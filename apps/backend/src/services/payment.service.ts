import { prisma } from '../lib/prisma';
import { AppError } from '../middleware/errorHandler';
import { roundMoney, formatPKR } from '@fatani/shared';
import { logAudit } from '../middleware/audit';

export class PaymentService {
  private static async generatePaymentNumber(): Promise<string> {
    const today = new Date();
    const prefix = `PAY-${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}`;
    const payments = await prisma.payment.findMany({
      where: {
        paymentNumber: {
          startsWith: prefix,
        },
      },
      select: { paymentNumber: true },
    });
    let maxNum = 0;
    for (const p of payments) {
      const match = p.paymentNumber.match(/-(\d+)$/);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > maxNum) maxNum = num;
      }
    }
    return `${prefix}-${String(maxNum + 1).padStart(4, '0')}`;
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

  static async recordPurchasePayment(data: {
    purchaseId: string;
    amount: number;
    paymentDate: string | Date;
    referenceNumber?: string;
    notes?: string;
    accountId?: string | null;
    userId?: string;
  }) {
    if (data.amount <= 0) {
      throw new AppError('Payment amount must be greater than zero', 400);
    }

    const purchase = await prisma.purchase.findUnique({
      where: { id: data.purchaseId },
      include: {
        supplier: true,
        lots: { include: { product: true } },
      },
    });

    if (!purchase) {
      throw new AppError('Purchase record not found', 404);
    }

    if (data.amount <= 0 || data.amount > purchase.balanceAmount) {
      throw new AppError(
        `Payment amount (PKR ${data.amount}) cannot exceed remaining balance (PKR ${purchase.balanceAmount})`,
        400
      );
    }

    const account = data.accountId
      ? await prisma.financialAccount.findUnique({ where: { id: data.accountId } })
      : null;

    const paymentNumber = await this.generatePaymentNumber();

    const result = await prisma.$transaction(async (tx) => {
      // 1. Create Payment record linked to purchase
      const payment = await tx.payment.create({
        data: {
          paymentNumber,
          type: 'SUPPLIER_PAYMENT',
          supplierId: purchase.supplierId || null,
          purchaseId: purchase.id,
          accountId: account ? account.id : null,
          amount: data.amount,
          paymentDate: new Date(data.paymentDate),
          referenceNumber: data.referenceNumber || purchase.purchaseNumber,
          notes: data.notes || `Payment for purchase ${purchase.purchaseNumber}`,
        },
      });

      // 2. Outflow from Financial Account if one is provided
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
            description: `Payment for purchase ${purchase.purchaseNumber}`,
          },
        });
      }

      // 3. Purchase Allocation
      await tx.paymentAllocation.create({
        data: {
          paymentId: payment.id,
          purchaseId: purchase.id,
          amount: data.amount,
        },
      });

      const newPaid = roundMoney(purchase.paidAmount + data.amount);
      const newBal = roundMoney(purchase.balanceAmount - data.amount);
      const updatedPurchase = await tx.purchase.update({
        where: { id: purchase.id },
        data: {
          paidAmount: newPaid,
          balanceAmount: newBal,
        },
      });

      // 4. Update Supplier Ledger if supplier is present on the purchase
      if (purchase.supplierId && purchase.supplier) {
        const newSupplierBalance = roundMoney(purchase.supplier.currentBalance - data.amount);
        await tx.supplierLedgerEntry.create({
          data: {
            supplierId: purchase.supplier.id,
            date: new Date(data.paymentDate),
            type: 'PAYMENT',
            referenceNumber: paymentNumber,
            referenceId: payment.id,
            description: data.notes || `Payment for purchase ${purchase.purchaseNumber}`,
            debit: data.amount,
            credit: 0,
            runningBalance: newSupplierBalance,
          },
        });

        await tx.supplier.update({
          where: { id: purchase.supplier.id },
          data: { currentBalance: newSupplierBalance },
        });
      }

      return {
        payment,
        purchase: updatedPurchase,
        remainingBalance: newBal,
      };
    });

    await logAudit(
      data.userId,
      'RECORD_PURCHASE_PAYMENT',
      'Payment',
      result.payment.id,
      {
        paymentNumber,
        purchaseNumber: purchase.purchaseNumber,
        amount: data.amount,
        remainingBalance: result.remainingBalance,
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
    if (type && type !== 'ALL') {
      const types = type.split(',').map((value) => value.trim()).filter(Boolean);
      where.type = types.length > 1 ? { in: types } : types[0];
    }

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
          purchase: {
            select: {
              id: true,
              purchaseNumber: true,
              lots: { select: { product: { select: { name: true } } } },
            },
          },
          allocations: {
            include: {
              sale: { select: { id: true, invoiceNumber: true } },
              purchase: {
                select: {
                  id: true,
                  purchaseNumber: true,
                  lots: { select: { product: { select: { name: true } } } },
                },
              },
            },
          },
        },
      }),
      prisma.payment.aggregate({
        where: { type: 'CUSTOMER_PAYMENT' },
        _sum: { amount: true },
      }),
      prisma.payment.aggregate({
        where: { type: { in: ['SUPPLIER_PAYMENT', 'PURCHASE_PAYMENT'] } },
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

  static async getPaymentById(id: string) {
    const payment = await prisma.payment.findUnique({
      where: { id },
      include: {
        customer: true,
        supplier: true,
        purchase: {
          include: { lots: { include: { product: true } } },
        },
        account: true,
        allocations: {
          include: {
            sale: true,
            purchase: {
              include: { lots: { include: { product: true } } },
            },
          },
        },
      },
    });

    if (!payment) throw new AppError('Payment record not found', 404);
    return payment;
  }

  static async updatePayment(
    id: string,
    data: {
      amount?: number;
      paymentDate?: string | Date;
      referenceNumber?: string | null;
      notes?: string | null;
      userId?: string;
    }
  ) {
    const payment = await prisma.payment.findUnique({
      where: { id },
      include: {
        customer: true,
        supplier: true,
        purchase: true,
        account: true,
        allocations: { include: { sale: true, purchase: true } },
      },
    });

    if (!payment) throw new AppError('Payment record not found', 404);

    if (payment.allocations.length > 1 || (payment.type === 'SUPPLIER_PAYMENT' && !payment.purchaseId && payment.allocations.length > 0)) throw new AppError('Split or FIFO payments require a reviewed allocation correction',400);
    if (payment.allocations.length === 1 && payment.allocations[0].amount !== payment.amount) throw new AppError('Payments with partially allocated balances require a reviewed allocation correction',400);
    const oldAmount = payment.amount;
    const newAmount = data.amount !== undefined ? data.amount : oldAmount;
    if (newAmount <= 0) throw new AppError('Payment amount must be greater than zero', 400);

    const deltaAmount = roundMoney(newAmount - oldAmount);
    const purchaseId = payment.purchaseId || payment.allocations[0]?.purchaseId;
    const linkedPurchase = purchaseId ? await prisma.purchase.findUnique({where:{id:purchaseId}}) : null;
    if (linkedPurchase && newAmount > linkedPurchase.totalLandedCost - (linkedPurchase.paidAmount - (payment.allocations[0]?.amount || 0))) throw new AppError('Payment exceeds remaining purchase balance',400);
    if (payment.type === 'CUSTOMER_PAYMENT' && payment.allocations.length === 1 && payment.allocations[0].saleId) {
      const sale = payment.allocations[0].sale;
      if (newAmount > (sale?.grandTotal || 0) - ((sale?.paidAmount || 0) - payment.allocations[0].amount)) throw new AppError('Payment exceeds remaining invoice balance',400);
    }

    const result = await prisma.$transaction(async (tx) => {
      // 1. Customer Payment Update
      if (payment.type === 'CUSTOMER_PAYMENT' && payment.customerId) {
        const customer = await tx.customer.findUnique({ where: { id: payment.customerId } });
        if (customer && deltaAmount !== 0) {
          const newCustBal = roundMoney(customer.currentBalance - deltaAmount);
          await tx.customer.update({
            where: { id: customer.id },
            data: { currentBalance: newCustBal },
          });

        }
        await tx.customerLedgerEntry.updateMany({where:{referenceId:payment.id,type:'PAYMENT'},data:{credit:newAmount,...(customer && deltaAmount!==0?{runningBalance:roundMoney(customer.currentBalance-deltaAmount)}:{}),date:data.paymentDate?new Date(data.paymentDate):payment.paymentDate}});

        if (payment.allocations.length === 1 && payment.allocations[0].saleId && deltaAmount !== 0) {
          const alloc = payment.allocations[0];
          const sale = await tx.sale.findUnique({ where: { id: alloc.saleId! } });
          if (sale) {
            const newPaid = roundMoney(sale.paidAmount + deltaAmount);
            if (newPaid > sale.grandTotal) {
              throw new AppError(
                `Payment amount (${formatPKR(newAmount)}) exceeds sale grand total (${formatPKR(sale.grandTotal)})`,
                400
              );
            }
            await tx.sale.update({
              where: { id: sale.id },
              data: {
                paidAmount: newPaid,
                balanceAmount: Math.max(0, roundMoney(sale.grandTotal - newPaid)),
              },
            });
            await tx.paymentAllocation.update({
              where: { id: alloc.id },
              data: { amount: newAmount },
            });
          }
        }
      }

      // 2. Supplier / Purchase Payment Update
      if (payment.type === 'SUPPLIER_PAYMENT' || payment.type === 'PURCHASE_PAYMENT') {
        const targetPurchaseId = payment.purchaseId || payment.allocations?.[0]?.purchaseId;
        if (targetPurchaseId && deltaAmount !== 0) {
          const purchase = await tx.purchase.findUnique({ where: { id: targetPurchaseId } });
          if (purchase) {
            const newPaid = roundMoney(purchase.paidAmount + deltaAmount);
            if (newPaid > purchase.totalLandedCost) {
              throw new AppError(
                `Payment amount (${formatPKR(newAmount)}) exceeds purchase total cost (${formatPKR(purchase.totalLandedCost)})`,
                400
              );
            }
            await tx.purchase.update({
              where: { id: purchase.id },
              data: {
                paidAmount: newPaid,
                balanceAmount: Math.max(0, roundMoney(purchase.totalLandedCost - newPaid)),
              },
            });

            if (payment.allocations.length > 0) {
              await tx.paymentAllocation.updateMany({
                where: { paymentId: payment.id },
                data: { amount: newAmount },
              });
            }
          }
        }

        if (payment.supplierId) {
          const supplier = await tx.supplier.findUnique({ where: { id: payment.supplierId } });
          if (supplier) {
            await tx.supplierLedgerEntry.updateMany({
              where: { referenceId: payment.id, type: 'PAYMENT' },
              data: {
                debit: newAmount,
                date: data.paymentDate ? new Date(data.paymentDate) : payment.paymentDate,
              },
            });
            if (deltaAmount !== 0) {
              const newSuppBal = roundMoney(supplier.currentBalance - deltaAmount);
              await tx.supplier.update({where:{id:supplier.id},data:{currentBalance:newSuppBal}});
              await tx.supplierLedgerEntry.updateMany({where:{referenceId:payment.id,type:'PAYMENT'},data:{runningBalance:newSuppBal}});
            }
          }
        }
      }

      // 3. Financial Account Outflow/Inflow update
      if (payment.accountId) {
        const account = await tx.financialAccount.findUnique({ where: { id: payment.accountId } });
        if (account) {
          const newAccBal = payment.type === 'CUSTOMER_PAYMENT' ? roundMoney(account.currentBalance + deltaAmount) : roundMoney(account.currentBalance - deltaAmount);
          if(deltaAmount!==0) await tx.financialAccount.update({where:{id:account.id},data:{currentBalance:newAccBal}});

          await tx.financialTransaction.updateMany({
            where: { referenceId: payment.id },
            data: {
              amount: newAmount,
              balanceAfter: newAccBal,
              date: data.paymentDate ? new Date(data.paymentDate) : payment.paymentDate,
            },
          });
        }
      }

      const updated = await tx.payment.update({
        where: { id: payment.id },
        data: {
          amount: newAmount,
          paymentDate: data.paymentDate ? new Date(data.paymentDate) : payment.paymentDate,
          referenceNumber:
            data.referenceNumber !== undefined ? data.referenceNumber : payment.referenceNumber,
          notes: data.notes !== undefined ? data.notes : payment.notes,
        },
      });

      return updated;
    });

    await logAudit(data.userId, 'UPDATE_PAYMENT', 'Payment', payment.id, {
      paymentNumber: payment.paymentNumber,
      oldAmount,
      newAmount,
    });

    return result;
  }

  static async deletePayment(id: string, userId?: string) {
    const payment = await prisma.payment.findUnique({
      where: { id },
      include: {
        customer: true,
        supplier: true,
        purchase: true,
        account: true,
        allocations: { include: { sale: true, purchase: true } },
      },
    });

    if (!payment) throw new AppError('Payment record not found', 404);

    if (payment.allocations.length > 1 || (payment.type === 'SUPPLIER_PAYMENT' && !payment.purchaseId && payment.allocations.length > 0)) throw new AppError('Split or FIFO payments require a reviewed allocation reversal',400);
    const amount = payment.amount;

    await prisma.$transaction(async (tx) => {
      // 1. Revert Customer Payment
      if (payment.type === 'CUSTOMER_PAYMENT' && payment.customerId) {
        const customer = await tx.customer.findUnique({ where: { id: payment.customerId } });
        if (customer) {
          const newCustBal = roundMoney(customer.currentBalance + amount);
          await tx.customer.update({
            where: { id: customer.id },
            data: { currentBalance: newCustBal },
          });

          await tx.customerLedgerEntry.deleteMany({
            where: { referenceId: payment.id },
          });
        }

        for (const alloc of payment.allocations) {
          if (alloc.saleId) {
            const sale = await tx.sale.findUnique({ where: { id: alloc.saleId } });
            if (sale) {
              const newPaid = Math.max(0, roundMoney(sale.paidAmount - alloc.amount));
              await tx.sale.update({
                where: { id: sale.id },
                data: {
                  paidAmount: newPaid,
                  balanceAmount: roundMoney(sale.grandTotal - newPaid),
                },
              });
            }
          }
        }
      }

      // 2. Revert Supplier / Purchase Payment
      if (payment.type === 'SUPPLIER_PAYMENT' || payment.type === 'PURCHASE_PAYMENT') {
        const targetPurchaseId = payment.purchaseId || payment.allocations?.[0]?.purchaseId;
        if (targetPurchaseId) {
          const purchase = await tx.purchase.findUnique({ where: { id: targetPurchaseId } });
          if (purchase) {
            const newPaid = Math.max(0, roundMoney(purchase.paidAmount - amount));
            await tx.purchase.update({
              where: { id: purchase.id },
              data: {
                paidAmount: newPaid,
                balanceAmount: roundMoney(purchase.totalLandedCost - newPaid),
              },
            });
          }
        }

        if (payment.supplierId) {
          const supplier = await tx.supplier.findUnique({ where: { id: payment.supplierId } });
          if (supplier) {
            const newSuppBal = roundMoney(supplier.currentBalance + amount);
            await tx.supplier.update({
              where: { id: supplier.id },
              data: { currentBalance: newSuppBal },
            });

            await tx.supplierLedgerEntry.deleteMany({where:{referenceId:payment.id,type:'PAYMENT'}});
          }
        }
      }

      // 3. Revert Financial Account
      if (payment.accountId) {
        const account = await tx.financialAccount.findUnique({ where: { id: payment.accountId } });
        if (account) {
          const newAccBal =
            payment.type === 'CUSTOMER_PAYMENT'
              ? roundMoney(account.currentBalance - amount)
              : roundMoney(account.currentBalance + amount);

          await tx.financialAccount.update({
            where: { id: account.id },
            data: { currentBalance: newAccBal },
          });

          await tx.financialTransaction.deleteMany({
            where: { referenceId: payment.id },
          });
        }
      }

      await tx.paymentAllocation.deleteMany({ where: { paymentId: payment.id } });
      await tx.payment.delete({ where: { id: payment.id } });
    });

    await logAudit(userId, 'DELETE_PAYMENT', 'Payment', payment.id, {
      paymentNumber: payment.paymentNumber,
      type: payment.type,
      amount,
    });

    return {
      success: true,
      message: `Payment ${payment.paymentNumber} deleted and reversed successfully`,
    };
  }
}
