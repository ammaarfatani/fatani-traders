import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '../lib/prisma';
import { PurchaseService } from '../services/purchase.service';
import { PaymentService } from '../services/payment.service';
import { SaleService } from '../services/sale.service';
import { kgAndGramsToGrams } from '@fatani/shared';

describe('Fatani Traders Simplified Purchase & Lot-Based Payment Workflow', () => {
  let createdPurchaseIds: string[] = [];
  let testSupplierId: string;
  let testCustomerId: string;

  beforeAll(async () => {
    // 1. Create or ensure test supplier
    let supplier = await prisma.supplier.findFirst({
      where: { name: 'Test Mill Supplier' },
    });
    if (!supplier) {
      supplier = await prisma.supplier.create({
        data: {
          name: 'Test Mill Supplier',
          companyName: 'Test Mill Fabrics',
          phone: '03001234567',
          openingBalance: 0,
          currentBalance: 0,
        },
      });
    }
    testSupplierId = supplier.id;

    // 2. Create or ensure test customer
    let customer = await prisma.customer.findFirst({
      where: { name: 'Test Wholesale Customer' },
    });
    if (!customer) {
      customer = await prisma.customer.create({
        data: {
          name: 'Test Wholesale Customer',
          phone: '03219876543',
          openingBalance: 0,
          currentBalance: 0,
        },
      });
    }
    testCustomerId = customer.id;
  });

  afterAll(async () => {
    // Cleanup created test purchases
    for (const pid of createdPurchaseIds) {
      try {
        await prisma.paymentAllocation.deleteMany({ where: { purchaseId: pid } });
        await prisma.payment.deleteMany({ where: { purchaseId: pid } });
        const lots = await prisma.purchaseLot.findMany({ where: { purchaseId: pid } });
        for (const lot of lots) {
          await prisma.saleItem.deleteMany({ where: { lotId: lot.id } });
          await prisma.inventoryMovement.deleteMany({ where: { lotId: lot.id } });
          await prisma.lotExpense.deleteMany({ where: { lotId: lot.id } });
          await prisma.purchaseLot.delete({ where: { id: lot.id } });
        }
        await prisma.purchase.delete({ where: { id: pid } });
      } catch (e) {
        // ignore
      }
    }
    await prisma.$disconnect();
  });

  it('1. Weight calculations: accurately converts decimal KG and extra grams into integer grams', () => {
    // 2.5 KG = 2,500 grams
    expect(kgAndGramsToGrams(2.5, 0)).toBe(2500);
    // 2.2 KG = 2,200 grams
    expect(kgAndGramsToGrams(2.2, 0)).toBe(2200);
    // 2.5 KG + 200 extra grams = 2,700 grams
    expect(kgAndGramsToGrams(2.5, 200)).toBe(2700);
    // 10 KG + 350 grams = 10,350 grams
    expect(kgAndGramsToGrams(10, 350)).toBe(10350);
  });

  it('2. Creates purchase WITHOUT supplier (Unknown Supplier) and generates automatic invoice number', async () => {
    const res = await PurchaseService.createPurchase({
      fabricName: 'Lucky Diet',
      supplierId: null, // No supplier
      purchaseDate: new Date(),
      weightKg: 2.5,
      weightGrams: 200, // 2700 grams total
      purchaseRatePerKg: 1000,
      expenses: [{ category: 'Transport', amount: 300, isCapitalized: true }],
      supplierPaymentAmount: 0, // Unpaid
    });

    createdPurchaseIds.push(res.purchase.id);

    expect(res.purchase.supplierId).toBeNull();
    expect(res.purchase.purchaseNumber).toMatch(/^PUR-\d{6}$/);
    // Base cost: 2.7 KG * 1000 = 2700
    expect(res.purchase.baseCost).toBe(2700);
    // Total expenses: 300
    expect(res.purchase.totalExpenses).toBe(300);
    // Landed cost: 2700 + 300 = 3000
    expect(res.purchase.totalLandedCost).toBe(3000);
    expect(res.purchase.paidAmount).toBe(0);
    expect(res.purchase.balanceAmount).toBe(3000);

    // Lot verification
    expect(res.lot.purchasedGrams).toBe(2700);
    expect(res.lot.availableGrams).toBe(2700);
    // Landed cost per KG = 3000 / 2.7 = 1111.11
    expect(res.lot.landedCostPerKg).toBeCloseTo(1111.11, 1);
  });

  it('3. Creates purchase WITH supplier and verifies supplier ledger update', async () => {
    const initialSupplier = await prisma.supplier.findUnique({ where: { id: testSupplierId } });
    const initialBal = initialSupplier?.currentBalance || 0;

    const res = await PurchaseService.createPurchase({
      fabricName: 'Cotton Voile',
      supplierId: testSupplierId,
      purchaseDate: new Date(),
      weightKg: 10,
      weightGrams: 0,
      purchaseRatePerKg: 500,
      expenses: [{ category: 'Transport', amount: 500, isCapitalized: true }],
      supplierPaymentAmount: 2000, // Partial immediate payment
    });

    createdPurchaseIds.push(res.purchase.id);

    expect(res.purchase.supplierId).toBe(testSupplierId);
    // Base cost: 10 * 500 = 5000, Total Landed: 5000 + 500 = 5500
    expect(res.purchase.totalLandedCost).toBe(5500);
    expect(res.purchase.paidAmount).toBe(2000);
    expect(res.purchase.balanceAmount).toBe(3500);

    // Verify payment record created
    const pay = await prisma.payment.findFirst({
      where: { purchaseId: res.purchase.id },
    });
    expect(pay).toBeDefined();
    expect(pay?.amount).toBe(2000);

    // Supplier balance should increase by net owed (5500 - 2000 = 3500)
    const updatedSupplier = await prisma.supplier.findUnique({ where: { id: testSupplierId } });
    expect(updatedSupplier?.currentBalance).toBe(initialBal + 3500);
  });

  it('4. Free-text fabric names reuse internal product entity without duplicate entries', async () => {
    // 1st purchase with "Lucky One"
    const p1 = await PurchaseService.createPurchase({
      fabricName: 'Lucky One',
      supplierId: null,
      purchaseDate: new Date(),
      weightKg: 5,
      purchaseRatePerKg: 200,
    });
    createdPurchaseIds.push(p1.purchase.id);

    // 2nd purchase with "lucky one" (case-insensitive duplicate check)
    const p2 = await PurchaseService.createPurchase({
      fabricName: '  lucky one  ',
      supplierId: null,
      purchaseDate: new Date(),
      weightKg: 8,
      purchaseRatePerKg: 210,
    });
    createdPurchaseIds.push(p2.purchase.id);

    // Both should point to the SAME product ID
    expect(p1.lot.productId).toBe(p2.lot.productId);

    // But each purchase MUST have its own distinct lot!
    expect(p1.lot.id).not.toBe(p2.lot.id);
    expect(p1.lot.lotNumber).not.toBe(p2.lot.lotNumber);
  });

  it('5. Supports multiple dynamic additional expenses', async () => {
    const res = await PurchaseService.createPurchase({
      fabricName: 'Khaddar Special',
      supplierId: null,
      purchaseDate: new Date(),
      weightKg: 10,
      purchaseRatePerKg: 300,
      expenses: [
        { category: 'Transport', amount: 500 },
        { category: 'Loading', customName: 'Mill Loading Labor', amount: 200 },
        { category: 'Packaging', customName: 'Bales wrap', amount: 150 },
      ],
    });
    createdPurchaseIds.push(res.purchase.id);

    // Base cost: 10 * 300 = 3000. Expenses = 500 + 200 + 150 = 850.
    expect(res.purchase.baseCost).toBe(3000);
    expect(res.purchase.totalExpenses).toBe(850);
    expect(res.purchase.totalLandedCost).toBe(3850);

    const expensesInDb = await prisma.lotExpense.findMany({ where: { purchaseId: res.purchase.id } });
    expect(expensesInDb.length).toBe(3);
  });

  it('6. Does not create a payment record if immediate payment is zero', async () => {
    const res = await PurchaseService.createPurchase({
      fabricName: 'Wash & Wear Pure',
      supplierId: null,
      purchaseDate: new Date(),
      weightKg: 4,
      purchaseRatePerKg: 250,
      supplierPaymentAmount: 0,
    });
    createdPurchaseIds.push(res.purchase.id);

    const payments = await prisma.payment.findMany({ where: { purchaseId: res.purchase.id } });
    expect(payments.length).toBe(0);
  });

  it('7. Records subsequent payment against a specific purchase without supplier and updates balance', async () => {
    // 1. Create unpaid purchase without supplier
    const p = await PurchaseService.createPurchase({
      fabricName: 'Winter Linen',
      supplierId: null,
      purchaseDate: new Date(),
      weightKg: 10,
      purchaseRatePerKg: 400, // Total 4000
    });
    createdPurchaseIds.push(p.purchase.id);
    expect(p.purchase.balanceAmount).toBe(4000);

    // 2. Pay 1500 against this purchase
    const payRes1 = await PaymentService.recordPurchasePayment({
      purchaseId: p.purchase.id,
      amount: 1500,
      paymentDate: new Date(),
      notes: 'First installment',
    });

    expect(payRes1.remainingBalance).toBe(2500);
    expect(payRes1.purchase.paidAmount).toBe(1500);
    expect(payRes1.purchase.balanceAmount).toBe(2500);

    // 3. Pay remaining 2500
    const payRes2 = await PaymentService.recordPurchasePayment({
      purchaseId: p.purchase.id,
      amount: 2500,
      paymentDate: new Date(),
      notes: 'Final settlement',
    });

    expect(payRes2.remainingBalance).toBe(0);
    expect(payRes2.purchase.paidAmount).toBe(4000);
    expect(payRes2.purchase.balanceAmount).toBe(0);
  });

  it('8. Prevents overpayment exceeding purchase balance', async () => {
    const p = await PurchaseService.createPurchase({
      fabricName: 'Silk Blend',
      supplierId: null,
      purchaseDate: new Date(),
      weightKg: 5,
      purchaseRatePerKg: 200, // Total 1000
    });
    createdPurchaseIds.push(p.purchase.id);

    await expect(
      PaymentService.recordPurchasePayment({
        purchaseId: p.purchase.id,
        amount: 1500, // Exceeds balance of 1000
        paymentDate: new Date(),
      })
    ).rejects.toThrow(/exceed/i);
  });

  it('9. Retrieves payable purchases for the Pay Purchase dropdown', async () => {
    const payables = await PurchaseService.getPayablePurchases();
    expect(Array.isArray(payables)).toBe(true);
    for (const p of payables) {
      expect(p.balanceAmount).toBeGreaterThan(0);
      expect(p.displayText).toBeDefined();
    }
  });

  it('10. Compatibility: Allows selling stock from lot created via simplified purchase', async () => {
    // 1. Purchase 10 KG
    const p = await PurchaseService.createPurchase({
      fabricName: 'Sale Compatible Fabric',
      supplierId: null,
      purchaseDate: new Date(),
      weightKg: 10,
      purchaseRatePerKg: 300,
    });
    createdPurchaseIds.push(p.purchase.id);

    // 2. Sell 4 KG from this lot
    const sale = await SaleService.createSale({
      customerId: testCustomerId,
      invoiceDate: new Date(),
      items: [
        {
          lotId: p.lot.id,
          productId: p.lot.productId,
          totalGrams: 4000,
          sellingRatePerKg: 450,
        },
      ],
      immediatePayment: 1800,
    });

    expect(sale.sale.grandTotal).toBe(1800);

    // 3. Verify lot stock decreased: 10,000 - 4,000 = 6,000 grams
    const lotAfter = await prisma.purchaseLot.findUnique({ where: { id: p.lot.id } });
    expect(lotAfter?.availableGrams).toBe(6000);
    expect(lotAfter?.soldGrams).toBe(4000);

    // Cleanup sale
    await prisma.paymentAllocation.deleteMany({ where: { saleId: sale.sale.id } });
    await prisma.payment.deleteMany({ where: { allocations: { some: { saleId: sale.sale.id } } } });
    await prisma.customerLedgerEntry.deleteMany({ where: { referenceId: sale.sale.id } });
    await prisma.saleItem.deleteMany({ where: { saleId: sale.sale.id } });
    await prisma.sale.delete({ where: { id: sale.sale.id } });
  });
});
