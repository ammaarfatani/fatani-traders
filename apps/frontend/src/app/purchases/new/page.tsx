'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import {
  kgAndGramsToGrams,
  calculateLandedCost,
  formatPKR,
  formatWeight,
  roundMoney,
} from '@fatani/shared';
import {
  ShoppingCart,
  Plus,
  Trash2,
  ArrowLeft,
  DollarSign,
  Scale,
  CheckCircle,
  Building2,
  Calendar,
  FileText,
  AlertCircle,
  Layers,
  Truck,
} from 'lucide-react';

interface ExpenseItem {
  id: string;
  category: string;
  customName?: string;
  amount: number | '';
}

export default function NewPurchasePage() {
  const router = useRouter();
  const queryClient = useQueryClient();

  // Form State
  const [fabricName, setFabricName] = useState('');
  const [supplierId, setSupplierId] = useState<string>(''); // Optional
  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().split('T')[0]);
  const [invoiceRefNumber, setInvoiceRefNumber] = useState('');
  const [weightKg, setWeightKg] = useState<number | ''>(10);
  const [extraGrams, setExtraGrams] = useState<number | ''>(0);
  const [purchaseRatePerKg, setPurchaseRatePerKg] = useState<number | ''>(500);

  // Dynamic Additional Expenses: initially starts with 1 optional row (Transport)
  const [expenses, setExpenses] = useState<ExpenseItem[]>([
    { id: '1', category: 'Transport', amount: '' },
  ]);

  // Immediate Payment
  const [immediatePayment, setImmediatePayment] = useState<number | ''>('');
  const [notes, setNotes] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  // Queries
  const { data: nextNumberData } = useQuery({
    queryKey: ['nextPurchaseNumber'],
    queryFn: () => api.get<{ nextNumber: string }>('/purchases/next-number'),
  });

  const { data: suppliersData } = useQuery({
    queryKey: ['suppliers'],
    queryFn: () => api.get<any[]>('/suppliers'),
  });

  const suppliers = suppliersData || [];
  const autoInvoiceNumber = nextNumberData?.nextNumber || 'PUR-000001';

  // Calculations
  const numericKg = Number(weightKg) || 0;
  const numericExtraGrams = Number(extraGrams) || 0;
  const numericRate = Number(purchaseRatePerKg) || 0;

  // Total Grams = (Weight in KG * 1000) + Extra Grams
  const totalGrams = useMemo(() => {
    return kgAndGramsToGrams(numericKg, numericExtraGrams);
  }, [numericKg, numericExtraGrams]);

  const totalKg = totalGrams / 1000;

  // Purchase Amount = Total KG * Purchase Rate per KG
  const purchaseAmount = useMemo(() => {
    return roundMoney(totalKg * numericRate);
  }, [totalKg, numericRate]);

  // Sum of all additional expenses
  const totalAdditionalExpenses = useMemo(() => {
    return expenses.reduce((sum, exp) => sum + (Number(exp.amount) || 0), 0);
  }, [expenses]);

  // Total Landed Cost = Purchase Amount + Additional Expenses
  const totalLandedCost = useMemo(() => {
    return roundMoney(purchaseAmount + totalAdditionalExpenses);
  }, [purchaseAmount, totalAdditionalExpenses]);

  // Landed Cost per KG
  const landedCostPerKg = useMemo(() => {
    return totalKg > 0 ? roundMoney(totalLandedCost / totalKg) : 0;
  }, [totalLandedCost, totalKg]);

  // Remaining Payment = Total Landed Cost - Immediate Payment
  const numericImmediatePayment = Number(immediatePayment) || 0;
  const remainingPayment = useMemo(() => {
    return roundMoney(Math.max(0, totalLandedCost - numericImmediatePayment));
  }, [totalLandedCost, numericImmediatePayment]);

  // Expense row handlers
  const handleAddExpenseRow = () => {
    const newId = String(Date.now());
    setExpenses([...expenses, { id: newId, category: 'Labour', amount: '' }]);
  };

  const handleRemoveExpenseRow = (id: string) => {
    if (expenses.length === 1) {
      setExpenses([{ id: '1', category: 'Transport', amount: '' }]);
    } else {
      setExpenses(expenses.filter((e) => e.id !== id));
    }
  };

  const handleExpenseChange = (id: string, field: 'category' | 'amount' | 'customName', val: any) => {
    setExpenses(
      expenses.map((e) => {
        if (e.id === id) {
          return { ...e, [field]: val };
        }
        return e;
      })
    );
  };

  // Quick payment helper
  const handleSetPayFull = () => {
    setImmediatePayment(totalLandedCost);
  };

  const handleSetPayZero = () => {
    setImmediatePayment(0);
  };

  // Submit Mutation
  const purchaseMutation = useMutation({
    mutationFn: (payload: any) => api.post('/purchases', payload),
    onSuccess: (res: any) => {
      queryClient.invalidateQueries({ queryKey: ['purchases'] });
      queryClient.invalidateQueries({ queryKey: ['inventoryLots'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      router.push(`/purchases/${res.data.purchase.id}`);
    },
    onError: (err: any) => {
      setFormError(err.message || 'Failed to save purchase');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!fabricName.trim()) {
      setFormError('Fabric Name is required (e.g. Lucky Diet, Cotton, Lawn).');
      return;
    }

    if (numericKg <= 0 && numericExtraGrams <= 0) {
      setFormError('Purchased weight must be greater than zero.');
      return;
    }

    if (numericRate <= 0) {
      setFormError('Purchase Rate per KG is required and must be greater than zero.');
      return;
    }

    if (numericImmediatePayment > totalLandedCost) {
      setFormError('Immediate payment cannot exceed total landed cost.');
      return;
    }

    // Format expenses for API
    const validExpenses = expenses
      .filter((exp) => Number(exp.amount) > 0)
      .map((exp) => ({
        category: exp.category,
        customName: exp.customName || undefined,
        amount: Number(exp.amount),
        isCapitalized: true,
      }));

    purchaseMutation.mutate({
      fabricName: fabricName.trim(),
      supplierId: supplierId || null,
      purchaseDate: new Date(purchaseDate).toISOString(),
      purchaseNumber: autoInvoiceNumber,
      invoiceRefNumber: invoiceRefNumber || undefined,
      weightKg: numericKg,
      weightGrams: numericExtraGrams,
      purchaseRatePerKg: numericRate,
      expenses: validExpenses,
      supplierPaymentAmount: numericImmediatePayment,
      notes: notes || undefined,
    });
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-20">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 sm:p-5 rounded-2xl border border-brand-muted shadow-subtle">
        <div className="flex items-center gap-3.5">
          <Link
            href="/purchases"
            className="p-2.5 rounded-xl bg-brand-light border border-brand-muted text-brand-charcoal hover:bg-brand-muted transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-bold text-brand-charcoal tracking-tight font-sans">
                New Fabric Purchase
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-brand-light text-brand-fabric border border-brand-muted">
                {autoInvoiceNumber}
              </span>
            </div>
            <p className="text-xs text-gray-500">
              Fast purchase entry, optional supplier, live weight & landed cost calculations
            </p>
          </div>
        </div>

        <Link
          href="/purchases"
          className="text-xs font-semibold text-gray-500 hover:text-brand-charcoal px-3 py-1.5 rounded-lg border border-gray-200 text-center"
        >
          Cancel
        </Link>
      </div>

      {formError && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-2xl text-xs sm:text-sm font-semibold flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{formError}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* SECTION 1: Basic Information */}
        <div className="bg-white p-5 sm:p-6 rounded-2xl border border-brand-muted shadow-subtle space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-gray-100">
            <Layers className="w-4 h-4 text-brand-fabric" />
            <h2 className="text-sm font-bold uppercase tracking-wider text-brand-charcoal">
              1. Fabric & Supplier Details
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* 1. Fabric Name (Free text, required) */}
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold uppercase tracking-wider text-brand-charcoal mb-1">
                Fabric Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={fabricName}
                onChange={(e) => setFabricName(e.target.value)}
                placeholder="e.g. Lucky Diet, Lucky One, Cotton Lawn, Wash & Wear"
                className="w-full px-3.5 py-2.5 bg-brand-light/30 border border-brand-muted rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-brand-fabric text-brand-charcoal"
              />
              <p className="text-[11px] text-gray-400 mt-1">
                Type any fabric or quality name directly. No product pre-registration needed.
              </p>
            </div>

            {/* 2. Supplier (Optional) */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-bold uppercase tracking-wider text-brand-charcoal">
                  Supplier <span className="text-gray-400 font-normal lowercase">(optional)</span>
                </label>
                <Link
                  href="/suppliers"
                  target="_blank"
                  className="text-[11px] font-semibold text-brand-fabric hover:underline"
                >
                  + Add New Supplier
                </Link>
              </div>
              <select
                value={supplierId}
                onChange={(e) => setSupplierId(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-white border border-brand-muted rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-brand-fabric text-brand-charcoal"
              >
                <option value="">No Supplier / Unknown Supplier</option>
                {suppliers.map((s: any) => (
                  <option key={s.id} value={s.id}>
                    {s.name} {s.phone ? `(${s.phone})` : ''}
                  </option>
                ))}
              </select>
              <p className="text-[11px] text-gray-400 mt-1">
                Leave unselected if bought from market cash or unknown supplier.
              </p>
            </div>

            {/* 3. Purchase Date */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-brand-charcoal mb-1">
                Purchase Date
              </label>
              <input
                type="date"
                required
                value={purchaseDate}
                onChange={(e) => setPurchaseDate(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-white border border-brand-muted rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-brand-fabric text-brand-charcoal"
              />
            </div>
          </div>
        </div>

        {/* SECTION 2: Weight & Purchase Rate */}
        <div className="bg-white p-5 sm:p-6 rounded-2xl border border-brand-muted shadow-subtle space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-gray-100">
            <Scale className="w-4 h-4 text-brand-fabric" />
            <h2 className="text-sm font-bold uppercase tracking-wider text-brand-charcoal">
              2. Weight & Purchase Rate
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Weight in KG */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-brand-charcoal mb-1">
                Weight in KG <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                step="any"
                min="0"
                required
                value={weightKg}
                onChange={(e) => setWeightKg(e.target.value === '' ? '' : Number(e.target.value))}
                placeholder="e.g. 2.5 or 100"
                className="w-full px-3.5 py-2.5 bg-brand-light/30 border border-brand-muted rounded-xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-brand-fabric text-brand-charcoal"
              />
              <span className="text-[11px] text-gray-400 mt-1 block">Decimal KG allowed (e.g. 2.5 KG)</span>
            </div>

            {/* Extra Grams */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-brand-charcoal mb-1">
                Extra Grams <span className="text-gray-400 font-normal lowercase">(optional)</span>
              </label>
              <input
                type="number"
                step="1"
                min="0"
                value={extraGrams}
                onChange={(e) => setExtraGrams(e.target.value === '' ? '' : Number(e.target.value))}
                placeholder="e.g. 200 or 350"
                className="w-full px-3.5 py-2.5 bg-white border border-brand-muted rounded-xl text-sm font-medium focus:outline-none focus:ring-2 focus:ring-brand-fabric text-brand-charcoal"
              />
              <span className="text-[11px] text-gray-400 mt-1 block">Extra grams (e.g. +200g = 2,700g)</span>
            </div>

            {/* Rate per KG */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-brand-charcoal mb-1">
                Purchase Rate (Rs. / KG) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                step="any"
                min="0"
                required
                value={purchaseRatePerKg}
                onChange={(e) =>
                  setPurchaseRatePerKg(e.target.value === '' ? '' : Number(e.target.value))
                }
                placeholder="e.g. 500"
                className="w-full px-3.5 py-2.5 bg-brand-light/30 border border-brand-muted rounded-xl text-sm font-bold focus:outline-none focus:ring-2 focus:ring-brand-fabric text-brand-charcoal"
              />
              <span className="text-[11px] text-gray-400 mt-1 block">Price per 1.000 KG</span>
            </div>
          </div>

          {/* Live Weight & Base Cost Summary Bar */}
          <div className="bg-brand-light/60 p-4 rounded-xl border border-brand-muted flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
            <div>
              <span className="text-gray-500 font-medium">Total Calculated Weight:</span>
              <p className="text-sm font-extrabold text-brand-charcoal">
                {formatWeight(totalGrams)} ({totalGrams.toLocaleString()} integer grams)
              </p>
            </div>
            <div className="sm:text-right">
              <span className="text-gray-500 font-medium">Base Fabric Amount:</span>
              <p className="text-base font-extrabold text-brand-fabric">
                {formatPKR(purchaseAmount)}
              </p>
            </div>
          </div>
        </div>

        {/* SECTION 3: Dynamic Additional Expenses */}
        <div className="bg-white p-5 sm:p-6 rounded-2xl border border-brand-muted shadow-subtle space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <Truck className="w-4 h-4 text-brand-fabric" />
              <h2 className="text-sm font-bold uppercase tracking-wider text-brand-charcoal">
                3. Additional Landed Expenses
              </h2>
            </div>
            <button
              type="button"
              onClick={handleAddExpenseRow}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-brand-light hover:bg-brand-muted text-brand-fabric text-xs font-bold border border-brand-muted transition"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>+ Add Expense</span>
            </button>
          </div>

          <p className="text-xs text-gray-500">
            Add freight, loading, unloading, or labour costs to calculate actual landed cost per KG.
          </p>

          <div className="space-y-2.5">
            {expenses.map((exp, idx) => (
              <div
                key={exp.id}
                className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 bg-gray-50/70 p-2.5 rounded-xl border border-gray-200/60"
              >
                <div className="w-full sm:w-1/3">
                  <select
                    value={exp.category}
                    onChange={(e) => handleExpenseChange(exp.id, 'category', e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-gray-200 rounded-lg text-xs font-semibold text-brand-charcoal"
                  >
                    <option value="Transport">Vehicle / Transport</option>
                    <option value="Loading">Loading Labor</option>
                    <option value="Unloading">Unloading Labor</option>
                    <option value="Labour">Labour / Mazdoori</option>
                    <option value="Packaging">Packaging & Bales</option>
                    <option value="Folding">Folding & Rolling</option>
                    <option value="Other">Other Expense</option>
                  </select>
                </div>

                <div className="flex-1 flex items-center gap-2">
                  <div className="relative flex-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs">Rs.</span>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      value={exp.amount}
                      onChange={(e) =>
                        handleExpenseChange(
                          exp.id,
                          'amount',
                          e.target.value === '' ? '' : Number(e.target.value)
                        )
                      }
                      placeholder="0"
                      className="w-full pl-9 pr-3 py-2 bg-white border border-gray-200 rounded-lg text-xs font-bold text-brand-charcoal"
                    />
                  </div>

                  {expenses.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveExpenseRow(exp.id)}
                      className="p-2 text-gray-400 hover:text-red-600 rounded-lg transition"
                      title="Remove expense"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Landed Cost Summary Box */}
          <div className="p-4 rounded-xl bg-slate-900 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
            <div>
              <span className="text-gray-400 text-[11px] uppercase font-bold tracking-wider block">
                Total Landed Cost (Fabric + Expenses)
              </span>
              <p className="text-2xl font-black text-white mt-0.5">{formatPKR(totalLandedCost)}</p>
            </div>
            <div className="sm:text-right">
              <span className="text-gray-400 text-[11px] uppercase font-bold tracking-wider block">
                Actual Cost per KG
              </span>
              <p className="text-lg font-bold text-brand-accent mt-0.5">
                {formatPKR(landedCostPerKg)} / KG
              </p>
            </div>
          </div>
        </div>

        {/* SECTION 4: Immediate Payment & Final Settlement */}
        <div className="bg-white p-5 sm:p-6 rounded-2xl border border-brand-muted shadow-subtle space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-gray-100">
            <DollarSign className="w-4 h-4 text-emerald-700" />
            <h2 className="text-sm font-bold uppercase tracking-wider text-brand-charcoal">
              4. Immediate Payment & Remaining Balance
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-bold uppercase tracking-wider text-brand-charcoal">
                  Immediate Payment (Rs.)
                </label>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={handleSetPayZero}
                    className="text-[10px] font-bold text-gray-500 hover:text-brand-charcoal px-2 py-0.5 rounded bg-gray-100"
                  >
                    Rs. 0
                  </button>
                  <button
                    type="button"
                    onClick={handleSetPayFull}
                    className="text-[10px] font-bold text-emerald-800 hover:text-emerald-900 px-2 py-0.5 rounded bg-emerald-50"
                  >
                    Pay Full
                  </button>
                </div>
              </div>
              <input
                type="number"
                step="any"
                min="0"
                value={immediatePayment}
                onChange={(e) =>
                  setImmediatePayment(e.target.value === '' ? '' : Number(e.target.value))
                }
                placeholder="Enter amount paid today"
                className="w-full px-3.5 py-2.5 bg-white border border-brand-muted rounded-xl text-sm font-extrabold text-emerald-800 focus:outline-none focus:ring-2 focus:ring-emerald-700"
              />
              <span className="text-[11px] text-gray-400 mt-1 block">
                Leave 0 if unpaid. Payment record created only if &gt; Rs. 0.
              </span>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-1">
                Remaining Payment Balance
              </label>
              <div className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-xl text-base font-extrabold text-red-600 flex items-center justify-between">
                <span>{formatPKR(remainingPayment)}</span>
                <span className="text-[10px] uppercase font-bold text-gray-400">Payable Later</span>
              </div>
              <span className="text-[11px] text-gray-400 mt-1 block">
                Can be paid later via &ldquo;Pay Purchase&rdquo; action anytime.
              </span>
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-bold uppercase tracking-wider text-brand-charcoal mb-1">
                Notes / Remarks <span className="text-gray-400 font-normal lowercase">(optional)</span>
              </label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="e.g. Lot quality remarks, payment agreement, roll count"
                className="w-full px-3.5 py-2 bg-white border border-brand-muted rounded-xl text-xs text-brand-charcoal"
              />
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <Link
            href="/purchases"
            className="px-5 py-3 rounded-xl border border-gray-300 text-gray-600 font-semibold text-xs sm:text-sm hover:bg-gray-100 transition"
          >
            Cancel
          </Link>

          <button
            type="submit"
            disabled={purchaseMutation.isPending}
            className="flex items-center gap-2 px-7 py-3 rounded-xl bg-brand-deep hover:bg-brand-fabric text-white font-bold text-sm shadow-md active:scale-95 transition disabled:opacity-50"
          >
            {purchaseMutation.isPending ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>Saving Purchase...</span>
              </>
            ) : (
              <>
                <CheckCircle className="w-4 h-4" />
                <span>Save Purchase</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
