import { prisma } from '../lib/prisma';
import { AppError } from '../middleware/errorHandler';
import {
  calculateLineTotal,
  calculateDiscountedTotal,
  roundMoney,
  gramsToKg,
  formatWeight,
  formatPKR,
} from '@fatani/shared';
import { logAudit } from '../middleware/audit';

export class SaleService {
  private static async generateInvoiceNumber(): Promise<string> {
    const today = new Date();
    const prefix = `INV-${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}`;
    const count = await prisma.sale.count({
      where: {
        invoiceNumber: {
          startsWith: prefix,
        },
      },
    });
    return `${prefix}-${String(count + 1).padStart(4, '0')}`;
  }

  static async createSale(data: {
    customerId: string;
    invoiceDate: string | Date;
    items: Array<{
      lotId: string;
      productId: string;
      totalGrams: number;
      sellingRatePerKg: number;
    }>;
    discount?: number;
    immediatePayment?: number;
    paymentAccountId?: string | null;
    notes?: string;
    userId?: string;
  }) {
    // 1. Verify customer
    const customer = await prisma.customer.findUnique({
      where: { id: data.customerId },
    });
    if (!customer || !customer.isActive) {
      throw new AppError('Customer is invalid or inactive', 400);
    }

    if (!data.items || data.items.length === 0) {
      throw new AppError('At least one fabric item is required for sale', 400);
    }

    const immediatePay = Math.max(0, data.immediatePayment || 0);

    const invoiceNumber = await this.generateInvoiceNumber();

    // 2. Fetch business settings & active invoice template for snapshot
    const [settings, template] = await Promise.all([
      prisma.businessSettings.findFirst(),
      prisma.invoiceTemplate.findFirst({ where: { isDefault: true } }),
    ]);

    // 3. Execute in MongoDB multi-document ACID transaction
    const result = await prisma.$transaction(async (tx) => {
      let subtotal = 0;
      let totalCogs = 0;
      const processedItems: Array<{
        lotId: string;
        productId: string;
        lotNumber: string;
        productName: string;
        grams: number;
        kg: number;
        ratePerKg: number;
        costPerKg: number;
        lineTotal: number;
        cogsTotal: number;
      }> = [];

      for (const item of data.items) {
        if (item.totalGrams <= 0) {
          throw new AppError('Item sold grams must be greater than zero', 400);
        }

        // Fetch lot with lock/latest data
        const lot = await tx.purchaseLot.findUnique({
          where: { id: item.lotId },
          include: { product: true },
        });

        if (!lot) {
          throw new AppError(`Lot ${item.lotId} not found`, 404);
        }

        if (lot.availableGrams < item.totalGrams) {
          const availableKg = gramsToKg(lot.availableGrams);
          const requestedKg = gramsToKg(item.totalGrams);
          throw new AppError(
            `Insufficient stock in Lot ${lot.lotNumber}. Available: ${availableKg} KG, Requested: ${requestedKg} KG`,
            400
          );
        }

        const lineTotal = calculateLineTotal(item.totalGrams, item.sellingRatePerKg);
        const cogsTotal = roundMoney((item.totalGrams / 1000) * lot.landedCostPerKg);

        subtotal = roundMoney(subtotal + lineTotal);
        totalCogs = roundMoney(totalCogs + cogsTotal);

        const newAvailableGrams = lot.availableGrams - item.totalGrams;
        const newSoldGrams = lot.soldGrams + item.totalGrams;
        const newStatus = newAvailableGrams === 0 ? 'DEPLETED' : 'ACTIVE';

        // Decrement stock atomically
        await tx.purchaseLot.update({
          where: { id: lot.id },
          data: {
            availableGrams: newAvailableGrams,
            soldGrams: newSoldGrams,
            status: newStatus,
          },
        });

        // Record stock movement
        await tx.inventoryMovement.create({
          data: {
            lotId: lot.id,
            type: 'SALE',
            gramsChange: -item.totalGrams,
            resultingAvailableGrams: newAvailableGrams,
            referenceType: 'SALE',
            referenceId: invoiceNumber,
            date: new Date(data.invoiceDate),
            notes: `Sold ${gramsToKg(item.totalGrams)} KG to ${customer.name} (Inv #${invoiceNumber})`,
          },
        });

        processedItems.push({
          lotId: lot.id,
          productId: lot.productId,
          lotNumber: lot.lotNumber,
          productName: lot.product.name,
          grams: item.totalGrams,
          kg: gramsToKg(item.totalGrams),
          ratePerKg: item.sellingRatePerKg,
          costPerKg: lot.landedCostPerKg,
          lineTotal,
          cogsTotal,
        });
      }

      const discount = Math.max(0, data.discount || 0);
      const grandTotal = calculateDiscountedTotal(subtotal, discount);

      if (immediatePay > grandTotal) {
        throw new AppError('Immediate payment cannot exceed invoice grand total', 400);
      }

      const balanceAmount = roundMoney(grandTotal - immediatePay);
      const grossProfit = roundMoney(grandTotal - totalCogs);

      // Create static snapshot of invoice
      const invoiceSnapshot = {
        invoiceNumber,
        invoiceDate: new Date(data.invoiceDate).toISOString(),
        customer: {
          id: customer.id,
          name: customer.name,
          shopName: customer.shopName,
          phone: customer.phone,
          address: customer.address,
          previousBalance: customer.currentBalance,
        },
        business: {
          name: settings?.businessName || 'Fatani Traders',
          tagline: settings?.tagline,
          phone: settings?.phone,
          address: settings?.address,
          ntn: settings?.ntnOrTaxNumber,
        },
        template: {
          footerText: template?.footerText,
          termsAndConditions: template?.termsAndConditions,
          primaryColor: template?.primaryColor || '#0f172a',
          showPreviousBalance: template?.showPreviousBalance ?? true,
          showTotalOutstanding: template?.showTotalOutstanding ?? true,
        },
        items: processedItems.map((pi) => ({
          lotNumber: pi.lotNumber,
          productName: pi.productName,
          grams: pi.grams,
          kg: pi.kg,
          ratePerKg: pi.ratePerKg,
          lineTotal: pi.lineTotal,
          formattedWeight: formatWeight(pi.grams),
          formattedLineTotal: formatPKR(pi.lineTotal),
        })),
        subtotal,
        discount,
        grandTotal,
        immediatePayment: immediatePay,
        balanceAmount,
        notes: data.notes,
        createdAt: new Date().toISOString(),
      };

      // Create Sale
      const sale = await tx.sale.create({
        data: {
          invoiceNumber,
          customerId: customer.id,
          invoiceDate: new Date(data.invoiceDate),
          subtotal,
          discount,
          grandTotal,
          paidAmount: immediatePay,
          balanceAmount,
          totalCogs,
          grossProfit,
          status: balanceAmount === 0 ? 'COMPLETED' : immediatePay > 0 ? 'PARTIAL' : 'UNPAID',
          notes: data.notes,
          invoiceSnapshot,
        },
      });

      // Create Sale Items
      for (const pi of processedItems) {
        await tx.saleItem.create({
          data: {
            saleId: sale.id,
            lotId: pi.lotId,
            productId: pi.productId,
            grams: pi.grams,
            ratePerKg: pi.ratePerKg,
            costPerKg: pi.costPerKg,
            lineTotal: pi.lineTotal,
            cogsTotal: pi.cogsTotal,
          },
        });
      }

      // Handle immediate payment
      if (immediatePay > 0) {
        const payAccount = data.paymentAccountId
          ? await tx.financialAccount.findUnique({ where: { id: data.paymentAccountId } })
          : await tx.financialAccount.findFirst();

        let newAccountBalance = 0;
        if (payAccount) {
          newAccountBalance = roundMoney(payAccount.currentBalance + immediatePay);
          await tx.financialAccount.update({
            where: { id: payAccount.id },
            data: { currentBalance: newAccountBalance },
          });
        }

        const paymentNumber = `PAY-${Date.now()}`;
        const payment = await tx.payment.create({
          data: {
            paymentNumber,
            type: 'CUSTOMER_PAYMENT',
            customerId: customer.id,
            accountId: payAccount ? payAccount.id : null,
            amount: immediatePay,
            paymentDate: new Date(data.invoiceDate),
            referenceNumber: invoiceNumber,
            notes: `Immediate payment for invoice ${invoiceNumber}`,
          },
        });

        await tx.paymentAllocation.create({
          data: {
            paymentId: payment.id,
            saleId: sale.id,
            amount: immediatePay,
          },
        });

        if (payAccount) {
          await tx.financialTransaction.create({
            data: {
              accountId: payAccount.id,
              type: 'INFLOW',
              amount: immediatePay,
              balanceAfter: newAccountBalance,
              referenceType: 'CUSTOMER_PAYMENT',
              referenceId: payment.id,
              date: new Date(data.invoiceDate),
              description: `Payment received from customer ${customer.name} for ${invoiceNumber}`,
            },
          });
        }
      }

      // Update Customer Ledger
      // 1. Invoice increases balance (Debit)
      const balanceAfterInvoice = roundMoney(customer.currentBalance + grandTotal);
      await tx.customerLedgerEntry.create({
        data: {
          customerId: customer.id,
          date: new Date(data.invoiceDate),
          type: 'INVOICE',
          referenceNumber: invoiceNumber,
          referenceId: sale.id,
          description: `Sale Invoice #${invoiceNumber}`,
          debit: grandTotal,
          credit: 0,
          runningBalance: balanceAfterInvoice,
        },
      });

      // 2. Immediate payment decreases balance (Credit)
      let finalCustomerBalance = balanceAfterInvoice;
      if (immediatePay > 0) {
        finalCustomerBalance = roundMoney(balanceAfterInvoice - immediatePay);
        await tx.customerLedgerEntry.create({
          data: {
            customerId: customer.id,
            date: new Date(data.invoiceDate),
            type: 'PAYMENT',
            referenceNumber: invoiceNumber,
            referenceId: sale.id,
            description: `Immediate payment for Invoice #${invoiceNumber}`,
            debit: 0,
            credit: immediatePay,
            runningBalance: finalCustomerBalance,
          },
        });
      }

      await tx.customer.update({
        where: { id: customer.id },
        data: { currentBalance: finalCustomerBalance },
      });

      return {
        sale,
        items: processedItems,
        previousBalance: customer.currentBalance,
        newBalance: finalCustomerBalance,
      };
    });

    await logAudit(
      data.userId,
      'CREATE_SALE',
      'Sale',
      result.sale.id,
      {
        invoiceNumber,
        customerId: customer.id,
        grandTotal: result.sale.grandTotal,
        grossProfit: result.sale.grossProfit,
      }
    );

    return result;
  }

