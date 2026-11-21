import { prisma } from '../lib/prisma';
import { AppError } from '../middleware/errorHandler';
import { roundMoney } from '@fatani/shared';
import { logAudit } from '../middleware/audit';

export class AccountService {
  static async getAccounts() {
    return prisma.financialAccount.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    });
  }

  static async getAccountById(id: string) {
    const account = await prisma.financialAccount.findUnique({
      where: { id },
      include: {
        transactions: {
          orderBy: { date: 'desc' },
          take: 50,
        },
      },
    });

    if (!account) {
      throw new AppError('Account not found', 404);
    }

    return account;
  }

  static async createAccount(data: {
    name: string;
    type: string;
    accountNumber?: string;
    bankName?: string;
    openingBalance?: number;
    notes?: string;
    userId?: string;
  }) {
    const openingBal = roundMoney(data.openingBalance || 0);

    const account = await prisma.financialAccount.create({
      data: {
        name: data.name.trim(),
        type: data.type,
        accountNumber: data.accountNumber?.trim(),
        bankName: data.bankName?.trim(),
        openingBalance: openingBal,
        currentBalance: openingBal,
        notes: data.notes,
      },
    });

    if (openingBal > 0) {
      await prisma.financialTransaction.create({
        data: {
          accountId: account.id,
          type: 'INFLOW',
          amount: openingBal,
          balanceAfter: openingBal,
          referenceType: 'OPENING_BALANCE',
          description: 'Account Opening Balance',
        },
      });
    }

    await logAudit(data.userId, 'CREATE_ACCOUNT', 'FinancialAccount', account.id, {
      name: account.name,
      type: account.type,
      openingBalance: openingBal,
    });

    return account;
  }

  static async transferFunds(data: {
    fromAccountId: string;
    toAccountId: string;
    amount: number;
    date: string | Date;
    notes?: string;
    userId?: string;
  }) {
    if (data.fromAccountId === data.toAccountId) {
      throw new AppError('Source and destination accounts must be different', 400);
    }

    if (data.amount <= 0) {
      throw new AppError('Transfer amount must be greater than zero', 400);
    }

    const [fromAccount, toAccount] = await Promise.all([
      prisma.financialAccount.findUnique({ where: { id: data.fromAccountId } }),
      prisma.financialAccount.findUnique({ where: { id: data.toAccountId } }),
    ]);

    if (!fromAccount || !toAccount) {
      throw new AppError('One or both accounts could not be found', 404);
    }

    const result = await prisma.$transaction(async (tx) => {
      const fromNewBalance = roundMoney(fromAccount.currentBalance - data.amount);
      const toNewBalance = roundMoney(toAccount.currentBalance + data.amount);

      await tx.financialAccount.update({
        where: { id: fromAccount.id },
        data: { currentBalance: fromNewBalance },
      });

      await tx.financialAccount.update({
        where: { id: toAccount.id },
        data: { currentBalance: toNewBalance },
      });

      const transferRef = `TRF-${Date.now()}`;

      // Outflow on source account
      await tx.financialTransaction.create({
        data: {
          accountId: fromAccount.id,
          type: 'TRANSFER',
          amount: data.amount,
          balanceAfter: fromNewBalance,
          referenceType: 'CONTRA_TRANSFER',
          referenceId: transferRef,
          date: new Date(data.date),
          description: `Internal Transfer to ${toAccount.name}${data.notes ? ` - ${data.notes}` : ''}`,
        },
      });

      // Inflow on destination account
      await tx.financialTransaction.create({
        data: {
          accountId: toAccount.id,
          type: 'TRANSFER',
          amount: data.amount,
          balanceAfter: toNewBalance,
          referenceType: 'CONTRA_TRANSFER',
          referenceId: transferRef,
          date: new Date(data.date),
          description: `Internal Transfer from ${fromAccount.name}${data.notes ? ` - ${data.notes}` : ''}`,
        },
      });

      return {
        transferRef,
        fromAccount: { id: fromAccount.id, name: fromAccount.name, balance: fromNewBalance },
        toAccount: { id: toAccount.id, name: toAccount.name, balance: toNewBalance },
        amount: data.amount,
      };
    });

    await logAudit(
      data.userId,
      'TRANSFER_FUNDS',
      'FinancialTransaction',
      result.transferRef,
      {
        from: fromAccount.name,
        to: toAccount.name,
        amount: data.amount,
      }
    );

    return result;
  }

  static async updateAccount(
    id: string,
    data: {
      name?: string;
      type?: string;
      accountNumber?: string;
      bankName?: string;
      notes?: string;
      isActive?: boolean;
      userId?: string;
    }
  ) {
    const account = await prisma.financialAccount.update({
      where: { id },
      data: {
        name: data.name?.trim(),
        type: data.type,
        accountNumber: data.accountNumber?.trim(),
        bankName: data.bankName?.trim(),
        notes: data.notes,
        isActive: data.isActive,
      },
    });

    await logAudit(data.userId, 'UPDATE_ACCOUNT', 'FinancialAccount', account.id, data);
    return account;
  }

  static async deleteAccount(id: string, userId?: string) {
    const account = await prisma.financialAccount.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            transactions: true,
            payments: true,
            lotExpenses: true,
            operatingExpenses: true,
          },
        },
      },
    });

    if (!account) throw new AppError('Account not found', 404);

    const { transactions, payments, lotExpenses, operatingExpenses } = account._count;
    if (transactions > 0 || payments > 0 || lotExpenses > 0 || operatingExpenses > 0) {
      throw new AppError(
        `Cannot delete account "${account.name}" because it has ${transactions} transaction(s). Please deactivate the account instead.`,
        400
      );
    }

    await prisma.financialAccount.delete({ where: { id } });
    await logAudit(userId, 'DELETE_ACCOUNT', 'FinancialAccount', id, { name: account.name });
    return { success: true, message: `Account "${account.name}" deleted successfully` };
  }
}
