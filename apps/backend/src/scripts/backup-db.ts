import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
dotenv.config();

const prisma = new PrismaClient();

async function createBackup() {
  const backupDir = path.resolve(process.cwd(), 'backups');
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupFilePath = path.join(backupDir, `fatani_traders_backup_${timestamp}.json`);

  console.log(`Creating database backup to ${backupFilePath}...`);

  const [
    adminUsers,
    sessions,
    businessSettings,
    invoiceTemplates,
    financialAccounts,
    expenseCategories,
    productCategories,
    products,
    suppliers,
    customers,
    purchases,
    purchaseLots,
    lotExpenses,
    costAdjustments,
    sales,
    saleItems,
    salesReturns,
    salesReturnItems,
    purchaseReturns,
    payments,
    paymentAllocations,
    financialTransactions,
    expenses,
    inventoryMovements,
    inventoryAdjustments,
    customerLedgerEntries,
    supplierLedgerEntries,
    auditLogs,
  ] = await Promise.all([
    prisma.adminUser.findMany(),
    prisma.session.findMany(),
    prisma.businessSettings.findMany(),
    prisma.invoiceTemplate.findMany(),
    prisma.financialAccount.findMany(),
    prisma.expenseCategory.findMany(),
    prisma.productCategory.findMany(),
    prisma.product.findMany(),
    prisma.supplier.findMany(),
    prisma.customer.findMany(),
    prisma.purchase.findMany(),
    prisma.purchaseLot.findMany(),
    prisma.lotExpense.findMany(),
    prisma.costAdjustment.findMany(),
    prisma.sale.findMany(),
    prisma.saleItem.findMany(),
    prisma.salesReturn.findMany(),
    prisma.salesReturnItem.findMany(),
    prisma.purchaseReturn.findMany(),
    prisma.payment.findMany(),
    prisma.paymentAllocation.findMany(),
    prisma.financialTransaction.findMany(),
    prisma.expense.findMany(),
    prisma.inventoryMovement.findMany(),
    prisma.inventoryAdjustment.findMany(),
    prisma.customerLedgerEntry.findMany(),
    prisma.supplierLedgerEntry.findMany(),
    prisma.auditLog.findMany(),
  ]);

  const backupData = {
    metadata: {
      timestamp: new Date().toISOString(),
      database: 'fatani_traders',
      version: '1.0.0',
    },
    counts: {
      adminUsers: adminUsers.length,
      sessions: sessions.length,
      businessSettings: businessSettings.length,
      invoiceTemplates: invoiceTemplates.length,
      financialAccounts: financialAccounts.length,
      expenseCategories: expenseCategories.length,
      productCategories: productCategories.length,
      products: products.length,
      suppliers: suppliers.length,
      customers: customers.length,
      purchases: purchases.length,
      purchaseLots: purchaseLots.length,
      lotExpenses: lotExpenses.length,
      costAdjustments: costAdjustments.length,
      sales: sales.length,
      saleItems: saleItems.length,
      salesReturns: salesReturns.length,
      salesReturnItems: salesReturnItems.length,
      purchaseReturns: purchaseReturns.length,
      payments: payments.length,
      paymentAllocations: paymentAllocations.length,
      financialTransactions: financialTransactions.length,
      expenses: expenses.length,
      inventoryMovements: inventoryMovements.length,
      inventoryAdjustments: inventoryAdjustments.length,
      customerLedgerEntries: customerLedgerEntries.length,
      supplierLedgerEntries: supplierLedgerEntries.length,
      auditLogs: auditLogs.length,
    },
    data: {
      adminUsers,
      sessions,
      businessSettings,
      invoiceTemplates,
      financialAccounts,
      expenseCategories,
      productCategories,
      products,
      suppliers,
      customers,
      purchases,
      purchaseLots,
      lotExpenses,
      costAdjustments,
      sales,
      saleItems,
      salesReturns,
      salesReturnItems,
      purchaseReturns,
      payments,
      paymentAllocations,
      financialTransactions,
      expenses,
      inventoryMovements,
      inventoryAdjustments,
      customerLedgerEntries,
      supplierLedgerEntries,
      auditLogs,
    },
  };

  fs.writeFileSync(backupFilePath, JSON.stringify(backupData, null, 2), 'utf-8');
  console.log(`✓ Backup successfully created! File: ${backupFilePath}`);
  console.log('Record counts in backup:', JSON.stringify(backupData.counts, null, 2));

  return { backupFilePath, counts: backupData.counts };
}

createBackup()
  .catch((err) => {
    console.error('Backup failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
