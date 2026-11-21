import { prisma } from '../lib/prisma';
import { AppError } from '../middleware/errorHandler';
import { roundMoney } from '@fatani/shared';
import { logAudit } from '../middleware/audit';

export class ExpenseService {
  private static businessDayStart(dateKey: string) {
    const start = new Date(`${dateKey}T00:00:00+05:00`);
    if (Number.isNaN(start.getTime())) throw new AppError('Invalid business date', 400);
    return start;
  }

  static async getOperatingExpenseAnalytics(startDate?: string, endDate?: string, categoryId?: string) {
    const businessDate = (date: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Karachi' }).format(date);
    const shiftDay = (key: string, amount: number) => {
      const value = new Date(`${key}T12:00:00Z`);
      value.setUTCDate(value.getUTCDate() + amount);
      return value.toISOString().slice(0, 10);
    };
    const today = businessDate(new Date());
    const selectedStart = startDate || `${today.slice(0, 7)}-01`;
    const selectedEnd = endDate || today;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(selectedStart) || !/^\d{4}-\d{2}-\d{2}$/.test(selectedEnd) || selectedStart > selectedEnd) {
      throw new AppError('Select a valid expense date range', 400);
    }
    const daysBetween = Math.ceil((this.businessDayStart(selectedEnd).getTime() - this.businessDayStart(selectedStart).getTime()) / 86400000) + 1;
    if (daysBetween > 366) throw new AppError('Expense analytics date range cannot exceed 366 days', 400);
    const start = this.businessDayStart(selectedStart);
    const end = this.businessDayStart(shiftDay(selectedEnd, 1));
    const selectedWhere: any = { date: { gte: start, lt: end } };
    if (categoryId) selectedWhere.categoryId = categoryId;

    const yesterday = shiftDay(today, -1);
    const weekday = new Date(`${today}T12:00:00+05:00`).getUTCDay();
    const weekStart = shiftDay(today, -((weekday + 6) % 7));
    const monthStart = `${today.slice(0, 7)}-01`;
    const monthLast = shiftDay(shiftDay(monthStart, 31).slice(0, 7) + '-01', -1);
    const periodTotal = (from: string, through: string) => prisma.expense.aggregate({
      where: { ...(categoryId ? { categoryId } : {}), date: { gte: this.businessDayStart(from), lt: this.businessDayStart(shiftDay(through, 1)) } },
      _sum: { amount: true },
    });
    const [todayAgg, yesterdayAgg, weekAgg, monthAgg, selectedAgg, rows, categoryAgg] = await Promise.all([
      periodTotal(today, today), periodTotal(yesterday, yesterday), periodTotal(weekStart, today),
      periodTotal(monthStart, monthLast), prisma.expense.aggregate({ where: selectedWhere, _sum: { amount: true } }),
      prisma.expense.findMany({ where: selectedWhere, select: { date: true, amount: true, categoryId: true } }),
      prisma.expense.groupBy({ by: ['categoryId'], where: selectedWhere, _sum: { amount: true }, _count: { _all: true } }),
    ]);
    const categoryIds = Array.from(new Set([...rows.map(row => row.categoryId), ...categoryAgg.map(row => row.categoryId)]));
    const categories = await prisma.expenseCategory.findMany({ where: { id: { in: categoryIds } }, select: { id: true, name: true } });
    const names = new Map(categories.map(category => [category.id, category.name]));
    const days = new Map<string, { date: string; total: number; count: number; categories: Map<string, number> }>();
    for (const row of rows) {
      const key = businessDate(row.date);
      const group = days.get(key) || { date: key, total: 0, count: 0, categories: new Map<string, number>() };
      group.total = roundMoney(group.total + row.amount);
      group.count++;
      group.categories.set(row.categoryId, roundMoney((group.categories.get(row.categoryId) || 0) + row.amount));
      days.set(key, group);
    }
    const categoryTotals = categoryAgg.map(row => ({ categoryId: row.categoryId, categoryName: names.get(row.categoryId) || 'Other', amount: roundMoney(row._sum.amount || 0), count: row._count._all }));
    return {
      timezone: 'Asia/Karachi',
      dateRange: { startDate: selectedStart, endDate: selectedEnd },
      summaries: {
        today: roundMoney(todayAgg._sum.amount || 0), yesterday: roundMoney(yesterdayAgg._sum.amount || 0),
        thisWeek: roundMoney(weekAgg._sum.amount || 0), thisMonth: roundMoney(monthAgg._sum.amount || 0),
        selectedPeriod: roundMoney(selectedAgg._sum.amount || 0),
      },
      categoryTotals,
      days: Array.from(days.values()).map(group => ({
        date: group.date, total: group.total, count: group.count,
        categories: Array.from(group.categories.entries()).map(([id, amount]) => ({ categoryId: id, categoryName: names.get(id) || 'Other', amount })),
      })).sort((a, b) => b.date.localeCompare(a.date)),
    };
  }

