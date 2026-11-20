import { prisma } from '../lib/prisma';
import { roundMoney, gramsToKg } from '@fatani/shared';

export class ReportService {
  static async getDashboard() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const firstDayOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);

    // 1. Today's sales
    const todaySales = await prisma.sale.findMany({
      where: {
        invoiceDate: { gte: today },
      },
      include: { items: true },
    });

    const todaySalesAmount = roundMoney(
      todaySales.reduce((sum, s) => sum + s.grandTotal, 0)
    );
    const todaySalesGrams = todaySales.reduce(
      (sum, s) => sum + s.items.reduce((iSum, item) => iSum + item.grams, 0),
      0
    );

    // 2. Today's payments received
    const todayPayments = await prisma.payment.aggregate({
      where: {
        type: 'CUSTOMER_PAYMENT',
        paymentDate: { gte: today },
      },
      _sum: { amount: true },
    });
    const todayPaymentsReceived = roundMoney(todayPayments._sum.amount || 0);

    // 3. Receivables & Payables
    const [customerReceivables, supplierPayables] = await Promise.all([
      prisma.customer.aggregate({
        where: { currentBalance: { gt: 0 } },
        _sum: { currentBalance: true },
      }),
      prisma.supplier.aggregate({
        where: { currentBalance: { gt: 0 } },
        _sum: { currentBalance: true },
      }),
    ]);

    const totalReceivables = roundMoney(customerReceivables._sum.currentBalance || 0);
    const totalSupplierPayables = roundMoney(supplierPayables._sum.currentBalance || 0);

    // 4. Inventory Stock & Valuation
    const activeLots = await prisma.purchaseLot.findMany({
      where: {
        status: 'ACTIVE',
        availableGrams: { gt: 0 },
      },
      select: {
        id: true,
        lotNumber: true,
        availableGrams: true,
        landedCostPerKg: true,
        product: { select: { name: true } },
      },
    });

    let totalAvailableStockGrams = 0;
    let totalInventoryValuation = 0;

    for (const lot of activeLots) {
      totalAvailableStockGrams += lot.availableGrams;
      const lotVal = (lot.availableGrams / 1000) * lot.landedCostPerKg;
      totalInventoryValuation += lotVal;
    }
    totalInventoryValuation = roundMoney(totalInventoryValuation);

    // 5. Month P&L (Accrual)
    const [monthSales, monthReturns, monthExpenses] = await Promise.all([
      prisma.sale.aggregate({
        where: { invoiceDate: { gte: firstDayOfMonth } },
        _sum: { grandTotal: true, totalCogs: true, grossProfit: true },
      }),
      prisma.salesReturn.aggregate({
        where: { returnDate: { gte: firstDayOfMonth } },
        _sum: { totalRefundAmount: true, totalCogsReversed: true },
      }),
      prisma.expense.aggregate({
        where: { date: { gte: firstDayOfMonth } },
        _sum: { amount: true },
      }),
    ]);

    const netSalesMonth = roundMoney(
      (monthSales._sum.grandTotal || 0) - (monthReturns._sum.totalRefundAmount || 0)
    );
    const cogsMonth = roundMoney(
      (monthSales._sum.totalCogs || 0) - (monthReturns._sum.totalCogsReversed || 0)
    );
    const monthGrossProfit = roundMoney(netSalesMonth - cogsMonth);
    const monthOperatingExpenses = roundMoney(monthExpenses._sum.amount || 0);
    const monthNetProfit = roundMoney(monthGrossProfit - monthOperatingExpenses);

    // 6. All-Time Totals: Purchases, Sales, Payments Received, Payments Paid
    const [allPurchasesAgg, allSalesAgg, allReceivedAgg, allPaidAgg] = await Promise.all([
      prisma.purchase.aggregate({
        _sum: { totalLandedCost: true },
      }),
      prisma.sale.aggregate({
        _sum: { grandTotal: true },
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

    const totalPurchases = roundMoney(allPurchasesAgg._sum.totalLandedCost || 0);
    const totalSales = roundMoney(allSalesAgg._sum.grandTotal || 0);
    const totalPaymentsReceived = roundMoney(allReceivedAgg._sum.amount || 0);
    const totalPaymentsPaid = roundMoney(allPaidAgg._sum.amount || 0);

    // 7. Recent Transactions: Sales, Purchases, Payments Received, Payments Paid
    const [
      recentSales,
      recentPurchases,
      recentPaymentsReceived,
      recentPaymentsPaid,
      overdueCustomers,
      lowStockLots,
    ] = await Promise.all([
      prisma.sale.findMany({
        take: 5,
        orderBy: { invoiceDate: 'desc' },
        include: {
          customer: { select: { id: true, name: true, phone: true } },
          items: { include: { product: { select: { name: true } }, lot: { select: { lotNumber: true } } } },
        },
      }),
      prisma.purchase.findMany({
        take: 5,
        orderBy: { purchaseDate: 'desc' },
        include: {
          supplier: { select: { id: true, name: true } },
          lots: { include: { product: { select: { name: true } } } },
        },
      }),
      prisma.payment.findMany({
        where: { type: 'CUSTOMER_PAYMENT' },
        take: 5,
        orderBy: { paymentDate: 'desc' },
        include: {
          customer: { select: { id: true, name: true } },
          allocations: {
            include: {
              sale: { select: { id: true, invoiceNumber: true } },
            },
          },
        },
      }),
      prisma.payment.findMany({
        where: { type: 'SUPPLIER_PAYMENT' },
        take: 5,
        orderBy: { paymentDate: 'desc' },
        include: {
          supplier: { select: { id: true, name: true } },
          allocations: {
            include: {
              purchase: { select: { id: true, purchaseNumber: true } },
            },
          },
        },
      }),
      prisma.customer.findMany({
        where: { currentBalance: { gt: 50000 } },
        take: 5,
        orderBy: { currentBalance: 'desc' },
        select: { id: true, name: true, shopName: true, phone: true, currentBalance: true, creditLimit: true },
      }),
      prisma.purchaseLot.findMany({
        where: {
          status: 'ACTIVE',
          availableGrams: { gt: 0, lte: 50000 }, // Under 50 KG
        },
        take: 5,
        orderBy: { availableGrams: 'asc' },
        include: { product: { select: { name: true } } },
      }),
    ]);

    // 8. Monthly Sales & Gross Profit Chart Data (Last 6 Months)
    const monthlyTrends: Array<{
      month: string;
      sales: number;
      cogs: number;
      grossProfit: number;
    }> = [];

    for (let i = 5; i >= 0; i--) {
      const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
      const nextMonth = new Date(today.getFullYear(), today.getMonth() - i + 1, 1);
      const monthName = d.toLocaleString('en-US', { month: 'short', year: '2-digit' });

      const mSales = await prisma.sale.aggregate({
        where: {
          invoiceDate: { gte: d, lt: nextMonth },
        },
        _sum: { grandTotal: true, totalCogs: true, grossProfit: true },
      });

      const salesVal = roundMoney(mSales._sum.grandTotal || 0);
      const cogsVal = roundMoney(mSales._sum.totalCogs || 0);
      const gpVal = roundMoney(salesVal - cogsVal);

      monthlyTrends.push({
        month: monthName,
        sales: salesVal,
        cogs: cogsVal,
        grossProfit: gpVal,
      });
    }

    return {
      totalPurchases,
      totalSales,
      totalPaymentsReceived,
      totalPaymentsPaid,
      todaySales: todaySalesAmount,
      todaySalesKg: gramsToKg(todaySalesGrams),
      todayPaymentsReceived,
      totalReceivables,
      totalSupplierPayables,
      totalAvailableStockGrams,
      totalAvailableStockKg: gramsToKg(totalAvailableStockGrams),
      totalInventoryValuation,
      monthGrossProfit,
      monthNetProfit,
      monthOperatingExpenses,
      recentSales,
      recentPurchases,
      recentPaymentsReceived,
      recentPaymentsPaid,
      overdueCustomers,
      lowStockLots: lowStockLots.map((l) => ({
        ...l,
        availableKg: gramsToKg(l.availableGrams),
      })),
      monthlyTrends,
    };
  }

  static async getProfitLoss(startDate?: string | Date, endDate?: string | Date) {
    const whereSale: any = {};
    const whereReturn: any = {};
    const whereExpense: any = {};

    if (startDate || endDate) {
      const dateFilter: any = {};
      if (startDate) dateFilter.gte = new Date(startDate);
      if (endDate) dateFilter.lte = new Date(endDate);

      whereSale.invoiceDate = dateFilter;
      whereReturn.returnDate = dateFilter;
      whereExpense.date = dateFilter;
    }

    const [salesAgg, returnsAgg, expensesByCategory] = await Promise.all([
      prisma.sale.aggregate({
        where: whereSale,
        _sum: { grandTotal: true, totalCogs: true, grossProfit: true },
      }),
      prisma.salesReturn.aggregate({
        where: whereReturn,
        _sum: { totalRefundAmount: true, totalCogsReversed: true },
      }),
      prisma.expense.groupBy({
        by: ['categoryId'],
        where: whereExpense,
        _sum: { amount: true },
      }),
    ]);

    // Populate category names
    const categoryIds = expensesByCategory.map((e) => e.categoryId);
    const categories = await prisma.expenseCategory.findMany({
      where: { id: { in: categoryIds } },
    });
    const categoryNameMap = new Map(categories.map((c) => [c.id, c.name]));

    const grossSales = roundMoney(salesAgg._sum.grandTotal || 0);
    const salesReturns = roundMoney(returnsAgg._sum.totalRefundAmount || 0);
    const netSales = roundMoney(grossSales - salesReturns);

    const grossCogs = roundMoney(salesAgg._sum.totalCogs || 0);
    const cogsReversed = roundMoney(returnsAgg._sum.totalCogsReversed || 0);
    const netCogs = roundMoney(grossCogs - cogsReversed);

    const grossProfit = roundMoney(netSales - netCogs);

    const operatingExpenseItems = expensesByCategory.map((e) => ({
      categoryId: e.categoryId,
      categoryName: categoryNameMap.get(e.categoryId) || 'Other Operating Expense',
      amount: roundMoney(e._sum.amount || 0),
    }));

    const totalOperatingExpenses = roundMoney(
      operatingExpenseItems.reduce((sum, item) => sum + item.amount, 0)
    );

    const netProfit = roundMoney(grossProfit - totalOperatingExpenses);

    return {
      revenue: {
        grossSales,
        salesReturns,
        netSales,
      },
      costOfGoodsSold: {
        grossCogs,
        cogsReversed,
        netCogs,
      },
      grossProfit,
      operatingExpenses: {
        items: operatingExpenseItems,
        total: totalOperatingExpenses,
      },
      netProfit,
      dateRange: {
        startDate: startDate ? new Date(startDate).toISOString() : null,
        endDate: endDate ? new Date(endDate).toISOString() : null,
      },
    };
  }

  static async getCashFlow(startDate?: string | Date, endDate?: string | Date) {
    const where: any = {};
    if (startDate || endDate) {
      where.date = {};
      if (startDate) where.date.gte = new Date(startDate);
      if (endDate) where.date.lte = new Date(endDate);
    }

    const transactions = await prisma.financialTransaction.findMany({
      where,
      orderBy: { date: 'asc' },
      include: { account: true },
    });

    let totalInflow = 0;
    let totalOutflow = 0;
    const customerCollections: any[] = [];
    const supplierDisbursements: any[] = [];
    const expenseDisbursements: any[] = [];
    const transfers: any[] = [];

    for (const t of transactions) {
      if (t.type === 'INFLOW') {
        totalInflow = roundMoney(totalInflow + t.amount);
        customerCollections.push(t);
      } else if (t.type === 'OUTFLOW') {
        totalOutflow = roundMoney(totalOutflow + t.amount);
        if (t.referenceType === 'SUPPLIER_PAYMENT') {
          supplierDisbursements.push(t);
        } else {
          expenseDisbursements.push(t);
        }
      } else if (t.type === 'TRANSFER') {
        transfers.push(t);
      }
    }

    const netCashFlow = roundMoney(totalInflow - totalOutflow);

    return {
      totalInflow,
      totalOutflow,
      netCashFlow,
      customerCollectionsCount: customerCollections.length,
      supplierDisbursementsCount: supplierDisbursements.length,
      expenseDisbursementsCount: expenseDisbursements.length,
      transfersCount: transfers.length / 2, // 2 entries per contra transfer
      dateRange: {
        startDate: startDate ? new Date(startDate).toISOString() : null,
        endDate: endDate ? new Date(endDate).toISOString() : null,
      },
    };
  }

  static async getInventoryReport() {
    const lots = await prisma.purchaseLot.findMany({
      include: {
        product: { include: { category: true } },
        purchase: {
          select: {
            purchaseNumber: true,
            purchaseDate: true,
            supplier: { select: { name: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    let totalAvailableGrams = 0;
    let totalValuation = 0;

    const items = lots.map((lot) => {
      totalAvailableGrams += lot.availableGrams;
      const val = roundMoney((lot.availableGrams / 1000) * lot.landedCostPerKg);
      totalValuation = roundMoney(totalValuation + val);

      return {
        id: lot.id,
        lotNumber: lot.lotNumber,
        productName: lot.product.name,
        category: lot.product.category.name,
        supplierName: lot.purchase.supplier.name,
        purchaseDate: lot.purchase.purchaseDate,
        purchasedKg: gramsToKg(lot.purchasedGrams),
        availableKg: gramsToKg(lot.availableGrams),
        soldKg: gramsToKg(lot.soldGrams),
        returnedKg: gramsToKg(lot.returnedGrams),
        purchaseRatePerKg: lot.purchaseRatePerKg,
        landedCostPerKg: lot.landedCostPerKg,
        inventoryValue: val,
        status: lot.status,
      };
    });

    return {
      totalLots: lots.length,
      totalAvailableKg: gramsToKg(totalAvailableGrams),
      totalInventoryValuation: totalValuation,
      lots: items,
    };
  }
}
