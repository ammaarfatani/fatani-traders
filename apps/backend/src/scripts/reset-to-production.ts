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

  console.log('Initiating safe production cleanup of business transactions...');

  await prisma.$transaction(async (tx) => {
    // 1. Returns
    await tx.salesReturnItem.deleteMany({});
    await tx.salesReturn.deleteMany({});
    await tx.purchaseReturn.deleteMany({});

    // 2. Payments & Allocations
    await tx.paymentAllocation.deleteMany({});
    await tx.payment.deleteMany({});

    // 3. Sales
    await tx.saleItem.deleteMany({});
    await tx.sale.deleteMany({});

    // 4. Purchases & Lots
    await tx.lotExpense.deleteMany({});
    await tx.purchaseLot.deleteMany({});
    await tx.purchase.deleteMany({});

    // 5. Ledgers
    await tx.customerLedgerEntry.deleteMany({});
    await tx.supplierLedgerEntry.deleteMany({});

    // 6. Customers & Suppliers
    await tx.customer.deleteMany({});
    await tx.supplier.deleteMany({});

    // 7. Inventory Adjustments & Financial Transactions
    await tx.inventoryAdjustment.deleteMany({});
    await tx.financialTransaction.deleteMany({});
    await tx.expense.deleteMany({});

    // 8. Reset Financial Account balances to 0
    await tx.financialAccount.updateMany({
      data: {
        openingBalance: 0,
        currentBalance: 0,
      },
    });
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
