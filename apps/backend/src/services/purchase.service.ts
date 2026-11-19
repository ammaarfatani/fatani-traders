import { prisma } from '../lib/prisma';
import { AppError } from '../middleware/errorHandler';
import {
  kgAndGramsToGrams,
  calculateLandedCost,
  recalculateLotCostWithAdjustment,
  roundMoney,
} from '@fatani/shared';
import { logAudit } from '../middleware/audit';

export class PurchaseService {
  private static async generatePurchaseNumber(): Promise<string> {
    const today = new Date();
    const prefix = `PUR-${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}`;
    const count = await prisma.purchase.count({
      where: {
        purchaseNumber: {
          startsWith: prefix,
        },
      },
    });
    return `${prefix}-${String(count + 1).padStart(4, '0')}`;
  }

  private static async generateLotNumber(): Promise<string> {
    const today = new Date();
    const prefix = `LOT-${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}`;
    const count = await prisma.purchaseLot.count({
      where: {
        lotNumber: {
          startsWith: prefix,
        },
      },
    });
    return `${prefix}-${String(count + 1).padStart(4, '0')}`;
  }

  static async createPurchase(data: {
    supplierId: string;
    productId: string;
    purchaseDate: string | Date;
    invoiceRefNumber?: string;
    weightKg: number;
    weightGrams?: number;
    purchaseRatePerKg: number;
    expenses?: Array<{
      category: string;
      customName?: string;
      amount: number;
      isCapitalized?: boolean;
      isPaid?: boolean;
      paymentAccountId?: string | null;
      date?: string | Date;
      notes?: string;
    }>;
    supplierPaymentAmount?: number;
    paymentAccountId?: string | null;
    notes?: string;
    userId?: string;
  }) {
    // 1. Verify supplier & product
    const supplier = await prisma.supplier.findUnique({
      where: { id: data.supplierId },
    });
    if (!supplier || !supplier.isActive) {
      throw new AppError('Selected supplier is invalid or inactive', 400);
    }

    const product = await prisma.product.findUnique({
      where: { id: data.productId },
      include: { category: true },
    });
    if (!product || !product.isActive) {
      throw new AppError('Selected product is invalid or inactive', 400);
    }

    // 2. Weight in integer grams
    const totalGrams = kgAndGramsToGrams(data.weightKg, data.weightGrams || 0);
    if (totalGrams <= 0) {
      throw new AppError('Total purchased weight must be greater than zero', 400);
    }

    // 3. Landed Cost Calculation
    const landedCost = calculateLandedCost(
      totalGrams,
      data.purchaseRatePerKg,
      data.expenses || []
    );

    const purchaseNumber = await this.generatePurchaseNumber();
    const lotNumber = await this.generateLotNumber();

    const supplierPayment = Math.max(0, data.supplierPaymentAmount || 0);
    if (supplierPayment > 0 && !data.paymentAccountId) {
      throw new AppError('Payment account is required when recording immediate supplier payment', 400);
    }

    if (supplierPayment > landedCost.basePurchaseCost) {
      throw new AppError('Immediate payment cannot exceed base purchase cost', 400);
    }

    const purchaseBalance = roundMoney(landedCost.basePurchaseCost - supplierPayment);

    // 4. Transactional execution
    const result = await prisma.$transaction(async (tx) => {
      // 4.1 Create Purchase
      const purchase = await tx.purchase.create({
        data: {
          purchaseNumber,
          supplierId: data.supplierId,
          purchaseDate: new Date(data.purchaseDate),
          invoiceRefNumber: data.invoiceRefNumber,
          baseCost: landedCost.basePurchaseCost,
          totalExpenses: landedCost.totalAdditionalExpenses,
          totalLandedCost: landedCost.totalLandedCost,
          paidAmount: supplierPayment,
          balanceAmount: purchaseBalance,
          notes: data.notes,
        },
      });

      // 4.2 Create Purchase Lot
      const lot = await tx.purchaseLot.create({
        data: {
          lotNumber,
          purchaseId: purchase.id,
          productId: data.productId,
          purchasedGrams: totalGrams,
          availableGrams: totalGrams,
          soldGrams: 0,
          returnedGrams: 0,
          adjustedGrams: 0,
          purchaseRatePerKg: data.purchaseRatePerKg,
          landedCostPerKg: landedCost.actualCostPerKg,
          status: 'ACTIVE',
        },
      });

      // 4.3 Create Lot Expenses
      if (data.expenses && data.expenses.length > 0) {
        for (const exp of data.expenses) {
          if (exp.amount > 0) {
            const lotExp = await tx.lotExpense.create({
              data: {
                purchaseId: purchase.id,
                lotId: lot.id,
                category: exp.category,
                customName: exp.customName,
                amount: exp.amount,
                isCapitalized: exp.isCapitalized !== false,
                isPaid: exp.isPaid || false,
                paymentAccountId: exp.paymentAccountId || null,
                date: exp.date ? new Date(exp.date) : new Date(data.purchaseDate),
                notes: exp.notes,
              },
            });

            // If expense is paid immediately from an account
            if (exp.isPaid && exp.paymentAccountId) {
              const account = await tx.financialAccount.findUnique({
                where: { id: exp.paymentAccountId },
              });
              if (account) {
                const newBalance = roundMoney(account.currentBalance - exp.amount);
                await tx.financialAccount.update({
                  where: { id: account.id },
                  data: { currentBalance: newBalance },
                });

                await tx.financialTransaction.create({
                  data: {
                    accountId: account.id,
                    type: 'OUTFLOW',
                    amount: exp.amount,
                    balanceAfter: newBalance,
                    referenceType: 'LOT_EXPENSE',
                    referenceId: lotExp.id,
                    date: new Date(exp.date || data.purchaseDate),
                    description: `Landed Expense: ${exp.category} for Lot ${lotNumber}`,
                  },
                });
              }
            }
          }
        }
      }

      // 4.4 Record Inventory Movement
      await tx.inventoryMovement.create({
        data: {
          lotId: lot.id,
          type: 'PURCHASE',
          gramsChange: totalGrams,
          resultingAvailableGrams: totalGrams,
          referenceType: 'PURCHASE',
          referenceId: purchase.id,
          date: new Date(data.purchaseDate),
          notes: `Purchase ${purchaseNumber} - ${data.weightKg} KG at PKR ${data.purchaseRatePerKg}/KG`,
        },
      });

      // 4.5 Handle Immediate Supplier Payment
      if (supplierPayment > 0 && data.paymentAccountId) {
        const payAccount = await tx.financialAccount.findUnique({
          where: { id: data.paymentAccountId },
        });
        if (!payAccount) {
          throw new AppError('Payment account not found', 404);
        }

        const newAccBalance = roundMoney(payAccount.currentBalance - supplierPayment);
        await tx.financialAccount.update({
          where: { id: payAccount.id },
          data: { currentBalance: newAccBalance },
        });

        const paymentNumber = `PAY-${Date.now()}`;
        const payment = await tx.payment.create({
          data: {
            paymentNumber,
            type: 'SUPPLIER_PAYMENT',
            supplierId: data.supplierId,
            accountId: payAccount.id,
            amount: supplierPayment,
            paymentDate: new Date(data.purchaseDate),
            referenceNumber: purchaseNumber,
            notes: `Immediate payment for purchase ${purchaseNumber}`,
          },
        });

        await tx.paymentAllocation.create({
          data: {
            paymentId: payment.id,
            purchaseId: purchase.id,
            amount: supplierPayment,
          },
        });

        await tx.financialTransaction.create({
          data: {
            accountId: payAccount.id,
            type: 'OUTFLOW',
            amount: supplierPayment,
            balanceAfter: newAccBalance,
            referenceType: 'SUPPLIER_PAYMENT',
            referenceId: payment.id,
            date: new Date(data.purchaseDate),
            description: `Payment to supplier ${supplier.name} for ${purchaseNumber}`,
          },
        });
      }

      // 4.6 Update Supplier Ledger & Current Balance
      // Purchase increases payable to supplier by base cost
      const balanceAfterPurchase = roundMoney(supplier.currentBalance + landedCost.basePurchaseCost);
      await tx.supplierLedgerEntry.create({
        data: {
          supplierId: supplier.id,
          date: new Date(data.purchaseDate),
          type: 'PURCHASE',
          referenceNumber: purchaseNumber,
          referenceId: purchase.id,
          description: `Purchase of ${product.name} (${data.weightKg} KG @ ${data.purchaseRatePerKg}/KG)`,
          debit: 0,
          credit: landedCost.basePurchaseCost,
          runningBalance: balanceAfterPurchase,
        },
      });

      let finalSupplierBalance = balanceAfterPurchase;
      if (supplierPayment > 0) {
        finalSupplierBalance = roundMoney(balanceAfterPurchase - supplierPayment);
        await tx.supplierLedgerEntry.create({
          data: {
            supplierId: supplier.id,
            date: new Date(data.purchaseDate),
            type: 'PAYMENT',
            referenceNumber: purchaseNumber,
            referenceId: purchase.id,
            description: `Immediate payment via account for ${purchaseNumber}`,
            debit: supplierPayment,
            credit: 0,
            runningBalance: finalSupplierBalance,
          },
        });
      }

      await tx.supplier.update({
        where: { id: supplier.id },
        data: { currentBalance: finalSupplierBalance },
      });

      return {
        purchase,
        lot,
        landedCost,
      };
    });

    await logAudit(
      data.userId,
      'CREATE_PURCHASE',
      'Purchase',
      result.purchase.id,
      {
        purchaseNumber,
        lotNumber,
        totalGrams,
        totalLandedCost: landedCost.totalLandedCost,
        actualCostPerKg: landedCost.actualCostPerKg,
      }
    );

    return result;
  }