  private static async generateExpenseNumber(): Promise<string> {
    const today = new Date();
    const prefix = `EXP-${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}`;
    const count = await prisma.expense.count({
      where: {
        expenseNumber: {
          startsWith: prefix,
        },
      },
    });
    return `${prefix}-${String(count + 1).padStart(4, '0')}`;
  }

  static async getCategories() {
    return prisma.expenseCategory.findMany({
      orderBy: { name: 'asc' },
    });
  }

  static async createCategory(name: string, isCapitalizableDefault: boolean = false, description?: string) {
    const existing = await prisma.expenseCategory.findUnique({
      where: { name: name.trim() },
    });
    if (existing) {
      throw new AppError('Expense category already exists', 400);
    }

    return prisma.expenseCategory.create({
      data: {
        name: name.trim(),
        isCapitalizableDefault,
        description,
      },
    });
  }

  static async createOperatingExpense(data: {
    categoryId: string;
    title: string;
    amount: number;
    date: string | Date;
    accountId?: string | null;
    isPaid?: boolean;
    notes?: string;
    userId?: string;
  }) {
    if (data.amount <= 0) {
      throw new AppError('Expense amount must be greater than zero', 400);
    }

    const category = await prisma.expenseCategory.findUnique({
      where: { id: data.categoryId },
    });
    if (!category) {
      throw new AppError('Category not found', 404);
    }

    const isPaid = data.isPaid !== false;
    let account = null;
    if (isPaid) {
      account = data.accountId
        ? await prisma.financialAccount.findUnique({ where: { id: data.accountId } })
        : await prisma.financialAccount.findFirst();
    }

    const expenseNumber = await this.generateExpenseNumber();

    const result = await prisma.$transaction(async (tx) => {
      const expense = await tx.expense.create({
        data: {
          expenseNumber,
          categoryId: category.id,
          title: data.title.trim(),
          amount: data.amount,
          date: new Date(data.date),
          accountId: account?.id || null,
          isPaid,
          notes: data.notes,
        },
      });

      if (isPaid && account) {
        const newBal = roundMoney(account.currentBalance - data.amount);
        await tx.financialAccount.update({
          where: { id: account.id },
          data: { currentBalance: newBal },
        });

        await tx.financialTransaction.create({
          data: {
            accountId: account.id,
            type: 'OUTFLOW',
            amount: data.amount,
            balanceAfter: newBal,
            referenceType: 'OPERATING_EXPENSE',
            referenceId: expense.id,
            date: new Date(data.date),
            description: `Operating Expense: ${data.title} (${category.name})`,
          },
        });
      }

      return expense;
    });

    await logAudit(
      data.userId,
      'CREATE_OPERATING_EXPENSE',
      'Expense',
      result.id,
      {
        expenseNumber,
        category: category.name,
        amount: data.amount,
      }
    );

    return result;
  }

