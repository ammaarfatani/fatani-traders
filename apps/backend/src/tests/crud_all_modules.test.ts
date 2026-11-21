import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { prisma } from '../lib/prisma';
import { CustomerService } from '../services/customer.service';
import { SupplierService } from '../services/supplier.service';
import { PurchaseService } from '../services/purchase.service';
import { SaleService } from '../services/sale.service';
import { PaymentService } from '../services/payment.service';
import { ExpenseService } from '../services/expense.service';
import { ReturnsService } from '../services/returns.service';
import { AccountService } from '../services/account.service';
import { ProductService } from '../services/product.service';

describe('ERP Comprehensive Edit and Delete Across All Modules', () => {
  let createdAccountIds: string[] = [];
  let createdSupplierIds: string[] = [];
  let createdCustomerIds: string[] = [];
  let createdPurchaseIds: string[] = [];
  let createdSaleIds: string[] = [];
  let createdExpenseIds: string[] = [];
  let createdCategoryIds: string[] = [];
  let createdProductCategoryIds: string[] = [];

  let testAccount: any;

  beforeAll(async () => {
    testAccount = await prisma.financialAccount.create({
      data: {
        name: 'CRUD Test Cash Drawer',
        type: 'CASH',
        openingBalance: 1000000,
        currentBalance: 1000000,
      },
    });
    createdAccountIds.push(testAccount.id);
  });

  afterAll(async () => {
    // Cleanup any lingering records safely
    for (const sid of createdSaleIds) {
      try {
        await prisma.salesReturnItem.deleteMany({ where: { salesReturn: { saleId: sid } } });
        await prisma.salesReturn.deleteMany({ where: { saleId: sid } });
        await prisma.saleItem.deleteMany({ where: { saleId: sid } });
        await prisma.customerLedgerEntry.deleteMany({ where: { referenceId: sid } });
        await prisma.sale.deleteMany({ where: { id: sid } });
      } catch (_) {}
    }

    for (const pid of createdPurchaseIds) {
      try {
        const lots = await prisma.purchaseLot.findMany({ where: { purchaseId: pid } });
        for (const lot of lots) {
          await prisma.saleItem.deleteMany({ where: { lotId: lot.id } });
          await prisma.inventoryMovement.deleteMany({ where: { lotId: lot.id } });
          await prisma.costAdjustment.deleteMany({ where: { lotId: lot.id } });
          await prisma.lotExpense.deleteMany({ where: { lotId: lot.id } });
          await prisma.purchaseLot.deleteMany({ where: { id: lot.id } });
        }
        await prisma.supplierLedgerEntry.deleteMany({ where: { referenceId: pid } });
        await prisma.purchase.deleteMany({ where: { id: pid } });
      } catch (_) {}
    }

    for (const eid of createdExpenseIds) {
      try {
        await prisma.financialTransaction.deleteMany({ where: { referenceId: eid } });
        await prisma.expense.deleteMany({ where: { id: eid } });
      } catch (_) {}
    }

    for (const cid of createdCustomerIds) {
      try {
        await prisma.customerLedgerEntry.deleteMany({ where: { customerId: cid } });
        await prisma.customer.deleteMany({ where: { id: cid } });
      } catch (_) {}
    }

    for (const sid of createdSupplierIds) {
      try {
        await prisma.supplierLedgerEntry.deleteMany({ where: { supplierId: sid } });
        await prisma.supplier.deleteMany({ where: { id: sid } });
      } catch (_) {}
    }

    for (const aid of createdAccountIds) {
      try {
        await prisma.financialTransaction.deleteMany({ where: { accountId: aid } });
        await prisma.financialAccount.deleteMany({ where: { id: aid } });
      } catch (_) {}
    }

    for (const catId of createdCategoryIds) {
      try {
        await prisma.expenseCategory.deleteMany({ where: { id: catId } });
      } catch (_) {}
    }

    for (const catId of createdProductCategoryIds) {
      try {
        await prisma.productCategory.deleteMany({ where: { id: catId } });
      } catch (_) {}
    }
  });

  describe('1. Customer CRUD and Safe Deletion Protection', () => {
    it('should create, update, and safely delete an unused customer', async () => {
      const customer = await CustomerService.createCustomer({
        name: 'CRUD Test Customer 1',
        phone: '03001112233',
        openingBalance: 0,
      });
      createdCustomerIds.push(customer.id);

      // Edit customer
      const updated = await CustomerService.updateCustomer(customer.id, {
        name: 'CRUD Test Customer 1 Renamed',
        creditLimit: 50000,
        notes: 'VIP customer',
      });
      expect(updated.name).toBe('CRUD Test Customer 1 Renamed');
      expect(updated.creditLimit).toBe(50000);

      // Delete unused customer
      const res = await CustomerService.deleteCustomer(customer.id);
      expect(res.success).toBe(true);

      const check = await prisma.customer.findUnique({ where: { id: customer.id } });
      expect(check).toBeNull();
    });

    it('should block deletion of customer with linked sales and allow deactivation', async () => {
      const customer = await CustomerService.createCustomer({
        name: 'CRUD Active Customer With Sales',
        phone: '03009998877',
      });
      createdCustomerIds.push(customer.id);

      // Create purchase lot to sell
      const purchaseRes = await PurchaseService.createPurchase({
        fabricName: 'Customer Test Lawn',
        weightKg: 50,
        purchaseRatePerKg: 800,
      });
      createdPurchaseIds.push(purchaseRes.purchase.id);

      const lot = purchaseRes.lot;
      expect(lot).toBeDefined();

      // Create sale
      const saleRes = await SaleService.createSale({
        customerId: customer.id,
        items: [{ lotId: lot.id, weightKg: 10, ratePerKg: 1200 }],
        paymentAccountId: testAccount.id,
      });
      createdSaleIds.push(saleRes.sale.id);

      // Attempt to delete customer with sales
      await expect(CustomerService.deleteCustomer(customer.id)).rejects.toThrow(
        /Cannot delete customer/
      );

      // Safe deactivation should succeed
      const deactivated = await CustomerService.updateCustomer(customer.id, { isActive: false });
      expect(deactivated.isActive).toBe(false);
    });
  });

  describe('2. Supplier CRUD and Safe Deletion Protection', () => {
    it('should create, update, and safely delete an unused supplier', async () => {
      const supplier = await SupplierService.createSupplier({
        name: 'CRUD Test Supplier 1',
        phone: '03112223344',
        openingBalance: 0,
      });
      createdSupplierIds.push(supplier.id);

      const updated = await SupplierService.updateSupplier(supplier.id, {
        name: 'CRUD Test Supplier 1 Renamed',
        companyName: 'Karachi Mills Ltd',
      });
      expect(updated.name).toBe('CRUD Test Supplier 1 Renamed');
      expect(updated.companyName).toBe('Karachi Mills Ltd');

      const res = await SupplierService.deleteSupplier(supplier.id);
      expect(res.success).toBe(true);

      const check = await prisma.supplier.findUnique({ where: { id: supplier.id } });
      expect(check).toBeNull();
    });

    it('should block deletion of supplier with linked purchases and allow deactivation', async () => {
      const supplier = await SupplierService.createSupplier({
        name: 'CRUD Active Supplier With Purchases',
        phone: '03334445566',
      });
      createdSupplierIds.push(supplier.id);

      const purchaseRes = await PurchaseService.createPurchase({
        supplierId: supplier.id,
        fabricName: 'Supplier Test Voile',
        weightKg: 40,
        purchaseRatePerKg: 700,
      });
      createdPurchaseIds.push(purchaseRes.purchase.id);

      await expect(SupplierService.deleteSupplier(supplier.id)).rejects.toThrow(
        /Cannot delete supplier/
      );

      const deactivated = await SupplierService.updateSupplier(supplier.id, { isActive: false });
      expect(deactivated.isActive).toBe(false);
    });
  });

  describe('3. Purchase & Landed Expenses CRUD & Inventory Safety', () => {
    it('should create purchase with landed expense, edit expense, and recalculate cost per KG', async () => {
      const purchaseRes = await PurchaseService.createPurchase({
        fabricName: 'Landed Expense Test Fabric',
        weightKg: 100, // 100,000 grams
        purchaseRatePerKg: 1000, // Base cost = 100,000 PKR
        expenses: [
          { category: 'Freight', amount: 5000, isCapitalized: true }, // Landed cost = 105,000 PKR (1,050/KG)
        ],
      });
      createdPurchaseIds.push(purchaseRes.purchase.id);

      let lot = await prisma.purchaseLot.findFirst({ where: { purchaseId: purchaseRes.purchase.id } });
      expect(lot!.landedCostPerKg).toBe(1050);

      // Add a second landed expense
      const addedExpenseRes = await PurchaseService.addPostPurchaseExpense({
        lotId: lot!.id,
        category: 'Loading',
        amount: 2000,
        isCapitalized: true,
      });

      lot = await prisma.purchaseLot.findFirst({ where: { purchaseId: purchaseRes.purchase.id } });
      expect(lot!.landedCostPerKg).toBe(1070); // 107,000 / 100 KG

      // Edit the added expense to 5000
      await PurchaseService.updateLotExpense(addedExpenseRes.expense.id, {
        amount: 5000,
      });

      lot = await prisma.purchaseLot.findFirst({ where: { purchaseId: purchaseRes.purchase.id } });
      expect(lot!.landedCostPerKg).toBe(1100); // 110,000 / 100 KG

      // Delete the expense
      await PurchaseService.deleteLotExpense(addedExpenseRes.expense.id);
      lot = await prisma.purchaseLot.findFirst({ where: { purchaseId: purchaseRes.purchase.id } });
      expect(lot!.landedCostPerKg).toBe(1050); // back to 105,000 / 100 KG
    });

    it('should update purchase weight and rate, and block reduction below sold weight', async () => {
      const purchaseRes = await PurchaseService.createPurchase({
        fabricName: 'Stock Safety Test Fabric',
        weightKg: 100,
        purchaseRatePerKg: 1000,
      });
      const purchase = purchaseRes.purchase;
      const lot = purchaseRes.lot;
      createdPurchaseIds.push(purchase.id);

      // Update purchase to 120 KG and 1100 PKR/KG
      const updated = await PurchaseService.updatePurchase(purchase.id, {
        weightKg: 120,
        purchaseRatePerKg: 1100,
      });
      expect(updated.lots[0].purchasedGrams).toBe(120000);
      expect(updated.baseCost).toBe(132000);

      // Customer buys 50 KG
      const customer = await CustomerService.createCustomer({
        name: 'Stock Safety Buyer',
        phone: '03445556677',
      });
      createdCustomerIds.push(customer.id);

      const saleRes = await SaleService.createSale({
        customerId: customer.id,
        items: [{ lotId: lot.id, weightKg: 50, ratePerKg: 1500 }],
      });
      createdSaleIds.push(saleRes.sale.id);

      // Attempt to reduce purchase weight to 40 KG (< 50 KG already sold)
      await expect(
        PurchaseService.updatePurchase(purchase.id, {
          weightKg: 40,
        })
      ).rejects.toThrow(/Cannot reduce purchase weight/);

      // Attempt to delete purchase while sold
      await expect(PurchaseService.deletePurchase(purchase.id)).rejects.toThrow(
        /cannot be deleted because/
      );

      // Delete the sale first
      await SaleService.deleteSale(saleRes.sale.id);

      // Now purchase deletion should succeed
      const delRes = await PurchaseService.deletePurchase(purchase.id);
      expect(delRes.success).toBe(true);

      const pCheck = await prisma.purchase.findUnique({ where: { id: purchase.id } });
      expect(pCheck).toBeNull();
    });
  });

  describe('4. Sale CRUD & Khata Consistency', () => {
    it('should create, edit items in sale, recalculate totals and revert on deletion', async () => {
      const customer = await CustomerService.createCustomer({
        name: 'Sale Edit Test Customer',
        phone: '03998887766',
      });
      createdCustomerIds.push(customer.id);

      const purchaseRes = await PurchaseService.createPurchase({
        fabricName: 'Sale Edit Fabric',
        weightKg: 100,
        purchaseRatePerKg: 1000,
      });
      createdPurchaseIds.push(purchaseRes.purchase.id);
      const lot = purchaseRes.lot;

      // Create Sale: 40 KG at 1500 PKR = 60,000 PKR
      const saleRes = await SaleService.createSale({
        customerId: customer.id,
        items: [{ lotId: lot.id, weightKg: 40, ratePerKg: 1500 }],
        discount: 2000,
      });
      const sale = saleRes.sale;
      createdSaleIds.push(sale.id);

      expect(sale.grandTotal).toBe(58000);

      let custCheck = await prisma.customer.findUnique({ where: { id: customer.id } });
      expect(custCheck!.currentBalance).toBe(58000);

      let lotCheck = await prisma.purchaseLot.findUnique({ where: { id: lot.id } });
      expect(lotCheck!.availableGrams).toBe(60000);
      expect(lotCheck!.soldGrams).toBe(40000);

      // Edit Sale: change to 30 KG at 1600 PKR = 48,000 PKR, discount 3000 = 45,000 PKR
      const updatedSale = await SaleService.updateSale(sale.id, {
        items: [{ lotId: lot.id, weightKg: 30, ratePerKg: 1600 }],
        discount: 3000,
      });
      expect(updatedSale.grandTotal).toBe(45000);

      custCheck = await prisma.customer.findUnique({ where: { id: customer.id } });
      expect(custCheck!.currentBalance).toBe(45000);

      lotCheck = await prisma.purchaseLot.findUnique({ where: { id: lot.id } });
      expect(lotCheck!.availableGrams).toBe(70000);
      expect(lotCheck!.soldGrams).toBe(30000);

      // Delete Sale
      const delRes = await SaleService.deleteSale(sale.id);
      expect(delRes.success).toBe(true);

      // Verify stock and customer khata completely restored
      custCheck = await prisma.customer.findUnique({ where: { id: customer.id } });
      expect(custCheck!.currentBalance).toBe(0);

      lotCheck = await prisma.purchaseLot.findUnique({ where: { id: lot.id } });
      expect(lotCheck!.availableGrams).toBe(100000);
      expect(lotCheck!.soldGrams).toBe(0);
    });
  });

  describe('5. Payments CRUD and Automatic Balance Reversal', () => {
    it('should create customer payment, update amount, and safely delete reversing khata', async () => {
      const customer = await CustomerService.createCustomer({
        name: 'Payment CRUD Customer',
        phone: '03776665544',
      });
      createdCustomerIds.push(customer.id);

      // Customer receives payment (advance or payment)
      const paymentRes = await PaymentService.recordCustomerPayment({
        customerId: customer.id,
        amount: 25000,
        accountId: testAccount.id,
        paymentDate: new Date(),
      });
      const payment = paymentRes.payment;

      let cust = await prisma.customer.findUnique({ where: { id: customer.id } });
      expect(cust!.currentBalance).toBe(-25000); // 25,000 credit/advance

      // Edit payment to 30,000
      await PaymentService.updatePayment(payment.id, {
        amount: 30000,
      });

      cust = await prisma.customer.findUnique({ where: { id: customer.id } });
      expect(cust!.currentBalance).toBe(-30000);

      // Delete payment
      const delRes = await PaymentService.deletePayment(payment.id);
      expect(delRes.success).toBe(true);

      cust = await prisma.customer.findUnique({ where: { id: customer.id } });
      expect(cust!.currentBalance).toBe(0);
    });
  });

  describe('6. Operating Expenses CRUD', () => {
    it('should create category, record expense, edit expense, and delete', async () => {
      const category = await ExpenseService.createCategory(
        'CRUD Test Utility Category',
        false,
        'Electricity & Generator'
      );
      createdCategoryIds.push(category.id);

      const expense = await ExpenseService.createOperatingExpense({
        categoryId: category.id,
        title: 'Electricity Bill Test',
        amount: 15000,
        date: new Date(),
        accountId: testAccount.id,
        isPaid: true,
      });
      createdExpenseIds.push(expense.id);

      // Update expense
      const updated = await ExpenseService.updateOperatingExpense(expense.id, {
        amount: 18000,
        title: 'Electricity Bill Test Updated',
      });
      expect(updated.amount).toBe(18000);

      // Delete expense
      const delRes = await ExpenseService.deleteOperatingExpense(expense.id);
      expect(delRes.success).toBe(true);

      // Delete category
      const delCatRes = await ExpenseService.deleteCategory(category.id);
      expect(delCatRes.success).toBe(true);
    });
  });

  describe('7. Sales & Purchase Returns Deletion', () => {
    it('should create sales return, restore stock, and revert cleanly on delete', async () => {
      const customer = await CustomerService.createCustomer({
        name: 'Return Test Customer',
        phone: '03887776655',
      });
      createdCustomerIds.push(customer.id);

      const purchaseRes = await PurchaseService.createPurchase({
        fabricName: 'Return Test Fabric',
        weightKg: 50,
        purchaseRatePerKg: 1000,
      });
      createdPurchaseIds.push(purchaseRes.purchase.id);
      const lot = purchaseRes.lot;

      const saleRes = await SaleService.createSale({
        customerId: customer.id,
        items: [{ lotId: lot.id, weightKg: 20, ratePerKg: 1500 }],
      });
      const sale = saleRes.sale;
      createdSaleIds.push(sale.id);

      const saleItem = await prisma.saleItem.findFirst({ where: { saleId: sale.id } });

      // Create return of 10 KG
      const sReturn = await ReturnsService.createSalesReturn({
        customerId: customer.id,
        saleId: sale.id,
        returnDate: new Date(),
        items: [{ saleItemId: saleItem!.id, returnedGrams: 10000, ratePerKg: 1500, isRestocked: true }],
      });

      let lotCheck = await prisma.purchaseLot.findUnique({ where: { id: lot.id } });
      expect(lotCheck!.availableGrams).toBe(40000); // 30,000 + 10,000 restocked

      // Delete the sales return
      const delRes = await ReturnsService.deleteSalesReturn(sReturn.salesReturn.id);
      expect(delRes.success).toBe(true);

      lotCheck = await prisma.purchaseLot.findUnique({ where: { id: lot.id } });
      expect(lotCheck!.availableGrams).toBe(30000); // restock reversed
    });
  });

  describe('8. Financial Accounts Safety', () => {
    it('should block deletion of account with transactions and allow deletion of unused account', async () => {
      const unusedAccount = await prisma.financialAccount.create({
        data: {
          name: 'Unused Test Account',
          type: 'BANK',
          openingBalance: 0,
          currentBalance: 0,
        },
      });

      // Update account
      const updated = await AccountService.updateAccount(unusedAccount.id, {
        name: 'Unused Test Account Renamed',
        bankName: 'HBL',
      });
      expect(updated.name).toBe('Unused Test Account Renamed');

      // Delete unused account
      const delRes = await AccountService.deleteAccount(unusedAccount.id);
      expect(delRes.success).toBe(true);

      // Create an account with a transaction
      const accountWithTx = await prisma.financialAccount.create({
        data: {
          name: 'Account With Tx',
          type: 'CASH',
          openingBalance: 1000,
          currentBalance: 1000,
        },
      });
      createdAccountIds.push(accountWithTx.id);

      await prisma.financialTransaction.create({
        data: {
          accountId: accountWithTx.id,
          type: 'INFLOW',
          amount: 500,
          balanceAfter: 1500,
          referenceType: 'TEST',
          referenceId: 'test-1',
          date: new Date(),
          description: 'Initial deposit',
        },
      });

      // Attempt to delete account which has transactions
      await expect(AccountService.deleteAccount(accountWithTx.id)).rejects.toThrow(
        /Cannot delete account/
      );
    });
  });
});
