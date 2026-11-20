'use client';

import React, { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import {
  kgAndGramsToGrams,
  calculateLineTotal,
  calculateDiscountedTotal,
  formatPKR,
  formatWeight,
  gramsToKg,
} from '@fatani/shared';
import {
  Receipt,
  Plus,
  Trash2,
  ArrowLeft,
  Users,
  DollarSign,
  Scale,
  CheckCircle,
  AlertCircle,
} from 'lucide-react';

interface SaleItemRow {
  id: string;
  lotId: string;
  productId: string;
  weightKg: number;
  weightGrams: number;
  sellingRatePerKg: number;
}

export default function NewSalePage() {
  const router = useRouter();

  const [customerId, setCustomerId] = useState('');
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split('T')[0]);
  const [discount, setDiscount] = useState<number>(0);
  const [immediatePayment, setImmediatePayment] = useState<number>(0);
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initial Item Row
  const [items, setItems] = useState<SaleItemRow[]>([
    {
      id: '1',
      lotId: '',
      productId: '',
      weightKg: 50,
      weightGrams: 0,
      sellingRatePerKg: 180,
    },
  ]);

  // Fetch Master Data
  const { data: customers } = useQuery({
    queryKey: ['customers'],
    queryFn: () => api.get<any[]>('/customers'),
  });

  const { data: availableLots } = useQuery({
    queryKey: ['availableLots'],
    queryFn: () => api.get<any[]>('/inventory/lots'),
  });

  // Auto-select first customer
  React.useEffect(() => {
    if (customers && customers.length > 0 && !customerId) {
      setCustomerId(customers[0].id);
    }
  }, [customers, customerId]);

  // Auto-select first lot in item row
  React.useEffect(() => {
    if (availableLots && availableLots.length > 0 && items.length > 0 && !items[0].lotId) {
      const firstLot = availableLots[0];
      setItems([
        {
          ...items[0],
          lotId: firstLot.id,
          productId: firstLot.productId,
          sellingRatePerKg: Math.round(firstLot.landedCostPerKg * 1.25), // 25% default markup suggestion
        },
      ]);
    }
  }, [availableLots, items]);

  // Selected customer details
  const selectedCustomer = useMemo(
    () => customers?.find((c) => c.id === customerId),
    [customers, customerId]
  );

  // Calculations
  const calculatedItems = useMemo(() => {
    return items.map((item) => {
      const grams = kgAndGramsToGrams(Number(item.weightKg) || 0, Number(item.weightGrams) || 0);
      const lineTotal = calculateLineTotal(grams, Number(item.sellingRatePerKg) || 0);
      const lot = availableLots?.find((l) => l.id === item.lotId);
      const availableGrams = lot?.availableGrams || 0;
      const isOverselling = grams > availableGrams;

      return {
        ...item,
        totalGrams: grams,
        lineTotal,
        lot,
        isOverselling,
      };
    });
  }, [items, availableLots]);

  const subtotal = useMemo(() => {
    return calculatedItems.reduce((sum, it) => sum + it.lineTotal, 0);
  }, [calculatedItems]);

  const grandTotal = useMemo(() => {
    return calculateDiscountedTotal(subtotal, Number(discount) || 0);
  }, [subtotal, discount]);

  const balanceAmount = useMemo(() => {
    return Math.max(0, grandTotal - (Number(immediatePayment) || 0));
  }, [grandTotal, immediatePayment]);

  // Items manipulation
  const addItemRow = () => {
    const defaultLot = availableLots?.[0];
    setItems([
      ...items,
      {
        id: Math.random().toString(36).substring(7),
        lotId: defaultLot?.id || '',
        productId: defaultLot?.productId || '',
        weightKg: 20,
        weightGrams: 0,
        sellingRatePerKg: defaultLot ? Math.round(defaultLot.landedCostPerKg * 1.25) : 150,
      },
    ]);
  };

  const removeItemRow = (id: string) => {
    if (items.length === 1) return;
    setItems(items.filter((it) => it.id !== id));
  };

  const updateItemRow = (id: string, updates: Partial<SaleItemRow>) => {
    setItems(
      items.map((it) => {
        if (it.id !== id) return it;

        let newUpdates = { ...updates };
        if (updates.lotId) {
          const lot = availableLots?.find((l) => l.id === updates.lotId);
          if (lot) {
            newUpdates.productId = lot.productId;
            newUpdates.sellingRatePerKg = Math.round(lot.landedCostPerKg * 1.25);
          }
        }
        return { ...it, ...newUpdates };
      })
    );
  };

  // Submit Handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!customerId) {
      setError('Please select a customer');
      return;
    }

    const oversellingItem = calculatedItems.find((it) => it.isOverselling);
    if (oversellingItem) {
      setError(
        `Quantity for Lot ${oversellingItem.lot?.lotNumber} exceeds available stock of ${formatWeight(
          oversellingItem.lot?.availableGrams
        )}`
      );
      return;
    }

    if (calculatedItems.some((it) => it.totalGrams <= 0)) {
      setError('All sold weights must be greater than zero');
      return;
    }

    if (calculatedItems.some((it) => it.sellingRatePerKg <= 0)) {
      setError('Selling rates must be greater than zero');
      return;
    }

    setIsSubmitting(true);

    try {
      const payload = {
        customerId,
        invoiceDate,
        items: calculatedItems.map((it) => ({
          lotId: it.lotId,
          productId: it.productId,
          weightKg: Number(it.weightKg),
          weightGrams: Number(it.weightGrams) || 0,
          totalGrams: it.totalGrams,
          sellingRatePerKg: Number(it.sellingRatePerKg),
        })),
        discount: Number(discount) || 0,
        immediatePayment: Number(immediatePayment) || 0,
        paymentAccountId: null,
        notes,
      };

      const res = await api.post<any>('/sales', payload);
      router.push(`/sales/${res.sale.id}`);
    } catch (err: any) {
      setError(err.message || 'Failed to create sale invoice');
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5 max-w-4xl mx-auto pb-24">
      {/* Title */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => router.back()}
          className="p-2 rounded-xl bg-white border border-slate-200 text-slate-600 hover:text-slate-900 shadow-sm"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">New Sales Invoice</h1>
          <p className="text-xs text-slate-500">Sell fabric by weight from specific lots</p>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm font-medium flex items-center gap-2">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Customer Selection Card */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
            <Users className="w-4 h-4 text-emerald-600" />
            <span>Customer Khata</span>
          </h2>

          <a
            href="/customers"
            target="_blank"
            className="text-xs font-semibold text-emerald-600 hover:text-emerald-700"
          >
            + Add New Customer
          </a>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Select Customer *</label>
            <select
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
              required
              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              {customers?.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} {c.shopName ? `(${c.shopName})` : ''}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Invoice Date</label>
            <input
              type="date"
              value={invoiceDate}
              onChange={(e) => setInvoiceDate(e.target.value)}
              required
              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
        </div>

        {/* Selected Customer Credit Info */}
        {selectedCustomer && (
          <div className="p-3 bg-slate-50 rounded-xl flex items-center justify-between text-xs">
            <div>
              <span className="text-slate-500">Current Outstanding Balance:</span>
              <span className={`ml-2 font-bold ${selectedCustomer.currentBalance > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                {formatPKR(selectedCustomer.currentBalance)}
              </span>
            </div>
            {selectedCustomer.creditLimit && (
              <span className="text-slate-500">
                Credit Limit: <strong className="text-slate-700">{formatPKR(selectedCustomer.creditLimit)}</strong>
              </span>
            )}
          </div>
        )}
      </div>

      {/* Fabric Items Selection from Lots */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <Scale className="w-4 h-4 text-emerald-600" />
              <span>Fabric Lots & Weights</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Select source lots to maintain exact landed COGS and prevent stock overselling
            </p>
          </div>

          <button
            type="button"
            onClick={addItemRow}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-semibold border border-emerald-200 transition"
          >
            <Plus className="w-4 h-4" />
            <span>Add Item</span>
          </button>
        </div>

        <div className="space-y-4">
          {calculatedItems.map((it, idx) => (
            <div
              key={it.id}
              className={`p-4 rounded-xl border space-y-3 transition ${
                it.isOverselling
                  ? 'bg-red-50/80 border-red-300'
                  : 'bg-slate-50/80 border-slate-200/80'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800">Fabric Item #{idx + 1}</span>
                {items.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeItemRow(it.id)}
                    className="p-1 text-slate-400 hover:text-red-500 transition"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Lot Dropdown */}
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                  Source Purchase Lot *
                </label>
                <select
                  value={it.lotId}
                  onChange={(e) => updateItemRow(it.id, { lotId: e.target.value })}
                  required
                  className="w-full p-2.5 bg-white border border-slate-200 rounded-lg text-xs font-medium"
                >
                  {availableLots?.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.product?.name} • Lot #{l.lotNumber} (Avail: {formatWeight(l.availableGrams)})
                    </option>
                  ))}
                </select>

                {/* Internal Landed Cost Reference (Private to Admin) */}
                {it.lot && (
                  <div className="mt-1 flex items-center justify-between text-[11px] text-slate-500">
                    <span>
                      Stock Available: <strong className="text-slate-800">{formatWeight(it.lot.availableGrams)}</strong>
                    </span>
                    <span className="text-indigo-600 font-medium">
                      (Internal Cost: {formatPKR(it.lot.landedCostPerKg)}/KG)
                    </span>
                  </div>
                )}
              </div>

              {/* Weight & Rate Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Weight (KG) *</label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    value={it.weightKg}
                    onChange={(e) => updateItemRow(it.id, { weightKg: parseFloat(e.target.value) || 0 })}
                    required
                    className="w-full p-2 bg-white border border-slate-200 rounded-lg text-sm font-bold text-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">Extra Grams (0-999)</label>
                  <input
                    type="number"
                    min="0"
                    max="999"
                    value={it.weightGrams}
                    onChange={(e) => updateItemRow(it.id, { weightGrams: parseInt(e.target.value, 10) || 0 })}
                    className="w-full p-2 bg-white border border-slate-200 rounded-lg text-sm font-bold text-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                    Selling Rate (PKR / KG) *
                  </label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    value={it.sellingRatePerKg}
                    onChange={(e) => updateItemRow(it.id, { sellingRatePerKg: parseFloat(e.target.value) || 0 })}
                    required
                    className="w-full p-2 bg-white border border-slate-200 rounded-lg text-sm font-bold text-slate-900"
                  />
                </div>
              </div>

              {/* Line Total */}
              <div className="flex justify-between items-center pt-1 border-t border-slate-200/60 text-xs">
                <span className="text-slate-500">
                  Total Sold: <strong className="text-slate-800">{formatWeight(it.totalGrams)}</strong>
                </span>
                <span className="font-extrabold text-sm text-slate-900">
                  Item Total: {formatPKR(it.lineTotal)}
                </span>
              </div>

              {it.isOverselling && (
                <p className="text-[11px] font-bold text-red-600 flex items-center gap-1">
                  <AlertCircle className="w-3.5 h-3.5" />
                  <span>Insufficient stock! You cannot sell more than available.</span>
                </p>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Invoice Totals & Immediate Payment */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
        <h2 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2">
          <DollarSign className="w-4 h-4 text-emerald-600" />
          <span>Payment & Discount</span>
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">Trade Discount (PKR)</label>
            <input
              type="number"
              min="0"
              value={discount}
              onChange={(e) => setDiscount(parseFloat(e.target.value) || 0)}
              placeholder="0"
              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-slate-900"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Immediate Payment Received (PKR)
            </label>
            <input
              type="number"
              min="0"
              max={grandTotal}
              value={immediatePayment}
              onChange={(e) => setImmediatePayment(parseFloat(e.target.value) || 0)}
              placeholder="0"
              className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold text-emerald-600"
            />
          </div>
        </div>

        {/* Calculation Overview */}
        <div className="p-4 bg-brand-deep text-white rounded-2xl space-y-2 text-xs border border-brand-dark/40 shadow-subtle">
          <div className="flex justify-between">
            <span className="text-gray-300">Subtotal</span>
            <span className="font-semibold">{formatPKR(subtotal)}</span>
          </div>
          {discount > 0 && (
            <div className="flex justify-between text-amber-300">
              <span>Discount</span>
              <span>-{formatPKR(discount)}</span>
            </div>
          )}
          <div className="flex justify-between text-sm font-bold border-t border-white/10 pt-2">
            <span>Invoice Grand Total</span>
            <span className="text-emerald-300">{formatPKR(grandTotal)}</span>
          </div>
          {immediatePayment > 0 && (
            <div className="flex justify-between text-emerald-200">
              <span>Immediate Paid</span>
              <span>-{formatPKR(immediatePayment)}</span>
            </div>
          )}
          <div className="flex justify-between text-sm font-bold border-t border-white/10 pt-2 text-amber-300">
            <span>Remaining Invoice Balance (Credit)</span>
            <span>{formatPKR(balanceAmount)}</span>
          </div>
        </div>
      </div>

      {/* Notes */}
      <div className="bg-white p-4 rounded-2xl border border-brand-muted shadow-subtle">
        <label className="block text-xs font-semibold text-brand-charcoal mb-1.5 uppercase tracking-wider">Invoice Notes & Delivery Details</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          placeholder="e.g. Delivered via Suzuki transport, customer verified roll weights..."
          className="w-full p-2.5 bg-brand-light border border-brand-muted rounded-xl text-sm text-brand-charcoal focus:ring-2 focus:ring-brand-fabric outline-none"
        />
      </div>

      {/* Sticky Save Action Bar */}
      <div className="fixed bottom-14 lg:bottom-4 left-0 right-0 z-30 p-3 bg-white/95 backdrop-blur-md border-t border-brand-muted flex justify-end max-w-4xl mx-auto rounded-t-2xl shadow-elevated">
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full sm:w-auto px-8 py-3.5 bg-brand-deep hover:bg-brand-fabric active:scale-95 text-white font-bold text-sm rounded-xl shadow-md shadow-brand-deep/20 transition disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {isSubmitting ? (
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <>
              <CheckCircle className="w-5 h-5" />
              <span>Complete Sale & View Invoice</span>
            </>
          )}
        </button>
      </div>
    </form>
  );
}
