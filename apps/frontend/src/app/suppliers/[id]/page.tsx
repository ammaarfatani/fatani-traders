'use client';

import React, { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { formatPKR } from '@fatani/shared';
import {
  ArrowLeft,
  Building2,
  Plus,
  Phone,
  Printer,
  X,
  CreditCard,
  MapPin,
  CheckCircle,
} from 'lucide-react';

export default function SupplierKhataDetailPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const id = Array.isArray(params.id) ? params.id[0] : (params.id as string);

  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState<number | ''>('');
  const [accountId, setAccountId] = useState('');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [paymentRef, setPaymentRef] = useState('');
  const [selectedPurchaseId, setSelectedPurchaseId] = useState<string>('');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [modalError, setModalError] = useState<string | null>(null);

  const { data: supplier, isLoading, error } = useQuery({
    queryKey: ['supplier', id],
    queryFn: () => api.get<any>(`/suppliers/${id}`),
  });

  const { data: accounts } = useQuery({
    queryKey: ['accounts'],
    queryFn: () => api.get<any[]>('/accounts'),
  });

  React.useEffect(() => {
    if (accounts && accounts.length > 0 && !accountId) {
      setAccountId(accounts[0].id);
    }
  }, [accounts, accountId]);

  const paySupplierMutation = useMutation({
    mutationFn: (payload: any) => api.post('/payments', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['supplier', id] });
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      setIsPaymentModalOpen(false);
      setPaymentAmount('');
      setPaymentRef('');
      setPaymentNotes('');
      setModalError(null);
    },
    onError: (err: any) => {
      setModalError(err.message || 'Failed to record supplier payment');
    },
  });

  const handlePaySupplierSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentAmount || Number(paymentAmount) <= 0) {
      setModalError('Payment amount must be greater than zero');
      return;
    }
    if (!accountId) {
      setModalError('Please select a payment account');
      return;
    }

    paySupplierMutation.mutate({
      type: 'SUPPLIER_PAYMENT',
      supplierId: id,
      accountId,
      amount: Number(paymentAmount),
      paymentDate,
      referenceNumber: paymentRef || undefined,
      notes: paymentNotes || undefined,
      purchaseId: selectedPurchaseId || undefined,
    });
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <div className="w-8 h-8 border-4 border-brand-fabric border-t-transparent rounded-full animate-spin" />
        <p className="text-xs text-gray-500 font-semibold uppercase tracking-wider">Loading Supplier Khata...</p>
      </div>
    );
  }

  if (error || !supplier) {
    return (
      <div className="p-6 bg-red-50 border border-red-200 rounded-2xl text-red-700 text-sm">
        Supplier not found or failed to load.
      </div>
    );
  }

  const isPayable = supplier.currentBalance > 0;
  const isAdvance = supplier.currentBalance < 0;

  return (
    <div className="space-y-5 max-w-4xl mx-auto pb-16">
      {/* Header Bar */}
      <div className="no-print flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 sm:p-5 rounded-2xl border border-brand-muted shadow-subtle">
        <div className="flex items-center gap-3">
          <Link
            href="/suppliers"
            className="p-2.5 rounded-xl bg-brand-light border border-brand-muted text-brand-charcoal hover:bg-brand-muted transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-brand-charcoal tracking-tight font-sans">{supplier.name}</h1>
              {supplier.companyName && (
                <span className="text-xs bg-brand-light text-brand-fabric border border-brand-muted px-2 py-0.5 rounded-md font-semibold">
                  {supplier.companyName}
                </span>
              )}
            </div>
            <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1.5">
              <Phone className="w-3.5 h-3.5 text-gray-400" />
              <span>{supplier.phone}</span>
              {supplier.address && <span>• {supplier.address}</span>}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-brand-light hover:bg-brand-muted text-brand-charcoal border border-brand-muted text-xs font-semibold transition"
          >
            <Printer className="w-4 h-4" />
            <span>Print</span>
          </button>

          <button
            onClick={() => setIsPaymentModalOpen(true)}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-brand-deep hover:bg-brand-fabric text-white text-xs font-bold shadow-sm active:scale-95 transition"
          >
            <Plus className="w-4 h-4" />
            <span>Pay Supplier</span>
          </button>
        </div>
      </div>

      {/* Summary Card */}
      <div className="bg-white p-5 sm:p-6 rounded-2xl border border-brand-muted shadow-subtle space-y-4">
        <div className="flex items-center justify-between border-b border-gray-100 pb-4">
          <div>
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">
              Net Payable Balance
            </span>
            <p
              className={`text-2xl sm:text-3xl font-extrabold mt-1 ${
                isPayable ? 'text-amber-600' : isAdvance ? 'text-emerald-700' : 'text-brand-charcoal'
              }`}
            >
              {formatPKR(Math.abs(supplier.currentBalance))}
            </p>
            <p className="text-xs font-semibold mt-0.5 text-gray-600">
              {isPayable ? 'You Owe Supplier (Mill Debt)' : isAdvance ? 'Advance Paid to Mill' : 'Settled (Zero Balance)'}
            </p>
          </div>

          <div className="text-right">
            <span className="text-xs text-gray-400 uppercase tracking-wider font-semibold">Total Purchases</span>
            <p className="text-base font-bold text-brand-charcoal mt-1">
              {formatPKR(supplier.summary?.totalPurchased || 0)}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:gap-4 text-center text-xs pt-1">
          <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-100">
            <span className="text-emerald-700 block mb-0.5 text-[11px] font-medium uppercase">Total Payments Made</span>
            <span className="font-extrabold text-emerald-800 text-sm sm:text-base">
              {formatPKR(supplier.summary?.totalPaymentsMade || 0)}
            </span>
          </div>

          <div className="p-3 bg-brand-light rounded-xl border border-brand-muted">
            <span className="text-gray-500 block mb-0.5 text-[11px] font-medium uppercase">Total Returns / Refunds</span>
            <span className="font-extrabold text-brand-charcoal text-sm sm:text-base">
              {formatPKR(supplier.summary?.totalReturns || 0)}
            </span>
          </div>
        </div>
      </div>

      {/* Chronological Supplier Ledger */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-brand-muted shadow-subtle space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-bold text-brand-charcoal uppercase tracking-wider flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-brand-fabric" />
            <span>Supplier Ledger Entries</span>
          </h2>
          <span className="text-xs text-gray-400">{supplier.ledgerEntries?.length || 0} entries</span>
        </div>

        {supplier.ledgerEntries?.length === 0 ? (
          <p className="text-xs text-gray-400 py-6 text-center">No transactions recorded in this ledger.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-brand-muted text-gray-400 uppercase text-[10px] tracking-wider font-bold">
                  <th className="py-2.5 pr-2">Date</th>
                  <th className="py-2.5 px-2">Type / Ref</th>
                  <th className="py-2.5 px-2">Details</th>
                  <th className="py-2.5 px-2 text-right text-emerald-700">You Paid (Debit)</th>
                  <th className="py-2.5 px-2 text-right text-amber-600">You Purchased (Credit)</th>
                  <th className="py-2.5 pl-2 text-right">Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {supplier.ledgerEntries?.map((entry: any) => (
                  <tr key={entry.id}>
                    <td className="py-2.5 pr-2 text-gray-500">
                      {new Date(entry.date).toLocaleDateString()}
                    </td>
                    <td className="py-2.5 px-2 font-bold text-brand-charcoal font-mono">
                      {entry.referenceId || entry.type}
                    </td>
                    <td className="py-2.5 px-2 text-gray-500 truncate max-w-xs">
                      {entry.description || '-'}
                    </td>
                    <td className="py-2.5 px-2 text-right font-bold text-emerald-700">
                      {entry.debit > 0 ? formatPKR(entry.debit) : '-'}
                    </td>
                    <td className="py-2.5 px-2 text-right font-bold text-amber-600">
                      {entry.credit > 0 ? formatPKR(entry.credit) : '-'}
                    </td>
                    <td className="py-2.5 pl-2 text-right font-extrabold text-brand-charcoal">
                      {formatPKR(entry.runningBalance)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Payment Modal */}
      {isPaymentModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-brand-deep/70 backdrop-blur-sm">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-brand-muted animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-4 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-amber-600" />
                <h3 className="font-extrabold text-base text-brand-charcoal">Pay Fabric Supplier</h3>
              </div>
              <button
                onClick={() => setIsPaymentModalOpen(false)}
                className="p-1 rounded-lg text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handlePaySupplierSubmit} className="space-y-4 pt-4">
              {modalError && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs font-semibold">
                  {modalError}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-brand-charcoal mb-1">
                  Payment Amount (PKR) *
                </label>
                <input
                  type="number"
                  required
                  min={1}
                  step="any"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value === '' ? '' : Number(e.target.value))}
                  placeholder="e.g. 100000"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-brand-muted text-base font-bold text-brand-charcoal focus:ring-2 focus:ring-brand-fabric outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-brand-charcoal mb-1">
                  Pay From Account *
                </label>
                <select
                  required
                  value={accountId}
                  onChange={(e) => setAccountId(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-brand-muted text-sm text-brand-charcoal focus:ring-2 focus:ring-brand-fabric outline-none bg-white"
                >
                  {accounts?.map((acc: any) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.name} ({acc.type} - Bal: {formatPKR(acc.currentBalance)})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-brand-charcoal mb-1">
                    Payment Date
                  </label>
                  <input
                    type="date"
                    required
                    value={paymentDate}
                    onChange={(e) => setPaymentDate(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl border border-brand-muted text-xs text-brand-charcoal focus:ring-2 focus:ring-brand-fabric outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-brand-charcoal mb-1">
                    Cheque / Ref #
                  </label>
                  <input
                    type="text"
                    value={paymentRef}
                    onChange={(e) => setPaymentRef(e.target.value)}
                    placeholder="Ref or Cheque #"
                    className="w-full px-3 py-2 rounded-xl border border-brand-muted text-xs text-brand-charcoal focus:ring-2 focus:ring-brand-fabric outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-brand-charcoal mb-1">
                  Remarks / Notes
                </label>
                <input
                  type="text"
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                  placeholder="Optional notes"
                  className="w-full px-3 py-2 rounded-xl border border-brand-muted text-xs text-brand-charcoal focus:ring-2 focus:ring-brand-fabric outline-none"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsPaymentModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-brand-muted text-xs font-semibold text-gray-600 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={paySupplierMutation.isPending}
                  className="px-5 py-2 rounded-xl bg-brand-deep hover:bg-brand-fabric text-white text-xs font-bold shadow-sm disabled:opacity-50"
                >
                  {paySupplierMutation.isPending ? 'Paying...' : 'Record Payment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
