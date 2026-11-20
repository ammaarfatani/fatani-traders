import dns from 'dns';
dns.setServers(['8.8.8.8', '1.1.1.1']);

import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';
dotenv.config();

async function cleanupAtlasProduction() {
  const isConfirmed = process.argv.includes('--confirm-atlas-production-deletion');
  if (!isConfirmed) {
    console.error('SAFETY BLOCK: You must pass --confirm-atlas-production-deletion to execute this destructive operation.');
    process.exit(1);
  }

  const atlasUrl = (process.env.ATLAS_DATABASE_URL || process.env.DATABASE_URL || '').replace(/\"/g, '');
  console.log('Connecting to MongoDB Atlas Production...');
  const client = new MongoClient(atlasUrl, {
    serverSelectionTimeoutMS: 15000,
    connectTimeoutMS: 20000,
  });

  try {
    await client.connect();
    const db = client.db('fatani_traders');
    console.log('✓ Connected to MongoDB Atlas "fatani_traders".');

    console.log('\n--- EXECUTING ZERO-DATA CLEANUP ---');

    // 1. Returns
    const sri = await db.collection('SalesReturnItem').deleteMany({});
    const sr = await db.collection('SalesReturn').deleteMany({});
    const pr = await db.collection('PurchaseReturn').deleteMany({});
    console.log(`1. Sales/Purchase Returns cleared: ${sri.deletedCount} items, ${sr.deletedCount} sales returns, ${pr.deletedCount} purchase returns.`);

    // 2. Payments & Allocations
    const pa = await db.collection('PaymentAllocation').deleteMany({});
    const pay = await db.collection('Payment').deleteMany({});
    console.log(`2. Payments cleared: ${pa.deletedCount} allocations, ${pay.deletedCount} payments.`);

    // 3. Sales & Sale Items
    const si = await db.collection('SaleItem').deleteMany({});
    const s = await db.collection('Sale').deleteMany({});
    console.log(`3. Sales cleared: ${si.deletedCount} items, ${s.deletedCount} sales.`);

    // 4. Lot dependents & Adjustments
    const im = await db.collection('InventoryMovement').deleteMany({});
    const ia = await db.collection('InventoryAdjustment').deleteMany({});
    const ca = await db.collection('CostAdjustment').deleteMany({});
    const le = await db.collection('LotExpense').deleteMany({});
    console.log(`4. Lot movements & expenses cleared: ${im.deletedCount} movements, ${ia.deletedCount} adjustments, ${ca.deletedCount} cost adjustments, ${le.deletedCount} lot expenses.`);

    // 5. Purchase Lots & Purchases
    const pl = await db.collection('PurchaseLot').deleteMany({});
    const pur = await db.collection('Purchase').deleteMany({});
    console.log(`5. Purchases cleared: ${pl.deletedCount} purchase lots, ${pur.deletedCount} purchases.`);

    // 6. Ledgers
    const cle = await db.collection('CustomerLedgerEntry').deleteMany({});
    const sle = await db.collection('SupplierLedgerEntry').deleteMany({});
    console.log(`6. Ledgers cleared: ${cle.deletedCount} customer ledger entries, ${sle.deletedCount} supplier ledger entries.`);

    // 7. Customers & Suppliers
    const cust = await db.collection('Customer').deleteMany({});
    const sup = await db.collection('Supplier').deleteMany({});
    console.log(`7. Business contacts cleared: ${cust.deletedCount} customers, ${sup.deletedCount} suppliers.`);

    // 8. Products
    const prod = await db.collection('Product').deleteMany({});
    console.log(`8. Products cleared: ${prod.deletedCount} products.`);

    // 9. Financial Transactions, Expenses & Audit Logs
    const ft = await db.collection('FinancialTransaction').deleteMany({});
    const exp = await db.collection('Expense').deleteMany({});
    const al = await db.collection('AuditLog').deleteMany({});
    const sess = await db.collection('Session').deleteMany({});
    console.log(`9. Operational logs cleared: ${ft.deletedCount} financial transactions, ${exp.deletedCount} expenses, ${al.deletedCount} audit logs, ${sess.deletedCount} old sessions.`);

    // 10. Financial Accounts: Reset opening and current balances to 0
    const fa = await db.collection('FinancialAccount').updateMany({}, {
      $set: {
        openingBalance: 0,
        currentBalance: 0,
        updatedAt: new Date()
      }
    });
    console.log(`10. Financial accounts zeroed: ${fa.modifiedCount} accounts reset to Rs. 0.`);

    // 11. Admin Users: Keep ONLY hammad@gmail.com, delete all old admin users
    const oldAdmins = await db.collection('AdminUser').deleteMany({
      email: { $ne: 'hammad@gmail.com' }
    });
    console.log(`11. Admin users cleaned: Removed ${oldAdmins.deletedCount} obsolete admin accounts. Kept hammad@gmail.com.`);

    // Verification
    console.log('\n--- VERIFYING POST-CLEANUP COLLECTION COUNTS ---');
    const cols = await db.listCollections().toArray();
    const finalCounts: Record<string, number> = {};
    for (const col of cols) {
      finalCounts[col.name] = await db.collection(col.name).countDocuments();
    }
    console.table(Object.entries(finalCounts).map(([collection, count]) => ({ collection, count })));

    console.log('\n✓ ATLAS PRODUCTION DATABASE IS NOW COMPLETELY CLEAN!');
  } catch (err: any) {
    console.error('Cleanup failed:', err.message);
    process.exit(1);
  } finally {
    await client.close();
  }
}

cleanupAtlasProduction();
