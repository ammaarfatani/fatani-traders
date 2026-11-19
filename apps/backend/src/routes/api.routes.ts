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
router.get('/purchases/:id', PurchaseController.getById);
router.post('/purchases/lots/:lotId/expense', PurchaseController.addExpense);

// Sales & Invoices
router.post('/sales', SaleController.create);
router.get('/sales', SaleController.list);
router.get('/sales/:id', SaleController.getById);

// Customers & Khata
router.get('/customers', CustomerController.list);
router.post('/customers', CustomerController.create);
router.get('/customers/:id', CustomerController.getById);
router.put('/customers/:id', CustomerController.update);
router.get('/customers/:id/statement', CustomerController.getStatement);

// Suppliers & Payables
router.get('/suppliers', SupplierController.list);
router.post('/suppliers', SupplierController.create);
router.get('/suppliers/:id', SupplierController.getById);
router.put('/suppliers/:id', SupplierController.update);
router.get('/suppliers/:id/statement', SupplierController.getStatement);

// Inventory & Lots
router.get('/inventory/lots', InventoryController.getAvailableLots);
router.get('/inventory/all-lots', InventoryController.getAllLots);
router.get('/inventory/lots/:id', InventoryController.getLotById);
router.post('/inventory/adjust', InventoryController.adjustStock);

// Payments & Allocations
router.post('/payments', PaymentController.create);
router.get('/payments', PaymentController.list);

// Returns (Sales & Purchases)
router.post('/returns/sales', ReturnsController.createSalesReturn);
router.get('/returns/sales', ReturnsController.listSalesReturns);
router.post('/returns/purchases', ReturnsController.createPurchaseReturn);
router.get('/returns/purchases', ReturnsController.listPurchaseReturns);

// Operating Expenses
router.get('/expenses/categories', ExpenseController.listCategories);
router.post('/expenses/categories', ExpenseController.createCategory);
router.post('/expenses', ExpenseController.create);
router.get('/expenses', ExpenseController.list);

// Financial Accounts & Cashbook/Bankbook
router.get('/accounts', AccountController.list);
router.post('/accounts', AccountController.create);
router.get('/accounts/:id', AccountController.getById);
router.post('/accounts/transfer', AccountController.transfer);

// Reports & Dashboard
router.get('/reports/dashboard', ReportController.getDashboard);
router.get('/reports/profit-loss', ReportController.getProfitLoss);
router.get('/reports/cash-flow', ReportController.getCashFlow);
router.get('/reports/inventory', ReportController.getInventoryReport);

// Products & Fabric Categories
router.get('/products/categories', ProductController.listCategories);
router.post('/products/categories', ProductController.createCategory);
router.get('/products', ProductController.list);
router.post('/products', ProductController.create);
router.put('/products/:id', ProductController.update);

// Business Settings, Templates & Audit Logs
router.get('/settings', SettingsController.getSettings);
router.put('/settings', SettingsController.updateSettings);
router.get('/settings/invoice-template', SettingsController.getInvoiceTemplate);
router.put('/settings/invoice-template', SettingsController.updateInvoiceTemplate);
router.get('/settings/audit-logs', SettingsController.getAuditLogs);

export default router;
