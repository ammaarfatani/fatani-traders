import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
dotenv.config();

const prisma = new PrismaClient();

async function inspect() {
  try {
    const adminCount = await prisma.adminUser.count();
    const settingsCount = await prisma.businessSettings.count();
    const templateCount = await prisma.invoiceTemplate.count();
    const accountCount = await prisma.financialAccount.count();
    const expCatCount = await prisma.expenseCategory.count();
    const prodCatCount = await prisma.productCategory.count();
    const prodCount = await prisma.product.count();
    const supplierCount = await prisma.supplier.count();
    const customerCount = await prisma.customer.count();
    const purchaseCount = await prisma.purchase.count();
    const lotCount = await prisma.purchaseLot.count();
    const saleCount = await prisma.sale.count();
    const paymentCount = await prisma.payment.count();
    const expenseCount = await prisma.expense.count();
    const salesReturnCount = await prisma.salesReturn.count();

    console.log('DATABASE_INSPECTION_RESULT:');
    console.log(JSON.stringify({
      adminUsers: adminCount,
      businessSettings: settingsCount,
      invoiceTemplates: templateCount,
      financialAccounts: accountCount,
      expenseCategories: expCatCount,
      productCategories: prodCatCount,
      products: prodCount,
      suppliers: supplierCount,
      customers: customerCount,
      purchases: purchaseCount,
      purchaseLots: lotCount,
      sales: saleCount,
      payments: paymentCount,
      expenses: expenseCount,
      salesReturns: salesReturnCount
    }, null, 2));
  } catch (err) {
    console.error('Inspection failed:', err);
  } finally {
    await prisma.$disconnect();
  }
}

inspect();
