export enum UserRole {
  ADMIN = 'ADMIN',
}

export enum AccountType {
  CASH = 'CASH',
  BANK = 'BANK',
  WALLET = 'WALLET',
}

export enum LotStatus {
  ACTIVE = 'ACTIVE',
  DEPLETED = 'DEPLETED',
  CLOSED = 'CLOSED',
}

export enum InventoryMovementType {
  PURCHASE = 'PURCHASE',
  SALE = 'SALE',
  SALES_RETURN = 'SALES_RETURN',
  PURCHASE_RETURN = 'PURCHASE_RETURN',
  ADJUSTMENT = 'ADJUSTMENT',
}

export enum PaymentType {
  CUSTOMER_PAYMENT = 'CUSTOMER_PAYMENT',
  SUPPLIER_PAYMENT = 'SUPPLIER_PAYMENT',
}

export enum FinancialTransactionType {
  INFLOW = 'INFLOW',
  OUTFLOW = 'OUTFLOW',
  TRANSFER = 'TRANSFER',
}

export enum SaleStatus {
  COMPLETED = 'COMPLETED',
  PARTIAL = 'PARTIAL',
  UNPAID = 'UNPAID',
  CANCELLED = 'CANCELLED',
}

export enum ExpenseType {
  CAPITALIZED = 'CAPITALIZED',
  OPERATING = 'OPERATING',
}

export const DEFAULT_LOT_EXPENSE_CATEGORIES = [
  'Vehicle / Transport',
  'Unloading Labor',
  'Loading Labor',
  'Folding',
  'Packaging',
  'Handling',
  'Freight Inward',
  'Other Landed Cost',
] as const;

export const DEFAULT_OPERATING_EXPENSE_CATEGORIES = [
  'Rent',
  'Electricity / Utilities',
  'Staff Salaries & Wages',
  'Chai & Office Hospitality',
  'Packaging Materials',
  'Vehicle Fuel & Maintenance',
  'Repair & Maintenance',
  'General Miscellaneous',
] as const;

export interface DashboardSummary {
  todaySales: number;
  todaySalesKg: number;
  todayPaymentsReceived: number;
  totalReceivables: number;
  totalSupplierPayables: number;
  totalAvailableStockGrams: number;
  totalAvailableStockKg: number;
  totalInventoryValuation: number;
  monthGrossProfit: number;
  monthNetProfit: number;
  monthOperatingExpenses: number;
  totalCashAndBankBalance: number;
  recentSales: any[];
  recentPurchases: any[];
  overdueCustomers: any[];
  lowStockLots: any[];
}
