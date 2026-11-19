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
    if (isPaid && !data.accountId) {
      throw new AppError('Payment account is required for paid expense', 400);
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
          accountId: data.accountId || null,
          isPaid,
          notes: data.notes,
        },
      });

      if (isPaid && data.accountId) {
        const account = await tx.financialAccount.findUnique({
          where: { id: data.accountId },
        });
        if (!account) {
          throw new AppError('Payment account not found', 404);
        }

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
}
