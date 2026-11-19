import { prisma } from '../lib/prisma';
import { AppError } from '../middleware/errorHandler';
import { roundMoney } from '@fatani/shared';
import { logAudit } from '../middleware/audit';

export class CustomerService {
  static async getCustomers(search?: string) {
    const where: any = { isActive: true };

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { shopName: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } },
      ];
    }

    const customers = await prisma.customer.findMany({
      where,
      orderBy: { name: 'asc' },
    });

    return customers;
  }

  static async getCustomerById(id: string) {
    const customer = await prisma.customer.findUnique({
      where: { id },
      include: {
        sales: {
          orderBy: { invoiceDate: 'desc' },
          take: 10,
          include: {
            items: {
              include: { product: true },
            },
          },
        },
        payments: {
          orderBy: { paymentDate: 'desc' },
          take: 10,
          include: { account: true },
        },
        salesReturns: {
          orderBy: { returnDate: 'desc' },
          take: 5,
        },
        ledgerEntries: {
          orderBy: { date: 'asc' },
        },
      },
    });

    if (!customer) {
      throw new AppError('Customer not found', 404);
    }

    // Calculate aggregated metrics
    const [salesAgg, paymentsAgg, returnsAgg] = await Promise.all([
      prisma.sale.aggregate({
        where: { customerId: id },
        _sum: { grandTotal: true, paidAmount: true, balanceAmount: true },
      }),
      prisma.payment.aggregate({
        where: { customerId: id },
        _sum: { amount: true },
      }),
      prisma.salesReturn.aggregate({
        where: { customerId: id },
        _sum: { totalRefundAmount: true },
      }),
    ]);

    const totalInvoiced = roundMoney(salesAgg._sum.grandTotal || 0);
    const totalPaymentsReceived = roundMoney(paymentsAgg._sum.amount || 0);
    const totalReturns = roundMoney(returnsAgg._sum.totalRefundAmount || 0);
    const outstandingBalance = roundMoney(customer.currentBalance);
    const advanceBalance = outstandingBalance < 0 ? Math.abs(outstandingBalance) : 0;

    return {
      ...customer,
      summary: {
        totalInvoiced,
        totalPaymentsReceived,
        totalReturns,
        outstandingBalance: Math.max(0, outstandingBalance),
        advanceBalance,
        netBalance: outstandingBalance,
      },
    };
  }

  static async createCustomer(data: {
    name: string;
    shopName?: string;
    phone: string;
    alternatePhone?: string;
    address?: string;
    creditLimit?: number;
    openingBalance?: number;
    notes?: string;
    userId?: string;
  }) {
    const openingBal = roundMoney(data.openingBalance || 0);

    const customer = await prisma.$transaction(async (tx) => {
      const created = await tx.customer.create({
        data: {
          name: data.name.trim(),
          shopName: data.shopName?.trim(),
          phone: data.phone.trim(),
          alternatePhone: data.alternatePhone?.trim(),
          address: data.address?.trim(),
          creditLimit: data.creditLimit,
          openingBalance: openingBal,
          currentBalance: openingBal,
          notes: data.notes,
        },
      });

      if (openingBal !== 0) {
        await tx.customerLedgerEntry.create({
          data: {
            customerId: created.id,
            date: new Date(),
            type: 'ADJUSTMENT',
            referenceNumber: 'OPENING',
            description: 'Opening Balance',
            debit: openingBal > 0 ? openingBal : 0,
            credit: openingBal < 0 ? Math.abs(openingBal) : 0,
            runningBalance: openingBal,
          },
        });
      }

      return created;
    });

    await logAudit(data.userId, 'CREATE_CUSTOMER', 'Customer', customer.id, {
      name: customer.name,
      phone: customer.phone,
      openingBalance: openingBal,
    });

    return customer;
  }

  static async updateCustomer(
    id: string,
    data: {
      name?: string;
      shopName?: string;
      phone?: string;
      alternatePhone?: string;
      address?: string;
      creditLimit?: number;
      notes?: string;
      userId?: string;
    }
  ) {
    const customer = await prisma.customer.update({
      where: { id },
      data: {
        name: data.name?.trim(),
        shopName: data.shopName?.trim(),
        phone: data.phone?.trim(),
        alternatePhone: data.alternatePhone?.trim(),
        address: data.address?.trim(),
        creditLimit: data.creditLimit,
        notes: data.notes,
      },
    });

    await logAudit(data.userId, 'UPDATE_CUSTOMER', 'Customer', customer.id, data);
    return customer;
  }

  static async getCustomerStatement(
    id: string,
    startDate?: string | Date,
    endDate?: string | Date
  ) {
    const customer = await prisma.customer.findUnique({
      where: { id },
    });

    if (!customer) {
      throw new AppError('Customer not found', 404);
    }

    const where: any = { customerId: id };
    if (startDate || endDate) {
      where.date = {};
      if (startDate) where.date.gte = new Date(startDate);
      if (endDate) where.date.lte = new Date(endDate);
    }

    const entries = await prisma.customerLedgerEntry.findMany({
      where,
      orderBy: { date: 'asc' },
    });

    const totalDebit = roundMoney(entries.reduce((acc, e) => acc + e.debit, 0));
    const totalCredit = roundMoney(entries.reduce((acc, e) => acc + e.credit, 0));

    return {
      customer: {
        id: customer.id,
        name: customer.name,
        shopName: customer.shopName,
        phone: customer.phone,
        address: customer.address,
        currentBalance: customer.currentBalance,
      },
      dateRange: {
        startDate: startDate ? new Date(startDate).toISOString() : null,
        endDate: endDate ? new Date(endDate).toISOString() : null,
      },
      totals: {
        totalDebit,
        totalCredit,
        closingBalance: customer.currentBalance,
      },
      entries,
    };
  }
}
