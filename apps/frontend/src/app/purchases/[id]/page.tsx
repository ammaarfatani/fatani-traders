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
  Banknote,
  ArrowUpRight,
  Calendar,
  AlertCircle,
  Edit,
  Trash2,
} from 'lucide-react';
import { ConfirmDeleteModal } from '@/components/ui/ConfirmDeleteModal';
import { EditPurchaseModal } from '@/components/purchases/EditPurchaseModal';
import { EditLotExpenseModal } from '@/components/purchases/EditLotExpenseModal';

export default function PurchaseDetailPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const id = Array.isArray(params.id) ? params.id[0] : (params.id as string);

  // Landed Expense Modal State
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);
  const [expenseCategory, setExpenseCategory] = useState<string>('Transport');
  const [customExpenseName, setCustomExpenseName] = useState('');
  const [expenseAmount, setExpenseAmount] = useState<number | ''>('');
  const [expenseNotes, setExpenseNotes] = useState('');
  const [expenseModalError, setExpenseModalError] = useState<string | null>(null);

  // Purchase Payment Modal State
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState<number | ''>('');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [paymentRef, setPaymentRef] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [paymentModalError, setPaymentModalError] = useState<string | null>(null);

  // Edit / Delete State
  const [isEditPurchaseOpen, setIsEditPurchaseOpen] = useState(false);
  const [isDeletePurchaseOpen, setIsDeletePurchaseOpen] = useState(false);
  const [editingExpense, setEditingExpense] = useState<any | null>(null);
  const [deletingExpense, setDeletingExpense] = useState<any | null>(null);

  const { data: purchase, isLoading, error } = useQuery({
    queryKey: ['purchase', id],
    queryFn: () => api.get<any>(`/purchases/${id}`),
  });

  const { data: suppliers = [] } = useQuery({queryKey:['suppliers'],queryFn:()=>api.get<any[]>('/suppliers'),enabled:isEditPurchaseOpen});

  const handleDeletePurchase = async () => {
    await api.delete(`/purchases/${id}`);
    queryClient.invalidateQueries();
    router.push('/purchases');
  };

  const handleDeleteExpense = async () => {
    if (!deletingExpense) return;
    await api.delete(`/purchases/expenses/${deletingExpense.id}`);
    queryClient.invalidateQueries();
    setDeletingExpense(null);
  };

  const lot = purchase?.lots?.[0];

  const addExpenseMutation = useMutation({
    mutationFn: (payload: any) =>
      api.post(`/purchases/lots/${lot.id}/expense`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries();
      setIsExpenseModalOpen(false);
      setExpenseAmount('');
      setCustomExpenseName('');
      setExpenseNotes('');
      setExpenseModalError(null);
    },
    onError: (err: any) => {
      setExpenseModalError(err.message || 'Failed to add landed expense');
    },
  });

  const recordPaymentMutation = useMutation({
    mutationFn: (payload: any) => api.post('/payments', payload),
    onSuccess: () => {
      queryClient.invalidateQueries();
      if (purchase?.supplierId) {
        queryClient.invalidateQueries();
      }
      setIsPaymentModalOpen(false);
      setPaymentAmount('');
      setPaymentRef('');
      setPaymentNotes('');
      setPaymentModalError(null);
    },
    onError: (err: any) => {
      setPaymentModalError(err.message || 'Failed to record payment');
    },
  });

  const handleOpenPaymentModal = () => {
    if (purchase) {
      setPaymentAmount(purchase.balanceAmount);
      setPaymentRef(`Payment for ${purchase.purchaseNumber}`);
      setPaymentDate(new Date().toISOString().split('T')[0]);
      setPaymentModalError(null);
      setIsPaymentModalOpen(true);
    }
  };

  const handlePaymentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentAmount || Number(paymentAmount) <= 0) {
      setPaymentModalError('Payment amount must be greater than zero');
      return;
    }
    if (Number(paymentAmount) > purchase.balanceAmount) {
      setPaymentModalError(`Payment amount cannot exceed remaining balance (${formatPKR(purchase.balanceAmount)})`);
      return;
    }
    setPaymentModalError(null);
    recordPaymentMutation.mutate({
      type: 'SUPPLIER_PAYMENT',
      purchaseId: purchase.id,
      supplierId: purchase.supplierId || undefined,
      amount: Number(paymentAmount),
      paymentDate: new Date(paymentDate).toISOString(),
      referenceNumber: paymentRef || purchase.purchaseNumber,
      notes: paymentNotes || undefined,
    });
  };

  const handleAddExpenseSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!expenseAmount || Number(expenseAmount) <= 0) {
      setExpenseModalError('Expense amount must be greater than zero');
      return;
    }

    addExpenseMutation.mutate({
      category: expenseCategory,
      customName: customExpenseName || undefined,
      amount: Number(expenseAmount),
      isCapitalized: true,
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

  const paymentAllocations = purchase.paymentAllocations || [];
  const paymentHistoryById = new Map<string, {payment:any;amount:number}>();
  for (const allocation of paymentAllocations) {
    if (!allocation.payment) continue;
    const existing = paymentHistoryById.get(allocation.payment.id);
    paymentHistoryById.set(allocation.payment.id, {
      payment: allocation.payment,
      amount: (existing?.amount || 0) + allocation.amount,
    });
  }
  for (const payment of purchase.payments || []) {
    if (!paymentHistoryById.has(payment.id)) paymentHistoryById.set(payment.id, {payment, amount:payment.amount});
  }
  const paymentHistory = Array.from(paymentHistoryById.values()).sort((a,b)=>new Date(b.payment.paymentDate).getTime()-new Date(a.payment.paymentDate).getTime());
  const paymentHistoryTotal = paymentHistory.reduce((sum,row)=>sum+row.amount,0);
  const supplierName = purchase.supplier?.name || 'Unknown Supplier';
  const fabricName = lot?.product?.name || 'Fabric Lot';

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-16">
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
                <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-brand-light text-brand-fabric border border-brand-muted">
                  Lot #{lot.lotNumber}
                </span>
              )}
            </div>
            <p className="text-xs text-gray-500 mt-0.5">
              Purchased on {new Date(purchase.purchaseDate).toLocaleDateString()} from <span className="font-semibold text-brand-charcoal">{supplierName}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {purchase.balanceAmount > 0 && (
            <button
              onClick={handleOpenPaymentModal}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-semibold text-xs shadow-sm transition"
            >
              <Banknote className="w-4 h-4" />
              <span>+ Pay Purchase</span>
            </button>
          )}

          {lot && (
            <button
              onClick={() => setIsExpenseModalOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-brand-deep hover:bg-brand-fabric text-white font-semibold text-xs shadow-sm transition"
            >
              <Plus className="w-4 h-4" />
              <span>Add Landed Expense</span>
            </button>
          )}

          <button
            onClick={() => setIsEditPurchaseOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-brand-muted hover:bg-brand-light text-brand-charcoal font-semibold text-xs transition"
            title="Edit Purchase"
          >
            <Edit className="w-3.5 h-3.5 text-gray-500" />
            <span>Edit</span>
          </button>

          <button
            onClick={() => setIsDeletePurchaseOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-red-200 text-red-600 hover:bg-red-50 font-semibold text-xs transition"
            title="Delete Purchase"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Delete</span>
          </button>
        </div>
      </div>

      {/* Primary Financial Overview Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3.5">
        <div className="bg-white p-4 rounded-2xl border border-brand-muted shadow-subtle">
          <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block mb-1">
            Base Purchase Cost
          </span>
          <p className="text-xl font-extrabold text-brand-charcoal">{formatPKR(purchase.baseCost)}</p>
          <p className="text-[11px] text-gray-500 mt-0.5">Weight × Rate</p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-brand-muted shadow-subtle">
          <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block mb-1">
            Additional Expenses
          </span>
          <p className="text-xl font-extrabold text-emerald-700">{formatPKR(purchase.totalExpenses || 0)}</p>
          <p className="text-[11px] text-gray-500 mt-0.5">Transport, labor, packaging</p>
        </div>

        <div className="bg-brand-deep text-white p-4 rounded-2xl shadow-subtle">
          <span className="text-[10px] font-bold uppercase tracking-wider text-brand-light/90 block mb-1">
            Total Landed Cost
          </span>
          <p className="text-xl font-extrabold text-white">{formatPKR(purchase.totalLandedCost)}</p>
          <p className="text-[11px] text-brand-light/70 mt-0.5">
            Landed Rate: {formatPKR(lot?.landedCostPerKg || 0)} / KG
          </p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-brand-muted shadow-subtle">
          <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 block mb-1">
            Remaining Payable
          </span>
          <p className="text-xl font-extrabold text-amber-700">{formatPKR(purchase.balanceAmount || 0)}</p>
          <p className="text-[11px] text-gray-500 mt-0.5">Paid: {formatPKR(purchase.paidAmount || 0)}</p>
        </div>
      </div>

      {/* Lot & Fabric Specifications */}
      {lot && (
        <div className="bg-white p-5 sm:p-6 rounded-2xl border border-brand-muted shadow-subtle space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <Package className="w-5 h-5 text-brand-fabric" />
              <h2 className="font-bold text-base text-brand-charcoal">Fabric Lot Details</h2>
            </div>
            <span
              className={`text-xs px-2.5 py-1 rounded-full font-bold ${
                lot.status === 'ACTIVE'
                  ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                  : 'bg-gray-100 text-gray-600'
              }`}
            >
              {lot.status}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
            <div>
              <span className="text-gray-400 block mb-0.5">Fabric Name</span>
              <p className="font-bold text-brand-charcoal text-sm">{fabricName}</p>
            </div>
            <div>
              <span className="text-gray-400 block mb-0.5">Initial Weight</span>
              <p className="font-bold text-brand-charcoal text-sm font-mono">{formatWeight(lot.purchasedGrams)}</p>
            </div>
            <div>
              <span className="text-gray-400 block mb-0.5">Available In Stock</span>
              <p className="font-bold text-emerald-700 text-sm font-mono">{formatWeight(lot.availableGrams)}</p>
            </div>
            <div>
              <span className="text-gray-400 block mb-0.5">Purchase Rate</span>
              <p className="font-bold text-brand-charcoal text-sm font-mono">Rs. {lot.purchaseRatePerKg.toLocaleString()} / KG</p>
            </div>
          </div>
        </div>
      )}

      {/* Landed Expenses Breakdown Table */}
      <div className="bg-white p-5 sm:p-6 rounded-2xl border border-brand-muted shadow-subtle space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Calculator className="w-5 h-5 text-brand-fabric" />
            <h2 className="font-bold text-base text-brand-charcoal">Additional Expenses Breakdown</h2>
          </div>
          {lot && (
            <button
              onClick={() => setIsExpenseModalOpen(true)}
              className="text-xs font-semibold text-brand-fabric hover:text-brand-accent flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Expense</span>
            </button>
          )}
        </div>

        {!lot?.expenses || lot.expenses.length === 0 ? (
          <p className="text-xs text-gray-400 py-4 text-center">
            No additional expenses recorded for this purchase.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-100 text-gray-400 text-left font-bold uppercase tracking-wider text-[10px]">
                  <th className="py-2.5">Category</th>
                  <th className="py-2.5">Payee / Description</th>
                  <th className="py-2.5">Notes</th>
                  <th className="py-2.5 text-right">Amount (PKR)</th>
                  <th className="py-2.5 text-right w-20">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {lot.expenses.map((exp: any) => (
                  <tr key={exp.id} className="hover:bg-brand-light/30">
                    <td className="py-3 font-semibold text-brand-charcoal">{exp.category}</td>
                    <td className="py-3 text-gray-600">{exp.customName || '-'}</td>
                    <td className="py-3 text-gray-500">{exp.notes || '-'}</td>
                    <td className="py-3 text-right font-bold text-brand-charcoal">
                      {formatPKR(exp.amount)}
                    </td>
                    <td className="py-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => setEditingExpense(exp)}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-brand-fabric hover:bg-brand-light transition"
                          title="Edit Expense"
                        >
                          <Edit className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setDeletingExpense(exp)}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition"
                          title="Delete Expense"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Linked Payment Transactions History Section */}
      <div className="bg-white p-5 sm:p-6 rounded-2xl border border-brand-muted shadow-subtle space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <ArrowUpRight className="w-5 h-5 text-amber-700" />
            <h2 className="font-bold text-base text-brand-charcoal">Purchase Payment History</h2>
          </div>
          {purchase.balanceAmount > 0 ? (
            <button
              onClick={handleOpenPaymentModal}
              className="px-3 py-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-semibold text-xs transition"
            >
              + Pay Purchase
            </button>
          ) : (
            <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
              ✓ Fully Paid
            </span>
          )}
        </div>

        {paymentHistory.length === 0 ? (
          <div className="py-6 text-center text-xs text-gray-400 space-y-2">
            {purchase.paidAmount > 0 ? (
              <p className="font-semibold text-amber-800">This purchase records {formatPKR(purchase.paidAmount)} paid, but no linked payment records were returned. Review this payment history before changing the purchase.</p>
            ) : <p>No payments recorded for this purchase yet.</p>}
            <p className="text-amber-700 font-semibold">Remaining balance payable: {formatPKR(purchase.balanceAmount)}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            {Math.abs(paymentHistoryTotal - purchase.paidAmount) >= 0.01 && (
              <p className="mb-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs font-semibold text-amber-900">
                Linked payment history totals {formatPKR(paymentHistoryTotal)}, while this purchase records {formatPKR(purchase.paidAmount)} paid. Review the discrepancy before editing or deleting the purchase.
              </p>
            )}
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-100 text-gray-400 text-left font-bold uppercase tracking-wider text-[10px]">
                  <th className="py-2.5">Date</th>
                  <th className="py-2.5">Payment #</th>
                  <th className="py-2.5">Reference / Notes</th>
                  <th className="py-2.5 text-right">Amount Paid</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {paymentHistory.map(({payment:p,amount}: any) => {
                  return (
                    <tr key={p?.id || p?._id || `${p?.paymentNumber || "payment"}-${amount}`}  className="hover:bg-brand-light/30">
                      <td className="py-3 text-gray-600 font-medium">
                        {p?.paymentDate ? new Date(p.paymentDate).toLocaleDateString() : '-'}
                      </td>
                      <td className="py-3 font-mono font-bold text-brand-charcoal">
                        {p?.paymentNumber || 'Direct Payment'}
                      </td>
                      <td className="py-3 text-gray-500">
                        {p?.referenceNumber || p?.notes || 'Purchase Settlement'}
                      </td>
                      <td className="py-3 text-right font-extrabold text-amber-700">
                        -{formatPKR(amount)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Record Purchase Payment Modal */}
      {isPaymentModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-brand-muted space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <Banknote className="w-5 h-5 text-amber-700" />
                <h3 className="font-bold text-base text-brand-charcoal">Pay Purchase</h3>
              </div>
              <button
                onClick={() => setIsPaymentModalOpen(false)}
                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {paymentModalError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs">
                {paymentModalError}
              </div>
            )}

            <form onSubmit={handlePaymentSubmit} className="space-y-4 text-xs">
              <div className="bg-brand-light/60 p-3 rounded-xl space-y-1.5 border border-brand-muted">
                <div className="flex justify-between">
                  <span className="text-gray-500">Purchase / Lot:</span>
                  <span className="font-bold font-mono text-brand-charcoal">{purchase.purchaseNumber} ({fabricName})</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Supplier:</span>
                  <span className="font-semibold text-brand-charcoal">{supplierName}</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-gray-700 block mb-1">Total Landed Cost</label>
                  <input
                    type="text"
                    value={formatPKR(purchase.totalLandedCost)}
                    disabled
                    className="w-full px-3 py-2 bg-gray-100 border border-gray-200 rounded-xl font-semibold"
                  />
                </div>
                <div>
                  <label className="font-semibold text-amber-700 block mb-1">Balance Due</label>
                  <input
                    type="text"
                    value={formatPKR(purchase.balanceAmount)}
                    disabled
                    className="w-full px-3 py-2 bg-amber-50 border border-amber-200 rounded-xl font-bold text-amber-700"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-brand-charcoal block mb-1">
                  Payment Amount to Pay (PKR) *
                </label>
                <input
                  type="number"
                  required
                  min={1}
                  max={purchase.balanceAmount}
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value === '' ? '' : Number(e.target.value))}
                  className="w-full px-3.5 py-2.5 border border-brand-muted rounded-xl text-sm font-bold text-amber-800 focus:outline-none focus:ring-2 focus:ring-amber-600"
                  placeholder="Enter payment amount"
                />
              </div>

              <div>
                <label className="font-semibold text-gray-700 block mb-1">Payment Date *</label>
                <input
                  type="date"
                  required
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                  className="w-full px-3 py-2 border border-brand-muted rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-fabric"
                />
              </div>

              <div>
                <label className="font-semibold text-gray-700 block mb-1">
                  Payment Reference (Cash / Bank Transfer Ref)
                </label>
                <input
                  type="text"
                  value={paymentRef}
                  onChange={(e) => setPaymentRef(e.target.value)}
                  className="w-full px-3 py-2 border border-brand-muted rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-fabric"
                  placeholder="e.g. Cash, Cheque #1029, Meezan online"
                />
              </div>

              <div>
                <label className="font-semibold text-gray-700 block mb-1">Notes (Optional)</label>
                <textarea
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 border border-brand-muted rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-fabric"
                  placeholder="Additional remarks..."
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setIsPaymentModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={recordPaymentMutation.isPending}
                  className="px-5 py-2 rounded-xl bg-amber-700 hover:bg-amber-800 text-white font-bold shadow-sm transition disabled:opacity-50"
                >
                  {recordPaymentMutation.isPending ? 'Recording...' : 'Confirm Payment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Landed Expense Modal */}
      {isExpenseModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-brand-muted space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <Calculator className="w-5 h-5 text-brand-fabric" />
                <h3 className="font-bold text-base text-brand-charcoal">Add Landed Expense</h3>
              </div>
              <button
                onClick={() => setIsExpenseModalOpen(false)}
                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {expenseModalError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs">
                {expenseModalError}
              </div>
            )}

            <form onSubmit={handleAddExpenseSubmit} className="space-y-4 text-xs">
              <div>
                <label className="font-semibold text-gray-700 block mb-1">Expense Category *</label>
                <select
                  value={expenseCategory}
                  onChange={(e) => setExpenseCategory(e.target.value)}
                  className="w-full px-3 py-2 border border-brand-muted rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-fabric bg-white"
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
                <label className="font-semibold text-gray-700 block mb-1">Payee / Description</label>
                <input
                  type="text"
                  value={customExpenseName}
                  onChange={(e) => setCustomExpenseName(e.target.value)}
                  placeholder="e.g. Mazdoor union loading, Suzuki transport"
                  className="w-full px-3 py-2 border border-brand-muted rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-fabric"
                />
              </div>

              <div>
                <label className="font-bold text-brand-charcoal block mb-1">Amount (PKR) *</label>
                <input
                  type="number"
                  required
                  min={1}
                  value={expenseAmount}
                  onChange={(e) => setExpenseAmount(e.target.value === '' ? '' : Number(e.target.value))}
                  placeholder="e.g. 5000"
                  className="w-full px-3.5 py-2.5 border border-brand-muted rounded-xl text-sm font-bold text-brand-charcoal focus:outline-none focus:ring-2 focus:ring-brand-fabric"
                />
              </div>

              <div>
                <label className="font-semibold text-gray-700 block mb-1">Notes (Optional)</label>
                <input
                  type="text"
                  value={expenseNotes}
                  onChange={(e) => setExpenseNotes(e.target.value)}
                  placeholder="Optional notes"
                  className="w-full px-3 py-2 border border-brand-muted rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-fabric"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setIsExpenseModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addExpenseMutation.isPending}
                  className="px-5 py-2 rounded-xl bg-brand-deep hover:bg-brand-fabric text-white font-bold shadow-sm transition disabled:opacity-50"
                >
                  {addExpenseMutation.isPending ? 'Capitalizing...' : 'Capitalize Expense'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Purchase Modal */}
      {purchase && (
        <EditPurchaseModal
          isOpen={isEditPurchaseOpen}
          onClose={() => setIsEditPurchaseOpen(false)}
          purchase={purchase}
          suppliers={suppliers}
          onSuccess={() => {
            queryClient.invalidateQueries();
            queryClient.invalidateQueries();
          }}
        />
      )}

      {/* Delete Purchase Confirmation Modal */}
      {purchase && (
        <ConfirmDeleteModal
          isOpen={isDeletePurchaseOpen}
          onClose={() => setIsDeletePurchaseOpen(false)}
          onConfirm={handleDeletePurchase}
          title="Delete Purchase"
          description="Confirm deletion of this purchase and its lot records. Purchase-only payments will be voided and reversed; shared payments will remain active but be detached from this purchase."
          itemIdentifier={`${purchase.purchaseNumber} (${fabricName})`}
          consequences={[
            `Removes purchase record ${purchase.purchaseNumber} and associated lot #${lot?.lotNumber || ''}.`,
            `Restores/removes the added inventory weight of ${lot ? formatWeight(lot.purchasedGrams) : ''}.`,
            `Reverses supplier payable balance of ${formatPKR(purchase.totalLandedCost)}.`,
            'Fully purchase-only payments are voided, their account/supplier balances are reversed, and payment/ledger audit history is retained.',
            'Payments shared with other purchases remain active; only their allocation to this purchase is detached. Deletion is blocked if sales, returns, or payment/account ledger mismatches are found.',
          ]}
          confirmButtonText="Delete Purchase"
        />
      )}

      {/* Edit Landed Expense Modal */}
      <EditLotExpenseModal
        isOpen={!!editingExpense}
        onClose={() => setEditingExpense(null)}
        expense={editingExpense}
        onSuccess={() => {
          queryClient.invalidateQueries();
          queryClient.invalidateQueries();
        }}
      />

      {/* Delete Landed Expense Confirmation Modal */}
      <ConfirmDeleteModal
        isOpen={!!deletingExpense}
        onClose={() => setDeletingExpense(null)}
        onConfirm={handleDeleteExpense}
        title="Delete Landed Expense"
        description="Are you sure you want to delete this additional landed cost expense?"
        itemIdentifier={deletingExpense ? `${deletingExpense.category} - ${formatPKR(deletingExpense.amount)}` : ''}
        consequences={[
          'Removes this expense from the lot cost breakdown.',
          'Recalculates the landed cost per KG for this purchase lot.',
          'Adjusts the total landed cost and outstanding balance payable.',
        ]}
        confirmButtonText="Delete Expense"
      />
    </div>
  );
}
