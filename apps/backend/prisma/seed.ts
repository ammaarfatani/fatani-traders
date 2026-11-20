import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();

async function main() {
  console.log('--- INITIALIZING ESSENTIAL SYSTEM CONFIGURATION (CLEAN ZERO-DATA START) ---');

  // 1. Single Admin User (hammad@gmail.com)
  const adminEmail = (process.env.INITIAL_ADMIN_EMAIL || 'hammad@gmail.com').toLowerCase().trim();
  const adminPassword = process.env.INITIAL_ADMIN_PASSWORD || '12345678';
  const adminName = process.env.INITIAL_ADMIN_NAME || 'Hammad Admin';

  const existingAdmin = await prisma.adminUser.findUnique({
    where: { email: adminEmail },
  });

  if (!existingAdmin) {
    const salt = await bcrypt.genSalt(12);
    const passwordHash = await bcrypt.hash(adminPassword, salt);

    await prisma.adminUser.create({
      data: {
        email: adminEmail,
        passwordHash,
        fullName: adminName,
        role: 'ADMIN',
        isActive: true,
      },
    });
    console.log(`✓ Admin user created: ${adminEmail}`);
  } else {
    console.log(`✓ Admin user verified: ${adminEmail}`);
  }

  // 2. Business Settings
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
    console.log('✓ Business settings initialized');
  } else {
    console.log('✓ Business settings verified');
  }

  // 3. Invoice Template
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
        primaryColor: '#0f172a',
        showPreviousBalance: true,
        showTotalOutstanding: true,
        isDefault: true,
      },
    });
    console.log('✓ Invoice template initialized');
  } else {
    console.log('✓ Invoice template verified');
  }

  // 4. Default Financial Accounts (Opening and current balances strictly 0)
  const defaultAccounts = [
    { name: 'Shop Cash Drawer', type: 'CASH', openingBalance: 0, currentBalance: 0 },
    { name: 'Meezan Bank - Main Business A/c', type: 'BANK', bankName: 'Meezan Bank', accountNumber: '01020304050607', openingBalance: 0, currentBalance: 0 },
    { name: 'Habib Bank Limited (HBL)', type: 'BANK', bankName: 'HBL', accountNumber: '11223344556677', openingBalance: 0, currentBalance: 0 },
    { name: 'JazzCash / EasyPaisa Merchant', type: 'WALLET', accountNumber: '03001234567', openingBalance: 0, currentBalance: 0 },
  ];

  for (const acc of defaultAccounts) {
    const found = await prisma.financialAccount.findFirst({ where: { name: acc.name } });
    if (!found) {
      await prisma.financialAccount.create({ data: acc });
    }
  }
  console.log('✓ Financial accounts initialized with 0 balance');

  // 5. Default Expense Categories
  const expenseCategories = [
    { name: 'Vehicle / Transport', isCapitalizableDefault: true, description: 'Freight from mills/godown to shop' },
    { name: 'Unloading Labor', isCapitalizableDefault: true, description: 'Labor cost for unloading rolls/thaan' },
    { name: 'Loading Labor', isCapitalizableDefault: true, description: 'Loading cost at source' },
    { name: 'Folding & Rolling', isCapitalizableDefault: true, description: 'Fabric folding, rolling, and inspection labor' },
    { name: 'Packaging & Bales', isCapitalizableDefault: true, description: 'Plastic wraps, sacks, and ropes for rolls' },
    { name: 'Handling & Mazdoori', isCapitalizableDefault: true, description: 'Godown shifting and handling' },
    { name: 'Freight Inward', isCapitalizableDefault: true, description: 'Inter-city carriage and logistics' },
    { name: 'Godown / Shop Rent', isCapitalizableDefault: false, description: 'Monthly premises rent' },
    { name: 'Electricity & Utilities', isCapitalizableDefault: false, description: 'Utility bills' },
    { name: 'Staff Salaries & Wages', isCapitalizableDefault: false, description: 'Monthly staff salaries' },
    { name: 'Chai & Hospitality', isCapitalizableDefault: false, description: 'Tea and hospitality expenses' },
    { name: 'Vehicle Fuel & Maintenance', isCapitalizableDefault: false, description: 'Delivery bike/van fuel' },
    { name: 'Repair & Maintenance', isCapitalizableDefault: false, description: 'Shop repairs' },
    { name: 'Office & Stationery', isCapitalizableDefault: false, description: 'Office supplies' },
    { name: 'General Miscellaneous', isCapitalizableDefault: false, description: 'Unclassified operational expenses' },
  ];

  for (const cat of expenseCategories) {
    const found = await prisma.expenseCategory.findUnique({ where: { name: cat.name } });
    if (!found) {
      await prisma.expenseCategory.create({ data: cat });
    }
  }
  console.log('✓ Expense categories initialized');

  // 6. Fabric Product Categories
  const categories = [
    { name: 'Cotton Lawn', description: 'Pure cotton and blended fine lawn fabric rolls' },
    { name: 'Cotton Voile', description: 'Lightweight plain woven cotton fabric' },
    { name: 'Khaddar', description: 'Coarse winter cotton khaddar rolls' },
    { name: 'Wash & Wear Suiting', description: 'Polyester-viscose blended men suiting fabric' },
    { name: 'Linen', description: 'High quality linen rolls for clothing' },
    { name: 'Chiffon & Silk', description: 'Bember chiffon and pure silk rolls' },
  ];

  for (const cat of categories) {
    const found = await prisma.productCategory.findUnique({ where: { name: cat.name } });
    if (!found) {
      await prisma.productCategory.create({ data: cat });
    }
  }
  console.log('✓ Product categories initialized');

  console.log('==================================================');
  console.log('✓ ZERO BUSINESS DATA INJECTED: 0 Customers, 0 Suppliers, 0 Products, 0 Purchases, 0 Sales');
  console.log('==================================================');
}

main()
  .catch((e) => {
    console.error('Seeding error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
