import { describe, it, expect } from 'vitest';
import { prisma } from '../lib/prisma';
import { PurchaseService as Purchases } from '../services/purchase.service';
import { SaleService as Sales } from '../services/sale.service';
import { InventoryService as Inventory } from '../services/inventory.service';
import { ReturnsService as Returns } from '../services/returns.service';
import { ProductService as Products } from '../services/product.service';
import { ExpenseService as Expenses } from '../services/expense.service';
import { PaymentService as Payments } from '../services/payment.service';
import { CustomerService as Customers } from '../services/customer.service';
import { ReportService } from '../services/report.service';
import { requireAuth } from '../middleware/auth';
import { CustomerSchema, StockAdjustmentSchema } from '@fatani/shared';

async function purchase() { return Purchases.createPurchase({fabricName:`Integrity ${Date.now()}`,weightKg:10,purchaseRatePerKg:100}); }
async function sold() {
  const p = await purchase();
  const customer = await Customers.createCustomer({name:'Isolated integrity buyer',phone:'03001234567'});
  const {sale} = await Sales.createSale({customerId:customer.id,items:[{lotId:p.lot.id,weightKg:5,ratePerKg:200}]});
  const item = await prisma.saleItem.findFirstOrThrow({where:{saleId:sale.id}});
  return {p,customer,sale,item};
}