  static async addPostPurchaseExpense(data: {
    lotId: string;
    category: string;
    customName?: string;
    amount: number;
    isCapitalized?: boolean;
    isPaid?: boolean;
    paymentAccountId?: string | null;
    date: string | Date;
    notes?: string;
    userId?: string;
  }) {
    const lot = await prisma.purchaseLot.findUnique({
      where: { id: data.lotId },
      include: { purchase: true, expenses: true },
    });

    if (!lot) {
      throw new AppError('Purchase lot not found', 404);
    }

    if (data.amount <= 0) {
      throw new AppError('Expense amount must be greater than zero', 400);
    }

    if (data.isPaid && !data.paymentAccountId) {
      throw new AppError('Payment account is required for paid expense', 400);
    }

    const isCapitalized = data.isCapitalized !== false;
    const oldCostPerKg = lot.landedCostPerKg;

    const result = await prisma.$transaction(async (tx) => {
      // 1. Create Lot Expense
      const expense = await tx.lotExpense.create({
        data: {
          purchaseId: lot.purchaseId,
          lotId: lot.id,
          category: data.category,
          customName: data.customName,
          amount: data.amount,
          isCapitalized,
          isPaid: data.isPaid || false,
          paymentAccountId: data.paymentAccountId || null,
          date: new Date(data.date),
          notes: data.notes,
        },
      });

      // 2. If capitalized, update lot landed cost and create CostAdjustment record
      let newCostPerKg = oldCostPerKg;
      let newTotalLandedCost = lot.purchase.totalLandedCost;

      if (isCapitalized) {
        const recalc = recalculateLotCostWithAdjustment(
          lot.purchasedGrams,
          lot.purchase.totalLandedCost,
          data.amount
        );
        newCostPerKg = recalc.newCostPerKg;
        newTotalLandedCost = recalc.newTotalLandedCost;

        await tx.purchaseLot.update({
          where: { id: lot.id },
          data: { landedCostPerKg: newCostPerKg },
        });

        await tx.purchase.update({
          where: { id: lot.purchaseId },
          data: {
            totalExpenses: roundMoney(lot.purchase.totalExpenses + data.amount),
            totalLandedCost: newTotalLandedCost,
          },
        });

        await tx.costAdjustment.create({
          data: {
            lotId: lot.id,
            previousLandedCostPerKg: oldCostPerKg,
            newLandedCostPerKg: newCostPerKg,
            adjustmentAmount: data.amount,
            reason: `Post-purchase landed expense added: ${data.category} (PKR ${data.amount})`,
          },
        });
      }

      // 3. If paid immediately from account
      if (data.isPaid && data.paymentAccountId) {
        const account = await tx.financialAccount.findUnique({
          where: { id: data.paymentAccountId },
        });
        if (account) {
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
              referenceType: 'LOT_EXPENSE',
              referenceId: expense.id,
              date: new Date(data.date),
              description: `Landed Expense: ${data.category} for Lot ${lot.lotNumber}`,
            },
          });
        }
      }

