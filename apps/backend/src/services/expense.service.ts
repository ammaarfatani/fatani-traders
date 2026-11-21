import { prisma } from '../lib/prisma';
import { AppError } from '../middleware/errorHandler';
import { roundMoney } from '@fatani/shared';
import { logAudit } from '../middleware/audit';

export class ExpenseService {
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
