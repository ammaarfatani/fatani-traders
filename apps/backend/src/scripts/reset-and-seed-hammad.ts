import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
dotenv.config();

const prisma = new PrismaClient();

async function resetAndSeedNewAdmin() {
  const isConfirmed = process.argv.includes('--confirm-production-reset');
  if (!isConfirmed) {
    console.error('SAFETY BLOCK: You must pass --confirm-production-reset to execute this destructive operation.');
    process.exit(1);
  }

  console.log('--- STARTING CLEAN PRODUCTION DATABASE RESET & HAMMAD ADMIN INITIALIZATION ---');

  // 1. Clear all transactions, orders, returns, and allocations
  console.log('Clearing sales & purchase returns...');
  await prisma.salesReturnItem.deleteMany({});
  await prisma.salesReturn.deleteMany({});
  await prisma.purchaseReturn.deleteMany({});

  console.log('Clearing payment allocations & payments...');
  await prisma.paymentAllocation.deleteMany({});
  await prisma.payment.deleteMany({});

  console.log('Clearing sales & items...');
  await prisma.saleItem.deleteMany({});
  await prisma.sale.deleteMany({});

  console.log('Clearing inventory movements & adjustments...');
  await prisma.inventoryMovement.deleteMany({});
  await prisma.inventoryAdjustment.deleteMany({});
  await prisma.costAdjustment.deleteMany({});
  await prisma.lotExpense.deleteMany({});

  console.log('Clearing purchase lots & purchases...');
  await prisma.purchaseLot.deleteMany({});
  await prisma.purchase.deleteMany({});

  // 2. Clear products and categories (User requested: Total products: 0, Total fabric lots: 0)
  console.log('Clearing products...');
  await prisma.product.deleteMany({});

  // 3. Clear ledgers and parties
  console.log('Clearing customer & supplier ledgers...');
  await prisma.customerLedgerEntry.deleteMany({});
  await prisma.supplierLedgerEntry.deleteMany({});

  console.log('Clearing customers & suppliers...');
  await prisma.customer.deleteMany({});
  await prisma.supplier.deleteMany({});

  // 4. Clear financial transactions & expenses
  console.log('Clearing financial transactions & expenses...');
  await prisma.financialTransaction.deleteMany({});
  await prisma.expense.deleteMany({});

  // 5. Invalidate all existing sessions and audit logs
  console.log('Invalidating all active sessions...');
  await prisma.session.deleteMany({});
  await prisma.auditLog.deleteMany({});

  // 6. Reset all old admin accounts and create the new administrator
  console.log('Removing old admin accounts...');
  await prisma.adminUser.deleteMany({});

  const newAdminEmail = process.env.INITIAL_ADMIN_EMAIL || 'hammad@gmail.com';
  const newAdminPassword = process.env.INITIAL_ADMIN_PASSWORD;
  const newAdminName = process.env.INITIAL_ADMIN_NAME || 'Hammad Admin';

  if (!newAdminPassword) {
    throw new Error('INITIAL_ADMIN_PASSWORD environment variable is required to set the admin password.');
  }

  const salt = await bcrypt.genSalt(12);
  const passwordHash = await bcrypt.hash(newAdminPassword, salt);

  const newAdmin = await prisma.adminUser.create({
    data: {
      email: newAdminEmail,
      passwordHash,
      fullName: newAdminName,
      role: 'ADMIN',
      isActive: true,
    },
  });
  console.log(`✓ Created new administrator: ${newAdmin.email} (ID: ${newAdmin.id})`);

  // 7. Reset Financial Account balances to 0
  console.log('Resetting financial accounts...');
  await prisma.financialAccount.updateMany({
    data: {
      openingBalance: 0,
      currentBalance: 0,
    },
  });

  // 8. Ensure essential Business Settings & Invoice Template exist
  const existingSettings = await prisma.businessSettings.findFirst();
  if (!existingSettings) {
    await prisma.businessSettings.create({
      data: {
        businessName: 'Fatani Traders',
        tagline: 'Wholesale Fabric & Textile Trading ERP',
        phone: '+92 300 1234567',
        address: 'Shop # 14, Textile Plaza, M.A. Jinnah Road, Karachi, Pakistan',
        ntnOrTaxNumber: '42101-1234567-1',
        currencySymbol: 'PKR',
        weightUnit: 'KG',
      },
    });
  }

  const existingTemplate = await prisma.invoiceTemplate.findFirst();
  if (!existingTemplate) {
    await prisma.invoiceTemplate.create({
      data: {
        name: 'Standard Fatani Traders Invoice',
        businessName: 'Fatani Traders',
        businessAddress: 'Shop # 14, Textile Plaza, M.A. Jinnah Road, Karachi, Pakistan',
        phone: '+92 300 1234567 / +92 21 32415678',
        email: 'billing@fatanitraders.com',
        footerText: 'Thank you for your business! No claims or returns accepted after fabric is cut, washed, or dyed.',
        termsAndConditions: '1. Payment is due as agreed.\n2. In case of quality dispute, return intact rolls within 3 business days.\n3. Goods sold by weight in Kilograms and Grams.',
        primaryColor: '#172f35',
        showPreviousBalance: true,
        showTotalOutstanding: true,
        isDefault: true,
      },
    });
  }

  console.log('--- RESET & HAMMAD ADMIN INITIALIZATION COMPLETE ---');
}

resetAndSeedNewAdmin()
  .catch((err) => {
    console.error('Operation failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