      return {
        expense,
        oldCostPerKg,
        newCostPerKg,
        newTotalLandedCost,
      };
    });

    await logAudit(
      data.userId,
      'ADD_LOT_EXPENSE',
      'LotExpense',
      result.expense.id,
      {
        lotNumber: lot.lotNumber,
        oldCostPerKg,
        newCostPerKg: result.newCostPerKg,
        amount: data.amount,
      }
    );

    return result;
  }

  static async getPurchases(page: number = 1, limit: number = 20, search?: string) {
    const skip = (page - 1) * limit;
    const where: any = {};

    if (search) {
      where.OR = [
        { purchaseNumber: { contains: search, mode: 'insensitive' } },
        { invoiceRefNumber: { contains: search, mode: 'insensitive' } },
        { supplier: { name: { contains: search, mode: 'insensitive' } } },
      ];
    }

    const [total, purchases] = await Promise.all([
      prisma.purchase.count({ where }),
      prisma.purchase.findMany({
        where,
        skip,
        take: limit,
        orderBy: { purchaseDate: 'desc' },
        include: {
          supplier: { select: { id: true, name: true, phone: true } },
          lots: {
            include: {
              product: { select: { id: true, name: true, code: true } },
            },
          },
          expenses: true,
        },
      }),
    ]);

    return {
      purchases,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  static async getPurchaseById(id: string) {
    const purchase = await prisma.purchase.findUnique({
      where: { id },
      include: {
        supplier: true,
        lots: {
          include: {
            product: { include: { category: true } },
            expenses: { include: { paymentAccount: true } },
            costAdjustments: { orderBy: { createdAt: 'desc' } },
            movements: { orderBy: { date: 'desc' } },
          },
        },
        expenses: {
          include: { paymentAccount: true },
        },
        paymentAllocations: {
          include: { payment: { include: { account: true } } },
        },
        purchaseReturns: true,
      },
    });

    if (!purchase) {
      throw new AppError('Purchase record not found', 404);
    }

    return purchase;
  }
}