describe('Edit/delete integrity regressions in isolated local database',()=>{
  it('replays an identical purchase submission by purchase number without duplicating inventory or payments',async()=>{
    const request={purchaseNumber:`PUR-IDEMP-${Date.now()}`,fabricName:'Idempotent request fabric',weightKg:2,purchaseRatePerKg:400,supplierPaymentAmount:150};
    const first=await Purchases.createPurchase(request);
    const second=await Purchases.createPurchase(request);
    expect(second.purchase.id).toBe(first.purchase.id);
    expect(second.lot.id).toBe(first.lot.id);
    expect(await prisma.purchase.count({where:{purchaseNumber:request.purchaseNumber}})).toBe(1);
    expect(await prisma.purchaseLot.count({where:{purchaseId:first.purchase.id}})).toBe(1);
    expect(await prisma.payment.count({where:{purchaseId:first.purchase.id}})).toBe(1);
    await expect(Purchases.createPurchase({...request,fabricName:'Different request under same number'})).rejects.toThrow(/already in use/);
    expect(await prisma.purchase.count({where:{purchaseNumber:request.purchaseNumber}})).toBe(1);
    expect(await prisma.purchaseLot.count({where:{purchaseId:first.purchase.id}})).toBe(1);
  });
  it('returns purchase and sale list values with their summaries while including purchases without suppliers',async()=>{
    const p=await Purchases.createPurchase({fabricName:`Unknown supplier list ${Date.now()}`,weightKg:1,purchaseRatePerKg:250});
    const customer=await Customers.createCustomer({name:`Sales list buyer ${Date.now()}`,phone:`03${String(Date.now()).slice(-9)}`});
    const saleResult=await Sales.createSale({customerId:customer.id,items:[{lotId:p.lot.id,weightKg:0.5,ratePerKg:400}]});
    const purchaseResponse=await Purchases.getPurchases(1,100);
    const saleResponse=await Sales.getSales(1,100);
    expect(purchaseResponse.purchases.some((row:any)=>row.id===p.purchase.id)).toBe(true);
    expect(purchaseResponse.summary.totalPurchases).toBeGreaterThanOrEqual(250);
    expect(saleResponse.sales.some((row:any)=>row.id===saleResult.sale.id)).toBe(true);
    expect(saleResponse.summary.totalSales).toBeGreaterThanOrEqual(200);
  });
  it('replays an identical sale submission without deducting stock or recording its immediate receipt twice',async()=>{
    const p=await Purchases.createPurchase({fabricName:`Idempotent sale lot ${Date.now()}`,weightKg:2,purchaseRatePerKg:400});
    const customer=await Customers.createCustomer({name:`Idempotent sale buyer ${Date.now()}`,phone:`03${String(Date.now()).slice(-9)}`});
    const invoiceNumber=await Sales.generateInvoiceNumber();
    const request={invoiceNumber,customerId:customer.id,invoiceDate:'2026-11-22T00:00:00.000Z',items:[{lotId:p.lot.id,weightKg:1,ratePerKg:600}],discount:50,immediatePayment:100};
    const first=await Sales.createSale(request);
    const second=await Sales.createSale(request);
    expect(second.sale.id).toBe(first.sale.id);
    expect(await prisma.sale.count({where:{invoiceNumber}})).toBe(1);
    expect(await prisma.saleItem.count({where:{saleId:first.sale.id}})).toBe(1);
    expect(await prisma.payment.count({where:{allocations:{some:{saleId:first.sale.id}}}})).toBe(1);
    expect((await prisma.purchaseLot.findUniqueOrThrow({where:{id:p.lot.id}})).availableGrams).toBe(1000);
    await expect(Sales.createSale({...request,discount:0})).rejects.toThrow(/already in use/);
    expect((await prisma.purchaseLot.findUniqueOrThrow({where:{id:p.lot.id}})).availableGrams).toBe(1000);
  });
  it('groups operating expenses by Pakistan business date and reports category totals',async()=>{
    const category=await Expenses.createCategory(`Daily group ${Date.now()}`);
    await Expenses.createOperatingExpense({categoryId:category.id,title:'After-midnight Pakistan expense',amount:125,date:'2026-11-21T20:30:00.000Z',isPaid:false});
    const result=await Expenses.getOperatingExpenseAnalytics('2026-11-22','2026-11-22',category.id);
    expect(result.timezone).toBe('Asia/Karachi');
    expect(result.days).toHaveLength(1);
    expect(result.days[0].date).toBe('2026-11-22');
    expect(result.days[0].total).toBe(125);
    expect(result.categoryTotals[0].amount).toBe(125);
  });
  it('reconciles profit, discount, COGS, receipts, operating expense, and remaining stock from saved transactions',async()=>{
    const before=await ReportService.getProfitLoss();
    const p=await Purchases.createPurchase({fabricName:`P&L lot ${Date.now()}`,weightKg:2,purchaseRatePerKg:400});
    const customer=await Customers.createCustomer({name:`P&L customer ${Date.now()}`,phone:`03${String(Date.now()).slice(-9)}`});
    await Sales.createSale({customerId:customer.id,items:[{lotId:p.lot.id,weightKg:1,ratePerKg:600}],discount:50,immediatePayment:100});
    const category=await Expenses.createCategory(`P&L expense ${Date.now()}`);
    await Expenses.createOperatingExpense({categoryId:category.id,title:'P&L overhead',amount:30,date:new Date(),isPaid:false});
    const after=await ReportService.getProfitLoss();
    expect(after.revenue.grossSales-before.revenue.grossSales).toBe(600);
    expect(after.revenue.discounts-before.revenue.discounts).toBe(50);
    expect(after.revenue.netSales-before.revenue.netSales).toBe(550);
    expect(after.costOfGoodsSold.grossCogs-before.costOfGoodsSold.grossCogs).toBe(400);
    expect(after.grossProfit).not.toBeNull();
    expect(before.grossProfit).not.toBeNull();
    expect(after.grossProfit!-before.grossProfit!).toBe(150);
    expect(after.operatingExpenses.total-before.operatingExpenses.total).toBe(30);
    expect(after.netProfit).not.toBeNull();
    expect(before.netProfit).not.toBeNull();
    expect(after.netProfit!-before.netProfit!).toBe(120);
    expect(after.cashAndBalances.paymentsReceived-before.cashAndBalances.paymentsReceived).toBe(100);
    expect(after.inventory.currentQuantityKg-before.inventory.currentQuantityKg).toBe(1);
    expect(after.inventory.currentValuation-before.inventory.currentValuation).toBe(400);
  });
  it('preserves signed stock adjustments when purchase weight changes',async()=>{
    const p=await purchase();
    const a=await Inventory.adjustStock({lotId:p.lot.id,gramsChange:-1000,reason:'Damaged stock',date:new Date()});
    await Purchases.updatePurchase(p.purchase.id,{weightKg:12});
    expect((await Inventory.getLotById(p.lot.id)).availableGrams).toBe(11000);
    await Inventory.changeAdjustment(a.adjustment.id,{gramsChange:-2000});
    expect((await Inventory.getLotById(p.lot.id)).availableGrams).toBe(10000);
    await Inventory.changeAdjustment(a.adjustment.id,null);
    expect((await Inventory.getLotById(p.lot.id)).availableGrams).toBe(12000);
  });
  it('reconciles all-time purchase total, active inventory valuation, lot options, and deleted purchases',async()=>{
    const before=await ReportService.getDashboard();
    const inventoryBefore=await ReportService.getInventoryReport();
    const p=await Purchases.createPurchase({fabricName:'Dashboard reconciliation fabric',weightKg:10,purchaseRatePerKg:500,expenses:[{category:'Transport',amount:500,isCapitalized:true}]});
    const afterPurchase=await ReportService.getDashboard();
    const inventoryAfterPurchase=await ReportService.getInventoryReport();
    expect(afterPurchase.totalPurchases-before.totalPurchases).toBe(5500);
    expect(afterPurchase.totalAvailableStockKg-before.totalAvailableStockKg).toBe(10);
    expect(afterPurchase.totalInventoryValuation-before.totalInventoryValuation).toBe(5500);
    expect(inventoryAfterPurchase.totalLots-inventoryBefore.totalLots).toBe(1);
    expect(inventoryAfterPurchase.totalAvailableKg-inventoryBefore.totalAvailableKg).toBe(10);
    expect(inventoryAfterPurchase.totalInventoryValuation-inventoryBefore.totalInventoryValuation).toBe(5500);
    const eligibleLots=await Inventory.getAvailableLots();
    expect(eligibleLots.some(lot=>lot.id===p.lot.id && lot.availableKg===10)).toBe(true);
    const adjustment=await Inventory.adjustStock({lotId:p.lot.id,gramsChange:-2000,reason:'Dashboard calculation regression',date:new Date()});
    const afterAdjustment=await ReportService.getDashboard();
    const inventoryAfterAdjustment=await ReportService.getInventoryReport();
    expect(afterAdjustment.totalPurchases).toBe(afterPurchase.totalPurchases);
    expect(afterAdjustment.totalAvailableStockKg-before.totalAvailableStockKg).toBe(8);
    expect(afterAdjustment.totalInventoryValuation-before.totalInventoryValuation).toBe(4400);
    expect(inventoryAfterAdjustment.totalInventoryValuation-inventoryBefore.totalInventoryValuation).toBe(4400);
    await Inventory.changeAdjustment(adjustment.adjustment.id,null);
    await Purchases.deletePurchase(p.purchase.id);
    const afterDelete=await ReportService.getDashboard();
    const inventoryAfterDelete=await ReportService.getInventoryReport();
    expect(afterDelete.totalPurchases).toBe(before.totalPurchases);
    expect(afterDelete.totalAvailableStockKg).toBe(before.totalAvailableStockKg);
    expect(afterDelete.totalInventoryValuation).toBe(before.totalInventoryValuation);
    expect(inventoryAfterDelete.totalLots).toBe(inventoryBefore.totalLots);
    expect(inventoryAfterDelete.totalAvailableKg).toBe(inventoryBefore.totalAvailableKg);
    expect(inventoryAfterDelete.totalInventoryValuation).toBe(inventoryBefore.totalInventoryValuation);
  });
  it('blocks reversal of added stock once consumed',async()=>{
    const p=await purchase();
    const a=await Inventory.adjustStock({lotId:p.lot.id,gramsChange:1000,reason:'Found stock',date:new Date()});
    await Inventory.adjustStock({lotId:p.lot.id,gramsChange:-11000,reason:'Damaged stock',date:new Date()});
    await expect(Inventory.changeAdjustment(a.adjustment.id,null)).rejects.toThrow(/already been used/);
  });
  it('preserves adjustments when purchase deletion is blocked',async()=>{
    const p=await purchase();
    await Inventory.adjustStock({lotId:p.lot.id,gramsChange:1000,reason:'Found stock',date:new Date()});
    await expect(Purchases.deletePurchase(p.purchase.id)).rejects.toThrow(/adjustments/);
  });
  it('restores sold grams when a sales return is reversed',async()=>{
    const {p,customer,sale,item}=await sold();
    const r=await Returns.createSalesReturn({saleId:sale.id,customerId:customer.id,returnDate:new Date(),items:[{saleItemId:item.id,returnedGrams:1000,ratePerKg:200}]});
    await Returns.updateReturn('sales',r.salesReturn.id,{notes:'Corrected note'});
    expect((await prisma.salesReturn.findUniqueOrThrow({where:{id:r.salesReturn.id}})).notes).toBe('Corrected note');
    await Returns.deleteSalesReturn(r.salesReturn.id);
    const lot=await Inventory.getLotById(p.lot.id);
    expect(lot.availableGrams).toBe(5000); expect(lot.soldGrams).toBe(5000);
    expect((await Customers.getCustomerById(customer.id)).currentBalance).toBe(1000);
  });
  it('rejects cumulative over-returns',async()=>{
    const {customer,sale,item}=await sold();
    const data={saleId:sale.id,customerId:customer.id,returnDate:new Date(),items:[{saleItemId:item.id,returnedGrams:3000,ratePerKg:200}]};
    await Returns.createSalesReturn(data);
    await expect(Returns.createSalesReturn(data)).rejects.toThrow(/Cannot return more/);
  });
  it('reverses damaged return adjustment while retaining the original return audit record',async()=>{
    const {p,customer,sale,item}=await sold();
    const r=await Returns.createSalesReturn({saleId:sale.id,customerId:customer.id,returnDate:new Date(),items:[{saleItemId:item.id,returnedGrams:1000,ratePerKg:200,isRestocked:false}]});
    await Returns.deleteSalesReturn(r.salesReturn.id);
    const lot=await Inventory.getLotById(p.lot.id);
    expect(lot.availableGrams).toBe(5000); expect(lot.adjustedGrams).toBe(0);
    expect((await prisma.salesReturn.findUniqueOrThrow({where:{id:r.salesReturn.id}})).notes).toContain('[Reversed]');
  });
  it('blocks deletion of return stock that has been consumed',async()=>{
    const {p,customer,sale,item}=await sold();
    const r=await Returns.createSalesReturn({saleId:sale.id,customerId:customer.id,returnDate:new Date(),items:[{saleItemId:item.id,returnedGrams:1000,ratePerKg:200}]});
    await Inventory.adjustStock({lotId:p.lot.id,gramsChange:-6000,reason:'Damaged stock',date:new Date()});
    await expect(Returns.deleteSalesReturn(r.salesReturn.id)).rejects.toThrow(/already been used/);
    expect(await prisma.salesReturn.findUnique({where:{id:r.salesReturn.id}})).not.toBeNull();
  });
  it('reverses only actual cash refunded, including partial refunds',async()=>{
    const {customer,sale,item}=await sold();
    const account=await prisma.financialAccount.create({data:{name:'Isolated refund account',type:'CASH',currentBalance:500}});
    const r=await Returns.createSalesReturn({saleId:sale.id,customerId:customer.id,returnDate:new Date(),refundAccountId:account.id,refundAmount:50,items:[{saleItemId:item.id,returnedGrams:1000,ratePerKg:200}]});
    await Returns.deleteSalesReturn(r.salesReturn.id);
    expect((await prisma.financialAccount.findUniqueOrThrow({where:{id:account.id}})).currentBalance).toBe(500);
    expect((await Customers.getCustomerById(customer.id)).currentBalance).toBe(1000);
  });
  it('edits categories and blocks deleting referenced fabric categories',async()=>{
    const c=await Products.createCategory(`Integrity category ${Date.now()}`);
    const p=await Products.createProduct({name:'Unused fabric',categoryId:c.id});
    await Products.updateProduct(p.id,{name:'Corrected fabric'});
    await Products.updateCategory(c.id,`${c.name} updated`);
    await expect(Products.deleteCategory(c.id)).rejects.toThrow(/product/);
    await Products.deleteProduct(p.id); await Products.deleteCategory(c.id);
  });
  it('edits and deletes unused expense categories',async()=>{
    const c=await Expenses.createCategory(`Integrity expense ${Date.now()}`);
    expect((await Expenses.updateCategory(c.id,`${c.name} updated`)).name).toContain('updated');
    await Expenses.deleteCategory(c.id);
  });
  it('links purchase payments to their payment ledger entry and reverses it',async()=>{
    const supplier=await prisma.supplier.create({data:{name:`Payment ledger ${Date.now()}`,phone:'03001234567'}});
    const p=await Purchases.createPurchase({fabricName:'Supplier ledger fabric',supplierId:supplier.id,weightKg:10,purchaseRatePerKg:100});
    const result=await Payments.recordPurchasePayment({purchaseId:p.purchase.id,amount:100,paymentDate:new Date()});
    expect(await prisma.supplierLedgerEntry.findFirst({where:{referenceId:result.payment.id,type:'PAYMENT'}})).not.toBeNull();
    await Payments.deletePayment(result.payment.id);
    expect(await prisma.supplierLedgerEntry.findFirst({where:{referenceId:result.payment.id,type:'PAYMENT'}})).toBeNull();
    expect((await prisma.purchase.findUniqueOrThrow({where:{id:p.purchase.id}})).paidAmount).toBe(0);
    expect(await prisma.supplierLedgerEntry.findFirst({where:{referenceId:p.purchase.id,type:'PURCHASE'}})).not.toBeNull();
    expect((await prisma.supplier.findUniqueOrThrow({where:{id:supplier.id}})).currentBalance).toBe(1000);
  });
  it('lists immediate and later purchase payments once and reverses them with confirmed purchase deletion',async()=>{
    const supplier=await prisma.supplier.create({data:{name:`Delete payment supplier ${Date.now()}`,phone:'03001234567'}});
    const account=await prisma.financialAccount.create({data:{name:`Delete payment account ${Date.now()}`,type:'CASH',currentBalance:10000}});
    const initialAccountBalance=account.currentBalance;
    const initialSupplierBalance=supplier.currentBalance;
    const paymentSummaryBefore=(await Payments.getPayments(1,100,'SUPPLIER_PAYMENT,PURCHASE_PAYMENT')).summary.totalPaid;
    const dashboardBefore=(await ReportService.getDashboard()).totalPaymentsPaid;
    const p=await Purchases.createPurchase({fabricName:`Linked payment fabric ${Date.now()}`,supplierId:supplier.id,weightKg:10,purchaseRatePerKg:100,supplierPaymentAmount:200,paymentAccountId:account.id});
    expect((await prisma.financialAccount.findUniqueOrThrow({where:{id:account.id}})).currentBalance).toBe(9800);
    const later=await Payments.recordPurchasePayment({purchaseId:p.purchase.id,amount:300,paymentDate:new Date(),accountId:account.id});
    expect(later.purchase.paidAmount).toBe(500);
    expect((await prisma.purchase.findUniqueOrThrow({where:{id:p.purchase.id}})).balanceAmount).toBe(500);
    expect((await prisma.financialAccount.findUniqueOrThrow({where:{id:account.id}})).currentBalance).toBe(9500);
    const listed=await Payments.getPayments(1,100,'SUPPLIER_PAYMENT,PURCHASE_PAYMENT',p.purchase.purchaseNumber);
    const linked=listed.payments.filter((payment:any)=>payment.purchaseId===p.purchase.id || payment.allocations.some((allocation:any)=>allocation.purchaseId===p.purchase.id));
    expect(linked).toHaveLength(2);
    expect(linked.reduce((sum:number,payment:any)=>sum+payment.amount,0)).toBe(500);
    expect(listed.summary.totalPaid-paymentSummaryBefore).toBe(500);
    const detail=await Purchases.getPurchaseById(p.purchase.id);
    expect(detail.paymentAllocations.reduce((sum:number,allocation:any)=>sum+allocation.amount,0)).toBe(500);
    expect(detail.payments).toHaveLength(2);
    expect((await ReportService.getDashboard()).totalPaymentsPaid-dashboardBefore).toBe(500);

    await Purchases.deletePurchase(p.purchase.id);
    expect(await prisma.purchase.findUnique({where:{id:p.purchase.id}})).toBeNull();
    expect((await prisma.financialAccount.findUniqueOrThrow({where:{id:account.id}})).currentBalance).toBe(initialAccountBalance);
    expect((await prisma.supplier.findUniqueOrThrow({where:{id:supplier.id}})).currentBalance).toBe(initialSupplierBalance);
    const retained=await prisma.payment.findMany({where:{purchaseId:null,referenceNumber:p.purchase.purchaseNumber,type:'VOIDED_SUPPLIER_PAYMENT'},include:{allocations:true}});
    expect(retained).toHaveLength(2);
    expect(retained.reduce((sum,payment)=>sum+payment.amount,0)).toBe(500);
    expect(retained.flatMap(payment=>payment.allocations).every(allocation=>allocation.purchaseId===null)).toBe(true);
    const afterDeleteSummary=await Payments.getPayments(1,100,'SUPPLIER_PAYMENT,PURCHASE_PAYMENT');
    expect(afterDeleteSummary.summary.totalPaid).toBe(paymentSummaryBefore);
    expect(await prisma.supplierLedgerEntry.count({where:{supplierId:supplier.id,referenceId:p.purchase.id,type:'PURCHASE'}})).toBe(1);
    expect(await prisma.supplierLedgerEntry.count({where:{supplierId:supplier.id,type:'ADJUSTMENT'}})).toBeGreaterThanOrEqual(3);
  });
  it('retains shared supplier payments when deleting only one allocated purchase',async()=>{
    const supplier=await prisma.supplier.create({data:{name:`Shared payment supplier ${Date.now()}`,phone:'03001234567'}});
    const account=await prisma.financialAccount.create({data:{name:`Shared payment account ${Date.now()}`,type:'CASH',currentBalance:1000}});
    const p1=await Purchases.createPurchase({fabricName:'Shared payment lot one',supplierId:supplier.id,weightKg:1,purchaseRatePerKg:100});
    const p2=await Purchases.createPurchase({fabricName:'Shared payment lot two',supplierId:supplier.id,weightKg:2,purchaseRatePerKg:100});
    const result=await Payments.recordSupplierPayment({supplierId:supplier.id,accountId:account.id,amount:250,paymentDate:new Date(),purchaseId:p1.purchase.id});
    await Purchases.deletePurchase(p1.purchase.id);
    const retained=await prisma.payment.findUniqueOrThrow({where:{id:result.payment.id},include:{allocations:true}});
    expect(retained.type).toBe('SUPPLIER_PAYMENT');
    expect(retained.purchaseId).toBeNull();
    expect(retained.amount).toBe(250);
    expect(retained.allocations[0].purchaseId).toBeNull();
    expect((await prisma.purchase.findUniqueOrThrow({where:{id:p2.purchase.id}})).paidAmount).toBe(0);
    expect((await prisma.financialAccount.findUniqueOrThrow({where:{id:account.id}})).currentBalance).toBe(750);
  });
  it('includes legacy PURCHASE_PAYMENT records in the paid summary without allocation double-counting',async()=>{
    const before=(await Payments.getPayments(1,100,'SUPPLIER_PAYMENT,PURCHASE_PAYMENT')).summary.totalPaid;
    const payment=await prisma.payment.create({data:{paymentNumber:`LEGACY-${Date.now()}`,type:'PURCHASE_PAYMENT',amount:73,paymentDate:new Date(),referenceNumber:'Legacy migration fixture'}});
    const result=await Payments.getPayments(1,100,'SUPPLIER_PAYMENT,PURCHASE_PAYMENT','Legacy migration fixture');
    expect(result.payments.some(row=>row.id===payment.id)).toBe(true);
    expect(result.summary.totalPaid-before).toBe(73);
    await prisma.payment.delete({where:{id:payment.id}});
  });
  it('rejects blank names and fractional inventory grams',()=>{
    expect(CustomerSchema.safeParse({name:'   ',phone:'03001234567'}).success).toBe(false);
    expect(StockAdjustmentSchema.safeParse({lotId:'test',gramsChange:0.5,reason:'Found stock',date:new Date()}).success).toBe(false);
  });
  it('rejects unauthenticated API requests',async()=>{
    let error:any;
    await requireAuth({headers:{},cookies:{}} as any,{} as any,(e:any)=>{error=e;});
    expect(error.statusCode).toBe(401);
  });
});
