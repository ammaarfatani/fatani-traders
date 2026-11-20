'use client';

import React, { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { formatPKR, formatWeight } from '@fatani/shared';
import {
  ArrowLeft,
  Printer,
  Share2,
  Phone,
  MapPin,
  CheckCircle,
  Copy,
  Plus,
  Banknote,
  Calendar,
  X,
  CreditCard,
  AlertCircle,
  ArrowDownLeft,
} from 'lucide-react';

export default function InvoiceDetailPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const id = Array.isArray(params.id) ? params.id[0] : (params.id as string);
  const [layoutMode, setLayoutMode] = useState<'a4' | 'thermal'>('a4');
  const [copied, setCopied] = useState(false);

  // Payment Modal State
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState<number | ''>('');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [paymentRef, setPaymentRef] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [modalError, setModalError] = useState<string | null>(null);

  const { data: sale, isLoading, error } = useQuery({
    queryKey: ['sale', id],
    queryFn: () => api.get<any>(`/sales/${id}`),
  });

  const recordPaymentMutation = useMutation({
    mutationFn: (payload: any) => api.post('/payments', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sale', id] });
      queryClient.invalidateQueries({ queryKey: ['sales'] });
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['customer', sale?.customerId] });
      setIsPaymentModalOpen(false);
      setPaymentAmount('');
      setPaymentRef('');
      setPaymentNotes('');
      setModalError(null);
    },
    onError: (err: any) => {
      setModalError(err.message || 'Failed to record payment');
    },
  });

  const handleOpenPaymentModal = () => {
    if (sale) {
      setPaymentAmount(sale.balanceAmount);
      setPaymentRef(`Payment for ${sale.invoiceNumber}`);
      setPaymentDate(new Date().toISOString().split('T')[0]);
      setModalError(null);
      setIsPaymentModalOpen(true);
    }
  };

  const handlePaymentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentAmount || Number(paymentAmount) <= 0) {
      setModalError('Payment amount must be greater than zero');
      return;
    }
    setModalError(null);
    recordPaymentMutation.mutate({
      type: 'CUSTOMER_PAYMENT',
      customerId: sale.customerId,
      saleId: sale.id,
      amount: Number(paymentAmount),
      paymentDate: new Date(paymentDate).toISOString(),
      referenceNumber: paymentRef || sale.invoiceNumber,
      notes: paymentNotes || undefined,
    });
  };

  const snapshot = sale?.invoiceSnapshot;

  // Generate WhatsApp Share Message
  const getWhatsAppMessage = () => {
    if (!sale) return '';
    const customerName = snapshot?.customer?.name || sale.customer?.name;
    const invNo = sale.invoiceNumber;
    const date = new Date(sale.invoiceDate).toLocaleDateString();
    const grandTotal = formatPKR(sale.grandTotal);
    const paid = formatPKR(sale.paidAmount);
    const bal = formatPKR(sale.balanceAmount);
    const totalOut = formatPKR(sale.customer?.currentBalance || 0);

    const itemsSummary = sale.items
      ?.map(
        (it: any) =>
          `• ${it.product?.name} (${formatWeight(it.grams)} @ PKR ${it.ratePerKg}/KG) = ${formatPKR(it.lineTotal)}`
      )
      .join('\n');

    return (
      `*FATANI TRADERS — INVOICE*\n` +
      `----------------------------\n` +
      `Invoice #: ${invNo}\n` +
      `Date: ${date}\n` +
      `Customer: ${customerName}\n\n` +
      `*Items:*\n${itemsSummary}\n\n` +
      `Subtotal: ${formatPKR(sale.subtotal)}\n` +
      (sale.discount > 0 ? `Discount: -${formatPKR(sale.discount)}\n` : '') +
      `*Grand Total:* ${grandTotal}\n` +
      `Amount Paid: ${paid}\n` +
      `*Current Invoice Due:* ${bal}\n` +
      `----------------------------\n` +
      `*Total Customer Outstanding:* ${totalOut}\n\n` +
      `Thank you for your business!`
    );
  };

  const handleShareWhatsApp = () => {
    const text = encodeURIComponent(getWhatsAppMessage());
    const phone = sale?.customer?.phone?.replace(/[^0-9]/g, '');
    const url = phone ? `https://wa.me/${phone}?text=${text}` : `https://wa.me/?text=${text}`;
    window.open(url, '_blank');
  };

  const handleCopyText = () => {
    navigator.clipboard.writeText(getWhatsAppMessage());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePrint = () => {
    window.print();
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <div className="w-8 h-8 border-4 border-brand-fabric border-t-transparent rounded-full animate-spin" />
        <p className="text-xs text-gray-500 font-semibold uppercase tracking-wider">Loading Invoice...</p>
      </div>
    );
  }

  if (error || !sale) {
    return (
      <div className="p-6 bg-red-50 border border-red-200 rounded-2xl text-red-700 text-sm">
        Invoice not found.
      </div>
    );
  }

  const business = snapshot?.business || {
    name: 'Fatani Traders',
    tagline: 'Wholesale Fabric & Textile Trading',
    phone: '+92 300 1234567',
    address: 'Shop # 14, Textile Plaza, M.A. Jinnah Road, Karachi, Pakistan',
    ntn: '42101-1234567-1',
  };

  const template = snapshot?.template || {
    primaryColor: '#172F35',
    footerText: 'Thank you for your business! No claims or returns accepted after fabric is cut, washed, or dyed.',
    termsAndConditions: '1. Payment is due as agreed.\n2. In case of quality dispute, return intact rolls within 3 business days.\n3. Goods sold by weight in Kilograms and Grams.',
    showPreviousBalance: true,
    showTotalOutstanding: true,
  };

  const customer = snapshot?.customer || {
    name: sale.customer?.name,
    phone: sale.customer?.phone,
    address: sale.customer?.address,
    previousBalance: 0,
  };

  const currentTotalDue = sale.customer?.currentBalance || sale.balanceAmount;
  const paymentAllocations = sale.paymentAllocations || [];

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-16">
      {/* Top Action Bar (Hidden on print) */}
      <div className="print:hidden bg-white p-4 rounded-2xl border border-brand-muted shadow-subtle flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/sales"
          className="flex items-center gap-1.5 text-xs font-semibold text-gray-600 hover:text-brand-fabric transition"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Sales History</span>
        </Link>

        <div className="flex items-center gap-2 flex-wrap">
          {sale.balanceAmount > 0 && (
            <button
              onClick={handleOpenPaymentModal}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-semibold text-xs shadow-sm transition"
            >
              <Banknote className="w-4 h-4" />
              <span>+ Record Payment</span>
            </button>
          )}

          <div className="flex bg-brand-light p-1 rounded-xl border border-brand-muted text-xs">
            <button
              onClick={() => setLayoutMode('a4')}
              className={`px-3 py-1 rounded-lg font-semibold transition ${
                layoutMode === 'a4' ? 'bg-brand-deep text-white shadow-xs' : 'text-gray-600 hover:text-black'
              }`}
            >
              A4 Format
            </button>
            <button
              onClick={() => setLayoutMode('thermal')}
              className={`px-3 py-1 rounded-lg font-semibold transition ${
                layoutMode === 'thermal' ? 'bg-brand-deep text-white shadow-xs' : 'text-gray-600 hover:text-black'
              }`}
            >
              80mm Thermal
            </button>
          </div>

          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-brand-deep hover:bg-brand-fabric text-white font-semibold text-xs shadow-sm transition"
          >
            <Printer className="w-4 h-4" />
            <span>Print Invoice</span>
          </button>

          <button
            onClick={handleShareWhatsApp}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#25D366] hover:bg-[#20ba5a] text-white font-semibold text-xs shadow-sm transition"
          >
            <Share2 className="w-4 h-4" />
            <span className="hidden sm:inline">WhatsApp</span>
          </button>

          <button
            onClick={handleCopyText}
            className="flex items-center gap-1 px-3 py-2 rounded-xl bg-brand-light hover:bg-brand-muted text-gray-700 font-semibold text-xs border border-brand-muted transition"
            title="Copy text summary"
          >
            {copied ? <CheckCircle className="w-4 h-4 text-emerald-700" /> : <Copy className="w-4 h-4" />}
            <span className="hidden sm:inline">{copied ? 'Copied' : 'Copy'}</span>
          </button>
        </div>
      </div>

      {/* Invoice Document Paper Container */}
      <div
        id="invoice-printable-area"
        className={`bg-white rounded-3xl border border-brand-muted shadow-card transition-all mx-auto ${
          layoutMode === 'thermal'
            ? 'w-full max-w-[80mm] p-4 text-[11px] leading-tight font-mono'
            : 'w-full p-8 sm:p-12 text-sm leading-normal'
        }`}
      >
        {/* Invoice Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start gap-6 border-b border-brand-muted pb-6">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 shrink-0 flex items-center justify-center">
              <Image
                src="/logo.png"
                alt="Fatani Fabrics Logo"
                width={64}
                height={64}
                className="w-full h-full object-contain"
                priority
              />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-black text-brand-charcoal tracking-tight">
                {business.name}
              </h2>
              <p className="text-xs text-brand-fabric font-semibold uppercase tracking-wider">
                {business.tagline}
              </p>
              <div className="text-xs text-gray-500 mt-1 space-y-0.5">
                <p className="flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 shrink-0 text-gray-400" />
                  <span>{business.address}</span>
                </p>
                <p className="flex items-center gap-1">
                  <Phone className="w-3.5 h-3.5 shrink-0 text-gray-400" />
                  <span>{business.phone}</span>
                  {business.ntn && <span className="ml-2 font-mono">NTN: {business.ntn}</span>}
                </p>
              </div>
            </div>
          </div>

          <div className="text-left sm:text-right shrink-0">
            <div className="inline-block bg-brand-light px-3 py-1 rounded-lg text-brand-fabric font-bold text-xs uppercase tracking-wider mb-2">
              Tax Invoice / Bill
            </div>
            <p className="text-base sm:text-lg font-black text-brand-charcoal font-mono">
              #{sale.invoiceNumber}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              Date: <span className="font-semibold text-gray-700">{new Date(sale.invoiceDate).toLocaleDateString()}</span>
            </p>
            <p className="text-xs text-gray-500">
              Status:{' '}
              <span
                className={`font-bold ${
                  sale.status === 'COMPLETED'
                    ? 'text-emerald-700'
                    : sale.status === 'PARTIAL'
                    ? 'text-amber-700'
                    : 'text-red-700'
                }`}
              >
                {sale.status}
              </span>
            </p>
          </div>
        </div>

        {/* Billed To Section */}
        <div className="my-6 p-4 rounded-2xl bg-brand-light/60 border border-brand-muted/80 flex flex-col sm:flex-row justify-between gap-4 text-xs">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block mb-1">
              Billed To (Customer):
            </span>
            <p className="text-sm font-bold text-brand-charcoal">{customer.name}</p>
            {customer.phone && <p className="text-gray-600 mt-0.5 font-mono">{customer.phone}</p>}
            {customer.address && <p className="text-gray-500 mt-0.5">{customer.address}</p>}
          </div>

          {template.showPreviousBalance && (
            <div className="text-left sm:text-right border-t sm:border-t-0 pt-2 sm:pt-0 border-brand-muted">
              <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block mb-1">
                Customer DigiKhata Ledger:
              </span>
              <p className="text-gray-600">
                Current Khata Balance:{' '}
                <strong className="text-brand-charcoal">{formatPKR(sale.customer?.currentBalance || 0)}</strong>
              </p>
            </div>
          )}
        </div>

        {/* Items Table */}
        <div className="overflow-x-auto my-6">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-brand-muted text-gray-500 font-bold uppercase tracking-wider text-[10px]">
                <th className="py-2.5 text-left">#</th>
                <th className="py-2.5 text-left">Fabric Description & Roll</th>
                <th className="py-2.5 text-right">Net Weight</th>
                <th className="py-2.5 text-right">Rate / KG</th>
                <th className="py-2.5 text-right">Total (PKR)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {sale.items?.map((it: any, index: number) => (
                <tr key={it.id} className="hover:bg-brand-light/20">
                  <td className="py-3 text-gray-400 font-mono">{index + 1}</td>
                  <td className="py-3 pr-2">
                    <p className="font-bold text-brand-charcoal">{it.product?.name || 'Fabric Roll'}</p>
                    {it.lot?.lotNumber && (
                      <p className="text-[10px] text-brand-fabric font-mono">Lot #{it.lot.lotNumber}</p>
                    )}
                  </td>
                  <td className="py-3 px-2 text-right font-semibold text-gray-700">
                    {formatWeight(it.grams)}
                  </td>
                  <td className="py-3 px-2 text-right font-mono text-gray-600">
                    {formatPKR(it.ratePerKg)}
                  </td>
                  <td className="py-3 pl-2 text-right font-bold text-brand-charcoal">
                    {formatPKR(it.lineTotal)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totals Section */}
        <div className="border-t border-brand-muted pt-4 flex flex-col sm:flex-row justify-between gap-6">
          <div className="sm:max-w-xs space-y-3 text-xs">
            {sale.notes && (
              <div>
                <span className="font-semibold text-brand-charcoal">Remarks:</span>
                <p className="text-gray-500 mt-0.5">{sale.notes}</p>
              </div>
            )}

            {template.termsAndConditions && (
              <div className="text-[11px] text-gray-400 leading-relaxed border-t border-gray-100 pt-2">
                <span className="font-semibold text-gray-600 block mb-0.5">Terms & Conditions:</span>
                <p className="whitespace-pre-line">{template.termsAndConditions}</p>
              </div>
            )}
          </div>

          <div className="w-full sm:w-64 space-y-2 text-xs">
            <div className="flex justify-between text-gray-600">
              <span>Subtotal:</span>
              <span className="font-semibold">{formatPKR(sale.subtotal)}</span>
            </div>

            {sale.discount > 0 && (
              <div className="flex justify-between text-amber-600">
                <span>Discount:</span>
                <span className="font-semibold">-{formatPKR(sale.discount)}</span>
              </div>
            )}

            <div className="flex justify-between text-sm font-extrabold text-brand-charcoal border-t border-brand-muted pt-2">
              <span>Grand Total:</span>
              <span>{formatPKR(sale.grandTotal)}</span>
            </div>

            <div className="flex justify-between text-emerald-700">
              <span>Amount Paid:</span>
              <span className="font-semibold">{formatPKR(sale.paidAmount)}</span>
            </div>

            <div className="flex justify-between text-sm font-extrabold text-red-600 border-t border-brand-muted pt-2">
              <span>Invoice Balance Due:</span>
              <span>{formatPKR(sale.balanceAmount)}</span>
            </div>

            {template.showTotalOutstanding && (
              <div className="p-2.5 rounded-xl bg-brand-deep text-white flex justify-between items-center text-xs font-bold mt-2 shadow-sm">
                <span>Total Customer Khata Due:</span>
                <span className="text-emerald-300 text-sm">{formatPKR(currentTotalDue)}</span>
              </div>
            )}
          </div>
        </div>

        {/* Footer & Signature Section */}
        <div className="mt-10 pt-6 border-t border-brand-muted flex flex-col sm:flex-row justify-between items-end gap-6 text-xs text-gray-400">
          <div>
            <p className="font-medium text-gray-500">{template.footerText}</p>
            <p className="text-[10px] text-gray-400 mt-1">Generated electronically by Fatani Traders ERP.</p>
          </div>

          <div className="text-center sm:text-right pt-6 sm:pt-0">
            <div className="w-40 border-b border-gray-400 mb-1" />
            <span className="text-[11px] font-semibold text-gray-600">Authorized Signature</span>
          </div>
        </div>
      </div>

      {/* Linked Payment Transactions History Section (Hidden on Print) */}
      <div className="print:hidden bg-white p-5 sm:p-6 rounded-3xl border border-brand-muted shadow-card space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <ArrowDownLeft className="w-5 h-5 text-emerald-700" />
            <h3 className="text-base font-bold text-brand-charcoal">
              Payment Transactions History
            </h3>
          </div>
          {sale.balanceAmount > 0 && (
            <button
              onClick={handleOpenPaymentModal}
              className="px-3 py-1.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-semibold text-xs transition"
            >
              + Record Payment
            </button>
          )}
        </div>

        {paymentAllocations.length === 0 ? (
          <div className="py-6 text-center text-xs text-gray-400 space-y-2">
            <p>No payments recorded for this invoice yet.</p>
            <p className="text-red-600 font-semibold">Remaining balance due: {formatPKR(sale.balanceAmount)}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-100 text-gray-400 text-left font-bold uppercase tracking-wider text-[10px]">
                  <th className="py-2.5">Date</th>
                  <th className="py-2.5">Payment #</th>
                  <th className="py-2.5">Reference / Notes</th>
                  <th className="py-2.5 text-right">Amount Received</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {paymentAllocations.map((alloc: any) => {
                  const p = alloc.payment;
                  return (
                    <tr key={alloc.id} className="hover:bg-brand-light/30">
                      <td className="py-3 text-gray-600 font-medium">
                        {p?.paymentDate ? new Date(p.paymentDate).toLocaleDateString() : '-'}
                      </td>
                      <td className="py-3 font-mono font-bold text-brand-charcoal">
                        {p?.paymentNumber || 'Direct Allocation'}
                      </td>
                      <td className="py-3 text-gray-500">
                        {p?.referenceNumber || p?.notes || 'Invoice Payment'}
                      </td>
                      <td className="py-3 text-right font-extrabold text-emerald-700">
                        +{formatPKR(alloc.amount)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Record Payment Modal */}
      {isPaymentModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-brand-muted space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <Banknote className="w-5 h-5 text-emerald-700" />
                <h3 className="font-bold text-base text-brand-charcoal">Receive Payment</h3>
              </div>
              <button
                onClick={() => setIsPaymentModalOpen(false)}
                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {modalError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs">
                {modalError}
              </div>
            )}

            <form onSubmit={handlePaymentSubmit} className="space-y-4 text-xs">
              <div>
                <label className="font-semibold text-gray-700 block mb-1">Customer</label>
                <input
                  type="text"
                  value={customer.name}
                  disabled
                  className="w-full px-3 py-2 bg-gray-100 border border-gray-200 rounded-xl font-bold text-brand-charcoal"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-semibold text-gray-700 block mb-1">Invoice Total</label>
                  <input
                    type="text"
                    value={formatPKR(sale.grandTotal)}
                    disabled
                    className="w-full px-3 py-2 bg-gray-100 border border-gray-200 rounded-xl font-semibold"
                  />
                </div>
                <div>
                  <label className="font-semibold text-red-600 block mb-1">Balance Due</label>
                  <input
                    type="text"
                    value={formatPKR(sale.balanceAmount)}
                    disabled
                    className="w-full px-3 py-2 bg-red-50 border border-red-200 rounded-xl font-bold text-red-700"
                  />
                </div>
              </div>

              <div>
                <label className="font-bold text-brand-charcoal block mb-1">
                  Payment Amount Received (PKR) *
                </label>
                <input
                  type="number"
                  required
                  min={1}
                  max={sale.balanceAmount}
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value === '' ? '' : Number(e.target.value))}
                  className="w-full px-3.5 py-2.5 border border-brand-muted rounded-xl text-sm font-bold text-emerald-800 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                  placeholder="Enter received amount"
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
                  className="px-5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold shadow-sm transition disabled:opacity-50"
                >
                  {recordPaymentMutation.isPending ? 'Recording...' : 'Confirm Payment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
