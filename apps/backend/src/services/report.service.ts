import { prisma } from '../lib/prisma';
import { roundMoney, gramsToKg } from '@fatani/shared';

const karachiDateKey = (date: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Karachi' }).format(date);
const shiftKarachiDate = (key: string, days: number) => {
  const date = new Date(`${key}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};
const karachiDateStart = (key: string) => new Date(`${key}T00:00:00+05:00`);
const shiftKarachiMonth = (key: string, months: number) => {
  const date = new Date(`${key.slice(0, 7)}-01T12:00:00Z`);
  date.setUTCMonth(date.getUTCMonth() + months);
  return date.toISOString().slice(0, 7) + '-01';
};

export class ReportService {
  static async getDashboard() {
    const todayKey = karachiDateKey(new Date());
    const tomorrowKey = shiftKarachiDate(todayKey, 1);
    const todayStart = karachiDateStart(todayKey);
    const tomorrowStart = karachiDateStart(tomorrowKey);
    const firstDayOfMonth = karachiDateStart(`${todayKey.slice(0, 7)}-01`);
    const nextMonthStart = karachiDateStart(`${shiftKarachiDate(`${todayKey.slice(0, 7)}-01`, 31).slice(0, 7)}-01`);

    // 1. Today's sales
    const todaySales = await prisma.sale.findMany({
      where: {
        invoiceDate: { gte: todayStart, lt: tomorrowStart },
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
    const todayCogs = roundMoney(todaySales.reduce((sum, sale) => sum + sale.totalCogs, 0));

    // 2. Today's payments received
    const todayPayments = await prisma.payment.aggregate({
      where: {
        type: 'CUSTOMER_PAYMENT',
        paymentDate: { gte: todayStart, lt: tomorrowStart },
      },
      _sum: { amount: true },
    });
    const todayPaymentsReceived = roundMoney(todayPayments._sum.amount || 0);
    const [todayExpenseAgg, todayReturns, todayMissingCostSales] = await Promise.all([
      prisma.expense.aggregate({ where: { date: { gte: todayStart, lt: tomorrowStart } }, _sum: { amount: true } }),
      prisma.salesReturn.aggregate({ where: { returnDate: { gte: todayStart, lt: tomorrowStart } }, _sum: { totalRefundAmount: true, totalCogsReversed: true } }),
      prisma.sale.count({ where: { invoiceDate: { gte: todayStart, lt: tomorrowStart }, grandTotal: { gt: 0 }, totalCogs: { lte: 0 } } }),
    ]);
    const todayOperatingExpenses = roundMoney(todayExpenseAgg._sum.amount || 0);
    const todayGrossProfit = todayMissingCostSales > 0 ? null : roundMoney(todaySalesAmount - (todayReturns._sum.totalRefundAmount || 0) - todayCogs + (todayReturns._sum.totalCogsReversed || 0));

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
    const [monthSales, monthReturns, monthExpenses, monthMissingCostSales] = await Promise.all([
      prisma.sale.aggregate({
        where: { invoiceDate: { gte: firstDayOfMonth, lt: nextMonthStart } },
        _sum: { grandTotal: true, totalCogs: true, grossProfit: true },
      }),
      prisma.salesReturn.aggregate({
        where: { returnDate: { gte: firstDayOfMonth, lt: nextMonthStart } },
        _sum: { totalRefundAmount: true, totalCogsReversed: true },
      }),
      prisma.expense.aggregate({
        where: { date: { gte: firstDayOfMonth, lt: nextMonthStart } },
        _sum: { amount: true },
      }),
      prisma.sale.count({ where: { invoiceDate: { gte: firstDayOfMonth, lt: nextMonthStart }, grandTotal: { gt: 0 }, totalCogs: { lte: 0 } } }),
    ]);

    const netSalesMonth = roundMoney(
      (monthSales._sum.grandTotal || 0) - (monthReturns._sum.totalRefundAmount || 0)
    );
    const cogsMonth = roundMoney(
      (monthSales._sum.totalCogs || 0) - (monthReturns._sum.totalCogsReversed || 0)
    );
    const monthGrossProfit = monthMissingCostSales > 0 ? null : roundMoney(netSalesMonth - cogsMonth);
    const monthOperatingExpenses = roundMoney(monthExpenses._sum.amount || 0);
    const monthNetProfit = monthGrossProfit === null ? null : roundMoney(monthGrossProfit - monthOperatingExpenses);

    // 6. All-Time Totals: Purchases, Sales, Payments Received, Payments Paid
    const [allPurchasesAgg, allSalesAgg, allReceivedAgg, allPaidAgg, allLotsWeightAgg] = await Promise.all([
      prisma.purchase.aggregate({
        _sum: { totalLandedCost: true, paidAmount: true, balanceAmount: true },
      }),
      prisma.sale.aggregate({
        _sum: { grandTotal: true },
      }),
      prisma.payment.aggregate({
        where: { type: 'CUSTOMER_PAYMENT' },
        _sum: { amount: true },
      }),
      prisma.payment.aggregate({
        where: { type: { in: ['SUPPLIER_PAYMENT', 'PURCHASE_PAYMENT'] } },
        _sum: { amount: true },
      }),
      prisma.purchaseLot.aggregate({
        _sum: { purchasedGrams: true },
      }),
    ]);

    const totalPurchases = roundMoney(allPurchasesAgg._sum.totalLandedCost || 0);
    const totalPurchasePayments = roundMoney(allPurchasesAgg._sum.paidAmount || 0);
    const totalOutstandingPurchases = roundMoney(allPurchasesAgg._sum.balanceAmount || 0);
    const totalPurchasedWeightKg = roundMoney((allLotsWeightAgg._sum.purchasedGrams || 0) / 1000);

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
        where: { type: { in: ['SUPPLIER_PAYMENT', 'PURCHASE_PAYMENT'] } },
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
      expenses: number;
      cogs: number;
      grossProfit: number;
      netProfit: number | null;
    }> = [];

    for (let i = 5; i >= 0; i--) {
      const monthFirst = shiftKarachiMonth(todayKey, -i);
      const monthStart = karachiDateStart(monthFirst);
      const nextMonthKey = shiftKarachiMonth(monthFirst, 1);
      const nextMonth = karachiDateStart(nextMonthKey);
      const monthName = new Intl.DateTimeFormat('en-US', { month: 'short', year: '2-digit', timeZone: 'Asia/Karachi' }).format(monthStart);

      const [mSales, mReturns, mExpenses, mMissingCostSales] = await Promise.all([
        prisma.sale.aggregate({ where: { invoiceDate: { gte: monthStart, lt: nextMonth } }, _sum: { grandTotal: true, totalCogs: true } }),
        prisma.salesReturn.aggregate({ where: { returnDate: { gte: monthStart, lt: nextMonth } }, _sum: { totalRefundAmount: true, totalCogsReversed: true } }),
        prisma.expense.aggregate({ where: { date: { gte: monthStart, lt: nextMonth } }, _sum: { amount: true } }),
        prisma.sale.count({ where: { invoiceDate: { gte: monthStart, lt: nextMonth }, grandTotal: { gt: 0 }, totalCogs: { lte: 0 } } }),
      ]);

      const salesVal = roundMoney((mSales._sum.grandTotal || 0) - (mReturns._sum.totalRefundAmount || 0));
      const cogsVal = roundMoney((mSales._sum.totalCogs || 0) - (mReturns._sum.totalCogsReversed || 0));
      const expensesVal = roundMoney(mExpenses._sum.amount || 0);
      const gpVal = roundMoney(salesVal - cogsVal);

      monthlyTrends.push({
        month: monthName,
        sales: salesVal,
        expenses: expensesVal,
        cogs: cogsVal,
        grossProfit: gpVal,
        netProfit: mMissingCostSales > 0 ? null : roundMoney(gpVal - expensesVal),
      });
    }

    return {
      totalPurchases,
      totalPurchasePayments,
      totalOutstandingPurchases,
      totalPurchasedWeightKg,
      totalSales,
      totalPaymentsReceived,
      totalPaymentsPaid,
      todaySales: todaySalesAmount,
      todayGrossProfit,
      todayProfitCostDataComplete: todayMissingCostSales === 0,
      todayOperatingExpenses,
      todaySalesKg: gramsToKg(todaySalesGrams),
      todayPaymentsReceived,
      totalReceivables,
      totalSupplierPayables,
      totalAvailableStockGrams,
      totalAvailableStockKg: gramsToKg(totalAvailableStockGrams),
      totalInventoryValuation,
      monthGrossProfit,
      monthSalesRevenue: netSalesMonth,
      monthNetProfit,
      monthProfitCostDataComplete: monthMissingCostSales === 0,
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

    const wherePayment: any = {};
    if (startDate || endDate) {
      const dateFilter: any = {};
      if (startDate) dateFilter.gte = new Date(startDate);
      if (endDate) dateFilter.lte = new Date(endDate);
      wherePayment.paymentDate = dateFilter;
    }

    const [salesAgg, returnsAgg, expensesByCategory, paymentsReceivedAgg, paymentsPaidAgg, receivableAgg, payableAgg, inventoryLots, missingCostSales] = await Promise.all([
      prisma.sale.aggregate({
        where: whereSale,
        _sum: { subtotal: true, discount: true, grandTotal: true, totalCogs: true },
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
      prisma.payment.aggregate({ where: { ...wherePayment, type: 'CUSTOMER_PAYMENT' }, _sum: { amount: true } }),
      prisma.payment.aggregate({ where: { ...wherePayment, type: { in: ['SUPPLIER_PAYMENT', 'PURCHASE_PAYMENT'] } }, _sum: { amount: true } }),
      prisma.customer.aggregate({ where: { currentBalance: { gt: 0 } }, _sum: { currentBalance: true } }),
      prisma.purchase.aggregate({ where: { balanceAmount: { gt: 0 } }, _sum: { balanceAmount: true } }),
      prisma.purchaseLot.findMany({ where: { status: 'ACTIVE', availableGrams: { gt: 0 } }, select: { availableGrams: true, landedCostPerKg: true } }),
      prisma.sale.count({ where: { ...whereSale, grandTotal: { gt: 0 }, totalCogs: { lte: 0 } } }),
    ]);

    // Populate category names
    const categoryIds = expensesByCategory.map((e) => e.categoryId);
    const categories = await prisma.expenseCategory.findMany({
      where: { id: { in: categoryIds } },
    });
    const categoryNameMap = new Map(categories.map((c) => [c.id, c.name]));

    const grossSales = roundMoney(salesAgg._sum.subtotal || 0);
    const discounts = roundMoney(salesAgg._sum.discount || 0);
    const salesReturns = roundMoney(returnsAgg._sum.totalRefundAmount || 0);
    const netSales = roundMoney(grossSales - discounts - salesReturns);

    const grossCogs = roundMoney(salesAgg._sum.totalCogs || 0);
    const cogsReversed = roundMoney(returnsAgg._sum.totalCogsReversed || 0);
    const netCogs = roundMoney(grossCogs - cogsReversed);

    const calculatedGrossProfit = roundMoney(netSales - netCogs);
    const grossProfit = missingCostSales > 0 ? null : calculatedGrossProfit;

    const operatingExpenseItems = expensesByCategory.map((e) => ({
      categoryId: e.categoryId,
      categoryName: categoryNameMap.get(e.categoryId) || 'Other Operating Expense',
      amount: roundMoney(e._sum.amount || 0),
    }));

    const totalOperatingExpenses = roundMoney(
      operatingExpenseItems.reduce((sum, item) => sum + item.amount, 0)
    );

    const netProfit = grossProfit === null ? null : roundMoney(grossProfit - totalOperatingExpenses);
    const currentInventoryQuantityKg = roundMoney(inventoryLots.reduce((sum, lot) => sum + lot.availableGrams, 0) / 1000);
    const currentInventoryValuation = roundMoney(inventoryLots.reduce((sum, lot) => sum + (lot.availableGrams / 1000) * lot.landedCostPerKg, 0));

    return {
      revenue: {
        grossSales,
        discounts,
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
      profitComplete: missingCostSales === 0,
      reconciliationWarnings: missingCostSales > 0 ? [`${missingCostSales} sale(s) in this period have no positive stored lot COGS. Profit is withheld until cost history is reconciled.`] : [],
      cashAndBalances: {
        paymentsReceived: roundMoney(paymentsReceivedAgg._sum.amount || 0),
        paymentsPaid: roundMoney(paymentsPaidAgg._sum.amount || 0),
        customerReceivables: roundMoney(receivableAgg._sum.currentBalance || 0),
        purchasePayables: roundMoney(payableAgg._sum.balanceAmount || 0),
      },
      inventory: { currentQuantityKg: currentInventoryQuantityKg, currentValuation: currentInventoryValuation },
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

    const activeStockLots = lots.filter((lot) => lot.status === 'ACTIVE' && lot.availableGrams > 0);
    let totalAvailableGrams = 0;
    let totalValuation = 0;

    const items = lots.map((lot) => {
      const val = roundMoney((lot.availableGrams / 1000) * lot.landedCostPerKg);

      return {
        id: lot.id,
        lotNumber: lot.lotNumber,
        productName: lot.product.name,
        category: lot.product.category.name,
        supplierName: lot.purchase.supplier?.name || 'Unknown Supplier',
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

    for (const lot of activeStockLots) {
      totalAvailableGrams += lot.availableGrams;
      totalValuation = roundMoney(totalValuation + (lot.availableGrams / 1000) * lot.landedCostPerKg);
    }

    return {
      totalLots: activeStockLots.length,
      totalAvailableKg: gramsToKg(totalAvailableGrams),
      totalInventoryValuation: totalValuation,
      lots: items,
    };
  }
}
