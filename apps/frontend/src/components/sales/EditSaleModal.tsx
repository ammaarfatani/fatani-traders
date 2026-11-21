'use client';

import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { formatPKR, formatWeight } from '@fatani/shared';
import { X, Receipt, AlertCircle, Save, Calendar, User } from 'lucide-react';

interface EditSaleModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  sale: {
    id: string;
    invoiceNumber: string;
    customerId: string;
    customer?: {
      id: string;
      name: string;
      phone?: string | null;
    };
    invoiceDate: string | Date;
    subtotal: number;
    discount: number;
    grandTotal: number;
    paidAmount: number;
    balanceAmount: number;
    notes?: string | null;
    items?: Array<{
      id: string;
      lotId: string;
      grams: number;
      ratePerKg: number;
      lineTotal: number;
      lot?: {
        lotNumber: string;
      };
      product?: {
        name: string;
      };
    }>;
  } | null;
}

export function EditSaleModal({ isOpen, onClose, onSuccess, sale }: EditSaleModalProps) {
  const queryClient = useQueryClient();

  const [customerId, setCustomerId] = useState<string>('');
  const [invoiceDate, setInvoiceDate] = useState<string>('');
  const [discount, setDiscount] = useState<number | ''>(0);
  const [notes, setNotes] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Fetch customers for selector
  const { data: customersData } = useQuery({
    queryKey: ['customers-list'],
    queryFn: () => api.get<any>('/customers?limit=100'),
    enabled: isOpen,
  });
  const customers = customersData?.data || customersData?.customers || [];

  useEffect(() => {
    if (sale) {
      setCustomerId(sale.customerId || '');
      setInvoiceDate(
        sale.invoiceDate ? new Date(sale.invoiceDate).toISOString().split('T')[0] : ''
      );
      setDiscount(sale.discount ?? 0);
      setNotes(sale.notes || '');
      setErrorMessage(null);
    }
  }, [sale]);

  const updateMutation = useMutation({
    mutationFn: (payload: any) => api.put(`/sales/${sale?.id}`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['sale', sale?.id] });
      queryClient.invalidateQueries({ queryKey: ['sales'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      if (onSuccess) onSuccess();
      onClose();
    },
    onError: (err: any) => {
      setErrorMessage(err.message || 'Failed to update sale invoice');
    },
  });

  if (!isOpen || !sale) return null;

  const currentDiscount = typeof discount === 'number' ? discount : 0;
  const newGrandTotal = Math.max(0, sale.subtotal - currentDiscount);
  const newBalance = Math.max(0, newGrandTotal - (sale.paidAmount || 0));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerId) {
      setErrorMessage('Please select a customer');
      return;
    }

    if (currentDiscount < 0) {
      setErrorMessage('Discount cannot be negative');
      return;
    }

    if (currentDiscount > sale.subtotal) {
      setErrorMessage(`Discount cannot exceed subtotal (${formatPKR(sale.subtotal)})`);
      return;
    }

    setErrorMessage(null);
    updateMutation.mutate({
      customerId,
      invoiceDate: invoiceDate ? new Date(invoiceDate).toISOString() : undefined,
      discount: currentDiscount,
      notes: notes || undefined,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-brand-muted space-y-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Receipt className="w-5 h-5 text-brand-fabric" />
            <div>
              <h3 className="font-bold text-base text-brand-charcoal">Edit Sales Invoice</h3>
              <p className="text-xs text-gray-500 font-mono">{sale.invoiceNumber}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {errorMessage && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {/* Customer Selection */}
          <div>
            <label className="font-semibold text-gray-700 block mb-1">
              Customer <span className="text-red-500">*</span>
            </label>
            <select
              value={customerId}
              onChange={(e) => setCustomerId(e.target.value)}
              className="w-full px-3 py-2 border border-brand-muted rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-fabric bg-white font-medium text-xs text-brand-charcoal"
              required
            >
              <option value="">Select Customer...</option>
              {customers.map((c: any) => (
                <option key={c.id} value={c.id}>
                  {c.name} {c.phone ? `(${c.phone})` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Invoice Date */}
          <div>
            <label className="font-semibold text-gray-700 block mb-1">
              Invoice Date <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <Calendar className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="date"
                required
                value={invoiceDate}
                onChange={(e) => setInvoiceDate(e.target.value)}
                className="w-full pl-9 pr-3 py-2 border border-brand-muted rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-fabric font-medium text-xs text-brand-charcoal"
              />
            </div>
          </div>

          {/* Items Summary (Read-only summary of sold items) */}
          <div className="bg-brand-light/50 p-3 rounded-xl border border-brand-muted space-y-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500 block">
              Items in this invoice
            </span>
            <div className="space-y-1.5 max-h-32 overflow-y-auto divide-y divide-gray-100">
              {sale.items?.map((it) => (
                <div key={it.id} className="pt-1.5 first:pt-0 flex items-center justify-between text-xs">
                  <div>
                    <span className="font-semibold text-brand-charcoal">{it.product?.name || 'Fabric'}</span>
                    {it.lot?.lotNumber && (
                      <span className="ml-1.5 text-[10px] bg-white border border-brand-muted px-1.5 py-0.5 rounded font-mono">
                        Lot #{it.lot.lotNumber}
                      </span>
                    )}
                    <span className="text-gray-500 block text-[11px]">
                      {formatWeight(it.grams)} @ Rs. {it.ratePerKg.toLocaleString()}/KG
                    </span>
                  </div>
                  <span className="font-bold text-brand-charcoal font-mono">
                    {formatPKR(it.lineTotal)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Subtotal & Discount Adjustment */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-semibold text-gray-700 block mb-1">Subtotal (PKR)</label>
              <input
                type="text"
                disabled
                value={formatPKR(sale.subtotal)}
                className="w-full px-3 py-2 bg-gray-100 border border-gray-200 rounded-xl font-bold font-mono text-xs text-gray-700"
              />
            </div>

            <div>
              <label className="font-semibold text-gray-700 block mb-1">Discount (PKR)</label>
              <input
                type="number"
                min={0}
                max={sale.subtotal}
                value={discount}
                onChange={(e) =>
                  setDiscount(e.target.value === '' ? '' : Math.max(0, Number(e.target.value)))
                }
                className="w-full px-3 py-2 border border-brand-muted rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-fabric font-bold font-mono text-xs text-brand-charcoal"
              />
            </div>
          </div>

          {/* Financial Calculation Preview Banner */}
          <div className="bg-brand-deep text-white p-3.5 rounded-xl space-y-1.5 shadow-sm">
            <div className="flex justify-between items-center text-xs">
              <span className="text-brand-light/80">Revised Grand Total:</span>
              <span className="font-extrabold text-sm font-mono">{formatPKR(newGrandTotal)}</span>
            </div>
            <div className="flex justify-between items-center text-xs">
              <span className="text-brand-light/80">Already Paid:</span>
              <span className="font-semibold text-emerald-300 font-mono">{formatPKR(sale.paidAmount || 0)}</span>
            </div>
            <div className="flex justify-between items-center text-xs border-t border-white/10 pt-1.5">
              <span className="text-brand-light/90 font-bold">Revised Remaining Balance:</span>
              <span className="font-extrabold text-amber-300 font-mono">{formatPKR(newBalance)}</span>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="font-semibold text-gray-700 block mb-1">Notes / Terms</label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Special price discount approved"
              className="w-full px-3 py-2 border border-brand-muted rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-fabric text-xs text-brand-charcoal"
            />
          </div>

          {/* Action buttons */}
          <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={updateMutation.isPending}
              className="flex items-center gap-1.5 px-5 py-2 rounded-xl bg-brand-deep hover:bg-brand-fabric text-white font-bold shadow-sm transition disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{updateMutation.isPending ? 'Saving...' : 'Save Changes'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
