'use client';

import React, { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { formatPKR, formatWeight, DEFAULT_LOT_EXPENSE_CATEGORIES } from '@fatani/shared';
import {
  ArrowLeft,
  ShoppingCart,
  Package,
  Plus,
  Calendar,
  Building2,
  Clock,
  X,
  FileText,
} from 'lucide-react';

export default function PurchaseDetailPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const id = params.id as string;

  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [expenseCategory, setExpenseCategory] = useState<string>('Packaging');
  const [customExpenseName, setCustomExpenseName] = useState('');
  const [expenseAmount, setExpenseAmount] = useState<number>(0);
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
      setIsExpenseModalOpen(false);
      setExpenseAmount(0);
      setCustomExpenseName('');
      setModalError(null);
    },
    onError: (err: any) => {
      setModalError(err.message || 'Failed to add post-purchase expense');
    },
  });

  const handleAddExpenseSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!expenseAmount || expenseAmount <= 0) {
      setModalError('Amount must be greater than zero');
      return;
    }

    addExpenseMutation.mutate({
      category: expenseCategory,
      customName: customExpenseName || undefined,
      amount: Number(expenseAmount),
      isCapitalized: true,
      isPaid,
      paymentAccountId: isPaid ? paymentAccountId : null,
      date: new Date(),
      notes: expenseNotes || undefined,
    });
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <div className="w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin" />
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
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push('/purchases')}
            className="p-2 rounded-xl bg-white border border-slate-200 text-slate-600 hover:text-slate-900 shadow-sm"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
                {purchase.purchaseNumber}
              </h1>
              {lot && (
                <span className="text-xs bg-emerald-100 text-emerald-800 font-mono px-2.5 py-0.5 rounded-full font-bold">
                  {lot.lotNumber}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Purchased on {new Date(purchase.purchaseDate).toLocaleDateString()}
            </p>
          </div>
        </div>

        {lot && (
          <button
            onClick={() => setIsExpenseModalOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-semibold shadow-md shadow-emerald-600/20 transition active:scale-95"
          >
            <Plus className="w-4 h-4" />
            <span>Add Landed Expense</span>
          </button>
        )}
      </div>

      {/* Summary Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
          <p className="text-xs text-slate-500 font-semibold uppercase">Total Landed Cost</p>
          <p className="text-lg sm:text-xl font-extrabold text-slate-900 mt-1">
            {formatPKR(purchase.totalLandedCost)}
          </p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
          <p className="text-xs text-slate-500 font-semibold uppercase">Landed Cost / KG</p>
          <p className="text-lg sm:text-xl font-extrabold text-emerald-600 mt-1">
            {formatPKR(lot?.landedCostPerKg || 0)}
          </p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
          <p className="text-xs text-slate-500 font-semibold uppercase">Purchased Weight</p>
          <p className="text-lg sm:text-xl font-extrabold text-slate-900 mt-1">
            {lot ? formatWeight(lot.purchasedGrams) : '0 KG'}
          </p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
          <p className="text-xs text-slate-500 font-semibold uppercase">Available Stock</p>
          <p className="text-lg sm:text-xl font-extrabold text-blue-600 mt-1">
            {lot ? formatWeight(lot.availableGrams) : '0 KG'}
          </p>
        </div>
      </div>

      {/* Supplier & Fabric Specs */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
          <Building2 className="w-4 h-4 text-emerald-600" />
          <span>Supplier & Fabric Information</span>
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
          <div>
            <p className="text-slate-400">Supplier Name</p>
            <p className="text-sm font-bold text-slate-900 mt-0.5">{purchase.supplier?.name}</p>
            <p className="text-slate-500">{purchase.supplier?.phone} • {purchase.supplier?.address}</p>
          </div>

          <div>
            <p className="text-slate-400">Fabric Product</p>
            <p className="text-sm font-bold text-slate-900 mt-0.5">{lot?.product?.name}</p>
            <p className="text-slate-500">{lot?.product?.category?.name} {lot?.product?.code ? `(${lot?.product?.code})` : ''}</p>
          </div>

          <div>
            <p className="text-slate-400">Mill / Bilti Ref #</p>
            <p className="text-sm font-semibold text-slate-800 mt-0.5">{purchase.invoiceRefNumber || 'N/A'}</p>
          </div>

          <div>
            <p className="text-slate-400">Base Purchase Rate</p>
            <p className="text-sm font-semibold text-slate-800 mt-0.5">
              {formatPKR(lot?.purchaseRatePerKg || 0)} / KG
            </p>
          </div>
        </div>
      </div>

      {/* Landed Expenses Breakdown */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
            <Package className="w-4 h-4 text-emerald-600" />
            <span>Capitalized Landed Expenses</span>
          </h2>
          <span className="text-xs font-bold text-emerald-700">
            Total: {formatPKR(purchase.totalExpenses)}
          </span>
        </div>

        {purchase.expenses?.length === 0 ? (
          <p className="text-xs text-slate-400 py-2">No additional landed expenses on this lot.</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {purchase.expenses?.map((exp: any) => (
              <div key={exp.id} className="py-2.5 flex items-center justify-between text-xs">
                <div>
                  <p className="font-semibold text-slate-900">{exp.category}</p>
                  {exp.customName && <p className="text-slate-500">{exp.customName}</p>}
                </div>
                <div className="text-right">
                  <p className="font-bold text-slate-900">{formatPKR(exp.amount)}</p>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                    exp.isPaid ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                  }`}>
                    {exp.isPaid ? 'Paid' : 'Unpaid Payable'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Lot Movement & Stock Tracking */}
      {lot && lot.movements && lot.movements.length > 0 && (
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
          <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
            <Clock className="w-4 h-4 text-emerald-600" />
            <span>Lot Stock Movements History</span>
          </h2>

          <div className="divide-y divide-slate-100">
            {lot.movements.map((m: any) => (
              <div key={m.id} className="py-2.5 flex items-center justify-between text-xs">
                <div>
                  <div className="flex items-center gap-2">
                    <span className={`font-bold px-2 py-0.5 rounded text-[10px] ${
                      m.type === 'PURCHASE' || m.type === 'SALES_RETURN'
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {m.type}
                    </span>
                    <span className="text-slate-500">{new Date(m.date).toLocaleDateString()}</span>
                  </div>
                  <p className="text-slate-600 mt-1">{m.notes}</p>
                </div>

                <div className="text-right">
                  <p className={`font-bold ${m.gramsChange > 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                    {m.gramsChange > 0 ? '+' : ''}{formatWeight(m.gramsChange)}
                  </p>
                  <p className="text-[10px] text-slate-400">
                    Bal: {formatWeight(m.resultingAvailableGrams)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal: Add Post-Purchase Expense */}
      {isExpenseModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-bold text-base text-slate-900">Add Landed Expense</h3>
                <p className="text-xs text-slate-500">Recalculates lot landed cost per KG</p>
              </div>
              <button
                onClick={() => setIsExpenseModalOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {modalError && (
              <div className="p-3 bg-red-50 text-red-700 text-xs rounded-xl border border-red-200">
                {modalError}
              </div>
            )}

            <form onSubmit={handleAddExpenseSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Expense Category</label>
                <select
                  value={expenseCategory}
                  onChange={(e) => setExpenseCategory(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium"
                >
                  {DEFAULT_LOT_EXPENSE_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Custom Expense Title</label>
                <input
                  type="text"
                  value={customExpenseName}
                  onChange={(e) => setCustomExpenseName(e.target.value)}
                  placeholder="e.g. Additional folding labor"
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Amount (PKR) *</label>
                <input
                  type="number"
                  min="0"
                  required
                  value={expenseAmount}
                  onChange={(e) => setExpenseAmount(parseFloat(e.target.value) || 0)}
                  placeholder="0"
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-base font-bold text-slate-900"
                />
              </div>

              <div className="pt-1">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isPaid}
                    onChange={(e) => setIsPaid(e.target.checked)}
                    className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                  />
                  <span className="font-semibold text-slate-800">Paid immediately</span>
                </label>

                {isPaid && (
                  <div className="mt-2">
                    <label className="block text-[11px] text-slate-500 mb-1">Paid From Account</label>
                    <select
                      value={paymentAccountId}
                      onChange={(e) => setPaymentAccountId(e.target.value)}
                      className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium"
                    >
                      {accounts?.map((acc) => (
                        <option key={acc.id} value={acc.id}>
                          {acc.name} ({formatPKR(acc.currentBalance)})
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Remarks / Notes</label>
                <input
                  type="text"
                  value={expenseNotes}
                  onChange={(e) => setExpenseNotes(e.target.value)}
                  placeholder="Notes..."
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsExpenseModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addExpenseMutation.isPending}
                  className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold transition disabled:opacity-50"
                >
                  {addExpenseMutation.isPending ? 'Saving...' : 'Add Expense & Recalculate'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
