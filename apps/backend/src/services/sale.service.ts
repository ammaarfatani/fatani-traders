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
    const sales = await prisma.sale.findMany({
      where: {
        invoiceNumber: {
          startsWith: prefix,
        },
      },
      select: { invoiceNumber: true },
    });
    let maxNum = 0;
    for (const s of sales) {
      const match = s.invoiceNumber.match(/-(\d+)$/);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > maxNum) maxNum = num;
      }
    }
    return `${prefix}-${String(maxNum + 1).padStart(4, '0')}`;
  }

  static async createSale(data: {
    customerId: string;
    invoiceDate?: string | Date;
    items: Array<{
      lotId: string;
      productId?: string;
      weightKg?: number;
      weightGrams?: number;
      totalGrams?: number;
      sellingRatePerKg?: number;
      ratePerKg?: number;
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
    const invoiceDateObj = data.invoiceDate ? new Date(data.invoiceDate) : new Date();

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

      for (const rawItem of data.items) {
        const itemGrams =
          rawItem.totalGrams !== undefined && rawItem.totalGrams > 0
            ? rawItem.totalGrams
            : (rawItem.weightKg || 0) * 1000 + (rawItem.weightGrams || 0);

        const itemRate =
          rawItem.sellingRatePerKg !== undefined && rawItem.sellingRatePerKg > 0
            ? rawItem.sellingRatePerKg
            : (rawItem.ratePerKg || 0);

        if (itemGrams <= 0) {
          throw new AppError('Item sold grams must be greater than zero', 400);
        }
        if (itemRate <= 0) {
          throw new AppError('Item selling rate per KG must be greater than zero', 400);
        }

        // Fetch lot with lock/latest data
        const lot = await tx.purchaseLot.findUnique({
          where: { id: rawItem.lotId },
          include: { product: true },
        });

        if (!lot) {
          throw new AppError(`Lot ${rawItem.lotId} not found`, 404);
        }

        if (lot.availableGrams < itemGrams) {
          const availableKg = gramsToKg(lot.availableGrams);
          const requestedKg = gramsToKg(itemGrams);
          throw new AppError(
            `Insufficient stock in Lot ${lot.lotNumber}. Available: ${availableKg} KG, Requested: ${requestedKg} KG`,
            400
          );
        }

        const lineTotal = calculateLineTotal(itemGrams, itemRate);
        const cogsTotal = roundMoney((itemGrams / 1000) * lot.landedCostPerKg);

        subtotal = roundMoney(subtotal + lineTotal);
        totalCogs = roundMoney(totalCogs + cogsTotal);

        const newAvailableGrams = lot.availableGrams - itemGrams;
        const newSoldGrams = lot.soldGrams + itemGrams;
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
            gramsChange: -itemGrams,
            resultingAvailableGrams: newAvailableGrams,
            referenceType: 'SALE',
            referenceId: invoiceNumber,
            date: invoiceDateObj,
            notes: `Sold ${gramsToKg(itemGrams)} KG to ${customer.name} (Inv #${invoiceNumber})`,
          },
        });

        processedItems.push({
          lotId: lot.id,
          productId: lot.productId,
          lotNumber: lot.lotNumber,
          productName: lot.product.name,
          grams: itemGrams,
          kg: gramsToKg(itemGrams),
          ratePerKg: itemRate,
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
        invoiceDate: invoiceDateObj.toISOString(),
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
          invoiceDate: invoiceDateObj,
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
            paymentDate: invoiceDateObj,
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
              date: invoiceDateObj,
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
          date: invoiceDateObj,
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
            date: invoiceDateObj,
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

  static async updateSale(
    id: string,
    data: {
      customerId?: string;
      invoiceDate?: string | Date;
      discount?: number;
      notes?: string | null;
      items?: Array<{
        lotId: string;
        productId?: string;
        weightKg?: number;
        weightGrams?: number;
        totalGrams?: number;
        sellingRatePerKg?: number;
        ratePerKg?: number;
      }>;
      userId?: string;
    }
  ) {
    const sale = await prisma.sale.findUnique({
      where: { id },
      include: {
        customer: true,
        items: { include: { lot: true } },
        salesReturns: true,
        paymentAllocations: { include: { payment: true } },
      },
    });

    if (!sale) throw new AppError('Sale invoice not found', 404);

    if (sale.salesReturns.length > 0) {
      throw new AppError(
        `Cannot edit sale invoice with linked sales returns. Please delete the returns first.`,
        400
      );
    }

    const oldGrandTotal = sale.grandTotal;
    const oldCustomerId = sale.customerId;
    const newCustomerId = data.customerId || oldCustomerId;
    if (newCustomerId !== oldCustomerId && (sale.paidAmount > 0 || sale.paymentAllocations.length > 0)) throw new AppError('Cannot change customer after payments have been allocated',400);
    if (!(await prisma.customer.findUnique({where:{id:newCustomerId}}))) throw new AppError('Customer not found',404);
    const discount = data.discount !== undefined ? data.discount : sale.discount;

    const result = await prisma.$transaction(async (tx) => {
      let newSubtotal = 0;
      let newTotalCogs = 0;

      // Handle items change if provided
      if (data.items && data.items.length > 0) {
        // 1. Revert previous lot stock usage
        for (const oldItem of sale.items) {
          const lot = await tx.purchaseLot.findUnique({ where: { id: oldItem.lotId } });
          if (lot) {
            await tx.purchaseLot.update({
              where: { id: lot.id },
              data: {
                availableGrams: lot.availableGrams + oldItem.grams,
                soldGrams: Math.max(0, lot.soldGrams - oldItem.grams),
                status: 'ACTIVE',
              },
            });
          }
        }

        // Delete old sale items & old movements
        await tx.saleItem.deleteMany({ where: { saleId: sale.id } });
        await tx.inventoryMovement.deleteMany({ where: { referenceId: sale.id, referenceType: 'SALE' } });

        // 2. Process new items and apply stock deduction with validation
        for (const rawItem of data.items) {
          const itemGrams =
            rawItem.totalGrams !== undefined && rawItem.totalGrams > 0
              ? rawItem.totalGrams
              : (rawItem.weightKg || 0) * 1000 + (rawItem.weightGrams || 0);

          const itemRate =
            rawItem.sellingRatePerKg !== undefined && rawItem.sellingRatePerKg > 0
              ? rawItem.sellingRatePerKg
              : (rawItem.ratePerKg || 0);

          if (itemGrams <= 0) throw new AppError('Item sold grams must be greater than zero', 400);
          if (itemRate <= 0) throw new AppError('Item selling rate per KG must be greater than zero', 400);

          const lot = await tx.purchaseLot.findUnique({ where: { id: rawItem.lotId } });
          if (!lot) throw new AppError(`Lot ${rawItem.lotId} not found`, 404);

          if (lot.availableGrams < itemGrams) {
            throw new AppError(
              `Insufficient stock in Lot ${lot.lotNumber}. Available: ${gramsToKg(lot.availableGrams)} KG, Requested: ${gramsToKg(itemGrams)} KG`,
              400
            );
          }

          const lineTotal = calculateLineTotal(itemGrams, itemRate);
          const cogsTotal = calculateLineTotal(itemGrams, lot.landedCostPerKg);
          newSubtotal += lineTotal;
          newTotalCogs += cogsTotal;

          const newAvail = lot.availableGrams - itemGrams;
          await tx.purchaseLot.update({
            where: { id: lot.id },
            data: {
              availableGrams: newAvail,
              soldGrams: lot.soldGrams + itemGrams,
              status: newAvail === 0 ? 'DEPLETED' : 'ACTIVE',
            },
          });

          await tx.saleItem.create({
            data: {
              saleId: sale.id,
              lotId: lot.id,
              productId: lot.productId,
              grams: itemGrams,
              ratePerKg: itemRate,
              costPerKg: lot.landedCostPerKg,
              lineTotal,
              cogsTotal,
            },
          });

          await tx.inventoryMovement.create({
            data: {
              lotId: lot.id,
              type: 'SALE',
              gramsChange: -itemGrams,
              resultingAvailableGrams: newAvail,
              referenceType: 'SALE',
              referenceId: sale.id,
              date: data.invoiceDate ? new Date(data.invoiceDate) : sale.invoiceDate,
              notes: `Sale ${sale.invoiceNumber} (Updated)`,
            },
          });
        }
      } else {
        // Items unchanged
        newSubtotal = sale.subtotal;
        newTotalCogs = sale.totalCogs;
      }

      const newGrandTotal = calculateDiscountedTotal(newSubtotal, discount);
      const newGrossProfit = roundMoney(newGrandTotal - newTotalCogs);

      if (sale.paidAmount > newGrandTotal) {
        throw new AppError(
          `New invoice grand total (${formatPKR(newGrandTotal)}) cannot be less than already paid amount (${formatPKR(sale.paidAmount)}). Please delete or reduce payments first.`,
          400
        );
      }

      const newBalanceAmount = roundMoney(newGrandTotal - sale.paidAmount);

      // Customer balance adjustment
      if (oldCustomerId !== newCustomerId) {
        // Reverse from old customer
        const oldCust = await tx.customer.findUnique({ where: { id: oldCustomerId } });
        if (oldCust) {
          await tx.customer.update({
            where: { id: oldCustomerId },
            data: { currentBalance: roundMoney(oldCust.currentBalance - oldGrandTotal) },
          });
          await tx.customerLedgerEntry.deleteMany({
            where: { customerId: oldCustomerId, referenceId: sale.id, type: 'SALE' },
          });
        }

        // Add to new customer
        const newCust = await tx.customer.findUnique({ where: { id: newCustomerId } });
        if (newCust) {
          const newCustBal = roundMoney(newCust.currentBalance + newGrandTotal);
          await tx.customer.update({
            where: { id: newCustomerId },
            data: { currentBalance: newCustBal },
          });
          await tx.customerLedgerEntry.create({
            data: {
              customerId: newCustomerId,
              date: data.invoiceDate ? new Date(data.invoiceDate) : sale.invoiceDate,
              type: 'SALE',
              referenceNumber: sale.invoiceNumber,
              referenceId: sale.id,
              description: `Invoice ${sale.invoiceNumber} (Transferred)`,
              debit: newGrandTotal,
              credit: 0,
              runningBalance: newCustBal,
            },
          });
        }
      } else {
        // Same customer: net difference
        const diff = roundMoney(newGrandTotal - oldGrandTotal);
        if (diff !== 0) {
          const cust = await tx.customer.findUnique({ where: { id: oldCustomerId } });
          if (cust) {
            const newCustBal = roundMoney(cust.currentBalance + diff);
            await tx.customer.update({
              where: { id: oldCustomerId },
              data: { currentBalance: newCustBal },
            });
            await tx.customerLedgerEntry.updateMany({
              where: { customerId: oldCustomerId, referenceId: sale.id, type: 'SALE' },
              data: { debit: newGrandTotal, runningBalance: newCustBal },
            });
          }
        }
      }

      // Update sale record
      const updatedSale = await tx.sale.update({
        where: { id: sale.id },
        data: {
          customerId: newCustomerId,
          invoiceDate: data.invoiceDate ? new Date(data.invoiceDate) : sale.invoiceDate,
          subtotal: newSubtotal,
          discount,
          grandTotal: newGrandTotal,
          balanceAmount: newBalanceAmount,
          totalCogs: newTotalCogs,
          grossProfit: newGrossProfit,
          notes: data.notes !== undefined ? data.notes : sale.notes,
        },
        include: {
          customer: true,
          items: { include: { lot: true, product: true } },
          paymentAllocations: { include: { payment: true } },
        },
      });

      return updatedSale;
    });

    await logAudit(data.userId, 'UPDATE_SALE', 'Sale', sale.id, {
      invoiceNumber: sale.invoiceNumber,
      oldGrandTotal,
      newGrandTotal: result.grandTotal,
    });

    return result;
  }

  static async deleteSale(id: string, userId?: string) {
    const sale = await prisma.sale.findUnique({
      where: { id },
      include: {
        customer: true,
        items: true,
        salesReturns: true,
        paymentAllocations: true,
      },
    });

    if (!sale) throw new AppError('Sale invoice not found', 404);

    if (sale.salesReturns.length > 0) {
      throw new AppError(
        `Cannot delete sale ${sale.invoiceNumber} because it has ${sale.salesReturns.length} linked sales return(s). Please delete the return(s) first.`,
        400
      );
    }

    if (sale.paidAmount > 0 || sale.paymentAllocations.length > 0) {
      throw new AppError(
        `Cannot delete sale ${sale.invoiceNumber} because it has payments recorded (${formatPKR(sale.paidAmount)}). Please delete or reverse the payments first.`,
        400
      );
    }

    await prisma.$transaction(async (tx) => {
      // 1. Restore lot stock
      for (const item of sale.items) {
        const lot = await tx.purchaseLot.findUnique({ where: { id: item.lotId } });
        if (lot) {
          const newAvail = lot.availableGrams + item.grams;
          await tx.purchaseLot.update({
            where: { id: lot.id },
            data: {
              availableGrams: newAvail,
              soldGrams: Math.max(0, lot.soldGrams - item.grams),
              status: 'ACTIVE',
            },
          });
        }
      }

      // 2. Remove inventory movements
      await tx.inventoryMovement.deleteMany({
        where: { referenceId: sale.id, referenceType: 'SALE' },
      });

      // 3. Revert customer balance & delete ledger entry
      const customer = await tx.customer.findUnique({ where: { id: sale.customerId } });
      if (customer) {
        const newBal = roundMoney(customer.currentBalance - sale.grandTotal);
        await tx.customer.update({
          where: { id: customer.id },
          data: { currentBalance: newBal },
        });

        await tx.customerLedgerEntry.deleteMany({
          where: { customerId: customer.id, referenceId: sale.id, type: 'SALE' },
        });
      }

      // 4. Delete sale items & sale
      await tx.saleItem.deleteMany({ where: { saleId: sale.id } });
      await tx.sale.delete({ where: { id: sale.id } });
    });

    await logAudit(userId, 'DELETE_SALE', 'Sale', sale.id, {
      invoiceNumber: sale.invoiceNumber,
      grandTotal: sale.grandTotal,
    });

    return { success: true, message: `Sale invoice ${sale.invoiceNumber} deleted successfully` };
  }
}
