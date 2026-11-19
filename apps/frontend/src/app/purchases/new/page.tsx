'use client';

import React, { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import {
  kgAndGramsToGrams,
  calculateLandedCost,
  formatPKR,
  DEFAULT_LOT_EXPENSE_CATEGORIES,
} from '@fatani/shared';
import {
  ShoppingCart,
  Plus,
  Trash2,
  Calculator,
  ArrowLeft,
  DollarSign,
  Scale,
  CheckCircle,
} from 'lucide-react';

interface ExpenseRow {
  id: string;
  category: string;
  customName: string;
  amount: number;
  isCapitalized: boolean;
  isPaid: boolean;
  paymentAccountId: string;
  notes: string;
}

export default function NewPurchasePage() {
  const router = useRouter();

  // Form State
  const [supplierId, setSupplierId] = useState('');
  const [productId, setProductId] = useState('');
  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().split('T')[0]);
  const [invoiceRefNumber, setInvoiceRefNumber] = useState('');
  const [weightKg, setWeightKg] = useState<number>(2000);
  const [weightGrams, setWeightGrams] = useState<number>(0);
  const [purchaseRatePerKg, setPurchaseRatePerKg] = useState<number>(120);

  // Dynamic Landed Expenses Rows
  const [expenses, setExpenses] = useState<ExpenseRow[]>([
    {
      id: '1',
      category: 'Vehicle / Transport',
      customName: 'Freight from Mill',
      amount: 5000,
      isCapitalized: true,
      isPaid: false,
      paymentAccountId: '',
      notes: '',
    },
    {
      id: '2',
      category: 'Unloading Labor',
      customName: 'Godown unloading labor',
      amount: 3000,
      isCapitalized: true,
      isPaid: false,
      paymentAccountId: '',
      notes: '',
    },
    {
      id: '3',
      category: 'Folding',
      customName: 'Thaan rolling and folding labor',
      amount: 2000,
      isCapitalized: true,
      isPaid: false,
      paymentAccountId: '',
      notes: '',
    },
  ]);

  // Immediate supplier payment
  const [supplierPaymentAmount, setSupplierPaymentAmount] = useState<number>(0);
  const [paymentAccountId, setPaymentAccountId] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch Master Data
  const { data: suppliers } = useQuery({
    queryKey: ['suppliers'],
    queryFn: () => api.get<any[]>('/suppliers'),
  });

  const { data: products } = useQuery({
    queryKey: ['products'],
    queryFn: () => api.get<any[]>('/products'),
  });

  const { data: accounts } = useQuery({
    queryKey: ['accounts'],
    queryFn: () => api.get<any[]>('/accounts'),
  });

  // Auto-select first item when loaded
  React.useEffect(() => {
    if (suppliers && suppliers.length > 0 && !supplierId) {
      setSupplierId(suppliers[0].id);
    }
  }, [suppliers, supplierId]);

  React.useEffect(() => {
    if (products && products.length > 0 && !productId) {
      setProductId(products[0].id);
    }
  }, [products, productId]);

  React.useEffect(() => {
    if (accounts && accounts.length > 0 && !paymentAccountId) {
      setPaymentAccountId(accounts[0].id);
    }
  }, [accounts, paymentAccountId]);

  // Real-time Landed Cost Recalculation
  const calculations = useMemo(() => {
    const totalGrams = kgAndGramsToGrams(Number(weightKg) || 0, Number(weightGrams) || 0);
    return calculateLandedCost(
      totalGrams,
      Number(purchaseRatePerKg) || 0,
      expenses.map((e) => ({
        amount: Number(e.amount) || 0,
        isCapitalized: e.isCapitalized,
        category: e.category,
      }))
    );
  }, [weightKg, weightGrams, purchaseRatePerKg, expenses]);

  // Add / Remove Expense Rows
  const addExpenseRow = () => {
    setExpenses([
      ...expenses,
      {
        id: Math.random().toString(36).substring(7),
        category: 'Packaging',
        customName: '',
        amount: 1000,
        isCapitalized: true,
        isPaid: false,
        paymentAccountId: accounts?.[0]?.id || '',
        notes: '',
      },
    ]);
  };

  const removeExpenseRow = (id: string) => {
    setExpenses(expenses.filter((e) => e.id !== id));
  };

  const updateExpenseRow = (id: string, updates: Partial<ExpenseRow>) => {
    setExpenses(expenses.map((e) => (e.id === id ? { ...e, ...updates } : e)));
  };

  // Submit Handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!supplierId) {
      setError('Please select a supplier');
      return;
    }
    if (!productId) {
      setError('Please select a fabric product');
      return;
    }
    if (calculations.purchasedGrams <= 0) {
      setError('Weight must be greater than zero');
      return;
    }
    if (calculations.purchaseRatePerKg <= 0) {
      setError('Purchase rate per KG must be greater than zero');
      return;
    }

    setIsSubmitting(true);

    try {
      const payload = {
        supplierId,
        productId,
        purchaseDate,
        invoiceRefNumber,
        weightKg: Number(weightKg),
        weightGrams: Number(weightGrams) || 0,
        purchaseRatePerKg: Number(purchaseRatePerKg),
        expenses: expenses.map((e) => ({
          category: e.category,
          customName: e.customName || undefined,
          amount: Number(e.amount),
          isCapitalized: e.isCapitalized,
          isPaid: e.isPaid,
          paymentAccountId: e.isPaid ? e.paymentAccountId || paymentAccountId : null,
          notes: e.notes || undefined,
        })),
        supplierPaymentAmount: Number(supplierPaymentAmount) || 0,
        paymentAccountId: Number(supplierPaymentAmount) > 0 ? paymentAccountId : null,
        notes,
      };

      const res = await api.post<any>('/purchases', payload);
      router.push(`/purchases/${res.purchase.id}`);
    } catch (err: any) {
      setError(err.message || 'Failed to record purchase entry');
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5 max-w-4xl mx-auto pb-20">
      {/* Page Title & Back */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => router.back()}
          className="p-2 rounded-xl bg-white border border-slate-200 text-slate-600 hover:text-slate-900 shadow-sm"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">New Purchase Entry</h1>
          <p className="text-xs text-slate-500">Record mill purchase lot & compute landed cost</p>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm font-medium">
          {error}
        </div>
      )}

      {/* Supplier & Product Info Card */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
          <ShoppingCart className="w-4 h-4 text-emerald-600" />
          <span>Supplier & Fabric Selection</span>
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Supplier / Mill *</label>
            <select
              value={supplierId}
              onChange={(e) => setSupplierId(e.target.value)}
              required
              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              {suppliers?.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} {s.companyName ? `(${s.companyName})` : ''}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Fabric Product *</label>
            <select
              value={productId}
              onChange={(e) => setProductId(e.target.value)}
              required
              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              {products?.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} {p.code ? `[${p.code}]` : ''}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Purchase Date</label>
            <input
              type="date"
              value={purchaseDate}
              onChange={(e) => setPurchaseDate(e.target.value)}
              required
              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Mill Invoice / Bilti Ref #</label>
            <input
              type="text"
              value={invoiceRefNumber}
              onChange={(e) => setInvoiceRefNumber(e.target.value)}
              placeholder="e.g. MILL-INV-9842"
              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
        </div>
      </div>

      {/* Weight & Base Rate Card */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
          <Scale className="w-4 h-4 text-emerald-600" />
          <span>Weight & Base Purchase Rate</span>
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Weight (KG) *</label>
            <input
              type="number"
              step="any"
              min="0"
              value={weightKg}
              onChange={(e) => setWeightKg(parseFloat(e.target.value) || 0)}
              required
              placeholder="2000"
              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-base font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Extra Grams (0-999)</label>
            <input
              type="number"
              min="0"
              max="999"
              value={weightGrams}
              onChange={(e) => setWeightGrams(parseInt(e.target.value, 10) || 0)}
              placeholder="0"
              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-base font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Purchase Rate (PKR / KG) *</label>
            <input
              type="number"
              step="any"
              min="0"
              value={purchaseRatePerKg}
              onChange={(e) => setPurchaseRatePerKg(parseFloat(e.target.value) || 0)}
              required
              placeholder="120"
              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-base font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
        </div>

        <div className="p-3 bg-slate-50 rounded-xl flex items-center justify-between text-xs text-slate-600">
          <span>Base Purchase Cost (Weight × Rate):</span>
          <span className="font-bold text-slate-900 text-sm">{formatPKR(calculations.basePurchaseCost)}</span>
        </div>
      </div>

      {/* Dynamic Landed Expenses Card */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <Calculator className="w-4 h-4 text-emerald-600" />
              <span>Dynamic Additional Landed Expenses</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Transport, unloading, folding and packaging directly capitalized into lot inventory cost
            </p>
          </div>

          <button
            type="button"
            onClick={addExpenseRow}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-semibold border border-emerald-200 transition"
          >
            <Plus className="w-4 h-4" />
            <span>Add Expense</span>
          </button>
        </div>

        {expenses.length === 0 ? (
          <div className="p-4 text-center border-2 border-dashed border-slate-200 rounded-xl text-xs text-slate-400">
            No additional expenses added. Click "+ Add Expense" above if transport or labor occurred.
          </div>
        ) : (
          <div className="space-y-3">
            {expenses.map((exp, idx) => (
              <div
                key={exp.id}
                className="p-3.5 bg-slate-50/80 rounded-xl border border-slate-200/80 space-y-3 transition"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-700">Expense #{idx + 1}</span>
                  <button
                    type="button"
                    onClick={() => removeExpenseRow(exp.id)}
                    className="p-1 text-slate-400 hover:text-red-500 transition"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  <div>
                    <label className="block text-[11px] font-medium text-slate-500 mb-1">Category</label>
                    <select
                      value={exp.category}
                      onChange={(e) => updateExpenseRow(exp.id, { category: e.target.value })}
                      className="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs font-medium"
                    >
                      {DEFAULT_LOT_EXPENSE_CATEGORIES.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-slate-500 mb-1">Custom Note / Name</label>
                    <input
                      type="text"
                      value={exp.customName}
                      onChange={(e) => updateExpenseRow(exp.id, { customName: e.target.value })}
                      placeholder="e.g. Mazda transport charges"
                      className="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-medium text-slate-500 mb-1">Amount (PKR) *</label>
                    <input
                      type="number"
                      min="0"
                      value={exp.amount}
                      onChange={(e) => updateExpenseRow(exp.id, { amount: parseFloat(e.target.value) || 0 })}
                      className="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-900"
                    />
                  </div>
                </div>

                {/* Paid / Unpaid Status */}
                <div className="flex items-center gap-4 pt-1 text-xs">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={exp.isPaid}
                      onChange={(e) => updateExpenseRow(exp.id, { isPaid: e.target.checked })}
                      className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                    />
                    <span className="text-slate-700 font-medium">Already paid now</span>
                  </label>

                  {exp.isPaid && (
                    <div className="flex-1 flex items-center gap-2">
                      <span className="text-slate-500 text-[11px]">Paid From:</span>
                      <select
                        value={exp.paymentAccountId}
                        onChange={(e) => updateExpenseRow(exp.id, { paymentAccountId: e.target.value })}
                        className="p-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium"
                      >
                        {accounts?.map((acc) => (
                          <option key={acc.id} value={acc.id}>
                            {acc.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Prominent Landed Cost Calculation Box (As explicitly specified in Prompt) */}
      <div className="bg-brand-deep text-white p-5 sm:p-6 rounded-2xl shadow-elevated space-y-4 border border-brand-dark/40">
        <div className="flex items-center justify-between border-b border-white/10 pb-3">
          <div className="flex items-center gap-2">
            <Calculator className="w-5 h-5 text-brand-accent" />
            <h3 className="font-bold text-base text-white">Live Landed Cost Summary</h3>
          </div>
          <span className="text-xs bg-brand-fabric/60 text-white border border-brand-accent/40 px-2.5 py-0.5 rounded-full font-semibold">
            IAS 2 Compliant
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
          <div>
            <p className="text-gray-300">Purchased Weight</p>
            <p className="text-base font-bold text-white mt-0.5">
              {calculations.purchasedKg.toLocaleString()} KG
            </p>
          </div>

          <div>
            <p className="text-gray-300">Base Cost</p>
            <p className="text-base font-bold text-gray-200 mt-0.5">
              {formatPKR(calculations.basePurchaseCost)}
            </p>
          </div>

          <div>
            <p className="text-gray-300">Additional Expenses</p>
            <p className="text-base font-bold text-amber-300 mt-0.5">
              +{formatPKR(calculations.totalAdditionalExpenses)}
            </p>
          </div>

          <div>
            <p className="text-gray-300">Total Landed Cost</p>
            <p className="text-base font-bold text-emerald-300 mt-0.5">
              {formatPKR(calculations.totalLandedCost)}
            </p>
          </div>
        </div>

        {/* The Key Metric: Actual Cost Per KG */}
        <div className="pt-3 border-t border-white/10 flex items-center justify-between">
          <div>
            <span className="text-xs uppercase tracking-wider text-gray-300 font-bold">
              Actual Landed Cost per KG
            </span>
            <p className="text-[11px] text-gray-400 mt-0.5">
              (Total Landed Cost / Purchased Weight)
            </p>
          </div>
          <div className="text-right">
            <span className="text-2xl sm:text-3xl font-black text-emerald-300">
              {formatPKR(calculations.actualCostPerKg)}
            </span>
            <span className="text-xs text-gray-400 ml-1">/ KG</span>
          </div>
        </div>
      </div>

      {/* Immediate Supplier Payment Card */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
          <DollarSign className="w-4 h-4 text-emerald-600" />
          <span>Immediate Payment to Supplier (Optional)</span>
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Payment Amount (PKR)
            </label>
            <input
              type="number"
              min="0"
              max={calculations.basePurchaseCost}
              value={supplierPaymentAmount}
              onChange={(e) => setSupplierPaymentAmount(parseFloat(e.target.value) || 0)}
              placeholder="0"
              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-900"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Payment Account</label>
            <select
              value={paymentAccountId}
              onChange={(e) => setPaymentAccountId(e.target.value)}
              disabled={supplierPaymentAmount <= 0}
              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-900 disabled:opacity-50"
            >
              {accounts?.map((acc) => (
                <option key={acc.id} value={acc.id}>
                  {acc.name} (Balance: {formatPKR(acc.currentBalance)})
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex justify-between items-center text-xs text-slate-500 pt-2 border-t border-slate-100">
          <span>Supplier Outstanding from this purchase:</span>
          <span className="font-bold text-red-600 text-sm">
            {formatPKR(Math.max(0, calculations.basePurchaseCost - supplierPaymentAmount))}
          </span>
        </div>
      </div>

      {/* General Notes */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
        <label className="block text-xs font-semibold text-slate-700 mb-1.5">Internal Notes & Remarks</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          placeholder="e.g. Lot delivered at warehouse, quality checked 80/80 weave count..."
          className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm"
        />
      </div>

      {/* Sticky Save Action */}
      <div className="fixed bottom-14 lg:bottom-4 left-0 right-0 z-30 p-3 bg-white/90 backdrop-blur-md border-t border-slate-200 flex justify-end max-w-4xl mx-auto rounded-t-2xl shadow-xl">
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full sm:w-auto px-8 py-3.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-bold text-sm rounded-xl shadow-lg shadow-emerald-600/30 transition disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {isSubmitting ? (
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <>
              <CheckCircle className="w-5 h-5" />
              <span>Save Purchase & Generate Lot</span>
            </>
          )}
        </button>
      </div>
    </form>
  );
}
