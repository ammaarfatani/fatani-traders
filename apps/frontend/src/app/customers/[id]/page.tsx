'use client';

import React, { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { formatPKR } from '@fatani/shared';
import {
  ArrowLeft,
  Users,
  Plus,
  Phone,
  Share2,
  Printer,
  X,
  CreditCard,
  CheckCircle,
  AlertCircle,
  FileText,
} from 'lucide-react';

export default function CustomerKhataDetailPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const id = Array.isArray(params.id) ? params.id[0] : (params.id as string);

  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState<number | ''>('');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [paymentRef, setPaymentRef] = useState('');
  const [selectedSaleId, setSelectedSaleId] = useState<string>('');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [modalError, setModalError] = useState<string | null>(null);

  const { data: customer, isLoading, error } = useQuery({
    queryKey: ['customer', id],
    queryFn: () => api.get<any>(`/customers/${id}`),
  });

  // Record Payment Mutation
  const recordPaymentMutation = useMutation({
    mutationFn: (payload: any) => api.post('/payments', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customer', id] });
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      setIsPaymentModalOpen(false);
      setPaymentAmount('');
      setPaymentRef('');
      setPaymentNotes('');
      setModalError(null);
    },
    onError: (err: any) => {
      setModalError(err.message || 'Failed to record customer payment');
    },
  });

  const handleRecordPaymentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentAmount || Number(paymentAmount) <= 0) {
      setModalError('Payment amount must be greater than zero');
      return;
    }

    recordPaymentMutation.mutate({
      type: 'CUSTOMER_PAYMENT',
      customerId: id,
      amount: Number(paymentAmount),
      paymentDate,
      referenceNumber: paymentRef || undefined,
      notes: paymentNotes || undefined,
      saleId: selectedSaleId || undefined,
    });
  };

  // WhatsApp Statement Sharing
  const handleShareWhatsApp = () => {
    if (!customer) return;
    const entries = customer.ledgerEntries?.slice(-10) || [];
    const entriesText = entries
      .map(
        (e: any) =>
          `• ${new Date(e.date).toLocaleDateString()} | ${e.type} | Billed: ${formatPKR(
            e.debit
          )} | Paid: ${formatPKR(e.credit)} | Bal: ${formatPKR(e.runningBalance)}`
      )
      .join('\n');

    const message =
      `*FATANI TRADERS — CUSTOMER KHATA STATEMENT*\n` +
      `----------------------------------------\n` +
      `Customer: ${customer.name}\n` +
      (customer.shopName ? `Shop: ${customer.shopName}\n` : '') +
      `Date: ${new Date().toLocaleDateString()}\n\n` +
      `*Summary:*\n` +
      `Total Invoiced: ${formatPKR(customer.summary?.totalInvoiced || 0)}\n` +
      `Total Received: ${formatPKR(customer.summary?.totalPaymentsReceived || 0)}\n` +
      `*Net Outstanding Balance:* ${formatPKR(customer.currentBalance)}\n\n` +
      `*Recent Ledger History:*\n` +
      entriesText +
      `\n----------------------------------------\n` +
      `Kindly review and arrange payment. Thank you for your continued business!`;

    const encoded = encodeURIComponent(message);
    const phone = customer.phone?.replace(/[^0-9]/g, '');
    const url = phone ? `https://wa.me/${phone}?text=${encoded}` : `https://wa.me/?text=${encoded}`;
    window.open(url, '_blank');
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <div className="w-8 h-8 border-4 border-brand-fabric border-t-transparent rounded-full animate-spin" />
        <p className="text-xs text-gray-500 font-semibold uppercase tracking-wider">Loading Customer Khata...</p>
      </div>
    );
  }

  if (error || !customer) {
    return (
      <div className="p-6 bg-red-50 border border-red-200 rounded-2xl text-red-700 text-sm">
        Customer not found or failed to load.
      </div>
    );
  }

  const isReceivable = customer.currentBalance > 0;
  const isAdvance = customer.currentBalance < 0;

  return (
    <div className="space-y-5 max-w-4xl mx-auto pb-16">
      {/* Header Bar */}
      <div className="no-print flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 sm:p-5 rounded-2xl border border-brand-muted shadow-subtle">
        <div className="flex items-center gap-3">
          <Link
            href="/customers"
            className="p-2.5 rounded-xl bg-brand-light border border-brand-muted text-brand-charcoal hover:bg-brand-muted transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-brand-charcoal tracking-tight">{customer.name}</h1>
              {customer.shopName && (
                <span className="text-xs bg-brand-light text-brand-fabric border border-brand-muted px-2 py-0.5 rounded-md font-semibold">
                  {customer.shopName}
                </span>
              )}
            </div>
            <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1.5">
              <Phone className="w-3.5 h-3.5 text-gray-400" />
              <span>{customer.phone}</span>
              {customer.address && <span>• {customer.address}</span>}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleShareWhatsApp}
            className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold transition active:scale-95 shadow-sm"
          >
            <Share2 className="w-4 h-4" />
            <span>WhatsApp</span>
          </button>

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
            <span>Receive Payment</span>
          </button>
        </div>
      </div>

      {/* DigiKhata Style Summary Card */}
      <div className="bg-white p-5 sm:p-6 rounded-2xl border border-brand-muted shadow-subtle space-y-4">
        <div className="flex items-center justify-between border-b border-gray-100 pb-4">
          <div>
            <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">
              Khata Net Balance
            </span>
            <p
              className={`text-2xl sm:text-3xl font-extrabold mt-1 ${
                isReceivable ? 'text-red-600' : isAdvance ? 'text-emerald-700' : 'text-brand-charcoal'
              }`}
            >
              {formatPKR(Math.abs(customer.currentBalance))}
            </p>
            <p className="text-xs font-semibold mt-0.5 text-gray-600">
              {isReceivable ? 'Receivable (Customer Owes You)' : isAdvance ? 'Advance Credit (Amanat Held)' : 'Settled (Zero Balance)'}
            </p>
          </div>

          <div className="text-right">
            <span className="text-xs text-gray-400 uppercase tracking-wider font-semibold">Credit Limit</span>
            <p className="text-sm font-bold text-brand-charcoal mt-1">
              {customer.creditLimit ? formatPKR(customer.creditLimit) : 'No Limit'}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 sm:gap-4 text-center text-xs pt-1">
          <div className="p-3 bg-brand-light rounded-xl border border-brand-muted">
            <span className="text-gray-500 block mb-0.5 text-[11px] font-medium uppercase">Total Billed</span>
            <span className="font-extrabold text-brand-charcoal text-sm sm:text-base">
              {formatPKR(customer.summary?.totalInvoiced || 0)}
            </span>
          </div>

          <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-100">
            <span className="text-emerald-700 block mb-0.5 text-[11px] font-medium uppercase">Total Received</span>
            <span className="font-extrabold text-emerald-800 text-sm sm:text-base">
              {formatPKR(customer.summary?.totalPaymentsReceived || 0)}
            </span>
          </div>

          <div className="p-3 bg-brand-light rounded-xl border border-brand-muted">
            <span className="text-gray-500 block mb-0.5 text-[11px] font-medium uppercase">Total Returns</span>
            <span className="font-extrabold text-brand-charcoal text-sm sm:text-base">
              {formatPKR(customer.summary?.totalReturns || 0)}
            </span>
          </div>
        </div>
      </div>

      {/* Ledger Entries (Chronological DigiKhata Feed) */}
      <div className="bg-white rounded-2xl border border-brand-muted shadow-subtle overflow-hidden">
        <div className="p-4 sm:p-5 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-bold text-sm text-brand-charcoal">Transaction Ledger (Khata History)</h2>
          <span className="text-xs text-gray-400">
            {customer.ledgerEntries?.length || 0} entries
          </span>
        </div>

        <div className="divide-y divide-gray-100">
          {customer.ledgerEntries?.length === 0 ? (
            <p className="text-xs text-gray-400 py-8 text-center">No transactions recorded yet.</p>
          ) : (
            customer.ledgerEntries?.map((entry: any) => {
              const isDebit = entry.debit > 0;
              const isCredit = entry.credit > 0;

              return (
                <div
                  key={entry.id}
                  className="p-4 hover:bg-brand-light/30 transition flex items-center justify-between gap-4"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          entry.type === 'SALE'
                            ? 'bg-amber-50 text-amber-800 border border-amber-200'
                            : entry.type === 'PAYMENT'
                            ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                            : 'bg-blue-50 text-blue-800 border border-blue-200'
                        }`}
                      >
                        {entry.type}
                      </span>
                      <span className="text-xs font-semibold text-brand-charcoal">
                        {entry.referenceId || 'Entry'}
                      </span>
                      <span className="text-[11px] text-gray-400 font-medium">
                        {new Date(entry.date).toLocaleDateString()}
                      </span>
                    </div>
                    {entry.description && (
                      <p className="text-xs text-gray-500 mt-1 truncate">{entry.description}</p>
                    )}
                  </div>

                  <div className="text-right shrink-0">
                    {isDebit && (
                      <p className="text-sm font-extrabold text-red-600">
                        + {formatPKR(entry.debit)}
                      </p>
                    )}
                    {isCredit && (
                      <p className="text-sm font-extrabold text-emerald-700">
                        - {formatPKR(entry.credit)}
                      </p>
                    )}
                    <p className="text-[10px] text-gray-400 mt-0.5">
                      Bal: <strong className="text-brand-charcoal">{formatPKR(entry.runningBalance)}</strong>
                    </p>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Payment Receive Modal */}
      {isPaymentModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-brand-deep/70 backdrop-blur-sm">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-brand-muted animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-4 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-emerald-700" />
                <h3 className="font-extrabold text-base text-brand-charcoal">Receive Customer Payment</h3>
              </div>
              <button
                onClick={() => setIsPaymentModalOpen(false)}
                className="p-1 rounded-lg text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleRecordPaymentSubmit} className="space-y-4 pt-4">
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
                  placeholder="e.g. 50000"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-brand-muted text-base font-bold text-brand-charcoal focus:ring-2 focus:ring-brand-fabric focus:border-brand-fabric outline-none"
                />
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
                  Allocation Preference
                </label>
                <select
                  value={selectedSaleId}
                  onChange={(e) => setSelectedSaleId(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-brand-muted text-xs text-brand-charcoal focus:ring-2 focus:ring-brand-fabric outline-none bg-white"
                >
                  <option value="">Auto FIFO Distribution (Recommended)</option>
                  {customer.sales
                    ?.filter((s: any) => s.balanceAmount > 0)
                    .map((s: any) => (
                      <option key={s.id} value={s.id}>
                        {s.invoiceNumber} — Due: {formatPKR(s.balanceAmount)}
                      </option>
                    ))}
                </select>
                <p className="text-[10px] text-gray-400 mt-1">
                  General payments automatically settle oldest unpaid invoices first (FIFO).
                </p>
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
                  disabled={recordPaymentMutation.isPending}
                  className="px-5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold shadow-md shadow-emerald-700/20 disabled:opacity-50"
                >
                  {recordPaymentMutation.isPending ? 'Saving...' : 'Record Payment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
