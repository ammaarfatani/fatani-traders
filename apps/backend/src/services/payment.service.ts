import { prisma } from '../lib/prisma';
import { AppError } from '../middleware/errorHandler';
import { roundMoney } from '@fatani/shared';
import { logAudit } from '../middleware/audit';

export class PaymentService {
  private static async generatePaymentNumber(): Promise<string> {
    const today = new Date();
    const prefix = `PAY-${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}`;
    const count = await prisma.payment.count({
      where: {
        paymentNumber: {
          startsWith: prefix,
        },
      },
    });
    return `${prefix}-${String(count + 1).padStart(4, '0')}`;
  }

  static async recordCustomerPayment(data: {
    customerId: string;
    accountId?: string | null;
    amount: number;
    paymentDate: string | Date;
    referenceNumber?: string;
    notes?: string;
    saleId?: string | null;
    userId?: string;
  }) {
    if (data.amount <= 0) {
      throw new AppError('Payment amount must be greater than zero', 400);
    }

    const customer = await prisma.customer.findUnique({
      where: { id: data.customerId },
    });
    if (!customer) {
      throw new AppError('Customer not found', 404);
    }

    const account = data.accountId
      ? await prisma.financialAccount.findUnique({ where: { id: data.accountId } })
      : await prisma.financialAccount.findFirst();

    const paymentNumber = await this.generatePaymentNumber();

    const result = await prisma.$transaction(async (tx) => {
      // 1. Create Payment record
      const payment = await tx.payment.create({
        data: {
          paymentNumber,
          type: 'CUSTOMER_PAYMENT',
          customerId: customer.id,
          accountId: account ? account.id : null,
          amount: data.amount,
          paymentDate: new Date(data.paymentDate),
          referenceNumber: data.referenceNumber,
          notes: data.notes,
        },
      });

      // 2. Inflow into Financial Account if one exists
      let newAccBalance = 0;
      if (account) {
        newAccBalance = roundMoney(account.currentBalance + data.amount);
        await tx.financialAccount.update({
          where: { id: account.id },
          data: { currentBalance: newAccBalance },
        });

        await tx.financialTransaction.create({
          data: {
            accountId: account.id,
            type: 'INFLOW',
            amount: data.amount,
            balanceAfter: newAccBalance,
            referenceType: 'CUSTOMER_PAYMENT',
            referenceId: payment.id,
            date: new Date(data.paymentDate),
            description: `Payment received from customer ${customer.name}`,
          },
        });
      }

      // 3. Invoice Allocations (Specific or FIFO)
      let unallocated = data.amount;

      if (data.saleId) {
        // Specific invoice payment
        const sale = await tx.sale.findUnique({
          where: { id: data.saleId },
        });

        if (sale && sale.customerId === customer.id) {
          const allocAmount = Math.min(unallocated, sale.balanceAmount);
          if (allocAmount > 0) {
            await tx.paymentAllocation.create({
              data: {
                paymentId: payment.id,
                saleId: sale.id,
                amount: allocAmount,
              },
            });

            const newPaid = roundMoney(sale.paidAmount + allocAmount);
            const newBal = roundMoney(sale.balanceAmount - allocAmount);
            await tx.sale.update({
              where: { id: sale.id },
              data: {
                paidAmount: newPaid,
                balanceAmount: newBal,
                status: newBal === 0 ? 'COMPLETED' : 'PARTIAL',
              },
            });

            unallocated = roundMoney(unallocated - allocAmount);
          }
        }
      } else {
        // General customer payment: FIFO distribution across oldest unpaid invoices
        const unpaidSales = await tx.sale.findMany({
          where: {
            customerId: customer.id,
            balanceAmount: { gt: 0 },
          },
          orderBy: { invoiceDate: 'asc' },
        });

        for (const sale of unpaidSales) {
          if (unallocated <= 0) break;

          const allocAmount = Math.min(unallocated, sale.balanceAmount);
          await tx.paymentAllocation.create({
            data: {
              paymentId: payment.id,
              saleId: sale.id,
              amount: allocAmount,
            },
          });

          const newPaid = roundMoney(sale.paidAmount + allocAmount);
          const newBal = roundMoney(sale.balanceAmount - allocAmount);
          await tx.sale.update({
            where: { id: sale.id },
            data: {
              paidAmount: newPaid,
              balanceAmount: newBal,
              status: newBal === 0 ? 'COMPLETED' : 'PARTIAL',
            },
          });

          unallocated = roundMoney(unallocated - allocAmount);
        }
      }

      // 4. Update Customer Ledger
      const newCustomerBalance = roundMoney(customer.currentBalance - data.amount);
      await tx.customerLedgerEntry.create({
        data: {
          customerId: customer.id,
          date: new Date(data.paymentDate),
          type: 'PAYMENT',
          referenceNumber: paymentNumber,
          referenceId: payment.id,
          description: data.notes || (account ? `Payment received (${account.name})` : 'Payment received'),
          debit: 0,
          credit: data.amount,
          runningBalance: newCustomerBalance,
        },
      });

      await tx.customer.update({
        where: { id: customer.id },
        data: { currentBalance: newCustomerBalance },
      });

      return {
        payment,
        customerNewBalance: newCustomerBalance,
        accountNewBalance: newAccBalance,
        unallocatedAmount: unallocated,
      };
    });

    await logAudit(
      data.userId,
      'RECORD_CUSTOMER_PAYMENT',
      'Payment',
      result.payment.id,
      {
        paymentNumber,
        customerId: customer.id,
        amount: data.amount,
        account: account?.name || 'Direct',
      }
    );

    return result;
  }

