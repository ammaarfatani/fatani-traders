'use client';

import React, { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
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
} from 'lucide-react';

export default function SupplierKhataDetailPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const id = params.id as string;

  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState<number>(0);
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
      setIsPaymentModalOpen(false);
      setPaymentAmount(0);
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
    if (!paymentAmount || paymentAmount <= 0) {
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
      <div className="flex justify-center py-20">
        <div className="w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !supplier) {
    return (
      <div className="p-6 bg-red-50 border border-red-200 rounded-2xl text-red-700 text-sm">
        Supplier not found.
      </div>
    );
  }

  const isPayable = supplier.currentBalance > 0;
  const isAdvance = supplier.currentBalance < 0;

  return (
    <div className="space-y-4 max-w-4xl mx-auto pb-16">
      {/* Header Bar */}
      <div className="no-print flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push('/suppliers')}
            className="p-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-600 hover:text-slate-900"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">{supplier.name}</h1>
              {supplier.companyName && (
                <span className="text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md font-medium">
                  {supplier.companyName}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1">
              <Phone className="w-3.5 h-3.5" />
              <span>{supplier.phone}</span>
              {supplier.address && <span>• {supplier.address}</span>}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition"
          >
            <Printer className="w-4 h-4" />
            <span>Print</span>
          </button>

          <button
            onClick={() => setIsPaymentModalOpen(true)}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold shadow-md shadow-amber-600/20 active:scale-95 transition"
          >
            <Plus className="w-4 h-4" />
            <span>Pay Supplier</span>
          </button>
        </div>
      </div>

      {/* Summary Card */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              Net Payable Balance
            </span>
            <p className={`text-2xl sm:text-3xl font-black mt-1 ${
              isPayable ? 'text-amber-600' : isAdvance ? 'text-emerald-600' : 'text-slate-700'
            }`}>
              {formatPKR(Math.abs(supplier.currentBalance))}
            </p>
            <p className="text-xs font-semibold mt-0.5">
              {isPayable ? 'You Owe Supplier (Debt)' : isAdvance ? 'Advance Paid to Mill' : 'Settled'}
            </p>
          </div>

          <div className="text-right">
            <span className="text-xs text-slate-400 uppercase tracking-wider font-semibold">Total Purchases</span>
            <p className="text-base font-bold text-slate-800 mt-1">
              {formatPKR(supplier.summary?.totalPurchased || 0)}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 text-center text-xs pt-1">
          <div className="p-2.5 bg-emerald-50 rounded-xl">
            <span className="text-emerald-600 block mb-0.5">Total Payments Made</span>
            <span className="font-extrabold text-emerald-700 text-sm">
              {formatPKR(supplier.summary?.totalPaymentsMade || 0)}
            </span>
          </div>

          <div className="p-2.5 bg-slate-50 rounded-xl">
            <span className="text-slate-400 block mb-0.5">Total Returns / Refunds</span>
            <span className="font-extrabold text-slate-900 text-sm">
              {formatPKR(supplier.summary?.totalReturns || 0)}
            </span>
          </div>
        </div>
      </div>

      {/* Chronological Supplier Ledger */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-emerald-600" />
            <span>Supplier Ledger Entries</span>
          </h2>
          <span className="text-xs text-slate-400">{supplier.ledgerEntries?.length || 0} entries</span>
        </div>

        {supplier.ledgerEntries?.length === 0 ? (
          <p className="text-xs text-slate-400 py-6 text-center">No transactions recorded in this ledger.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 text-slate-400 uppercase text-[10px] tracking-wider font-bold">
                  <th className="py-2.5 pr-2">Date</th>
                  <th className="py-2.5 px-2">Type / Ref</th>
                  <th className="py-2.5 px-2">Details</th>
                  <th className="py-2.5 px-2 text-right text-emerald-600">You Paid (Debit)</th>
                  <th className="py-2.5 px-2 text-right text-amber-600">You Purchased (Credit)</th>
                  <th className="py-2.5 pl-2 text-right">Balance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {supplier.ledgerEntries?.map((entry: any) => (
                  <tr key={entry.id} className="hover:bg-slate-50/80 transition">
                    <td className="py-3 pr-2 text-slate-500 whitespace-nowrap">
                      {new Date(entry.date).toLocaleDateString()}
                    </td>
                    <td className="py-3 px-2 whitespace-nowrap">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                        entry.type === 'PURCHASE'
                          ? 'bg-amber-50 text-amber-800'
                          : entry.type === 'PAYMENT'
                          ? 'bg-emerald-50 text-emerald-800'
                          : 'bg-slate-100 text-slate-700'
                      }`}>
                        {entry.type}
                      </span>
                      {entry.referenceNumber && (
                        <span className="text-[10px] text-slate-400 ml-1 font-mono">
                          {entry.referenceNumber}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-2 text-slate-700 max-w-xs truncate">
                      {entry.description}
                    </td>
                    <td className="py-3 px-2 text-right font-bold text-emerald-600">
                      {entry.debit > 0 ? formatPKR(entry.debit) : '-'}
                    </td>
                    <td className="py-3 px-2 text-right font-bold text-amber-600">
                      {entry.credit > 0 ? formatPKR(entry.credit) : '-'}
                    </td>
                    <td className={`py-3 pl-2 text-right font-extrabold ${
                      entry.runningBalance > 0 ? 'text-amber-600' : 'text-emerald-600'
                    }`}>
                      {formatPKR(entry.runningBalance)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Modal: Pay Supplier */}
      {isPaymentModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-bold text-base text-slate-900">Record Payment to Supplier</h3>
                <p className="text-xs text-slate-500">{supplier.name} (Payable: {formatPKR(supplier.currentBalance)})</p>
              </div>
              <button
                onClick={() => setIsPaymentModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {modalError && (
              <div className="p-3 bg-red-50 text-red-700 text-xs rounded-xl border border-red-200">
                {modalError}
              </div>
            )}

            <form onSubmit={handlePaySupplierSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Payment Amount (PKR) *</label>
                <input
                  type="number"
                  min="0"
                  required
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(parseFloat(e.target.value) || 0)}
                  placeholder="0"
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-base font-bold text-amber-600"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Pay From Account *</label>
                <select
                  value={accountId}
                  onChange={(e) => setAccountId(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium"
                >
                  {accounts?.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.name} ({formatPKR(acc.currentBalance)})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Payment Date</label>
                <input
                  type="date"
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                  required
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Specific Purchase Bill (Optional)</label>
                <select
                  value={selectedPurchaseId}
                  onChange={(e) => setSelectedPurchaseId(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium"
                >
                  <option value="">General Payment (FIFO across oldest unpaid purchases)</option>
                  {supplier.purchases
                    ?.filter((p: any) => p.balanceAmount > 0)
                    .map((p: any) => (
                      <option key={p.id} value={p.id}>
                        {p.purchaseNumber} — Due: {formatPKR(p.balanceAmount)}
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Cheque / Online Transfer Ref #</label>
                <input
                  type="text"
                  value={paymentRef}
                  onChange={(e) => setPaymentRef(e.target.value)}
                  placeholder="e.g. Bank online transfer / Cheque #719"
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Notes</label>
                <input
                  type="text"
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                  placeholder="Notes..."
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsPaymentModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={paySupplierMutation.isPending}
                  className="px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold transition disabled:opacity-50"
                >
                  {paySupplierMutation.isPending ? 'Processing...' : 'Pay Supplier'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