  static async getOperatingExpenses(
    page: number = 1,
    limit: number = 20,
    categoryId?: string,
    startDate?: string | Date,
    endDate?: string | Date
  ) {
    const skip = (page - 1) * limit;
    const where: any = {};

    if (categoryId) {
      where.categoryId = categoryId;
    }

    if (startDate || endDate) {
      where.date = {};
      if (startDate) where.date.gte = new Date(startDate);
      if (endDate) where.date.lte = new Date(endDate);
    }

    const [total, expenses] = await Promise.all([
      prisma.expense.count({ where }),
      prisma.expense.findMany({
        where,
        skip,
        take: limit,
        orderBy: { date: 'desc' },
        include: {
          category: true,
          account: true,
        },
      }),
    ]);

    return {
      expenses,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  static async getExpenseById(id: string) {
    const expense = await prisma.expense.findUnique({
      where: { id },
      include: {
        category: true,
        account: true,
      },
    });

    if (!expense) throw new AppError('Expense record not found', 404);
    return expense;
  }

  static async updateOperatingExpense(
    id: string,
    data: {
      categoryId?: string;
      title?: string;
      amount?: number;
      date?: string | Date;
      accountId?: string | null;
      isPaid?: boolean;
      notes?: string | null;
      userId?: string;
    }
  ) {
    const expense = await prisma.expense.findUnique({
      where: { id },
      include: { account: true, category: true },
    });

    if (!expense) throw new AppError('Expense record not found', 404);

    if ((data.accountId !== undefined && data.accountId !== expense.accountId) || (data.isPaid !== undefined && data.isPaid !== expense.isPaid)) throw new AppError('Payment status and linked account cannot be changed through an expense edit',400);
    if (data.categoryId && !(await prisma.expenseCategory.findUnique({where:{id:data.categoryId}}))) throw new AppError('Category not found',404);
    const oldAmount = expense.amount;
    const newAmount = data.amount !== undefined ? data.amount : oldAmount;
    if (newAmount <= 0) throw new AppError('Expense amount must be greater than zero', 400);

    const deltaAmount = roundMoney(newAmount - oldAmount);

    const result = await prisma.$transaction(async (tx) => {
      // If financial account was used and amount changed
      if (expense.isPaid && expense.accountId && deltaAmount !== 0) {
        const account = await tx.financialAccount.findUnique({ where: { id: expense.accountId } });
        if (account) {
          const newBal = roundMoney(account.currentBalance - deltaAmount);
          await tx.financialAccount.update({
            where: { id: account.id },
            data: { currentBalance: newBal },
          });

          await tx.financialTransaction.updateMany({
            where: { referenceId: expense.id, referenceType: 'OPERATING_EXPENSE' },
            data: {
              amount: newAmount,
              balanceAfter: newBal,
              date: data.date ? new Date(data.date) : expense.date,
            },
          });
        }
      }

      const updated = await tx.expense.update({
        where: { id },
        data: {
          categoryId: data.categoryId || expense.categoryId,
          title: data.title !== undefined ? data.title.trim() : expense.title,
          amount: newAmount,
          date: data.date ? new Date(data.date) : expense.date,
          accountId: data.accountId !== undefined ? data.accountId : expense.accountId,
          isPaid: data.isPaid !== undefined ? data.isPaid : expense.isPaid,
          notes: data.notes !== undefined ? data.notes : expense.notes,
        },
        include: {
          category: true,
          account: true,
        },
      });

      return updated;
    });

    await logAudit(data.userId, 'UPDATE_OPERATING_EXPENSE', 'Expense', expense.id, {
      expenseNumber: expense.expenseNumber,
      oldAmount,
      newAmount,
    });

    return result;
  }

  static async deleteOperatingExpense(id: string, userId?: string) {
    const expense = await prisma.expense.findUnique({
      where: { id },
      include: { account: true },
    });

    if (!expense) throw new AppError('Expense record not found', 404);

    const amount = expense.amount;

    await prisma.$transaction(async (tx) => {
      // Revert account balance if paid
      if (expense.isPaid && expense.accountId) {
        const account = await tx.financialAccount.findUnique({ where: { id: expense.accountId } });
        if (account) {
          const newBal = roundMoney(account.currentBalance + amount);
          await tx.financialAccount.update({
            where: { id: account.id },
            data: { currentBalance: newBal },
          });

          await tx.financialTransaction.deleteMany({
            where: { referenceId: expense.id, referenceType: 'OPERATING_EXPENSE' },
          });
        }
      }

      await tx.expense.delete({ where: { id } });
    });

    await logAudit(userId, 'DELETE_OPERATING_EXPENSE', 'Expense', expense.id, {
      expenseNumber: expense.expenseNumber,
      amount,
    });

    return { success: true, message: `Expense ${expense.expenseNumber} deleted successfully` };
  }

  static async updateCategory(id: string, name: string, description?: string) {
    const existing = await prisma.expenseCategory.findUnique({ where: { id } });
    if (!existing) throw new AppError('Expense category not found', 404);

    const duplicate = await prisma.expenseCategory.findFirst({
      where: { name: name.trim(), id: { not: id } },
    });
    if (duplicate) throw new AppError('Another category already has this name', 400);

    return prisma.expenseCategory.update({
      where: { id },
      data: {
        name: name.trim(),
        description: description !== undefined ? description : existing.description,
      },
    });
  }

  static async deleteCategory(id: string) {
    const count = await prisma.expense.count({ where: { categoryId: id } });
    if (count > 0) {
      throw new AppError(`Cannot delete category because ${count} expense(s) are recorded under it.`, 400);
    }
    await prisma.expenseCategory.delete({ where: { id } });
    return { success: true, message: 'Expense category deleted successfully' };
  }
}
