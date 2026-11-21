'use client';

import React, { useState, useEffect } from 'react';
import { X, Edit2, Loader2, AlertCircle } from 'lucide-react';
import { DEFAULT_LOT_EXPENSE_CATEGORIES } from '@fatani/shared';
import { api } from '@/lib/api';

interface EditLotExpenseModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  expense: any;
}

export function EditLotExpenseModal({
  isOpen,
  onClose,
  onSuccess,
  expense,
}: EditLotExpenseModalProps) {
  const [category, setCategory] = useState<string>('Transport');
  const [customName, setCustomName] = useState('');
  const [amount, setAmount] = useState<number | ''>('');
  const [notes, setNotes] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (expense) {
      setCategory(expense.category || 'Transport');
      setCustomName(expense.customName || '');
      setAmount(expense.amount || '');
      setNotes(expense.notes || '');
      setError(null);
    }
  }, [expense, isOpen]);

  if (!isOpen || !expense) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (typeof amount !== 'number' || amount <= 0) {
      setError('Amount must be greater than zero');
      return;
    }

    setIsLoading(true);
    try {
      await api.put(`/purchases/expenses/${expense.id}`, {
        category,
        customName: customName.trim() || undefined,
        amount,
        notes: notes.trim() || undefined,
      });

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Failed to update landed expense');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-brand-muted space-y-4 animate-in zoom-in-95 duration-150">
        <div className="flex items-center justify-between pb-3 border-b border-gray-100">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-brand-fabric/10 text-brand-fabric flex items-center justify-center">
              <Edit2 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-base text-brand-charcoal">Edit Landed Expense</h3>
              <p className="text-[11px] text-gray-500">
                Update expense amount or category (recalculates landed cost)
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
          <div>
            <label className="font-semibold text-gray-700 block mb-1">
              Expense Category <span className="text-red-500">*</span>
            </label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-fabric/20 focus:border-brand-fabric font-medium bg-white"
            >
              {DEFAULT_LOT_EXPENSE_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
              <option value="Other">Other</option>
            </select>
          </div>

          <div>
            <label className="font-semibold text-gray-700 block mb-1">
              Payee / Custom Name <span className="text-gray-400 font-normal">(Optional)</span>
            </label>
            <input
              type="text"
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              placeholder="e.g. Faisal Goods Transport"
              className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-fabric/20 focus:border-brand-fabric font-medium"
            />
          </div>

          <div>
            <label className="font-semibold text-gray-700 block mb-1">
              Amount (PKR) <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              min="1"
              step="any"
              required
              value={amount}
              onChange={(e) => setAmount(e.target.value === '' ? '' : parseFloat(e.target.value))}
              placeholder="Expense Amount in PKR"
              className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-fabric/20 focus:border-brand-fabric font-mono font-bold"
            />
          </div>

          <div>
            <label className="font-semibold text-gray-700 block mb-1">Notes</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Receipt # or details..."
              className="w-full px-3 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-fabric/20 focus:border-brand-fabric font-medium"
            />
          </div>

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
                  <span>Saving...</span>
                </>
              ) : (
                <span>Save Expense</span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
