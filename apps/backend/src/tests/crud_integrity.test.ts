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
