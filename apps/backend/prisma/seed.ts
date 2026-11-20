import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding Fatani Traders ERP database...');

  // 1. Admin User
  const adminEmail = process.env.INITIAL_ADMIN_EMAIL || 'hammad@gmail.com';
  const adminPassword = process.env.INITIAL_ADMIN_PASSWORD;
  const adminName = process.env.INITIAL_ADMIN_NAME || 'Hammad Admin';

  if (!adminPassword) {
    throw new Error('INITIAL_ADMIN_PASSWORD environment variable is required to seed the admin account.');
  }

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
    console.log(`Admin user already exists: ${adminEmail}`);
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
  }

  // 4. Default Financial Accounts
  const defaultAccounts = [
    { name: 'Shop Cash Drawer', type: 'CASH', openingBalance: 50000, currentBalance: 50000 },
    { name: 'Meezan Bank - Main Business A/c', type: 'BANK', bankName: 'Meezan Bank', accountNumber: '01020304050607', openingBalance: 250000, currentBalance: 250000 },
    { name: 'Habib Bank Limited (HBL)', type: 'BANK', bankName: 'HBL', accountNumber: '11223344556677', openingBalance: 150000, currentBalance: 150000 },
    { name: 'JazzCash / EasyPaisa Merchant', type: 'WALLET', accountNumber: '03001234567', openingBalance: 20000, currentBalance: 20000 },
  ];

  for (const acc of defaultAccounts) {
    const found = await prisma.financialAccount.findFirst({ where: { name: acc.name } });
    if (!found) {
      await prisma.financialAccount.create({ data: acc });
    }
  }
  console.log('✓ Financial accounts initialized');

  // 5. Default Expense Categories (Capitalizable & Operating)
  const expenseCategories = [
    // Capitalizable Lot Expenses
    { name: 'Vehicle / Transport', isCapitalizableDefault: true, description: 'Freight from mills/godown to shop' },
    { name: 'Unloading Labor', isCapitalizableDefault: true, description: 'Labor cost for unloading rolls/thaan' },
    { name: 'Loading Labor', isCapitalizableDefault: true, description: 'Loading cost at source' },
    { name: 'Folding & Rolling', isCapitalizableDefault: true, description: 'Fabric folding, rolling, and inspection labor' },
    { name: 'Packaging & Bales', isCapitalizableDefault: true, description: 'Plastic wraps, sacks, and ropes for rolls' },
    { name: 'Handling & Mazdoori', isCapitalizableDefault: true, description: 'Godown shifting and handling' },
    { name: 'Freight Inward', isCapitalizableDefault: true, description: 'Inter-city carriage and logistics' },
    // General Operating Expenses
    { name: 'Godown / Shop Rent', isCapitalizableDefault: false, description: 'Monthly rental for premises' },
    { name: 'Electricity & Utilities', isCapitalizableDefault: false, description: 'K-Electric bills and utilities' },
    { name: 'Staff Salaries & Wages', isCapitalizableDefault: false, description: 'Monthly salaries and staff stipends' },
    { name: 'Chai & Hospitality', isCapitalizableDefault: false, description: 'Daily tea and snacks for customers/staff' },
    { name: 'Vehicle Fuel & Maintenance', isCapitalizableDefault: false, description: 'Shop delivery bike/van fuel' },
    { name: 'Repair & Maintenance', isCapitalizableDefault: false, description: 'Shop repairs and equipment upkeep' },
    { name: 'Office & Stationery', isCapitalizableDefault: false, description: 'Invoice books, pens, printer ink' },
    { name: 'General Miscellaneous', isCapitalizableDefault: false, description: 'Other unclassified expenses' },
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
    { name: 'Khaddar', description: 'Coarse hand-woven and mill-spun winter cotton khaddar' },
    { name: 'Wash & Wear Suiting', description: 'Polyester-viscose blended men suiting fabric' },
    { name: 'Linen', description: 'High quality linen rolls for clothing' },
    { name: 'Chiffon & Silk', description: 'Bember chiffon and pure silk rolls' },
  ];

  const categoryMap: Record<string, string> = {};
  for (const cat of categories) {
    let catRecord = await prisma.productCategory.findUnique({ where: { name: cat.name } });
    if (!catRecord) {
      catRecord = await prisma.productCategory.create({ data: cat });
    }
    categoryMap[cat.name] = catRecord.id;
  }
  console.log('✓ Product categories initialized');

  // 7. Fabric Products
  const products = [
    { name: 'Digital Print 80/80 Lawn', code: 'LAWN-8080-DP', categoryId: categoryMap['Cotton Lawn'], defaultUnit: 'KG' },
    { name: 'Dyed Plain 90/88 Lawn', code: 'LAWN-9088-DY', categoryId: categoryMap['Cotton Lawn'], defaultUnit: 'KG' },
    { name: 'Winter Mill Khaddar (Heavy)', code: 'KHD-WNT-HVY', categoryId: categoryMap['Khaddar'], defaultUnit: 'KG' },
    { name: 'Wash & Wear Tropical Suiting', code: 'WNW-TRP-01', categoryId: categoryMap['Wash & Wear Suiting'], defaultUnit: 'KG' },
    { name: 'Pure Fine Linen Slub', code: 'LIN-SLB-01', categoryId: categoryMap['Linen'], defaultUnit: 'KG' },
    { name: 'Crinkle Chiffon (70 GSM)', code: 'CHF-CRK-70', categoryId: categoryMap['Chiffon & Silk'], defaultUnit: 'KG' },
  ];

  for (const p of products) {
    const found = await prisma.product.findFirst({ where: { name: p.name } });
    if (!found) {
      await prisma.product.create({ data: p });
    }
  }
  console.log('✓ Fabric products initialized');

  // 8. Sample Suppliers
  const suppliers = [
    {
      name: 'Al-Karam Textile Mills Wholesale',
      companyName: 'Al-Karam Weaving & Finishing',
      phone: '03009211100',
      address: 'Landhi Industrial Area, Karachi',
      openingBalance: 0,
      currentBalance: 0,
      notes: 'Main mill supplier for premium lawn and digital fabrics',
    },
    {
      name: 'Sitara Textile Industries',
      companyName: 'Sitara Fabrics Faisalabad',
      phone: '03217654321',
      address: 'Faisalabad Textile Hub',
      openingBalance: 0,
      currentBalance: 0,
      notes: 'Direct Faisalabad mill supplier for khaddar and suiting',
    },
    {
      name: 'Haji Noor Muhammad & Sons',
      companyName: 'Noor Cloth Agency',
      phone: '03332198765',
      address: 'Cloth Market, Bolton Market, Karachi',
      openingBalance: 0,
      currentBalance: 0,
      notes: 'Local wholesale distributor for greige and processed fabric',
    },
  ];

  for (const s of suppliers) {
    const found = await prisma.supplier.findFirst({ where: { name: s.name } });
    if (!found) {
      await prisma.supplier.create({ data: s });
    }
  }
  console.log('✓ Suppliers initialized');

  // 9. Sample Customers
  const customers = [
    {
      name: 'Tariq Garments & Stitching Unit',
      shopName: 'Tariq Garments',
      phone: '03012345678',
      address: 'Sector 5-G, New Karachi Industrial Area',
      creditLimit: 500000,
      openingBalance: 0,
      currentBalance: 0,
      notes: 'Volume customer, purchases full rolls weekly',
    },
    {
      name: 'Bilal Cloth House',
      shopName: 'Bilal Cloth Store',
      phone: '03129876543',
      address: 'Rabi Center, Tariq Road, Karachi',
      creditLimit: 300000,
      openingBalance: 0,
      currentBalance: 0,
      notes: 'Retailer, pays within 10-15 days',
    },
    {
      name: 'Karachi Designer Boutique',
      shopName: 'K-Designer Studio',
      phone: '03345566778',
      address: 'Zamzama Commercial, DHA Phase 5, Karachi',
      creditLimit: 200000,
      openingBalance: 0,
      currentBalance: 0,
      notes: 'Purchases premium digital lawn and chiffon',
    },
    {
      name: 'Rehman Cutpiece & Fabric Center',
      shopName: 'Rehman Cloth Store',
      phone: '03451122334',
      address: 'Hydri Market, North Nazimabad, Karachi',
      creditLimit: 150000,
      openingBalance: 0,
      currentBalance: 0,
      notes: 'Regular cash and short-credit customer',
    },
  ];

  for (const c of customers) {
    const found = await prisma.customer.findFirst({ where: { name: c.name } });
    if (!found) {
      await prisma.customer.create({ data: c });
    }
  }
  console.log('✓ Customers initialized');

  console.log('==================================================');
  console.log('Database seeding completed successfully!');
  console.log(`Admin Login Email:    ${adminEmail}`);
  console.log(`Admin Login Password: ${adminPassword}`);
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