  static async recordSupplierPayment(data: {
    supplierId: string;
    accountId?: string | null;
    amount: number;
    paymentDate: string | Date;
    referenceNumber?: string;
    notes?: string;
    purchaseId?: string | null;
    userId?: string;
  }) {
    if (data.amount <= 0) {
      throw new AppError('Payment amount must be greater than zero', 400);
    }

    const supplier = await prisma.supplier.findUnique({
      where: { id: data.supplierId },
    });
    if (!supplier) {
      throw new AppError('Supplier not found', 404);
    }

    const account = data.accountId
      ? await prisma.financialAccount.findUnique({ where: { id: data.accountId } })
      : await prisma.financialAccount.findFirst();

    const paymentNumber = await this.generatePaymentNumber();

    const result = await prisma.$transaction(async (tx) => {
      // 1. Create Payment record
      const payment = await tx.payment.create({
        data: {
          paymentNumber,
          type: 'SUPPLIER_PAYMENT',
          supplierId: supplier.id,
          accountId: account ? account.id : null,
          amount: data.amount,
          paymentDate: new Date(data.paymentDate),
          referenceNumber: data.referenceNumber,
          notes: data.notes,
        },
      });

      // 2. Outflow from Financial Account if one exists
      let newAccBalance = 0;
      if (account) {
        newAccBalance = roundMoney(account.currentBalance - data.amount);
        await tx.financialAccount.update({
          where: { id: account.id },
          data: { currentBalance: newAccBalance },
        });

        await tx.financialTransaction.create({
          data: {
            accountId: account.id,
            type: 'OUTFLOW',
            amount: data.amount,
            balanceAfter: newAccBalance,
            referenceType: 'SUPPLIER_PAYMENT',
            referenceId: payment.id,
            date: new Date(data.paymentDate),
            description: `Payment to supplier ${supplier.name}`,
          },
        });
      }

      // 3. Purchase Allocations (Specific or FIFO)
      let unallocated = data.amount;

      if (data.purchaseId) {
        const purchase = await tx.purchase.findUnique({
          where: { id: data.purchaseId },
        });

        if (purchase && purchase.supplierId === supplier.id) {
          const allocAmount = Math.min(unallocated, purchase.balanceAmount);
          if (allocAmount > 0) {
            await tx.paymentAllocation.create({
              data: {
                paymentId: payment.id,
                purchaseId: purchase.id,
                amount: allocAmount,
              },
            });

            const newPaid = roundMoney(purchase.paidAmount + allocAmount);
            const newBal = roundMoney(purchase.balanceAmount - allocAmount);
            await tx.purchase.update({
              where: { id: purchase.id },
              data: {
                paidAmount: newPaid,
                balanceAmount: newBal,
              },
            });

            unallocated = roundMoney(unallocated - allocAmount);
          }
        }
      } else {
        const unpaidPurchases = await tx.purchase.findMany({
          where: {
            supplierId: supplier.id,
            balanceAmount: { gt: 0 },
          },
          orderBy: { purchaseDate: 'asc' },
        });

        for (const pur of unpaidPurchases) {
          if (unallocated <= 0) break;

          const allocAmount = Math.min(unallocated, pur.balanceAmount);
          await tx.paymentAllocation.create({
            data: {
              paymentId: payment.id,
              purchaseId: pur.id,
              amount: allocAmount,
            },
          });

          const newPaid = roundMoney(pur.paidAmount + allocAmount);
          const newBal = roundMoney(pur.balanceAmount - allocAmount);
          await tx.purchase.update({
            where: { id: pur.id },
            data: {
              paidAmount: newPaid,
              balanceAmount: newBal,
            },
          });

          unallocated = roundMoney(unallocated - allocAmount);
        }
      }

      // 4. Update Supplier Ledger (Payment debits what we owe)
      const newSupplierBalance = roundMoney(supplier.currentBalance - data.amount);
      await tx.supplierLedgerEntry.create({
        data: {
          supplierId: supplier.id,
          date: new Date(data.paymentDate),
          type: 'PAYMENT',
          referenceNumber: paymentNumber,
          referenceId: payment.id,
          description: data.notes || (account ? `Payment made via ${account.name}` : 'Supplier payment'),
          debit: data.amount,
          credit: 0,
          runningBalance: newSupplierBalance,
        },
      });

      await tx.supplier.update({
        where: { id: supplier.id },
        data: { currentBalance: newSupplierBalance },
      });

      return {
        payment,
        supplierNewBalance: newSupplierBalance,
        accountNewBalance: newAccBalance,
        unallocatedAmount: unallocated,
      };
    });

    await logAudit(
      data.userId,
      'RECORD_SUPPLIER_PAYMENT',
      'Payment',
      result.payment.id,
      {
        paymentNumber,
        supplierId: supplier.id,
        amount: data.amount,
        account: account?.name || 'Direct',
      }
    );

    return result;
  }

