import { Router } from 'express';
import { requireAuth } from '../middleware/auth';
import { authRateLimiter } from '../middleware/rateLimiter';

import { AuthController } from '../controllers/auth.controller';
import { PurchaseController } from '../controllers/purchase.controller';
import { SaleController } from '../controllers/sale.controller';
import { CustomerController } from '../controllers/customer.controller';
import { SupplierController } from '../controllers/supplier.controller';
import { InventoryController } from '../controllers/inventory.controller';
import { PaymentController } from '../controllers/payment.controller';
import { ReturnsController } from '../controllers/returns.controller';
import { ExpenseController } from '../controllers/expense.controller';
import { AccountController } from '../controllers/account.controller';
import { ReportController } from '../controllers/report.controller';
import { ProductController } from '../controllers/product.controller';
import { SettingsController } from '../controllers/settings.controller';

const router = Router();

// ================= AUTH ROUTES =================
router.post('/auth/login', authRateLimiter, AuthController.login);
router.post('/auth/logout', requireAuth, AuthController.logout);
router.get('/auth/me', requireAuth, AuthController.me);
router.post('/auth/change-password', requireAuth, AuthController.changePassword);

// ================= ALL ROUTES BELOW ARE PROTECTED =================
router.use(requireAuth);

// Purchases & Lots
router.post('/purchases', PurchaseController.create);
router.get('/purchases', PurchaseController.list);
router.get('/purchases/next-number', PurchaseController.getNextNumber);
router.get('/purchases/payable', PurchaseController.getPayable);
router.get('/purchases/:id', PurchaseController.getById);
router.put('/purchases/:id', PurchaseController.update);
router.delete('/purchases/:id', PurchaseController.delete);
router.post('/purchases/lots/:lotId/expense', PurchaseController.addExpense);
router.put('/purchases/expenses/:expenseId', PurchaseController.updateExpense);
router.delete('/purchases/expenses/:expenseId', PurchaseController.deleteExpense);

// Sales & Invoices
router.post('/sales', SaleController.create);
router.get('/sales', SaleController.list);
router.get('/sales/:id', SaleController.getById);
router.put('/sales/:id', SaleController.update);
router.delete('/sales/:id', SaleController.delete);

// Customers & Khata
router.get('/customers', CustomerController.list);
router.post('/customers', CustomerController.create);
router.get('/customers/:id', CustomerController.getById);
router.put('/customers/:id', CustomerController.update);
router.delete('/customers/:id', CustomerController.delete);
router.get('/customers/:id/statement', CustomerController.getStatement);

// Suppliers & Payables
router.get('/suppliers', SupplierController.list);
router.post('/suppliers', SupplierController.create);
router.get('/suppliers/:id', SupplierController.getById);
router.put('/suppliers/:id', SupplierController.update);
router.delete('/suppliers/:id', SupplierController.delete);
router.get('/suppliers/:id/statement', SupplierController.getStatement);

// Inventory & Lots
router.get('/inventory/lots', InventoryController.getAvailableLots);
router.get('/inventory/all-lots', InventoryController.getAllLots);
router.get('/inventory/lots/:id', InventoryController.getLotById);
router.put('/inventory/adjustments/:id', InventoryController.changeAdjustment);
router.delete('/inventory/adjustments/:id', InventoryController.changeAdjustment);
router.post('/inventory/adjust', InventoryController.adjustStock);

// Payments & Allocations
router.post('/payments', PaymentController.create);
router.get('/payments', PaymentController.list);
router.get('/payments/:id', PaymentController.getById);
router.put('/payments/:id', PaymentController.update);
router.delete('/payments/:id', PaymentController.delete);

// Returns (Sales & Purchases)
router.post('/returns/sales', ReturnsController.createSalesReturn);
router.get('/returns/sales', ReturnsController.listSalesReturns);
router.put('/returns/sales/:id', ReturnsController.update);
router.put('/returns/purchases/:id', ReturnsController.update);
router.delete('/returns/sales/:id', ReturnsController.deleteSalesReturn);
router.post('/returns/purchases', ReturnsController.createPurchaseReturn);
router.get('/returns/purchases', ReturnsController.listPurchaseReturns);
router.delete('/returns/purchases/:id', ReturnsController.deletePurchaseReturn);

// Operating Expenses
router.get('/expenses/categories', ExpenseController.listCategories);
router.post('/expenses/categories', ExpenseController.createCategory);
router.put('/expenses/categories/:id', ExpenseController.updateCategory);
router.delete('/expenses/categories/:id', ExpenseController.deleteCategory);
router.post('/expenses', ExpenseController.create);
router.get('/expenses', ExpenseController.list);
router.get('/expenses/:id', ExpenseController.getById);
router.put('/expenses/:id', ExpenseController.update);
router.delete('/expenses/:id', ExpenseController.delete);

// Financial Accounts & Cashbook/Bankbook
router.get('/accounts', AccountController.list);
router.post('/accounts', AccountController.create);
router.get('/accounts/:id', AccountController.getById);
router.put('/accounts/:id', AccountController.update);
router.delete('/accounts/:id', AccountController.delete);
router.post('/accounts/transfer', AccountController.transfer);

// Reports & Dashboard
router.get('/reports/dashboard', ReportController.getDashboard);
router.get('/reports/profit-loss', ReportController.getProfitLoss);
router.get('/reports/cash-flow', ReportController.getCashFlow);
router.get('/reports/inventory', ReportController.getInventoryReport);

// Products & Fabric Categories
router.get('/products/categories', ProductController.listCategories);
router.post('/products/categories', ProductController.createCategory);
router.put('/products/categories/:id', ProductController.updateCategory);
router.delete('/products/categories/:id', ProductController.deleteCategory);
router.get('/products', ProductController.list);
router.post('/products', ProductController.create);
router.put('/products/:id', ProductController.update);
router.delete('/products/:id', ProductController.delete);

// Business Settings, Templates & Audit Logs
router.get('/settings', SettingsController.getSettings);
router.put('/settings', SettingsController.updateSettings);
router.get('/settings/invoice-template', SettingsController.getInvoiceTemplate);
router.put('/settings/invoice-template', SettingsController.updateInvoiceTemplate);
router.get('/settings/audit-logs', SettingsController.getAuditLogs);

export default router;
