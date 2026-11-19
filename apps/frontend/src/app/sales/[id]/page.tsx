'use client';

import React, { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { formatPKR, formatWeight } from '@fatani/shared';
import {
  ArrowLeft,
  Printer,
  Share2,
  FileText,
  Layers,
  Phone,
  MapPin,
  CheckCircle,
  Copy,
} from 'lucide-react';

export default function InvoiceDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const [layoutMode, setLayoutMode] = useState<'a4' | 'thermal'>('a4');
  const [copied, setCopied] = useState(false);

  const { data: sale, isLoading, error } = useQuery({
    queryKey: ['sale', id],
    queryFn: () => api.get<any>(`/sales/${id}`),
  });

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
      <div className="flex justify-center py-20">
        <div className="w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin" />
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
    primaryColor: '#0f172a',
    footerText: 'Thank you for your business! No claims or returns accepted after fabric is cut or washed.',
    termsAndConditions: '1. Payment is due as agreed.\n2. Goods sold by weight in Kilograms and Grams.',
    showPreviousBalance: true,
    showTotalOutstanding: true,
  };

  const customer = snapshot?.customer || {
    name: sale.customer?.name,
    shopName: sale.customer?.shopName,
    phone: sale.customer?.phone,
    address: sale.customer?.address,
    previousBalance: sale.customer?.currentBalance - sale.balanceAmount,
  };

  const previousBal = customer.previousBalance || 0;
  const currentTotalDue = sale.customer?.currentBalance || 0;

  return (
    <div className="space-y-4 max-w-4xl mx-auto pb-16">
      {/* Action Bar (Hidden in Print) */}
      <div className="no-print flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-2">
          <button
            onClick={() => router.push('/sales')}
            className="p-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-600 hover:text-slate-900"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <span className="text-xs text-slate-500 font-medium">Invoice Number</span>
            <h2 className="font-bold text-base text-slate-900 leading-tight">{sale.invoiceNumber}</h2>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Layout Toggle */}
          <div className="bg-slate-100 p-1 rounded-xl flex text-xs font-semibold">
            <button
              onClick={() => setLayoutMode('a4')}
              className={`px-3 py-1.5 rounded-lg transition ${
                layoutMode === 'a4' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'
              }`}
            >
              A4 Format
            </button>
            <button
              onClick={() => setLayoutMode('thermal')}
              className={`px-3 py-1.5 rounded-lg transition ${
                layoutMode === 'thermal' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'
              }`}
            >
              Receipt Slip
            </button>
          </div>

          {/* Copy Text */}
          <button
            onClick={handleCopyText}
            className="p-2.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 transition"
            title="Copy Text"
          >
            {copied ? <CheckCircle className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
          </button>

          {/* WhatsApp Share */}
          <button
            onClick={handleShareWhatsApp}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-sm transition active:scale-95"
          >
            <Share2 className="w-4 h-4" />
            <span className="hidden sm:inline">WhatsApp</span>
          </button>

          {/* Print */}
          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold shadow-sm transition active:scale-95"
          >
            <Printer className="w-4 h-4" />
            <span>Print Invoice</span>
          </button>
        </div>
      </div>

      {/* Invoice Document Card */}
      <div
        className={`print-page bg-white mx-auto shadow-md border border-slate-200 transition-all ${
          layoutMode === 'thermal'
            ? 'max-w-[400px] p-5 rounded-2xl text-xs font-mono'
            : 'max-w-3xl p-6 sm:p-10 rounded-2xl text-sm'
        }`}
      >
        {/* Header Section */}
        <div className="flex flex-col sm:flex-row justify-between items-start gap-4 border-b border-slate-200 pb-6">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-slate-900 flex items-center justify-center text-white font-black text-sm">
                FT
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
                  {business.name}
                </h1>
                {business.tagline && (
                  <p className="text-xs text-slate-500 font-medium">{business.tagline}</p>
                )}
              </div>
            </div>
            <div className="mt-2 text-xs text-slate-500 space-y-0.5">
              <p className="flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 shrink-0" />
                <span>{business.address}</span>
              </p>
              <p className="flex items-center gap-1">
                <Phone className="w-3.5 h-3.5 shrink-0" />
                <span>{business.phone}</span>
              </p>
              {business.ntn && <p>NTN: {business.ntn}</p>}
            </div>
          </div>

          <div className="sm:text-right">
            <span className="inline-block px-3 py-1 rounded-full bg-slate-900 text-white font-bold text-xs uppercase tracking-wider mb-2">
              Tax Invoice
            </span>
            <p className="text-base font-extrabold text-slate-900 font-mono">
              {sale.invoiceNumber}
            </p>
            <p className="text-xs text-slate-500 mt-1">
              Date: <strong className="text-slate-800">{new Date(sale.invoiceDate).toLocaleDateString()}</strong>
            </p>
          </div>
        </div>

        {/* Bill To Customer */}
        <div className="py-4 border-b border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <div>
            <span className="text-slate-400 uppercase tracking-wider font-semibold">Bill To Customer</span>
            <p className="text-base font-bold text-slate-900 mt-1">{customer.name}</p>
            {customer.shopName && <p className="text-slate-600 font-medium">{customer.shopName}</p>}
            {customer.phone && <p className="text-slate-500">{customer.phone}</p>}
            {customer.address && <p className="text-slate-500">{customer.address}</p>}
          </div>

          {template.showPreviousBalance && (
            <div className="sm:text-right">
              <span className="text-slate-400 uppercase tracking-wider font-semibold">Customer Khata Balance</span>
              <p className="text-sm font-semibold text-slate-700 mt-1">
                Previous Balance: {formatPKR(previousBal)}
              </p>
              <p className="text-xs text-slate-500">
                Current Invoice Due: {formatPKR(sale.balanceAmount)}
              </p>
            </div>
          )}
        </div>

        {/* Items Table */}
        <div className="py-5 overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b-2 border-slate-900 text-slate-700 uppercase tracking-wider text-[11px]">
                <th className="py-2.5 pr-2">#</th>
                <th className="py-2.5 px-2">Fabric / Description</th>
                <th className="py-2.5 px-2 text-right">Weight (KG)</th>
                <th className="py-2.5 px-2 text-right">Rate / KG</th>
                <th className="py-2.5 pl-2 text-right">Amount (PKR)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sale.items?.map((it: any, idx: number) => (
                <tr key={it.id}>
                  <td className="py-3 pr-2 text-slate-400 font-mono">{idx + 1}</td>
                  <td className="py-3 px-2">
                    <p className="font-bold text-slate-900">{it.product?.name}</p>
                    <p className="text-[10px] text-slate-400">Lot: {it.lot?.lotNumber}</p>
                  </td>
                  <td className="py-3 px-2 text-right font-semibold text-slate-800">
                    {formatWeight(it.grams)}
                  </td>
                  <td className="py-3 px-2 text-right font-semibold text-slate-800">
                    {formatPKR(it.ratePerKg)}
                  </td>
                  <td className="py-3 pl-2 text-right font-bold text-slate-900">
                    {formatPKR(it.lineTotal)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Totals Section */}
        <div className="border-t border-slate-200 pt-4 flex flex-col sm:flex-row justify-between gap-6">
          <div className="sm:max-w-xs space-y-3 text-xs">
            {sale.notes && (
              <div>
                <span className="font-semibold text-slate-700">Remarks:</span>
                <p className="text-slate-500 mt-0.5">{sale.notes}</p>
              </div>
            )}

            {template.termsAndConditions && (
              <div className="text-[11px] text-slate-400 leading-relaxed border-t border-slate-100 pt-2">
                <span className="font-semibold text-slate-600 block mb-0.5">Terms & Conditions:</span>
                <p className="whitespace-pre-line">{template.termsAndConditions}</p>
              </div>
            )}
          </div>

          <div className="w-full sm:w-64 space-y-2 text-xs">
            <div className="flex justify-between text-slate-600">
              <span>Subtotal:</span>
              <span className="font-semibold">{formatPKR(sale.subtotal)}</span>
            </div>

            {sale.discount > 0 && (
              <div className="flex justify-between text-amber-600">
                <span>Discount:</span>
                <span className="font-semibold">-{formatPKR(sale.discount)}</span>
              </div>
            )}

            <div className="flex justify-between text-sm font-extrabold text-slate-900 border-t border-slate-200 pt-2">
              <span>Grand Total:</span>
              <span>{formatPKR(sale.grandTotal)}</span>
            </div>

            <div className="flex justify-between text-emerald-700">
              <span>Amount Paid:</span>
              <span className="font-semibold">{formatPKR(sale.paidAmount)}</span>
            </div>

            <div className="flex justify-between text-sm font-extrabold text-red-600 border-t border-slate-200 pt-2">
              <span>Invoice Balance Due:</span>
              <span>{formatPKR(sale.balanceAmount)}</span>
            </div>

            {template.showTotalOutstanding && (
              <div className="p-2.5 rounded-xl bg-slate-900 text-white flex justify-between items-center text-xs font-bold mt-2">
                <span>Total Customer Balance:</span>
                <span className="text-emerald-400 text-sm">{formatPKR(currentTotalDue)}</span>
              </div>
            )}
          </div>
        </div>

        {/* Footer & Signature Section */}
        <div className="mt-10 pt-6 border-t border-slate-200 flex flex-col sm:flex-row justify-between items-end gap-6 text-xs text-slate-400">
          <div>
            <p className="font-medium text-slate-500">{template.footerText}</p>
            <p className="text-[10px] text-slate-400 mt-1">Generated electronically by Fatani Traders ERP.</p>
          </div>

          <div className="text-center sm:text-right pt-6 sm:pt-0">
            <div className="w-40 border-b border-slate-400 mb-1" />
            <span className="text-[11px] font-semibold text-slate-600">Authorized Signature</span>
          </div>
        </div>
      </div>
    </div>
  );
}
