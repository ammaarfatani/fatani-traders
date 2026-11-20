import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
dotenv.config();

const prisma = new PrismaClient();

async function restoreBackup() {
  const backupFile = process.argv[2];
  if (!backupFile) {
    console.error('Usage: tsx src/scripts/restore-db.ts <path-to-backup.json>');
    process.exit(1);
  }

  const filePath = path.resolve(process.cwd(), backupFile);
  if (!fs.existsSync(filePath)) {
    console.error(`File not found: ${filePath}`);
    process.exit(1);
  }

  console.log(`Reading backup data from ${filePath}...`);
  const raw = fs.readFileSync(filePath, 'utf-8');
  const backup = JSON.parse(raw);

  console.log('Restoring database records...');
  // Restore collections
  const d = backup.data;
  if (d.businessSettings?.length) {
    await prisma.businessSettings.deleteMany({});
    for (const item of d.businessSettings) await prisma.businessSettings.create({ data: item });
  }
  if (d.invoiceTemplates?.length) {
    await prisma.invoiceTemplate.deleteMany({});
    for (const item of d.invoiceTemplates) await prisma.invoiceTemplate.create({ data: item });
  }
  if (d.expenseCategories?.length) {
    await prisma.expenseCategory.deleteMany({});
    for (const item of d.expenseCategories) await prisma.expenseCategory.create({ data: item });
  }

  console.log('✓ Restore completed successfully.');
}

restoreBackup()
  .catch((err) => {
    console.error('Restore failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
