import { prisma } from '../lib/prisma';
import { AppError } from '../middleware/errorHandler';
import { roundMoney, gramsToKg } from '@fatani/shared';
import { logAudit } from '../middleware/audit';

export class ReturnsService {
  private static async generateSalesReturnNumber(): Promise<string> {
    const today = new Date();
    const prefix = `SR-${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}`;
    const count = await prisma.salesReturn.count({
      where: {
        returnNumber: {
          startsWith: prefix,
        },
      },
    });
    return `${prefix}-${String(count + 1).padStart(4, '0')}`;
  }

  private static async generatePurchaseReturnNumber(): Promise<string> {
    const today = new Date();
    const prefix = `PR-${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}`;
    const count = await prisma.purchaseReturn.count({
      where: {
        returnNumber: {
          startsWith: prefix,
        },
      },
    });
    return `${prefix}-${String(count + 1).padStart(4, '0')}`;
  }

  static async createSalesReturn(data: {
    saleId: string;
    customerId: string;
    returnDate: string | Date;
    items: Array<{
      saleItemId: string;
      lotId: string;
      returnedGrams: number;
      ratePerKg: number;
      isRestocked?: boolean;
    }>;
    refundAmount?: number;
    refundAccountId?: string | null;
    notes?: string;
    userId?: string;
  }) {
    const sale = await prisma.sale.findUnique({
      where: { id: data.saleId },
      include: { customer: true, items: true },
    });

    if (!sale) {
      throw new AppError('Sale invoice not found', 404);
    }

    if (sale.customerId !== data.customerId) {
      throw new AppError('Customer does not match sale invoice', 400);
    }

    const immediateRefund = Math.max(0, data.refundAmount || 0);
    if (immediateRefund > 0 && !data.refundAccountId) {
      throw new AppError('Refund financial account is required for cash refund', 400);
    }

    const returnNumber = await this.generateSalesReturnNumber();

    const result = await prisma.$transaction(async (tx) => {
      let totalRefundValue = 0;
      let totalCogsReversed = 0;

      const processedItems: Array<{
        saleItemId: string;
        lotId: string;
        grams: number;
        ratePerKg: number;
        costPerKg: number;
        refundAmount: number;
        isRestocked: boolean;
      }> = [];

      for (const item of data.items) {
        const saleItem = sale.items.find((si) => si.id === item.saleItemId);
        if (!saleItem) {
          throw new AppError(`Sale item ${item.saleItemId} not found on this invoice`, 400);
        }

        if (item.returnedGrams > saleItem.grams) {
          throw new AppError(
            `Cannot return more than originally sold. Sold: ${gramsToKg(saleItem.grams)} KG, Returned: ${gramsToKg(item.returnedGrams)} KG`,
            400
          );
        }

        const lot = await tx.purchaseLot.findUnique({
          where: { id: item.lotId },
        });
        if (!lot) {
          throw new AppError(`Lot ${item.lotId} not found`, 404);
        }

        const itemRefundAmount = roundMoney((item.returnedGrams / 1000) * item.ratePerKg);
        const itemCogsReversed = roundMoney((item.returnedGrams / 1000) * lot.landedCostPerKg);

        totalRefundValue = roundMoney(totalRefundValue + itemRefundAmount);
        totalCogsReversed = roundMoney(totalCogsReversed + itemCogsReversed);

        const isRestocked = item.isRestocked !== false;

        // If restocked into sellable stock, restore availableGrams and decrement soldGrams
        if (isRestocked) {
          const newAvail = lot.availableGrams + item.returnedGrams;
          const newSold = Math.max(0, lot.soldGrams - item.returnedGrams);
          await tx.purchaseLot.update({
            where: { id: lot.id },
            data: {
              availableGrams: newAvail,
              soldGrams: newSold,
              status: 'ACTIVE',
            },
          });

          await tx.inventoryMovement.create({
            data: {
              lotId: lot.id,
              type: 'SALES_RETURN',
              gramsChange: item.returnedGrams,
              resultingAvailableGrams: newAvail,
              referenceType: 'SALES_RETURN',
              referenceId: returnNumber,
              date: new Date(data.returnDate),
              notes: `Customer return restocked: ${gramsToKg(item.returnedGrams)} KG (Return #${returnNumber})`,
            },
          });
        } else {
          // Damaged/non-sellable return: track adjustment
          await tx.inventoryAdjustment.create({
            data: {
              lotId: lot.id,
              gramsChange: -item.returnedGrams,
              reason: `Damaged sales return from ${sale.customer.name} (Return #${returnNumber})`,
              date: new Date(data.returnDate),
              adjustedByUserId: data.userId,
            },
          });
        }

        processedItems.push({
          saleItemId: saleItem.id,
          lotId: lot.id,
          grams: item.returnedGrams,
          ratePerKg: item.ratePerKg,
          costPerKg: lot.landedCostPerKg,
          refundAmount: itemRefundAmount,
          isRestocked,
        });
      }

      // Create Sales Return record
      const salesReturn = await tx.salesReturn.create({
        data: {
          returnNumber,
          saleId: sale.id,
          customerId: sale.customerId,
          returnDate: new Date(data.returnDate),
          totalRefundAmount: totalRefundValue,
          totalCogsReversed,
          refundAccountId: data.refundAccountId || null,
          notes: data.notes,
        },
      });

      for (const pi of processedItems) {
        await tx.salesReturnItem.create({
          data: {
            salesReturnId: salesReturn.id,
            saleItemId: pi.saleItemId,
            lotId: pi.lotId,
            grams: pi.grams,
            ratePerKg: pi.ratePerKg,
            costPerKg: pi.costPerKg,
            refundAmount: pi.refundAmount,
            isRestocked: pi.isRestocked,
          },
        });
      }

      // Adjust customer Khata
      // Total return value credits customer balance (reducing debt or increasing advance)
      const customer = await tx.customer.findUnique({ where: { id: sale.customerId } });
      if (!customer) throw new AppError('Customer not found', 404);

      let customerNewBalance = roundMoney(customer.currentBalance - totalRefundValue);

      await tx.customerLedgerEntry.create({
        data: {
          customerId: customer.id,
          date: new Date(data.returnDate),
          type: 'RETURN',
          referenceNumber: returnNumber,
          referenceId: salesReturn.id,
          description: `Sales Return for Invoice #${sale.invoiceNumber}`,
          debit: 0,
          credit: totalRefundValue,
          runningBalance: customerNewBalance,
        },
      });

      // If immediate cash refund was paid to customer
      if (immediateRefund > 0 && data.refundAccountId) {
        const refundAccount = await tx.financialAccount.findUnique({
          where: { id: data.refundAccountId },
        });
        if (refundAccount) {
          const newAccBal = roundMoney(refundAccount.currentBalance - immediateRefund);
          await tx.financialAccount.update({
            where: { id: refundAccount.id },
            data: { currentBalance: newAccBal },
          });

          await tx.financialTransaction.create({
            data: {
              accountId: refundAccount.id,
              type: 'OUTFLOW',
              amount: immediateRefund,
              balanceAfter: newAccBal,
              referenceType: 'SALES_RETURN_REFUND',
              referenceId: salesReturn.id,
              date: new Date(data.returnDate),
              description: `Cash refund paid to customer ${customer.name} (Return #${returnNumber})`,
            },
          });

          // Also re-debit customer ledger for the cash disbursed
          customerNewBalance = roundMoney(customerNewBalance + immediateRefund);
          await tx.customerLedgerEntry.create({
            data: {
              customerId: customer.id,
              date: new Date(data.returnDate),
              type: 'PAYMENT',
              referenceNumber: returnNumber,
              referenceId: salesReturn.id,
              description: `Cash refund disbursed (${refundAccount.name})`,
              debit: immediateRefund,
              credit: 0,
              runningBalance: customerNewBalance,
            },
          });
        }
      }

      await tx.customer.update({
        where: { id: customer.id },
        data: { currentBalance: customerNewBalance },
      });

      return {
        salesReturn,
        totalRefundValue,
        totalCogsReversed,
        customerNewBalance,
      };
    });

    await logAudit(
      data.userId,
      'CREATE_SALES_RETURN',
      'SalesReturn',
      result.salesReturn.id,
      {
        returnNumber,
        saleInvoice: sale.invoiceNumber,
        totalRefundValue: result.totalRefundValue,
      }
    );

    return result;
  }

