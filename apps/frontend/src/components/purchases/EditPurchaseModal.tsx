'use client';

import React, { useState, useEffect } from 'react';
import { X, Edit2, Loader2, AlertCircle, Building2, Scale } from 'lucide-react';
import { formatWeight, formatPKR } from '@fatani/shared';
import { api } from '@/lib/api';

interface EditPurchaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  purchase: any;
  suppliers: any[];
}

export function EditPurchaseModal({
  isOpen,
  onClose,
  onSuccess,
  purchase,
  suppliers,
}: EditPurchaseModalProps) {
  const lot = purchase?.lots?.[0];

  const [fabricName, setFabricName] = useState('');
  const [supplierId, setSupplierId] = useState<string>('');
  const [weightKg, setWeightKg] = useState<number | ''>('');
  const [weightGrams, setWeightGrams] = useState<number | ''>(0);
  const [purchaseRatePerKg, setPurchaseRatePerKg] = useState<number | ''>('');
  const [purchaseDate, setPurchaseDate] = useState('');
  const [invoiceRefNumber, setInvoiceRefNumber] = useState('');
  const [notes, setNotes] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (purchase && lot) {
      setFabricName(lot.product?.name || '');
      setSupplierId(purchase.supplierId || '');
      setWeightKg(Math.floor((lot.purchasedGrams || 0) / 1000));
      setWeightGrams((lot.purchasedGrams || 0) % 1000);
      setPurchaseRatePerKg(lot.purchaseRatePerKg || '');
      setPurchaseDate(
        purchase.purchaseDate ? new Date(purchase.purchaseDate).toISOString().split('T')[0] : ''
      );
      setInvoiceRefNumber(purchase.invoiceRefNumber || '');
      setNotes(purchase.notes || '');
      setError(null);
    }
  }, [purchase, lot, isOpen]);

  if (!isOpen || !purchase) return null;

  const minAllowedGrams = (lot?.soldGrams || 0) + (lot?.returnedGrams || 0) + -(lot?.adjustedGrams || 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const kg = typeof weightKg === 'number' ? weightKg : 0;
    const g = typeof weightGrams === 'number' ? weightGrams : 0;
    const totalG = kg * 1000 + g;

    if (totalG <= 0) {
      setError('Purchased weight must be greater than zero');
      return;
    }

    if (totalG < minAllowedGrams) {
      setError(
        `Cannot reduce weight below ${formatWeight(minAllowedGrams)} because ${formatWeight(
          lot?.soldGrams || 0
        )} has already been sold in sales invoices.`
      );
      return;
    }

    if (typeof purchaseRatePerKg !== 'number' || purchaseRatePerKg <= 0) {
      setError('Rate per KG must be greater than zero');
      return;
    }

    setIsLoading(true);
    try {
      await api.put(`/purchases/${purchase.id}`, {
        fabricName: fabricName.trim(),
        supplierId: supplierId || null,
        weightKg: kg,
        weightGrams: g,
        purchaseRatePerKg,
        purchaseDate,
        invoiceRefNumber: invoiceRefNumber.trim() || undefined,
        notes: notes.trim() || undefined,
      });

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to update purchase record');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-brand-muted space-y-4 animate-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between pb-3 border-b border-gray-100">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-brand-fabric/10 text-brand-fabric flex items-center justify-center">
              <Edit2 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-base text-brand-charcoal">
                Edit Purchase {purchase.purchaseNumber}
              </h3>
              <p className="text-[11px] text-gray-500">
                Update fabric details, weight, rate, or supplier
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isLoading}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs flex items-start gap-2">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          {/* Fabric Name */}
          <div>
            <label className="font-semibold text-gray-700 block mb-1">
              Fabric Name / Description <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              required
              value={fabricName}
              onChange={(e) => setFabricName(e.target.value)}
              placeholder="e.g. Lawn 68x68 Printed"
              className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-fabric/20 focus:border-brand-fabric font-medium"
            />
          </div>

          {/* Supplier (Optional) */}
          <div>
            <label className="font-semibold text-gray-700 block mb-1">
              Supplier <span className="text-gray-400 font-normal">(Optional)</span>
            </label>
            <select
              value={supplierId}
              onChange={(e) => setSupplierId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-fabric/20 focus:border-brand-fabric font-medium bg-white"
            >
              <option value="">Unknown Supplier (Cash / Unlinked)</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} {s.companyName ? `(${s.companyName})` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Weight Inputs */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="font-semibold text-gray-700">
                Purchased Weight <span className="text-red-500">*</span>
              </label>
              {minAllowedGrams > 0 && (
                <span className="text-[10px] text-amber-700 font-medium">
                  Min allowed: {formatWeight(minAllowedGrams)} (sold in sales)
                </span>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    step="any"
                    required
                    value={weightKg}
                    onChange={(e) =>
                      setWeightKg(e.target.value === '' ? '' : parseFloat(e.target.value))
                    }
                    placeholder="KG"
                    className="w-full px-3 py-2 pr-9 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-fabric/20 focus:border-brand-fabric font-mono font-bold"
                  />
                  <span className="absolute right-3 top-2.5 text-gray-400 font-semibold text-[10px]">
                    KG
                  </span>
                </div>
              </div>
              <div>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    max="999"
                    value={weightGrams}
                    onChange={(e) =>
                      setWeightGrams(e.target.value === '' ? '' : parseInt(e.target.value, 10))
                    }
                    placeholder="Grams"
                    className="w-full px-3 py-2 pr-9 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-fabric/20 focus:border-brand-fabric font-mono font-bold"
                  />
                  <span className="absolute right-3 top-2.5 text-gray-400 font-semibold text-[10px]">
                    g
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Purchase Rate per KG */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-semibold text-gray-700 block mb-1">
                Purchase Rate / KG (PKR) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                min="0"
                step="any"
                required
                value={purchaseRatePerKg}
                onChange={(e) =>
                  setPurchaseRatePerKg(e.target.value === '' ? '' : parseFloat(e.target.value))
                }
                placeholder="Rate per KG"
                className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-fabric/20 focus:border-brand-fabric font-mono font-bold"
              />
            </div>

            <div>
              <label className="font-semibold text-gray-700 block mb-1">
                Purchase Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                required
                value={purchaseDate}
                onChange={(e) => setPurchaseDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-fabric/20 focus:border-brand-fabric font-medium"
              />
            </div>
          </div>

          {/* Invoice Ref # */}
          <div>
            <label className="font-semibold text-gray-700 block mb-1">
              Supplier Invoice / Bilty Ref # <span className="text-gray-400 font-normal">(Optional)</span>
            </label>
            <input
              type="text"
              value={invoiceRefNumber}
              onChange={(e) => setInvoiceRefNumber(e.target.value)}
              placeholder="e.g. BL-9088"
              className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-fabric/20 focus:border-brand-fabric font-medium"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="font-semibold text-gray-700 block mb-1">Notes</label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Additional details..."
              className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-fabric/20 focus:border-brand-fabric font-medium"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="px-4 py-2 rounded-xl border border-gray-200 hover:bg-gray-50 text-gray-700 font-semibold transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-brand-fabric hover:bg-brand-accent text-white font-semibold shadow-sm active:scale-95 transition disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Saving Changes...</span>
                </>
              ) : (
                <span>Save Changes</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
