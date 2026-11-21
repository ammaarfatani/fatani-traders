import { z } from 'zod';
import { AccountType } from '../types';

export const LoginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters long'),
});

export const ChangePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(6, 'New password must be at least 6 characters'),
  confirmPassword: z.string().min(6, 'Please confirm your new password'),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});

export const ProductCategorySchema = z.object({
  name: z.string().min(1, 'Category name is required').trim(),
  description: z.string().optional(),
});

export const ProductSchema = z.object({
  name: z.string().min(1, 'Product name is required').trim(),
  code: z.string().optional(),
  categoryId: z.string().min(1, 'Category is required'),
  defaultUnit: z.string().default('KG'),
  description: z.string().optional(),
  isActive: z.boolean().default(true),
});

export const SupplierSchema = z.object({
  name: z.string().min(1, 'Supplier name is required').trim(),
  companyName: z.string().optional(),
  phone: z.string().min(5, 'Valid phone number is required').trim(),
  alternatePhone: z.string().optional(),
  address: z.string().optional(),
  openingBalance: z.number().default(0), // Positive means we owe supplier
  notes: z.string().optional(),
  isActive: z.boolean().default(true),
});

export const CustomerSchema = z.object({
  name: z.string().min(1, 'Customer name is required').trim(),
  shopName: z.string().optional(),
  phone: z.string().min(5, 'Valid phone number is required').trim(),
  alternatePhone: z.string().optional(),
  address: z.string().optional(),
  creditLimit: z.number().nonnegative().optional(),
  openingBalance: z.number().default(0), // Positive means customer owes us
  notes: z.string().optional(),
  isActive: z.boolean().default(true),
});

export const FinancialAccountSchema = z.object({
  name: z.string().min(1, 'Account name is required').trim(),
  type: z.nativeEnum(AccountType),
  accountNumber: z.string().optional(),
  bankName: z.string().optional(),
  openingBalance: z.number().default(0),
  notes: z.string().optional(),
  isActive: z.boolean().default(true),
});

export const LotExpenseRowSchema = z.object({
  category: z.string().min(1, 'Expense category is required'),
  customName: z.string().optional(),
  amount: z.number().positive('Expense amount must be greater than zero'),
  isCapitalized: z.boolean().default(true),
  isPaid: z.boolean().default(false),
  paymentAccountId: z.string().optional().nullable(),
  date: z.string().or(z.date()).optional(),
  notes: z.string().optional(),
});

export const PurchaseCreateSchema = z.object({
  fabricName: z.string().min(1, 'Fabric name is required').trim(),
  supplierId: z.string().optional().nullable(),
  productId: z.string().optional().nullable(),
  purchaseDate: z.string().or(z.date()),
  purchaseNumber: z.string().optional(),
  invoiceRefNumber: z.string().optional(),
  // Supports decimal kg (e.g. 2.5) and optional extra grams (e.g. 200)
  weightKg: z.number().positive('Weight in KG must be greater than 0'),
  weightGrams: z.number().min(0).default(0),
  purchaseRatePerKg: z.number().positive('Purchase rate per KG must be greater than 0'),
  expenses: z.array(LotExpenseRowSchema).default([]),
  supplierPaymentAmount: z.number().min(0).default(0),
  paymentAccountId: z.string().optional().nullable(),
  notes: z.string().optional(),
});

export const PostPurchaseExpenseSchema = z.object({
  category: z.string().min(1, 'Expense category is required'),
  customName: z.string().optional(),
  amount: z.number().positive('Expense amount must be greater than 0'),
  isCapitalized: z.boolean().default(true),
  isPaid: z.boolean().default(false),
  paymentAccountId: z.string().optional().nullable(),
  date: z.string().or(z.date()),
  notes: z.string().optional(),
});

export const SaleItemSchema = z.object({
  lotId: z.string().min(1, 'Purchase lot is required'),
  productId: z.string().min(1, 'Product is required'),
  weightKg: z.number().min(0, 'Weight must be non-negative'),
  weightGrams: z.number().min(0).max(999).default(0),
  totalGrams: z.number().positive('Total sold grams must be greater than 0'),
  sellingRatePerKg: z.number().positive('Selling rate per KG must be greater than 0'),
});

export const SaleCreateSchema = z.object({
  customerId: z.string().min(1, 'Customer is required'),
  invoiceDate: z.string().or(z.date()),
  items: z.array(SaleItemSchema).min(1, 'At least one lot item is required'),
  discount: z.number().min(0).default(0),
  immediatePayment: z.number().min(0).default(0),
  paymentAccountId: z.string().optional().nullable(),
  notes: z.string().optional(),
});

