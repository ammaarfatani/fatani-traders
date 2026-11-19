import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '../lib/prisma';
import { PurchaseService } from '../services/purchase.service';
import { SaleService } from '../services/sale.service';
import { ReturnsService } from '../services/returns.service';
import { AccountService } from '../services/account.service';
import { CustomerService } from '../services/customer.service';
import { ReportService } from '../services/report.service';

describe('Fatani Traders End-to-End ERP Integration Workflow', { timeout: 60000 }, () => {
  let supplierId: string;
  let customerId: string;
  let productId: string;
  let cashAccountId: string;
  let bankAccountId: string;
  let purchaseId: string;
  let lotId: string;
  let saleId: string;
  let saleItemId: string;

  beforeAll(async () => {
    // 1. Fetch or create test dependencies
    let supplier = await prisma.supplier.findFirst({ where: { name: { contains: 'Al-Karam' } } });
    if (!supplier) {
      supplier = await prisma.supplier.create({
        data: { name: 'Al-Karam Mills', phone: '03001234567' },
      });
    }
    supplierId = supplier.id;

    let customer = await prisma.customer.findFirst({ where: { name: { contains: 'Tariq Garments' } } });
    if (!customer) {
      customer = await prisma.customer.create({
        data: { name: 'Tariq Garments', phone: '03019876543' },
      });
    }
    customerId = customer.id;

    let product = await prisma.product.findFirst();
    if (!product) {
      const cat = await prisma.productCategory.create({ data: { name: 'Test Category' } });
      product = await prisma.product.create({
        data: { name: 'Test Cotton Lawn', categoryId: cat.id },
      });
    }
    productId = product.id;

    let cashAcc = await prisma.financialAccount.findFirst({ where: { type: 'CASH' } });
    if (!cashAcc) {
      cashAcc = await prisma.financialAccount.create({
        data: { name: 'Test Cash Drawer', type: 'CASH', currentBalance: 100000 },
      });
    }
    cashAccountId = cashAcc.id;

    let bankAcc = await prisma.financialAccount.findFirst({ where: { type: 'BANK' } });
    if (!bankAcc) {
      bankAcc = await prisma.financialAccount.create({
        data: { name: 'Test Meezan Bank', type: 'BANK', currentBalance: 500000 },
      });
    }
    bankAccountId = bankAcc.id;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('Step 1: Creates Purchase with dynamic expenses and verifies Landed Cost calculation', async () => {
    // Purchased Weight: 2,000 KG
    // Purchase Rate: PKR 120/KG
    // Base Cost: PKR 240,000
    // Transport: PKR 5,000
    // Unloading Labor: PKR 3,000
    // Folding: PKR 2,000
    // Total Additional: PKR 10,000
    // Total Landed Cost: PKR 250,000
    // Actual Cost per KG: PKR 125
    const purchaseResult = await PurchaseService.createPurchase({
      supplierId,
      productId,
      purchaseDate: new Date(),
      weightKg: 2000,
      weightGrams: 0,
      purchaseRatePerKg: 120,
      expenses: [
        { category: 'Vehicle / Transport', amount: 5000, isCapitalized: true },
        { category: 'Unloading Labor', amount: 3000, isCapitalized: true },
        { category: 'Folding', amount: 2000, isCapitalized: true },
      ],
      supplierPaymentAmount: 40000,
      paymentAccountId: cashAccountId,
      notes: 'Test Purchase batch',
    });

    purchaseId = purchaseResult.purchase.id;
    lotId = purchaseResult.lot.id;

    expect(purchaseResult.landedCost.basePurchaseCost).toBe(240000);
    expect(purchaseResult.landedCost.totalAdditionalExpenses).toBe(10000);
    expect(purchaseResult.landedCost.totalLandedCost).toBe(250000);
    expect(purchaseResult.landedCost.actualCostPerKg).toBe(125);

    // Verify Lot in Database
    const lotInDb = await prisma.purchaseLot.findUnique({ where: { id: lotId } });
    expect(lotInDb).toBeDefined();
    expect(lotInDb?.purchasedGrams).toBe(2000000); // 2000 KG
    expect(lotInDb?.availableGrams).toBe(2000000);
    expect(lotInDb?.landedCostPerKg).toBe(125);
    expect(lotInDb?.status).toBe('ACTIVE');

    // Verify stock movement was recorded
    const movements = await prisma.inventoryMovement.findMany({ where: { lotId } });
    expect(movements.length).toBeGreaterThan(0);
    expect(movements[0].type).toBe('PURCHASE');
    expect(movements[0].gramsChange).toBe(2000000);
  });

  it('Step 2: Adds a subsequent post-purchase expense to the lot and verifies Landed Cost recalculation', async () => {
    // Additional packaging expense of PKR 6,000
    // New total landed cost: 250,000 + 6,000 = 256,000
    // New cost per KG: 256,000 / 2000 = PKR 128/KG
    const adjResult = await PurchaseService.addPostPurchaseExpense({
      lotId,
      category: 'Packaging',
      amount: 6000,
      isCapitalized: true,
      isPaid: false,
      date: new Date(),
      notes: 'Subsequent packaging bags invoice',
    });

    expect(adjResult.oldCostPerKg).toBe(125);
    expect(adjResult.newCostPerKg).toBe(128);
    expect(adjResult.newTotalLandedCost).toBe(256000);

    const updatedLot = await prisma.purchaseLot.findUnique({ where: { id: lotId } });
    expect(updatedLot?.landedCostPerKg).toBe(128);
  });

  it('Step 3: Sells partial stock to a customer with partial payment', async () => {
    // Customer buys 500 KG (500,000 grams) @ PKR 180/KG
    // Line Total: 500 * 180 = PKR 90,000
    // Discount: PKR 2,000
    // Grand Total: PKR 88,000
    // Immediate Payment: PKR 38,000
    // Balance Amount: PKR 50,000
    // COGS: 500 * 128 (landed cost) = PKR 64,000
    // Gross Profit: 88,000 - 64,000 = PKR 24,000

    const initialCustomer = await CustomerService.getCustomerById(customerId);
    const initialCustomerBal = initialCustomer.currentBalance;

    const saleResult = await SaleService.createSale({
      customerId,
      invoiceDate: new Date(),
      items: [
        {
          lotId,
          productId,
          totalGrams: 500000, // 500 KG
          sellingRatePerKg: 180,
        },
      ],
      discount: 2000,
      immediatePayment: 38000,
      paymentAccountId: cashAccountId,
      notes: 'First wholesale order',
    });

    saleId = saleResult.sale.id;
    saleItemId = saleResult.items[0].lotId; // lotId

    expect(saleResult.sale.subtotal).toBe(90000);
    expect(saleResult.sale.discount).toBe(2000);
    expect(saleResult.sale.grandTotal).toBe(88000);
    expect(saleResult.sale.paidAmount).toBe(38000);
    expect(saleResult.sale.balanceAmount).toBe(50000);
    expect(saleResult.sale.totalCogs).toBe(64000);
    expect(saleResult.sale.grossProfit).toBe(24000);

    // Verify Lot available stock decreased atomically by 500,000 grams
    const lotAfterSale = await prisma.purchaseLot.findUnique({ where: { id: lotId } });
    expect(lotAfterSale?.availableGrams).toBe(1500000); // 1,500 KG remaining
    expect(lotAfterSale?.soldGrams).toBe(500000);

    // Verify Customer Ledger was updated with debit of 88,000 and credit of 38,000 (net +50,000)
    const customerAfterSale = await CustomerService.getCustomerById(customerId);
    expect(customerAfterSale.currentBalance).toBe(initialCustomerBal + 50000);
  });

  it('Step 4: Prevents overselling when requested quantity exceeds available stock', async () => {
    // Current available stock is 1,500,000 grams (1,500 KG)
    // Attempting to sell 1,600,000 grams (1,600 KG) must fail with error
    await expect(
      SaleService.createSale({
        customerId,
        invoiceDate: new Date(),
        items: [
          {
            lotId,
            productId,
            totalGrams: 1600000, // 1600 KG exceeds 1500 KG available
            sellingRatePerKg: 180,
          },
        ],
      })
    ).rejects.toThrow(/Insufficient stock in Lot/);
  });

  it('Step 5: Processes a sales return with stock restock and customer khata adjustment', async () => {
    // Customer returns 50 KG (50,000 grams) from the sale
    // Selling rate: PKR 180/KG -> Refund value: 50 * 180 = PKR 9,000
    // COGS reversal: 50 * 128 = PKR 6,400
    // Restocked: true -> lot availableGrams increases by 50,000 grams to 1,550,000 grams
    const saleRecord = await prisma.sale.findUnique({
      where: { id: saleId },
      include: { items: true },
    });
    const itemToReturn = saleRecord!.items[0];

    const customerBeforeReturn = await CustomerService.getCustomerById(customerId);
    const balanceBeforeReturn = customerBeforeReturn.currentBalance;

    const returnResult = await ReturnsService.createSalesReturn({
      saleId,
      customerId,
      returnDate: new Date(),
      items: [
        {
          saleItemId: itemToReturn.id,
          lotId,
          returnedGrams: 50000, // 50 KG
          ratePerKg: 180,
          isRestocked: true,
        },
      ],
      notes: 'Customer returned 1 intact roll',
    });

    expect(returnResult.totalRefundValue).toBe(9000);
    expect(returnResult.totalCogsReversed).toBe(6400);

    // Verify stock restored
    const lotAfterReturn = await prisma.purchaseLot.findUnique({ where: { id: lotId } });
    expect(lotAfterReturn?.availableGrams).toBe(1550000); // 1,550 KG

    // Verify customer balance reduced by PKR 9,000
    const customerAfterReturn = await CustomerService.getCustomerById(customerId);
    expect(customerAfterReturn.currentBalance).toBe(balanceBeforeReturn - 9000);
  });

  it('Step 6: Tests internal account transfer (contra) between cash and bank', async () => {
    const cashBefore = (await prisma.financialAccount.findUnique({ where: { id: cashAccountId } }))!.currentBalance;
    const bankBefore = (await prisma.financialAccount.findUnique({ where: { id: bankAccountId } }))!.currentBalance;

    const transferAmount = 25000;
    const transferResult = await AccountService.transferFunds({
      fromAccountId: cashAccountId,
      toAccountId: bankAccountId,
      amount: transferAmount,
      date: new Date(),
      notes: 'Cash deposit into Meezan Bank',
    });

    expect(transferResult.fromAccount.balance).toBe(cashBefore - transferAmount);
    expect(transferResult.toAccount.balance).toBe(bankBefore + transferAmount);
  });

  it('Step 7: Validates Profit & Loss and Dashboard real-time accrual accuracy', async () => {
    const pl = await ReportService.getProfitLoss();
    expect(pl.revenue.grossSales).toBeGreaterThanOrEqual(88000);
    expect(pl.revenue.salesReturns).toBeGreaterThanOrEqual(9000);
    expect(pl.grossProfit).toBeDefined();

    const dashboard = await ReportService.getDashboard();
    expect(dashboard.totalAvailableStockGrams).toBeGreaterThan(0);
    expect(dashboard.totalInventoryValuation).toBeGreaterThan(0);
    expect(dashboard.totalCashAndBankBalance).toBeGreaterThan(0);
  });
});