  static async getPayments(page: number = 1, limit: number = 20, type?: string, search?: string) {
    const skip = (page - 1) * limit;
    const where: any = {};
    if (type && type !== 'ALL') where.type = type;

    if (search) {
      where.OR = [
        { paymentNumber: { contains: search, mode: 'insensitive' } },
        { referenceNumber: { contains: search, mode: 'insensitive' } },
        { customer: { name: { contains: search, mode: 'insensitive' } } },
        { supplier: { name: { contains: search, mode: 'insensitive' } } },
      ];
    }

    const [total, payments, receivedAgg, paidAgg] = await Promise.all([
      prisma.payment.count({ where }),
      prisma.payment.findMany({
        where,
        skip,
        take: limit,
        orderBy: { paymentDate: 'desc' },
        include: {
          customer: { select: { id: true, name: true, phone: true } },
          supplier: { select: { id: true, name: true, phone: true } },
          account: { select: { id: true, name: true, type: true } },
          allocations: {
            include: {
              sale: { select: { id: true, invoiceNumber: true } },
              purchase: { select: { id: true, purchaseNumber: true } },
            },
          },
        },
      }),
      prisma.payment.aggregate({
        where: { type: 'CUSTOMER_PAYMENT' },
        _sum: { amount: true },
      }),
      prisma.payment.aggregate({
        where: { type: 'SUPPLIER_PAYMENT' },
        _sum: { amount: true },
      }),
    ]);

    return {
      payments,
      summary: {
        totalReceived: roundMoney(receivedAgg._sum.amount || 0),
        totalPaid: roundMoney(paidAgg._sum.amount || 0),
      },
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}