export const PaymentCreateSchema = z.object({
  type: z.enum(['CUSTOMER_PAYMENT', 'SUPPLIER_PAYMENT', 'PURCHASE_PAYMENT']).default('SUPPLIER_PAYMENT'),
  customerId: z.string().optional().nullable(),
  supplierId: z.string().optional().nullable(),
  purchaseId: z.string().optional().nullable(),
  accountId: z.string().optional().nullable(),
  amount: z.number().positive('Payment amount must be greater than 0'),
  paymentDate: z.string().or(z.date()),
  referenceNumber: z.string().optional(),
  notes: z.string().optional(),
  saleId: z.string().optional().nullable(),
});

export const PurchasePaymentCreateSchema = z.object({
  purchaseId: z.string().min(1, 'Purchase selection is required'),
  amount: z.number().positive('Payment amount must be greater than 0'),
  paymentDate: z.string().or(z.date()),
  referenceNumber: z.string().optional(),
  notes: z.string().optional(),
  accountId: z.string().optional().nullable(),
});

export const GeneralExpenseCreateSchema = z.object({
  categoryId: z.string().min(1, 'Category is required'),
  title: z.string().min(1, 'Expense title is required').trim(),
  amount: z.number().positive('Amount must be greater than 0'),
  date: z.string().or(z.date()),
  accountId: z.string().optional().nullable(),
  isPaid: z.boolean().default(true),
  notes: z.string().optional(),
});

export const AccountTransferSchema = z.object({
  fromAccountId: z.string().min(1, 'Source account is required'),
  toAccountId: z.string().min(1, 'Destination account is required'),
  amount: z.number().positive('Transfer amount must be greater than 0'),
  date: z.string().or(z.date()),
  notes: z.string().optional(),
}).refine(data => data.fromAccountId !== data.toAccountId, {
  message: 'Source and destination accounts must be different',
  path: ['toAccountId'],
});

export const SalesReturnCreateSchema = z.object({
  saleId: z.string().min(1, 'Original sale invoice is required'),
  customerId: z.string().min(1, 'Customer is required'),
  returnDate: z.string().or(z.date()),
  items: z.array(z.object({
    saleItemId: z.string().min(1, 'Sale item reference is required'),
    lotId: z.string().min(1, 'Lot is required'),
    returnedGrams: z.number().positive('Returned grams must be greater than 0'),
    ratePerKg: z.number().positive('Rate must match sale rate'),
    isRestocked: z.boolean().default(true), // true = returned to stock, false = damaged/loss
  })).min(1, 'At least one item must be returned'),
  refundAmount: z.number().min(0).default(0), // If cash refunded immediately
  refundAccountId: z.string().optional().nullable(),
  notes: z.string().optional(),
});

export const PurchaseReturnCreateSchema = z.object({
  purchaseId: z.string().min(1, 'Original purchase is required'),
  lotId: z.string().min(1, 'Lot is required'),
  supplierId: z.string().min(1, 'Supplier is required'),
  returnDate: z.string().or(z.date()),
  returnedGrams: z.number().positive('Returned grams must be greater than 0'),
  ratePerKg: z.number().positive('Rate must match purchase rate'),
  refundReceived: z.number().min(0).default(0), // If cash refund received immediately
  refundAccountId: z.string().optional().nullable(),
  notes: z.string().optional(),
});

export const StockAdjustmentSchema = z.object({
  lotId: z.string().min(1, 'Lot is required'),
  gramsChange: z.number().refine(val => val !== 0, 'Grams change cannot be 0'), // positive = found stock, negative = damaged/lost
  reason: z.string().min(3, 'Detailed reason for adjustment is required').trim(),
  date: z.string().or(z.date()),
  notes: z.string().optional(),
});

export const InvoiceTemplateSchema = z.object({
  businessName: z.string().min(1, 'Business name is required'),
  businessAddress: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().optional(),
  logoUrl: z.string().optional(),
  footerText: z.string().optional(),
  termsAndConditions: z.string().optional(),
  primaryColor: z.string().default('#0f172a'),
  showPreviousBalance: z.boolean().default(true),
  showTotalOutstanding: z.boolean().default(true),
});

export const BusinessSettingsSchema = z.object({
  businessName: z.string().min(1, 'Business name is required'),
  tagline: z.string().optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  ntnOrTaxNumber: z.string().optional(),
  currencySymbol: z.string().default('PKR'),
  weightUnit: z.string().default('KG'),
});
