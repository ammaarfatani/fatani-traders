'use client';

import React, { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { formatPKR } from '@fatani/shared';
import { X, Banknote, AlertCircle, Save, Calendar, FileText } from 'lucide-react';

interface EditPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  payment: {
    id: string;
    paymentNumber: string;
    type: 'CUSTOMER_PAYMENT' | 'SUPPLIER_PAYMENT';
    amount: number;
    paymentDate: string | Date;
    referenceNumber?: string | null;
    notes?: string | null;
    customer?: {
      name: string;
    } | null;
    supplier?: {
      name: string;
    } | null;
  } | null;
}

export function EditPaymentModal({ isOpen, onClose, onSuccess, payment }: EditPaymentModalProps) {
  const queryClient = useQueryClient();

  const [amount, setAmount] = useState<number | ''>('');
  const [paymentDate, setPaymentDate] = useState<string>('');
  const [referenceNumber, setReferenceNumber] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (payment) {
      setAmount(payment.amount);
      setPaymentDate(
        payment.paymentDate ? new Date(payment.paymentDate).toISOString().split('T')[0] : ''
      );
      setReferenceNumber(payment.referenceNumber || '');
      setNotes(payment.notes || '');
      setErrorMessage(null);
    }
  }, [payment]);

  const updateMutation = useMutation({
    mutationFn: (payload: any) => api.put(`/payments/${payment?.id}`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      queryClient.invalidateQueries({ queryKey: ['purchases'] });
      queryClient.invalidateQueries({ queryKey: ['sales'] });
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      if (onSuccess) onSuccess();
      onClose();
    },
    onError: (err: any) => {
      setErrorMessage(err.message || 'Failed to update payment');
    },
  });

  if (!isOpen || !payment) return null;

  const isReceived = payment.type === 'CUSTOMER_PAYMENT';
  const partyName = isReceived
    ? payment.customer?.name || 'Customer'
    : payment.supplier?.name || 'Supplier / Lot';

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || Number(amount) <= 0) {
      setErrorMessage('Payment amount must be greater than zero');
      return;
    }

    setErrorMessage(null);
    updateMutation.mutate({
      amount: Number(amount),
      paymentDate: paymentDate ? new Date(paymentDate).toISOString() : undefined,
      referenceNumber: referenceNumber || undefined,
      notes: notes || undefined,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-brand-muted space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Banknote className={`w-5 h-5 ${isReceived ? 'text-emerald-700' : 'text-amber-700'}`} />
            <div>
              <h3 className="font-bold text-base text-brand-charcoal">
                Edit {isReceived ? 'Payment Received' : 'Payment Paid'}
              </h3>
              <p className="text-xs text-gray-500 font-mono">{payment.paymentNumber}</p>
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
          {/* Party Details Read-only Banner */}
          <div className="bg-brand-light/60 p-3 rounded-xl space-y-1 border border-brand-muted">
            <div className="flex justify-between items-center">
              <span className="text-gray-500">{isReceived ? 'Customer:' : 'Paid To:'}</span>
              <span className="font-bold text-brand-charcoal">{partyName}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-500">Original Amount:</span>
              <span className="font-bold font-mono text-gray-700">{formatPKR(payment.amount)}</span>
            </div>
          </div>

          {/* Amount Field */}
          <div>
            <label className="font-bold text-brand-charcoal block mb-1">
              Payment Amount (PKR) <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              required
              min={1}
              value={amount}
              onChange={(e) => setAmount(e.target.value === '' ? '' : Number(e.target.value))}
              placeholder="e.g. 50000"
              className="w-full px-3.5 py-2.5 border border-brand-muted rounded-xl text-sm font-extrabold font-mono text-brand-charcoal focus:outline-none focus:ring-2 focus:ring-brand-fabric"
            />
            <p className="text-[11px] text-gray-400 mt-1">
              Adjusting the amount will automatically update ledger balances and account totals.
            </p>
          </div>

          {/* Payment Date */}
          <div>
            <label className="font-semibold text-gray-700 block mb-1">
              Payment Date <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <Calendar className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="date"
                required
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
                className="w-full pl-9 pr-3 py-2 border border-brand-muted rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-fabric font-medium text-xs text-brand-charcoal"
              />
            </div>
          </div>

          {/* Reference Number */}
          <div>
            <label className="font-semibold text-gray-700 block mb-1">Reference / Cheque #</label>
            <input
              type="text"
              value={referenceNumber}
              onChange={(e) => setReferenceNumber(e.target.value)}
              placeholder="e.g. Online transfer ref, cheque #"
              className="w-full px-3 py-2 border border-brand-muted rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-fabric text-xs text-brand-charcoal"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="font-semibold text-gray-700 block mb-1">Notes / Remarks</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional notes"
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
              className={`flex items-center gap-1.5 px-5 py-2 rounded-xl text-white font-bold shadow-sm transition disabled:opacity-50 ${
                isReceived
                  ? 'bg-emerald-700 hover:bg-emerald-800'
                  : 'bg-amber-700 hover:bg-amber-800'
              }`}
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