  static async createPurchaseReturn(data: {
    purchaseId: string;
    lotId: string;
    supplierId: string;
    returnDate: string | Date;
    returnedGrams: number;
    ratePerKg: number;
    refundReceived?: number;
    refundAccountId?: string | null;
    notes?: string;
    userId?: string;
  }) {
    const lot = await prisma.purchaseLot.findUnique({
      where: { id: data.lotId },
      include: { purchase: true },
    });

    if (!lot) {
      throw new AppError('Lot not found', 404);
    }

    if (lot.availableGrams < data.returnedGrams) {
      throw new AppError(
        `Cannot return more than available stock in lot. Available: ${gramsToKg(lot.availableGrams)} KG, Requested: ${gramsToKg(data.returnedGrams)} KG`,
        400
      );
    }

    const supplier = await prisma.supplier.findUnique({
      where: { id: data.supplierId },
    });
    if (!supplier) {
      throw new AppError('Supplier not found', 404);
    }

    const returnNumber = await this.generatePurchaseReturnNumber();
    const totalAmount = roundMoney((data.returnedGrams / 1000) * data.ratePerKg);
    const cashRefund = Math.max(0, data.refundReceived || 0);

    const result = await prisma.$transaction(async (tx) => {
      // 1. Deduct stock from lot
      const newAvail = lot.availableGrams - data.returnedGrams;
      const newStatus = newAvail === 0 ? 'DEPLETED' : 'ACTIVE';
      await tx.purchaseLot.update({
        where: { id: lot.id },
        data: {
          availableGrams: newAvail,
          returnedGrams: lot.returnedGrams + data.returnedGrams,
          status: newStatus,
        },
      });

      // 2. Inventory movement
      await tx.inventoryMovement.create({
        data: {
          lotId: lot.id,
          type: 'PURCHASE_RETURN',
          gramsChange: -data.returnedGrams,
          resultingAvailableGrams: newAvail,
          referenceType: 'PURCHASE_RETURN',
          referenceId: returnNumber,
          date: new Date(data.returnDate),
          notes: `Returned ${gramsToKg(data.returnedGrams)} KG to supplier ${supplier.name} (Return #${returnNumber})`,
        },
      });

      // 3. Create Purchase Return record
      const purchaseReturn = await tx.purchaseReturn.create({
        data: {
          returnNumber,
          purchaseId: lot.purchaseId,
          lotId: lot.id,
          supplierId: supplier.id,
          returnDate: new Date(data.returnDate),
          grams: data.returnedGrams,
          ratePerKg: data.ratePerKg,
          totalAmount,
          refundAccountId: data.refundAccountId || null,
          notes: data.notes,
        },
      });

      // 4. Update supplier ledger (Debit reduces what we owe)
      let supplierNewBalance = roundMoney(supplier.currentBalance - totalAmount);
      await tx.supplierLedgerEntry.create({
        data: {
          supplierId: supplier.id,
          date: new Date(data.returnDate),
          type: 'RETURN',
          referenceNumber: returnNumber,
          referenceId: purchaseReturn.id,
          description: `Purchase Return for Lot #${lot.lotNumber}`,
          debit: totalAmount,
          credit: 0,
          runningBalance: supplierNewBalance,
        },
      });

      // If cash refund received immediately from supplier
      if (cashRefund > 0 && data.refundAccountId) {
        const account = await tx.financialAccount.findUnique({
          where: { id: data.refundAccountId },
        });
        if (account) {
          const newAccBal = roundMoney(account.currentBalance + cashRefund);
          await tx.financialAccount.update({
            where: { id: account.id },
            data: { currentBalance: newAccBal },
          });

          await tx.financialTransaction.create({
            data: {
              accountId: account.id,
              type: 'INFLOW',
              amount: cashRefund,
              balanceAfter: newAccBal,
              referenceType: 'PURCHASE_RETURN_REFUND',
              referenceId: purchaseReturn.id,
              date: new Date(data.returnDate),
              description: `Cash refund received from supplier ${supplier.name} (Return #${returnNumber})`,
            },
          });

          // Credit supplier ledger for cash received
          supplierNewBalance = roundMoney(supplierNewBalance + cashRefund);
          await tx.supplierLedgerEntry.create({
            data: {
              supplierId: supplier.id,
              date: new Date(data.returnDate),
              type: 'PAYMENT',
              referenceNumber: returnNumber,
              referenceId: purchaseReturn.id,
              description: `Cash refund received into ${account.name}`,
              debit: 0,
              credit: cashRefund,
              runningBalance: supplierNewBalance,
            },
          });
        }
      }

      await tx.supplier.update({
        where: { id: supplier.id },
        data: { currentBalance: supplierNewBalance },
      });

      return {
        purchaseReturn,
        totalAmount,
        supplierNewBalance,
      };
    });

    await logAudit(
      data.userId,
      'CREATE_PURCHASE_RETURN',
      'PurchaseReturn',
      result.purchaseReturn.id,
      {
        returnNumber,
        lotNumber: lot.lotNumber,
        totalAmount,
      }
    );

    return result;
  }

  static async getSalesReturns(page: number = 1, limit: number = 20) {
    const skip = (page - 1) * limit;
    const [total, items] = await Promise.all([
      prisma.salesReturn.count(),
      prisma.salesReturn.findMany({
        skip,
        take: limit,
        orderBy: { returnDate: 'desc' },
        include: {
          customer: { select: { id: true, name: true, phone: true } },
          sale: { select: { id: true, invoiceNumber: true, invoiceDate: true } },
          items: true,
        },
      }),
    ]);

    return {
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  static async getPurchaseReturns(page: number = 1, limit: number = 20) {
    const skip = (page - 1) * limit;
    const [total, items] = await Promise.all([
      prisma.purchaseReturn.count(),
      prisma.purchaseReturn.findMany({
        skip,
        take: limit,
        orderBy: { returnDate: 'desc' },
        include: {
          supplier: { select: { id: true, name: true, phone: true } },
          purchase: { select: { id: true, purchaseNumber: true, purchaseDate: true } },
          lot: { select: { id: true, lotNumber: true, product: { select: { name: true } } } },
        },
      }),
    ]);

    return {
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}
