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
  public static async generatePurchaseNumber(): Promise<string> {
    const purchases = await prisma.purchase.findMany({
      select: { purchaseNumber: true },
    });
    let maxNum = 0;
    for (const p of purchases) {
      const match = p.purchaseNumber.match(/^PUR-(\d+)$/);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > maxNum) maxNum = num;
      }
    }
    const nextSeq = maxNum + 1;
    return `PUR-${String(nextSeq).padStart(6, '0')}`;
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
    fabricName?: string;
    supplierId?: string | null;
    productId?: string | null;
    purchaseDate: string | Date;
    purchaseNumber?: string;
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
    let attempts = 0;
    while (attempts < 3) {
      try {
        attempts++;
        return await this.executeCreatePurchase(data);
      } catch (err: any) {
        if (
          (err.message?.includes('write conflict') ||
            err.message?.includes('deadlock') ||
            err.message?.includes('TransientTransactionError')) &&
          attempts < 3
        ) {
          await new Promise((res) => setTimeout(res, 50 * attempts));
          continue;
        }
        throw err;
      }
    }
    throw new AppError('Purchase creation failed after retries', 500);
  }

  private static async executeCreatePurchase(data: {
    fabricName?: string;
    supplierId?: string | null;
    productId?: string | null;
    purchaseDate: string | Date;
    purchaseNumber?: string;
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
    // 1. Weight in integer grams (supports decimal kg e.g. 2.5 KG + extra grams e.g. 200 g)
    const totalGrams = kgAndGramsToGrams(data.weightKg, data.weightGrams || 0);
    if (totalGrams <= 0) {
      throw new AppError('Total purchased weight must be greater than zero', 400);
    }

    // 2. Landed Cost Calculation
    const landedCost = calculateLandedCost(
      totalGrams,
      data.purchaseRatePerKg,
      data.expenses || []
    );

    const purchaseNumber = data.purchaseNumber && data.purchaseNumber.trim()
      ? data.purchaseNumber.trim()
      : await this.generatePurchaseNumber();
    const lotNumber = await this.generateLotNumber();

    const supplierPayment = Math.max(0, data.supplierPaymentAmount || 0);
    if (supplierPayment > landedCost.totalLandedCost) {
      throw new AppError('Immediate payment cannot exceed total landed cost', 400);
    }

    const purchaseBalance = roundMoney(Math.max(0, landedCost.totalLandedCost - supplierPayment));

    // 3. Transactional execution
    const result = await prisma.$transaction(async (tx) => {
      // 3.1 Transparently resolve or create internal Product entity
      let product: { id: string; name: string } | null = null;
      const fabricName = (data.fabricName || '').trim();

      if (data.productId) {
        product = await tx.product.findUnique({ where: { id: data.productId } });
      }

      if (!product && fabricName) {
        product = await tx.product.findFirst({
          where: {
            name: { equals: fabricName, mode: 'insensitive' },
          },
        });

        if (!product) {
          let category = await tx.productCategory.findFirst({
            where: { name: { equals: 'Cotton Lawn', mode: 'insensitive' } },
          });
          if (!category) {
            category = await tx.productCategory.findFirst();
          }
          if (!category) {
            category = await tx.productCategory.create({
              data: {
                name: 'General Fabrics',
                description: 'Textile fabric rolls and thaan',
              },
            });
          }

          const safeCode = `FAB-${Date.now().toString().slice(-6)}`;
          product = await tx.product.create({
            data: {
              name: fabricName,
              code: safeCode,
              categoryId: category.id,
              defaultUnit: 'KG',
              isActive: true,
            },
          });
        }
      }

      if (!product) {
        throw new AppError('Fabric name is required', 400);
      }

      // 3.2 Optional supplier validation
      let supplier: any = null;
      if (data.supplierId && data.supplierId.trim()) {
        supplier = await tx.supplier.findUnique({
          where: { id: data.supplierId },
        });
        if (!supplier || !supplier.isActive) {
          throw new AppError('Selected supplier is invalid or inactive', 400);
        }
      }

      // 3.3 Create Purchase
      const purchase = await tx.purchase.create({
        data: {
          purchaseNumber,
          supplierId: supplier ? supplier.id : null,
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

      // 3.4 Create Purchase Lot (Each purchase gets its own distinct lot)
      const lot = await tx.purchaseLot.create({
        data: {
          lotNumber,
          purchaseId: purchase.id,
          productId: product.id,
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

      // 3.5 Create Lot Expenses
      if (data.expenses && data.expenses.length > 0) {
        for (const exp of data.expenses) {
          if (exp.amount > 0) {
            await tx.lotExpense.create({
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
          }
        }
      }

      // 3.6 Record Inventory Movement
      await tx.inventoryMovement.create({
        data: {
          lotId: lot.id,
          type: 'PURCHASE',
          gramsChange: totalGrams,
          resultingAvailableGrams: totalGrams,
          referenceType: 'PURCHASE',
          referenceId: purchase.id,
          date: new Date(data.purchaseDate),
          notes: `Purchase ${purchaseNumber} - ${product.name} (${data.weightKg} KG @ PKR ${data.purchaseRatePerKg}/KG)`,
        },
      });

      // 3.7 Handle Immediate Payment if greater than 0
      if (supplierPayment > 0) {
        const paymentNumber = `PAY-${Date.now()}`;
        const payment = await tx.payment.create({
          data: {
            paymentNumber,
            type: 'SUPPLIER_PAYMENT',
            supplierId: supplier ? supplier.id : null,
            purchaseId: purchase.id,
            accountId: data.paymentAccountId || null,
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

        if (supplier) {
          const balanceAfterPurchase = roundMoney(supplier.currentBalance + landedCost.totalLandedCost);
          await tx.supplierLedgerEntry.create({
            data: {
              supplierId: supplier.id,
              date: new Date(data.purchaseDate),
              type: 'PURCHASE',
              referenceNumber: purchaseNumber,
              referenceId: purchase.id,
              description: `Purchase of ${product.name} (${data.weightKg} KG @ ${data.purchaseRatePerKg}/KG)`,
              debit: 0,
              credit: landedCost.totalLandedCost,
              runningBalance: balanceAfterPurchase,
            },
          });

          const finalSupplierBalance = roundMoney(balanceAfterPurchase - supplierPayment);
          await tx.supplierLedgerEntry.create({
            data: {
              supplierId: supplier.id,
              date: new Date(data.purchaseDate),
              type: 'PAYMENT',
              referenceNumber: purchaseNumber,
              referenceId: purchase.id,
              description: `Immediate payment for ${purchaseNumber}`,
              debit: supplierPayment,
              credit: 0,
              runningBalance: finalSupplierBalance,
            },
          });

          await tx.supplier.update({
            where: { id: supplier.id },
            data: { currentBalance: finalSupplierBalance },
          });
        }
      } else if (supplier) {
        // No immediate payment, but supplier exists: update supplier ledger
        const balanceAfterPurchase = roundMoney(supplier.currentBalance + landedCost.totalLandedCost);
        await tx.supplierLedgerEntry.create({
          data: {
            supplierId: supplier.id,
            date: new Date(data.purchaseDate),
            type: 'PURCHASE',
            referenceNumber: purchaseNumber,
            referenceId: purchase.id,
            description: `Purchase of ${product.name} (${data.weightKg} KG @ ${data.purchaseRatePerKg}/KG)`,
            debit: 0,
            credit: landedCost.totalLandedCost,
            runningBalance: balanceAfterPurchase,
          },
        });

        await tx.supplier.update({
          where: { id: supplier.id },
          data: { currentBalance: balanceAfterPurchase },
        });
      }

      return {
        purchase,
        lot,
        landedCost,
        product,
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
        product: result.product.name,
        supplier: data.supplierId || 'Unknown Supplier',
        totalGrams,
        totalLandedCost: landedCost.totalLandedCost,
        immediatePayment: supplierPayment,
        balance: purchaseBalance,
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

  static async getPurchases(
    page: number = 1,
    limit: number = 20,
    search?: string,
    status?: 'ALL' | 'PAID' | 'PARTIAL' | 'UNPAID',
    supplierId?: string,
    unknownSupplier?: boolean
  ) {
    const skip = (page - 1) * limit;
    const where: any = {};

    if (unknownSupplier) {
      where.supplierId = null;
    } else if (supplierId) {
      where.supplierId = supplierId;
    }

    if (status && status !== 'ALL') {
      if (status === 'PAID') {
        where.balanceAmount = 0;
      } else if (status === 'UNPAID') {
        where.paidAmount = 0;
      } else if (status === 'PARTIAL') {
        where.paidAmount = { gt: 0 };
        where.balanceAmount = { gt: 0 };
      }
    }

    if (search) {
      where.OR = [
        { purchaseNumber: { contains: search, mode: 'insensitive' } },
        { invoiceRefNumber: { contains: search, mode: 'insensitive' } },
        { supplier: { name: { contains: search, mode: 'insensitive' } } },
        { lots: { some: { product: { name: { contains: search, mode: 'insensitive' } } } } },
      ];
    }

    const [total, purchases, summaryAgg] = await Promise.all([
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
          paymentAllocations: {
            include: { payment: true },
          },
        },
      }),
      prisma.purchase.aggregate({
        where,
        _sum: { totalLandedCost: true, paidAmount: true, balanceAmount: true, baseCost: true },
      }),
    ]);

    // Calculate total purchased KG across matching lots
    const allLots = await prisma.purchaseLot.aggregate({
      where: {
        purchase: where,
      },
      _sum: {
        purchasedGrams: true,
        availableGrams: true,
      },
    });

    const totalWeightKg = (allLots._sum.purchasedGrams || 0) / 1000;

    return {
      purchases,
      summary: {
        totalPurchases: roundMoney(summaryAgg._sum.totalLandedCost || 0),
        totalBaseCost: roundMoney(summaryAgg._sum.baseCost || 0),
        totalPaid: roundMoney(summaryAgg._sum.paidAmount || 0),
        totalBalance: roundMoney(summaryAgg._sum.balanceAmount || 0),
        totalWeightKg,
      },
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  static async getPayablePurchases() {
    const purchases = await prisma.purchase.findMany({
      where: {
        balanceAmount: { gt: 0 },
      },
      orderBy: { purchaseDate: 'desc' },
      include: {
        supplier: { select: { id: true, name: true, phone: true } },
        lots: {
          include: {
            product: { select: { id: true, name: true } },
          },
        },
      },
    });

    return purchases.map((p) => {
      const fabricName = p.lots[0]?.product?.name || 'Fabric';
      const supplierName = p.supplier?.name || 'Unknown Supplier';
      return {
        id: p.id,
        purchaseNumber: p.purchaseNumber,
        purchaseDate: p.purchaseDate,
        fabricName,
        supplierName,
        supplierId: p.supplierId,
        totalLandedCost: p.totalLandedCost,
        baseCost: p.baseCost,
        paidAmount: p.paidAmount,
        balanceAmount: p.balanceAmount,
        displayText: `${p.purchaseNumber} — ${fabricName} — Rs. ${p.balanceAmount.toLocaleString()} Remaining${
          p.supplier ? ` (${p.supplier.name})` : ' (Unknown Supplier)'
        }`,
      };
    });
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
