import { prisma } from '../lib/prisma';
import { AppError } from '../middleware/errorHandler';
import { roundMoney } from '@fatani/shared';
import { logAudit } from '../middleware/audit';

export class SupplierService {
  static async getSuppliers(search?: string) {
    const where: any = { isActive: true };

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { companyName: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } },
      ];
    }

    const suppliers = await prisma.supplier.findMany({
      where,
      orderBy: { name: 'asc' },
    });

    return suppliers;
  }

  static async getSupplierById(id: string) {
    const supplier = await prisma.supplier.findUnique({
      where: { id },
      include: {
        purchases: {
          orderBy: { purchaseDate: 'desc' },
          take: 10,
          include: {
            lots: { include: { product: true } },
          },
        },
        payments: {
          orderBy: { paymentDate: 'desc' },
          take: 10,
          include: { account: true },
        },
        purchaseReturns: {
          orderBy: { returnDate: 'desc' },
          take: 5,
        },
        ledgerEntries: {
          orderBy: { date: 'asc' },
        },
      },
    });

    if (!supplier) {
      throw new AppError('Supplier not found', 404);
    }

    const [purchasesAgg, paymentsAgg, returnsAgg] = await Promise.all([
      prisma.purchase.aggregate({
        where: { supplierId: id },
        _sum: { baseCost: true, paidAmount: true, balanceAmount: true },
      }),
      prisma.payment.aggregate({
        where: { supplierId: id },
        _sum: { amount: true },
      }),
      prisma.purchaseReturn.aggregate({
        where: { supplierId: id },
        _sum: { totalAmount: true },
      }),
    ]);

    const totalPurchased = roundMoney(purchasesAgg._sum.baseCost || 0);
    const totalPaymentsMade = roundMoney(paymentsAgg._sum.amount || 0);
    const totalReturns = roundMoney(returnsAgg._sum.totalAmount || 0);
    const currentPayable = roundMoney(supplier.currentBalance);

    return {
      ...supplier,
      summary: {
        totalPurchased,
        totalPaymentsMade,
        totalReturns,
        currentPayable: Math.max(0, currentPayable),
        advanceGiven: currentPayable < 0 ? Math.abs(currentPayable) : 0,
        netBalance: currentPayable,
      },
    };
  }

  static async createSupplier(data: {
    name: string;
    companyName?: string;
    phone: string;
    alternatePhone?: string;
    address?: string;
    openingBalance?: number;
    notes?: string;
    userId?: string;
  }) {
    const openingBal = roundMoney(data.openingBalance || 0);

    const supplier = await prisma.$transaction(async (tx) => {
      const created = await tx.supplier.create({
        data: {
          name: data.name.trim(),
          companyName: data.companyName?.trim(),
          phone: data.phone.trim(),
          alternatePhone: data.alternatePhone?.trim(),
          address: data.address?.trim(),
          openingBalance: openingBal,
          currentBalance: openingBal,
          notes: data.notes,
        },
      });

      if (openingBal !== 0) {
        await tx.supplierLedgerEntry.create({
          data: {
            supplierId: created.id,
            date: new Date(),
            type: 'ADJUSTMENT',
            referenceNumber: 'OPENING',
            description: 'Opening Balance',
            debit: openingBal < 0 ? Math.abs(openingBal) : 0,
            credit: openingBal > 0 ? openingBal : 0,
            runningBalance: openingBal,
          },
        });
      }

      return created;
    });

    await logAudit(data.userId, 'CREATE_SUPPLIER', 'Supplier', supplier.id, {
      name: supplier.name,
      phone: supplier.phone,
      openingBalance: openingBal,
    });

    return supplier;
  }

  static async updateSupplier(
    id: string,
    data: {
      name?: string;
      companyName?: string;
      phone?: string;
      alternatePhone?: string;
      address?: string;
      notes?: string;
      userId?: string;
    }
  ) {
    const supplier = await prisma.supplier.update({
      where: { id },
      data: {
        name: data.name?.trim(),
        companyName: data.companyName?.trim(),
        phone: data.phone?.trim(),
        alternatePhone: data.alternatePhone?.trim(),
        address: data.address?.trim(),
        notes: data.notes,
      },
    });

    await logAudit(data.userId, 'UPDATE_SUPPLIER', 'Supplier', supplier.id, data);
    return supplier;
  }

  static async getSupplierStatement(
    id: string,
    startDate?: string | Date,
    endDate?: string | Date
  ) {
    const supplier = await prisma.supplier.findUnique({
      where: { id },
    });

    if (!supplier) {
      throw new AppError('Supplier not found', 404);
    }

    const where: any = { supplierId: id };
    if (startDate || endDate) {
      where.date = {};
      if (startDate) where.date.gte = new Date(startDate);
      if (endDate) where.date.lte = new Date(endDate);
    }

    const entries = await prisma.supplierLedgerEntry.findMany({
      where,
      orderBy: { date: 'asc' },
    });

    const totalDebit = roundMoney(entries.reduce((acc, e) => acc + e.debit, 0));
    const totalCredit = roundMoney(entries.reduce((acc, e) => acc + e.credit, 0));

    return {
      supplier: {
        id: supplier.id,
        name: supplier.name,
        companyName: supplier.companyName,
        phone: supplier.phone,
        address: supplier.address,
        currentBalance: supplier.currentBalance,
      },
      dateRange: {
        startDate: startDate ? new Date(startDate).toISOString() : null,
        endDate: endDate ? new Date(endDate).toISOString() : null,
      },
      totals: {
        totalDebit,
        totalCredit,
        closingBalance: supplier.currentBalance,
      },
      entries,
    };
  }
}
