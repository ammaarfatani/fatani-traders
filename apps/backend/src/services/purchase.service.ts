import { prisma } from '../lib/prisma';
import { AppError } from '../middleware/errorHandler';
import {
  kgAndGramsToGrams,
  calculateLandedCost,
  recalculateLotCostWithAdjustment,
  roundMoney,
  formatWeight,
  formatPKR,
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
    const lots = await prisma.purchaseLot.findMany({
      where: {
        lotNumber: {
          startsWith: prefix,
        },
      },
      select: { lotNumber: true },
    });
    let maxNum = 0;
    for (const lot of lots) {
      const match = lot.lotNumber.match(/-(\d+)$/);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > maxNum) maxNum = num;
      }
    }
    return `${prefix}-${String(maxNum + 1).padStart(4, '0')}`;
  }

  static async createPurchase(data: {
    fabricName?: string;
    supplierId?: string | null;
    productId?: string | null;
    purchaseDate?: string | Date;
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

  static async resolveOrCreateProduct(fabricName: string, client: any = prisma) {
    let product = await client.product.findFirst({
      where: {
        name: { equals: fabricName, mode: 'insensitive' },
      },
    });

    if (!product) {
      let category = await client.productCategory.findFirst({
        where: { name: { equals: 'Cotton Lawn', mode: 'insensitive' } },
      });
      if (!category) {
        category = await client.productCategory.findFirst();
      }
      if (!category) {
        category = await client.productCategory.create({
          data: {
            name: 'General Fabrics',
            description: 'Textile fabric rolls and thaan',
          },
        });
      }

      const safeCode = `FAB-${Date.now().toString().slice(-6)}`;
      product = await client.product.create({
        data: {
          name: fabricName,
          code: safeCode,
          categoryId: category.id,
          defaultUnit: 'KG',
          isActive: true,
        },
      });
    }

    return product;
  }

  private static async executeCreatePurchase(data: {
    fabricName?: string;
    supplierId?: string | null;
    productId?: string | null;
    purchaseDate?: string | Date;
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
    const purchaseDateObj = data.purchaseDate ? new Date(data.purchaseDate) : new Date();

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
          purchaseDate: purchaseDateObj,
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
                date: exp.date ? new Date(exp.date) : purchaseDateObj,
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
          date: purchaseDateObj,
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
            paymentDate: purchaseDateObj,
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
              date: purchaseDateObj,
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
              date: purchaseDateObj,
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
            date: purchaseDateObj,
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
    date?: string | Date;
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
    const expenseDateObj = data.date ? new Date(data.date) : new Date();

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
          date: expenseDateObj,
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
            balanceAmount: roundMoney(newTotalLandedCost - lot.purchase.paidAmount),
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
              date: expenseDateObj,
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

  static async updatePurchase(
    id: string,
    data: {
      fabricName?: string;
      supplierId?: string | null;
      purchaseDate?: string | Date;
      invoiceRefNumber?: string | null;
      weightKg?: number;
      weightGrams?: number;
      purchaseRatePerKg?: number;
      expenses?: Array<{
        category: string;
        customName?: string;
        amount: number;
        isCapitalized?: boolean;
        notes?: string;
      }>;
      notes?: string | null;
      userId?: string;
    }
  ) {
    const purchase = await prisma.purchase.findUnique({
      where: { id },
      include: {
        supplier: true,
        lots: {
          include: {
            product: true,
            saleItems: true,
            purchaseReturns: true,
            expenses: true,
          },
        },
        expenses: true,
      },
    });

    if (!purchase) {
      throw new AppError('Purchase record not found', 404);
    }

    const lot = purchase.lots[0];
    if (!lot) {
      throw new AppError('Associated purchase lot not found', 404);
    }

    if (purchase.lots.length !== 1) throw new AppError('Multi-lot purchases must be corrected by lot; this edit is not supported', 400);
    if (data.expenses !== undefined) throw new AppError('Edit additional expenses individually to preserve their IDs and payment history', 400);
    if (data.supplierId !== undefined && data.supplierId !== purchase.supplierId && (purchase.paidAmount > 0 || lot.purchaseReturns.length > 0)) throw new AppError('Cannot change supplier after payments or returns', 400);
    if ((data.weightKg !== undefined || data.weightGrams !== undefined) && lot.returnedGrams > 0) throw new AppError('Cannot change purchase weight after a purchase return; preserve the return history and correct the lot separately',400);
    if ((data.weightKg !== undefined || data.weightGrams !== undefined) && lot.returnedGrams > 0) throw new AppError('Cannot change purchase weight after a purchase return; preserve the return history and correct the lot separately',400);
    if (data.supplierId && !(await prisma.supplier.findUnique({where:{id:data.supplierId}}))) throw new AppError('Supplier not found',404);
    // 1. Calculate new weight and validate against already sold quantity
    const currentKg = lot.purchasedGrams / 1000;
    const weightKg = data.weightKg !== undefined ? data.weightKg : currentKg;
    const weightGrams = data.weightGrams !== undefined ? data.weightGrams : 0;
    const newTotalGrams = Math.round(weightKg * 1000) + weightGrams;

    const minAllowedGrams = lot.soldGrams + lot.returnedGrams - lot.adjustedGrams;
    if (newTotalGrams < minAllowedGrams) {
      throw new AppError(
        `Cannot reduce purchase weight to ${formatWeight(newTotalGrams)} because ${formatWeight(lot.soldGrams)} has already been sold in sales invoices and ${formatWeight(lot.returnedGrams)} returned. Minimum allowed weight is ${formatWeight(minAllowedGrams)}.`,
        400
      );
    }

    const purchaseRatePerKg =
      data.purchaseRatePerKg !== undefined ? data.purchaseRatePerKg : lot.purchaseRatePerKg;
    const newBaseCost = roundMoney((newTotalGrams / 1000) * purchaseRatePerKg);

    // 2. Resolve Product if fabricName was updated
    let productId = lot.productId;
    if (data.fabricName && data.fabricName.trim() && data.fabricName.trim() !== lot.product?.name) {
      const product = await this.resolveOrCreateProduct(data.fabricName.trim());
      productId = product.id;
    }

    // 3. Additional Landed Expenses
    let newTotalExpenses = purchase.totalExpenses;

    const newTotalLandedCost = roundMoney(newBaseCost + newTotalExpenses);
    const newLandedCostPerKg = roundMoney(newTotalLandedCost / (newTotalGrams / 1000));

    if (purchase.paidAmount > newTotalLandedCost) {
      throw new AppError(
        `New total landed cost (${formatPKR(newTotalLandedCost)}) cannot be less than already paid amount (${formatPKR(purchase.paidAmount)}). Please delete or reduce payments first.`,
        400
      );
    }

    const newBalanceAmount = roundMoney(newTotalLandedCost - purchase.paidAmount);

    const oldSupplierId = purchase.supplierId;
    const newSupplierId =
      data.supplierId !== undefined
        ? data.supplierId === '' || data.supplierId === 'null'
          ? null
          : data.supplierId
        : oldSupplierId;

    const purchaseDate = data.purchaseDate ? new Date(data.purchaseDate) : purchase.purchaseDate;

    // 4. Atomic transaction update
    const result = await prisma.$transaction(async (tx) => {
      // 4.1 Update supplier ledgers and balances if supplier changed or baseCost changed
      if (oldSupplierId !== newSupplierId) {
        // Revert from old supplier
        if (oldSupplierId) {
          const oldSupp = await tx.supplier.findUnique({ where: { id: oldSupplierId } });
          if (oldSupp) {
            await tx.supplier.update({
              where: { id: oldSupplierId },
              data: { currentBalance: roundMoney(oldSupp.currentBalance - purchase.baseCost) },
            });
            await tx.supplierLedgerEntry.deleteMany({
              where: { supplierId: oldSupplierId, referenceId: purchase.id, type: 'PURCHASE' },
            });
          }
        }

        // Add to new supplier
        if (newSupplierId) {
          const newSupp = await tx.supplier.findUnique({ where: { id: newSupplierId } });
          if (newSupp) {
            const newSuppBal = roundMoney(newSupp.currentBalance + newBaseCost);
            await tx.supplier.update({
              where: { id: newSupplierId },
              data: { currentBalance: newSuppBal },
            });
            await tx.supplierLedgerEntry.create({
              data: {
                supplierId: newSupplierId,
                date: purchaseDate,
                type: 'PURCHASE',
                referenceNumber: purchase.purchaseNumber,
                referenceId: purchase.id,
                description: `Purchase ${purchase.purchaseNumber} (${formatWeight(newTotalGrams)} @ Rs. ${purchaseRatePerKg})`,
                debit: 0,
                credit: newBaseCost,
                runningBalance: newSuppBal,
              },
            });
          }
        }
      } else if (newSupplierId) {
        // Same supplier, update balance difference if baseCost changed
        const diff = roundMoney(newBaseCost - purchase.baseCost);
        if (diff !== 0) {
          const supp = await tx.supplier.findUnique({ where: { id: newSupplierId } });
          if (supp) {
            const newSuppBal = roundMoney(supp.currentBalance + diff);
            await tx.supplier.update({
              where: { id: newSupplierId },
              data: { currentBalance: newSuppBal },
            });
            await tx.supplierLedgerEntry.updateMany({
              where: { supplierId: newSupplierId, referenceId: purchase.id, type: 'PURCHASE' },
              data: {
                credit: newBaseCost,
                runningBalance: newSuppBal,
                date: purchaseDate,
                description: `Purchase ${purchase.purchaseNumber} (${formatWeight(newTotalGrams)} @ Rs. ${purchaseRatePerKg})`,
              },
            });
          }
        }
      }

      // 4.3 Update lot
      const newAvailableGrams = newTotalGrams - lot.soldGrams - lot.returnedGrams + lot.adjustedGrams;
      const updatedLot = await tx.purchaseLot.update({
        where: { id: lot.id },
        data: {
          productId,
          purchasedGrams: newTotalGrams,
          availableGrams: newAvailableGrams,
          purchaseRatePerKg,
          landedCostPerKg: newLandedCostPerKg,
          status: newAvailableGrams === 0 ? 'DEPLETED' : 'ACTIVE',
        },
      });

      // 4.4 Update initial movement
      await tx.inventoryMovement.updateMany({
        where: { lotId: lot.id, referenceType: 'PURCHASE' },
        data: {
          gramsChange: newTotalGrams,
          resultingAvailableGrams: newTotalGrams,
          date: purchaseDate,
        },
      });

      // 4.5 Update purchase record
      const updatedPurchase = await tx.purchase.update({
        where: { id: purchase.id },
        data: {
          supplierId: newSupplierId,
          purchaseDate,
          invoiceRefNumber:
            data.invoiceRefNumber !== undefined ? data.invoiceRefNumber : purchase.invoiceRefNumber,
          baseCost: newBaseCost,
          totalExpenses: newTotalExpenses,
          totalLandedCost: newTotalLandedCost,
          balanceAmount: newBalanceAmount,
          notes: data.notes !== undefined ? data.notes : purchase.notes,
        },
        include: {
          supplier: true,
          lots: { include: { product: true } },
          expenses: true,
        },
      });

      return { updatedPurchase, updatedLot };
    });

    await logAudit(data.userId, 'UPDATE_PURCHASE', 'Purchase', purchase.id, {
      purchaseNumber: purchase.purchaseNumber,
      oldTotalLandedCost: purchase.totalLandedCost,
      newTotalLandedCost,
      newTotalGrams,
    });

    return result.updatedPurchase;
  }

  static async deletePurchase(id: string, userId?: string) {
    const purchase = await prisma.purchase.findUnique({
      where: { id },
      include: {
        supplier: true,
        lots: {
          include: {
            saleItems: true,
            purchaseReturns: true,
            movements: true,
            expenses: true,
            costAdjustments: true,
            adjustments: true,
          },
        },
        expenses: true,
        paymentAllocations: { include: { payment: true } },
        payments: true,
        purchaseReturns: true,
      },
    });

    if (!purchase) {
      throw new AppError('Purchase record not found', 404);
    }

    // 1. Dependency checks
    for (const lot of purchase.lots) {
      if (lot.soldGrams > 0 || lot.saleItems.length > 0) {
        throw new AppError(
          `This purchase cannot be deleted because ${formatWeight(lot.soldGrams)} has already been sold in ${lot.saleItems.length} sales invoice(s).`,
          400
        );
      }
      if (lot.returnedGrams > 0 || lot.purchaseReturns.length > 0) {
        throw new AppError(
          `This purchase cannot be deleted because it has ${lot.purchaseReturns.length} linked purchase return(s).`,
          400
        );
      }
    }

    if (purchase.paidAmount > 0 || purchase.paymentAllocations.length > 0 || purchase.payments.length > 0) {
      throw new AppError(
        `This purchase cannot be deleted because it has recorded payments totaling ${formatPKR(purchase.paidAmount)}. Please delete or reverse the linked payments first.`,
        400
      );
    }

    if (purchase.purchaseReturns.length > 0) {
      throw new AppError(
        `This purchase cannot be deleted because it has linked purchase returns.`,
        400
      );
    }

    if (purchase.lots.some(l => l.adjustments.length > 0 || l.adjustedGrams !== 0) || purchase.expenses.some(e => e.isPaid || !e.isCapitalized)) throw new AppError('Cannot delete purchase with adjustments, paid expenses, or non-capitalized expense history', 400);
    // 2. Perform safe atomic deletion
    await prisma.$transaction(async (tx) => {
      // Revert supplier balance & remove ledger entry
      if (purchase.supplierId) {
        const supplier = await tx.supplier.findUnique({ where: { id: purchase.supplierId } });
        if (supplier) {
          const newBal = roundMoney(supplier.currentBalance - purchase.baseCost);
          await tx.supplier.update({
            where: { id: supplier.id },
            data: { currentBalance: newBal },
          });

          await tx.supplierLedgerEntry.deleteMany({
            where: {
              supplierId: supplier.id,
              referenceId: purchase.id,
            },
          });
        }
      }

      await tx.supplierLedgerEntry.deleteMany({ where: { referenceId: purchase.id } });
      // Delete lot movements, adjustments, expenses, and lots
      for (const lot of purchase.lots) {
        await tx.inventoryMovement.deleteMany({ where: { lotId: lot.id } });
        await tx.inventoryAdjustment.deleteMany({ where: { lotId: lot.id } });
        await tx.costAdjustment.deleteMany({ where: { lotId: lot.id } });
        await tx.lotExpense.deleteMany({ where: { lotId: lot.id } });
        await tx.purchaseLot.delete({ where: { id: lot.id } });
      }

      await tx.lotExpense.deleteMany({ where: { purchaseId: purchase.id } });
      await tx.purchase.delete({ where: { id: purchase.id } });
    });

    await logAudit(userId, 'DELETE_PURCHASE', 'Purchase', purchase.id, {
      purchaseNumber: purchase.purchaseNumber,
      totalLandedCost: purchase.totalLandedCost,
    });

    return { success: true, message: `Purchase ${purchase.purchaseNumber} deleted successfully` };
  }

  static async updateLotExpense(
    expenseId: string,
    data: {
      category?: string;
      customName?: string;
      amount?: number;
      notes?: string;
      userId?: string;
    }
  ) {
    const expense = await prisma.lotExpense.findUnique({
      where: { id: expenseId },
      include: {
        purchase: true,
        lot: true,
        paymentAccount: true,
      },
    });

    if (!expense) throw new AppError('Lot expense not found', 404);

    const oldAmount = expense.amount;
    const newAmount = data.amount !== undefined ? data.amount : oldAmount;
    if (newAmount <= 0) throw new AppError('Expense amount must be greater than zero', 400);

    const capitalDelta = expense.isCapitalized ? roundMoney(newAmount-oldAmount) : 0;
    if (expense.purchase.totalLandedCost + capitalDelta < expense.purchase.paidAmount) throw new AppError('Expense change would reduce purchase cost below recorded payments',400);
    const deltaAmount = roundMoney(newAmount - oldAmount);

    const result = await prisma.$transaction(async (tx) => {
      const updatedExpense = await tx.lotExpense.update({
        where: { id: expenseId },
        data: {
          category: data.category?.trim() || expense.category,
          customName: data.customName !== undefined ? data.customName : expense.customName,
          amount: newAmount,
          notes: data.notes !== undefined ? data.notes : expense.notes,
        },
      });

      if (deltaAmount !== 0) {
        const newTotalExpenses = roundMoney(expense.purchase.totalExpenses + capitalDelta);
        const newTotalLandedCost = roundMoney(expense.purchase.totalLandedCost + capitalDelta);
        const newBalanceAmount = roundMoney(expense.purchase.balanceAmount + capitalDelta);
        const newCostPerKg = roundMoney(newTotalLandedCost / (expense.lot.purchasedGrams / 1000));

        await tx.purchase.update({
          where: { id: expense.purchaseId },
          data: {
            totalExpenses: newTotalExpenses,
            totalLandedCost: newTotalLandedCost,
            balanceAmount: newBalanceAmount,
          },
        });

        await tx.purchaseLot.update({
          where: { id: expense.lotId },
          data: {
            landedCostPerKg: newCostPerKg,
          },
        });

        if (expense.isPaid && expense.paymentAccountId) {
          const account = await tx.financialAccount.findUnique({ where: { id: expense.paymentAccountId } });
          if (account) {
            const newAccBal = roundMoney(account.currentBalance - deltaAmount);
            await tx.financialAccount.update({
              where: { id: account.id },
              data: { currentBalance: newAccBal },
            });
            await tx.financialTransaction.updateMany({
              where: { referenceId: expense.id, referenceType: 'LOT_EXPENSE' },
              data: { amount: newAmount, balanceAfter: newAccBal },
            });
          }
        }
      }

      return updatedExpense;
    });

    await logAudit(data.userId, 'UPDATE_LOT_EXPENSE', 'LotExpense', expense.id, {
      oldAmount,
      newAmount,
      deltaAmount,
    });

    return result;
  }

  static async deleteLotExpense(expenseId: string, userId?: string) {
    const expense = await prisma.lotExpense.findUnique({
      where: { id: expenseId },
      include: {
        purchase: true,
        lot: true,
        paymentAccount: true,
      },
    });

    if (!expense) throw new AppError('Lot expense not found', 404);

    if (expense.isCapitalized && expense.purchase.totalLandedCost - expense.amount < expense.purchase.paidAmount) throw new AppError('Cannot delete expense: purchase payments exceed the remaining cost',400);
    const amount = expense.amount;
    const capitalAmount = expense.isCapitalized ? amount : 0;

    await prisma.$transaction(async (tx) => {
      const newTotalExpenses = Math.max(0, roundMoney(expense.purchase.totalExpenses - capitalAmount));
      const newTotalLandedCost = roundMoney(expense.purchase.totalLandedCost - capitalAmount);
      const newBalanceAmount = Math.max(0, roundMoney(expense.purchase.balanceAmount - capitalAmount));
      const newCostPerKg = roundMoney(newTotalLandedCost / (expense.lot.purchasedGrams / 1000));

      await tx.purchase.update({
        where: { id: expense.purchaseId },
        data: {
          totalExpenses: newTotalExpenses,
          totalLandedCost: newTotalLandedCost,
          balanceAmount: newBalanceAmount,
        },
      });

      await tx.purchaseLot.update({
        where: { id: expense.lotId },
        data: {
          landedCostPerKg: newCostPerKg,
        },
      });

      if (expense.isPaid && expense.paymentAccountId) {
        const account = await tx.financialAccount.findUnique({ where: { id: expense.paymentAccountId } });
        if (account) {
          const newAccBal = roundMoney(account.currentBalance + amount);
          await tx.financialAccount.update({
            where: { id: account.id },
            data: { currentBalance: newAccBal },
          });
          await tx.financialTransaction.deleteMany({
            where: { referenceId: expense.id, referenceType: 'LOT_EXPENSE' },
          });
        }
      }

      await tx.lotExpense.delete({ where: { id: expenseId } });
    });

    await logAudit(userId, 'DELETE_LOT_EXPENSE', 'LotExpense', expense.id, {
      amount,
      category: expense.category,
    });

    return { success: true, message: 'Expense deleted and landed cost recalculated successfully' };
  }
}
