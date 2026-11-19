'use client';

import React, { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
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
} from 'lucide-react';

export default function InvoiceDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = Array.isArray(params.id) ? params.id[0] : (params.id as string);
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
    shopName: sale.customer?.shopName,
    phone: sale.customer?.phone,
    address: sale.customer?.address,
    previousBalance: (sale.customer?.currentBalance || 0) - (sale.balanceAmount || 0),
  };

  const previousBal = customer.previousBalance || 0;
  const currentTotalDue = sale.customer?.currentBalance || 0;

  return (
    <div className="space-y-4 max-w-4xl mx-auto pb-16">
      {/* Action Bar (Hidden in Print) */}
      <div className="no-print flex flex-wrap items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-brand-muted shadow-subtle">
        <div className="flex items-center gap-2">
          <Link
            href="/sales"
            className="p-2 rounded-xl bg-brand-light border border-brand-muted text-brand-charcoal hover:bg-brand-muted transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <span className="text-xs text-gray-400 font-medium uppercase tracking-wider">Invoice Number</span>
            <h2 className="font-bold text-base text-brand-charcoal leading-tight">{sale.invoiceNumber}</h2>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Layout Toggle */}
          <div className="bg-brand-light p-1 rounded-xl flex text-xs font-semibold border border-brand-muted">
            <button
              onClick={() => setLayoutMode('a4')}
              className={`px-3 py-1.5 rounded-lg transition ${
                layoutMode === 'a4' ? 'bg-white text-brand-charcoal shadow-sm' : 'text-gray-500'
              }`}
            >
              A4 Format
            </button>
            <button
              onClick={() => setLayoutMode('thermal')}
              className={`px-3 py-1.5 rounded-lg transition ${
                layoutMode === 'thermal' ? 'bg-white text-brand-charcoal shadow-sm' : 'text-gray-500'
              }`}
            >
              Thermal Slip
            </button>
          </div>

          {/* Copy Text */}
          <button
            onClick={handleCopyText}
            className="p-2.5 rounded-xl border border-brand-muted hover:bg-brand-light text-brand-charcoal transition"
            title="Copy Text for Messaging"
          >
            {copied ? <CheckCircle className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
          </button>

          {/* WhatsApp Share */}
          <button
            onClick={handleShareWhatsApp}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold shadow-sm transition active:scale-95"
          >
            <Share2 className="w-4 h-4" />
            <span className="hidden sm:inline">WhatsApp</span>
          </button>

          {/* Print */}
          <button
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-brand-deep hover:bg-brand-fabric text-white text-xs font-semibold shadow-sm transition active:scale-95"
          >
            <Printer className="w-4 h-4" />
            <span>Print</span>
          </button>
        </div>
      </div>

      {/* Invoice Document Card */}
      <div
        className={`print-page bg-white mx-auto shadow-card border border-brand-muted transition-all ${
          layoutMode === 'thermal'
            ? 'max-w-[420px] p-5 rounded-2xl text-xs font-mono'
            : 'max-w-3xl p-6 sm:p-10 rounded-2xl text-sm'
        }`}
      >
        {/* Header Section */}
        <div className="flex flex-col sm:flex-row justify-between items-start gap-4 border-b border-brand-muted pb-6">
          <div className="flex items-start gap-3.5">
            <div className="w-16 h-16 rounded-2xl bg-brand-light p-1.5 shadow-sm border border-brand-muted flex items-center justify-center shrink-0">
              <Image
                src="/logo.png"
                alt="Fatani Fabrics Logo"
                width={56}
                height={56}
                className="w-full h-full object-contain"
              />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black text-brand-charcoal tracking-tight font-sans">
                {business.name}
              </h1>
              {business.tagline && (
                <p className="text-xs text-brand-fabric font-medium tracking-wide">{business.tagline}</p>
              )}
              <div className="mt-2 text-xs text-gray-500 space-y-0.5">
                <p className="flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 shrink-0 text-gray-400" />
                  <span>{business.address}</span>
                </p>
                <p className="flex items-center gap-1">
                  <Phone className="w-3.5 h-3.5 shrink-0 text-gray-400" />
                  <span>{business.phone}</span>
                </p>
                {business.ntn && <p className="text-[11px] text-gray-400">NTN: {business.ntn}</p>}
              </div>
            </div>
          </div>

          <div className="sm:text-right">
            <span className="inline-block px-3 py-1 rounded-full bg-brand-deep text-white font-bold text-xs uppercase tracking-wider mb-2">
              Commercial Invoice
            </span>
            <p className="text-base font-extrabold text-brand-charcoal font-mono">
              {sale.invoiceNumber}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              Date: <strong className="text-brand-charcoal">{new Date(sale.invoiceDate).toLocaleDateString()}</strong>
            </p>
          </div>
        </div>

        {/* Bill To Customer */}
        <div className="py-4 border-b border-brand-muted grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <div>
            <span className="text-gray-400 uppercase tracking-wider font-semibold text-[10px]">Bill To Customer</span>
            <p className="text-base font-bold text-brand-charcoal mt-1">{customer.name}</p>
            {customer.shopName && <p className="text-gray-600 font-medium">{customer.shopName}</p>}
            {customer.phone && <p className="text-gray-500">{customer.phone}</p>}
            {customer.address && <p className="text-gray-500">{customer.address}</p>}
          </div>

          {template.showPreviousBalance && (
            <div className="sm:text-right">
              <span className="text-gray-400 uppercase tracking-wider font-semibold text-[10px]">Customer Khata Balance</span>
              <p className="text-sm font-semibold text-gray-700 mt-1">
                Previous Balance: {formatPKR(previousBal)}
              </p>
              <p className="text-xs text-gray-500">
                Current Invoice Due: {formatPKR(sale.balanceAmount)}
              </p>
            </div>
          )}
        </div>

        {/* Items Table */}
        <div className="py-5 overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="border-b-2 border-brand-charcoal text-brand-charcoal uppercase tracking-wider text-[11px]">
                <th className="py-2.5 pr-2">#</th>
                <th className="py-2.5 px-2">Fabric / Description</th>
                <th className="py-2.5 px-2 text-right">Weight (KG)</th>
                <th className="py-2.5 px-2 text-right">Rate / KG</th>
                <th className="py-2.5 pl-2 text-right">Amount (PKR)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {sale.items?.map((it: any, idx: number) => (
                <tr key={it.id}>
                  <td className="py-3 pr-2 text-gray-400 font-mono">{idx + 1}</td>
                  <td className="py-3 px-2">
                    <p className="font-bold text-brand-charcoal">{it.product?.name}</p>
                    <p className="text-[10px] text-gray-400">Lot: {it.lot?.lotNumber}</p>
                  </td>
                  <td className="py-3 px-2 text-right font-semibold text-brand-charcoal">
                    {formatWeight(it.grams)}
                  </td>
                  <td className="py-3 px-2 text-right font-semibold text-brand-charcoal">
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
    </div>
  );
}
