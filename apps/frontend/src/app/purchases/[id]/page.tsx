'use client';

import React, { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { formatPKR, formatWeight, DEFAULT_LOT_EXPENSE_CATEGORIES } from '@fatani/shared';
import {
  ArrowLeft,
  ShoppingCart,
  Package,
  Plus,
  Building2,
  Clock,
  X,
  Calculator,
  CheckCircle,
  FileText,
} from 'lucide-react';

export default function PurchaseDetailPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const id = Array.isArray(params.id) ? params.id[0] : (params.id as string);

  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [expenseCategory, setExpenseCategory] = useState<string>('Packaging');
  const [customExpenseName, setCustomExpenseName] = useState('');
  const [expenseAmount, setExpenseAmount] = useState<number | ''>('');
  const [isPaid, setIsPaid] = useState(false);
  const [paymentAccountId, setPaymentAccountId] = useState('');
  const [expenseNotes, setExpenseNotes] = useState('');
  const [modalError, setModalError] = useState<string | null>(null);

  const { data: purchase, isLoading, error } = useQuery({
    queryKey: ['purchase', id],
    queryFn: () => api.get<any>(`/purchases/${id}`),
  });

  const { data: accounts } = useQuery({
    queryKey: ['accounts'],
    queryFn: () => api.get<any[]>('/accounts'),
  });

  React.useEffect(() => {
    if (accounts && accounts.length > 0 && !paymentAccountId) {
      setPaymentAccountId(accounts[0].id);
    }
  }, [accounts, paymentAccountId]);

  const lot = purchase?.lots?.[0];

  const addExpenseMutation = useMutation({
    mutationFn: (payload: any) =>
      api.post(`/purchases/lots/${lot.id}/expense`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchase', id] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      setIsExpenseModalOpen(false);
      setExpenseAmount('');
      setCustomExpenseName('');
      setModalError(null);
    },
    onError: (err: any) => {
      setModalError(err.message || 'Failed to add post-purchase expense');
    },
  });

  const handleAddExpenseSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!expenseAmount || Number(expenseAmount) <= 0) {
      setModalError('Expense amount must be greater than zero');
      return;
    }

    addExpenseMutation.mutate({
      category: expenseCategory,
      customName: customExpenseName || undefined,
      amount: Number(expenseAmount),
      isCapitalized: true,
      isPaid,
      paymentAccountId: isPaid ? paymentAccountId : undefined,
      notes: expenseNotes || undefined,
    });
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <div className="w-8 h-8 border-4 border-brand-fabric border-t-transparent rounded-full animate-spin" />
        <p className="text-xs text-gray-500 font-semibold uppercase tracking-wider">Loading Purchase Details...</p>
      </div>
    );
  }

  if (error || !purchase) {
    return (
      <div className="p-6 bg-red-50 border border-red-200 rounded-2xl text-red-700 text-sm">
        Purchase not found or failed to load.
      </div>
    );
  }

  return (
    <div className="space-y-5 max-w-4xl mx-auto pb-16">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 sm:p-5 rounded-2xl border border-brand-muted shadow-subtle">
        <div className="flex items-center gap-3">
          <Link
            href="/purchases"
            className="p-2.5 rounded-xl bg-brand-light border border-brand-muted text-brand-charcoal hover:bg-brand-muted transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-brand-charcoal tracking-tight font-sans">
                {purchase.purchaseNumber}
              </h1>
              {lot && (
                <span className="text-xs bg-brand-light text-brand-fabric border border-brand-muted font-mono px-2.5 py-0.5 rounded-full font-bold">
                  {lot.lotNumber}
                </span>
              )}
            </div>
            <p className="text-xs text-gray-500 mt-0.5">
              Purchased on {new Date(purchase.purchaseDate).toLocaleDateString()}
            </p>
          </div>
        </div>

        {lot && (
          <button
            onClick={() => setIsExpenseModalOpen(true)}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-brand-deep hover:bg-brand-fabric text-white text-xs sm:text-sm font-semibold shadow-sm transition active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>Add Landed Expense</span>
          </button>
        )}
      </div>

      {/* Summary Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white p-4 rounded-2xl border border-brand-muted shadow-subtle">
          <p className="text-[11px] text-gray-500 font-semibold uppercase tracking-wider">Total Landed Cost</p>
          <p className="text-lg sm:text-xl font-extrabold text-brand-charcoal mt-1">
            {formatPKR(purchase.totalLandedCost)}
          </p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-brand-muted shadow-subtle">
          <p className="text-[11px] text-gray-500 font-semibold uppercase tracking-wider">Landed Cost / KG</p>
          <p className="text-lg sm:text-xl font-extrabold text-emerald-700 mt-1">
            {formatPKR(lot?.landedCostPerKg || 0)}
          </p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-brand-muted shadow-subtle">
          <p className="text-[11px] text-gray-500 font-semibold uppercase tracking-wider">Purchased Weight</p>
          <p className="text-lg sm:text-xl font-extrabold text-brand-charcoal mt-1">
            {lot ? formatWeight(lot.purchasedGrams) : '0 KG'}
          </p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-brand-muted shadow-subtle">
          <p className="text-[11px] text-gray-500 font-semibold uppercase tracking-wider">Available Stock</p>
          <p className="text-lg sm:text-xl font-extrabold text-brand-fabric mt-1">
            {lot ? formatWeight(lot.availableGrams) : '0 KG'}
          </p>
        </div>
      </div>

      {/* Supplier & Fabric Specs */}
      <div className="bg-white p-5 rounded-2xl border border-brand-muted shadow-subtle space-y-4">
        <h2 className="text-xs font-bold text-brand-charcoal uppercase tracking-wider flex items-center gap-2">
          <Building2 className="w-4 h-4 text-brand-fabric" />
          <span>Supplier & Fabric Information</span>
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div>
            <p className="text-gray-400 uppercase text-[10px] font-semibold">Supplier Name</p>
            <p className="text-sm font-bold text-brand-charcoal mt-0.5">{purchase.supplier?.name}</p>
            <p className="text-gray-500">{purchase.supplier?.phone} • {purchase.supplier?.address}</p>
          </div>

          <div>
            <p className="text-gray-400 uppercase text-[10px] font-semibold">Fabric Product</p>
            <p className="text-sm font-bold text-brand-charcoal mt-0.5">{lot?.product?.name}</p>
            <p className="text-gray-500">{lot?.product?.category?.name} {lot?.product?.code ? `(${lot?.product?.code})` : ''}</p>
          </div>

          <div>
            <p className="text-gray-400 uppercase text-[10px] font-semibold">Mill / Bilti Ref #</p>
            <p className="text-sm font-semibold text-brand-charcoal mt-0.5">{purchase.invoiceRefNumber || 'N/A'}</p>
          </div>

          <div>
            <p className="text-gray-400 uppercase text-[10px] font-semibold">Base Purchase Rate</p>
            <p className="text-sm font-semibold text-brand-charcoal mt-0.5">
              {formatPKR(lot?.purchaseRatePerKg || 0)} / KG
            </p>
          </div>
        </div>
      </div>

      {/* Landed Expenses Breakdown */}
      <div className="bg-white p-5 rounded-2xl border border-brand-muted shadow-subtle space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold text-brand-charcoal uppercase tracking-wider flex items-center gap-2">
            <Package className="w-4 h-4 text-brand-fabric" />
            <span>Capitalized Landed Expenses</span>
          </h2>
          <span className="text-xs font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-100">
            Total: {formatPKR(purchase.totalExpenses)}
          </span>
        </div>

        {purchase.expenses?.length === 0 ? (
          <p className="text-xs text-gray-400 py-3">No additional landed expenses on this lot.</p>
        ) : (
          <div className="divide-y divide-gray-100">
            {purchase.expenses?.map((exp: any) => (
              <div key={exp.id} className="py-2.5 flex items-center justify-between text-xs">
                <div>
                  <p className="font-bold text-brand-charcoal">{exp.category}</p>
                  {exp.customName && <p className="text-[11px] text-gray-500">{exp.customName}</p>}
                  {exp.notes && <p className="text-[10px] text-gray-400">{exp.notes}</p>}
                </div>
                <div className="text-right">
                  <p className="font-bold text-brand-charcoal">{formatPKR(exp.amount)}</p>
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                      exp.isPaid ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                    }`}
                  >
                    {exp.isPaid ? 'Paid' : 'Unpaid (Payable)'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Stock Movement History for this Lot */}
      {lot && (
        <div className="bg-white p-5 rounded-2xl border border-brand-muted shadow-subtle space-y-3">
          <h2 className="text-xs font-bold text-brand-charcoal uppercase tracking-wider flex items-center gap-2">
            <Clock className="w-4 h-4 text-brand-fabric" />
            <span>Lot Stock Movements</span>
          </h2>

          <div className="divide-y divide-gray-100">
            {lot.movements?.map((m: any) => (
              <div key={m.id} className="py-2.5 flex items-center justify-between text-xs">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-brand-charcoal">{m.type}</span>
                    <span className="text-[10px] text-gray-400">
                      {new Date(m.date).toLocaleDateString()}
                    </span>
                  </div>
                  {m.notes && <p className="text-[11px] text-gray-500 mt-0.5">{m.notes}</p>}
                </div>
                <div className="text-right">
                  <p
                    className={`font-extrabold ${
                      m.gramsChange > 0 ? 'text-emerald-700' : 'text-red-600'
                    }`}
                  >
                    {m.gramsChange > 0 ? '+' : ''}
                    {formatWeight(m.gramsChange)}
                  </p>
                  <p className="text-[10px] text-gray-400">
                    Avail: {formatWeight(m.resultingAvailableGrams)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Post-Purchase Expense Modal */}
      {isExpenseModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-brand-deep/70 backdrop-blur-sm">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-brand-muted animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-4 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <Calculator className="w-5 h-5 text-brand-fabric" />
                <h3 className="font-extrabold text-base text-brand-charcoal">Add Landed Expense to Lot</h3>
              </div>
              <button
                onClick={() => setIsExpenseModalOpen(false)}
                className="p-1 rounded-lg text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddExpenseSubmit} className="space-y-4 pt-4">
              {modalError && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs font-semibold">
                  {modalError}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-brand-charcoal mb-1">
                  Expense Category *
                </label>
                <select
                  value={expenseCategory}
                  onChange={(e) => setExpenseCategory(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-brand-muted text-xs text-brand-charcoal focus:ring-2 focus:ring-brand-fabric outline-none bg-white"
                >
                  {DEFAULT_LOT_EXPENSE_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                  <option value="Other">Other Custom</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-brand-charcoal mb-1">
                  Custom Description / Payee
                </label>
                <input
                  type="text"
                  value={customExpenseName}
                  onChange={(e) => setCustomExpenseName(e.target.value)}
                  placeholder="e.g. Mazdoor union loading, Suzuki transport"
                  className="w-full px-3 py-2 rounded-xl border border-brand-muted text-xs text-brand-charcoal focus:ring-2 focus:ring-brand-fabric outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-brand-charcoal mb-1">
                  Amount (PKR) *
                </label>
                <input
                  type="number"
                  required
                  min={1}
                  step="any"
                  value={expenseAmount}
                  onChange={(e) => setExpenseAmount(e.target.value === '' ? '' : Number(e.target.value))}
                  placeholder="e.g. 5000"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-brand-muted text-base font-bold text-brand-charcoal focus:ring-2 focus:ring-brand-fabric outline-none"
                />
              </div>

              <div className="space-y-2 pt-1 text-xs">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isPaid}
                    onChange={(e) => setIsPaid(e.target.checked)}
                    className="rounded border-gray-300 text-brand-fabric focus:ring-brand-fabric"
                  />
                  <span className="text-brand-charcoal font-medium">Paid out immediately</span>
                </label>

                {isPaid && (
                  <div>
                    <label className="block text-[11px] font-semibold text-gray-500 mb-1">
                      Payment Account
                    </label>
                    <select
                      value={paymentAccountId}
                      onChange={(e) => setPaymentAccountId(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-brand-muted text-xs text-brand-charcoal focus:ring-2 focus:ring-brand-fabric outline-none bg-white"
                    >
                      {accounts?.map((acc: any) => (
                        <option key={acc.id} value={acc.id}>
                          {acc.name} ({formatPKR(acc.currentBalance)})
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-brand-charcoal mb-1">
                  Notes
                </label>
                <input
                  type="text"
                  value={expenseNotes}
                  onChange={(e) => setExpenseNotes(e.target.value)}
                  placeholder="Optional notes"
                  className="w-full px-3 py-2 rounded-xl border border-brand-muted text-xs text-brand-charcoal focus:ring-2 focus:ring-brand-fabric outline-none"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsExpenseModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-brand-muted text-xs font-semibold text-gray-600 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addExpenseMutation.isPending}
                  className="px-5 py-2 rounded-xl bg-brand-deep hover:bg-brand-fabric text-white text-xs font-bold shadow-sm disabled:opacity-50"
                >
                  {addExpenseMutation.isPending ? 'Capitalizing...' : 'Capitalize Expense'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
