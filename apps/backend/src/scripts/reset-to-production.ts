import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
dotenv.config();

const prisma = new PrismaClient();

async function resetToProduction() {
  const isConfirmed = process.argv.includes('--confirm-production-reset');
  if (!isConfirmed) {
    console.error('SAFETY BLOCK: You must pass --confirm-production-reset to execute this destructive operation.');
    process.exit(1);
  }

  console.log('Initiating safe production cleanup of business transactions in dependency order...');

  // 1. Returns items & returns
  console.log('1/10 Clearing sales & purchase returns...');
  await prisma.salesReturnItem.deleteMany({});
  await prisma.salesReturn.deleteMany({});
  await prisma.purchaseReturn.deleteMany({});

  // 2. Payments & Allocations
  console.log('2/10 Clearing payments & allocations...');
  await prisma.paymentAllocation.deleteMany({});
  await prisma.payment.deleteMany({});

  // 3. Sales & Sale Items
  console.log('3/10 Clearing sales & sale items...');
  await prisma.saleItem.deleteMany({});
  await prisma.sale.deleteMany({});

  // 4. Lot dependents (Inventory Movements, Adjustments, Cost Adjustments, Lot Expenses)
  console.log('4/10 Clearing lot dependents (movements, adjustments, cost adjustments, expenses)...');
  await prisma.inventoryMovement.deleteMany({});
  await prisma.inventoryAdjustment.deleteMany({});
  await prisma.costAdjustment.deleteMany({});
  await prisma.lotExpense.deleteMany({});

  // 5. Purchase Lots
  console.log('5/10 Clearing purchase lots...');
  await prisma.purchaseLot.deleteMany({});

  // 6. Purchases
  console.log('6/10 Clearing purchases...');
  await prisma.purchase.deleteMany({});

  // 7. Ledgers
  console.log('7/10 Clearing customer & supplier ledgers...');
  await prisma.customerLedgerEntry.deleteMany({});
  await prisma.supplierLedgerEntry.deleteMany({});

  // 8. Customers & Suppliers
  console.log('8/10 Clearing demo customers & suppliers...');
  await prisma.customer.deleteMany({});
  await prisma.supplier.deleteMany({});

  // 9. Financial Transactions, Expenses & Audit Logs
  console.log('9/10 Clearing financial transactions, expenses & audit logs...');
  await prisma.financialTransaction.deleteMany({});
  await prisma.expense.deleteMany({});
  await prisma.auditLog.deleteMany({});

  // 10. Reset Financial Account balances to 0
  console.log('10/10 Resetting financial account balances to zero...');
  await prisma.financialAccount.updateMany({
    data: {
      openingBalance: 0,
      currentBalance: 0,
    },
  });

  console.log('✓ Successfully wiped all demo/test transactions, customers, suppliers, purchases, and sales.');
  console.log('✓ Preserved: Admin users, business settings, invoice templates, accounts (zeroed), expense categories, product categories.');
}

resetToProduction()
  .catch((err) => {
    console.error('Reset failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