  static async getSales(page: number = 1, limit: number = 20, search?: string) {
    const skip = (page - 1) * limit;
    const where: any = {};

    if (search) {
      where.OR = [
        { invoiceNumber: { contains: search, mode: 'insensitive' } },
        { customer: { name: { contains: search, mode: 'insensitive' } } },
        { customer: { phone: { contains: search, mode: 'insensitive' } } },
      ];
    }

    const [total, sales, summaryAgg] = await Promise.all([
      prisma.sale.count({ where }),
      prisma.sale.findMany({
        where,
        skip,
        take: limit,
        orderBy: { invoiceDate: 'desc' },
        include: {
          customer: { select: { id: true, name: true, phone: true, currentBalance: true } },
          items: {
            include: {
              product: { select: { id: true, name: true } },
              lot: { select: { id: true, lotNumber: true } },
            },
          },
        },
      }),
      prisma.sale.aggregate({
        where,
        _sum: { grandTotal: true, paidAmount: true, balanceAmount: true },
      }),
    ]);

    return {
      sales,
      summary: {
        totalSales: roundMoney(summaryAgg._sum.grandTotal || 0),
        totalPaid: roundMoney(summaryAgg._sum.paidAmount || 0),
        totalBalance: roundMoney(summaryAgg._sum.balanceAmount || 0),
      },
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  static async getSaleById(id: string) {
    const sale = await prisma.sale.findUnique({
      where: { id },
      include: {
        customer: true,
        items: {
          include: {
            product: { include: { category: true } },
            lot: true,
          },
        },
        paymentAllocations: {
          include: {
            payment: {
              include: { account: true },
            },
          },
        },
        salesReturns: {
          include: {
            items: true,
          },
        },
      },
    });

    if (!sale) {
      throw new AppError('Sale invoice not found', 404);
    }

    return sale;
  }
}
