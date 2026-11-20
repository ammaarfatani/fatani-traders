'use client';

import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { formatPKR } from '@fatani/shared';
import {
  Banknote,
  Plus,
  ArrowDownLeft,
  ArrowUpRight,
  Search,
  Calendar,
  X,
  FileText,
  Clock,
  User,
  Building2,
  CheckCircle,
} from 'lucide-react';

export default function PaymentsPage() {
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();

  // Active section: 'RECEIVED' (Customer Inflow) or 'PAID' (Supplier Outflow)
  const [activeTab, setActiveTab] = useState<'RECEIVED' | 'PAID'>('RECEIVED');
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);

  // Sync tab with URL search parameter if present (?tab=received or ?tab=paid)
  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam === 'paid' || tabParam === 'SUPPLIER_PAYMENT') {
      setActiveTab('PAID');
    } else if (tabParam === 'received' || tabParam === 'CUSTOMER_PAYMENT') {
      setActiveTab('RECEIVED');
    }
  }, [searchParams]);

  // Modal States
  const [isReceiveModalOpen, setIsReceiveModalOpen] = useState(false);
  const [isPayModalOpen, setIsPayModalOpen] = useState(false);

  // Form Fields (Clean & Simple: Customer/Supplier, Amount, Date, Reference, Notes)
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [selectedSupplierId, setSelectedSupplierId] = useState('');
  const [paymentAmount, setPaymentAmount] = useState<number | ''>('');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [refNumber, setRefNumber] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  // Queries
  const paymentTypeParam = activeTab === 'RECEIVED' ? 'CUSTOMER_PAYMENT' : 'SUPPLIER_PAYMENT';
  const { data: paymentsData, isLoading } = useQuery({
    queryKey: ['payments', activeTab, page, searchTerm],
    queryFn: () =>
      api.get<any>(
        `/payments?type=${paymentTypeParam}&page=${page}&limit=50${
          searchTerm ? `&search=${encodeURIComponent(searchTerm)}` : ''
        }`
      ),
  });

  const { data: customersData } = useQuery({
    queryKey: ['customers'],
    queryFn: () => api.get<any>('/customers?limit=100'),
  });

  const { data: suppliersData } = useQuery({
    queryKey: ['suppliers'],
    queryFn: () => api.get<any>('/suppliers?limit=100'),
  });

  const payments = paymentsData?.data || [];
  const summary = paymentsData?.summary || { totalReceived: 0, totalPaid: 0 };
  const customers = customersData?.data || customersData?.customers || [];
  const suppliers = suppliersData?.data || suppliersData?.suppliers || [];

  const resetForm = () => {
    setSelectedCustomerId('');
    setSelectedSupplierId('');
    setPaymentAmount('');
    setPaymentDate(new Date().toISOString().split('T')[0]);
    setRefNumber('');
    setPaymentNotes('');
    setFormError(null);
  };

  const paymentMutation = useMutation({
    mutationFn: (payload: any) => api.post('/payments', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['sales'] });
      queryClient.invalidateQueries({ queryKey: ['purchases'] });
      setIsReceiveModalOpen(false);
      setIsPayModalOpen(false);
      resetForm();
    },
    onError: (err: any) => {
      setFormError(err.message || 'Failed to record payment');
    },
  });

  const handleReceiveSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomerId) {
      setFormError('Please select a customer');
      return;
    }
    if (!paymentAmount || Number(paymentAmount) <= 0) {
      setFormError('Please enter a valid received amount');
      return;
    }
    setFormError(null);
    paymentMutation.mutate({
      type: 'CUSTOMER_PAYMENT',
      customerId: selectedCustomerId,
      amount: Number(paymentAmount),
      paymentDate: new Date(paymentDate).toISOString(),
      referenceNumber: refNumber || undefined,
      notes: paymentNotes || undefined,
    });
  };

  const handlePaySubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSupplierId) {
      setFormError('Please select a supplier');
      return;
    }
    if (!paymentAmount || Number(paymentAmount) <= 0) {
      setFormError('Please enter a valid payment amount');
      return;
    }
    setFormError(null);
    paymentMutation.mutate({
      type: 'SUPPLIER_PAYMENT',
      supplierId: selectedSupplierId,
      amount: Number(paymentAmount),
      paymentDate: new Date(paymentDate).toISOString(),
      referenceNumber: refNumber || undefined,
      notes: paymentNotes || undefined,
    });
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 sm:p-5 rounded-2xl border border-brand-muted shadow-subtle">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-brand-deep text-white flex items-center justify-center shrink-0">
            <Banknote className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-brand-charcoal tracking-tight font-sans">
              Payments
            </h1>
            <p className="text-xs text-gray-500">
              Simple cash inflows from customers and payouts to suppliers
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              resetForm();
              setIsReceiveModalOpen(true);
            }}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-semibold text-xs sm:text-sm shadow-sm transition active:scale-95"
          >
            <ArrowDownLeft className="w-4 h-4" />
            <span>+ Receive Payment</span>
          </button>

          <button
            onClick={() => {
              resetForm();
              setIsPayModalOpen(true);
            }}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-amber-700 hover:bg-amber-800 text-white font-semibold text-xs sm:text-sm shadow-sm transition active:scale-95"
          >
            <ArrowUpRight className="w-4 h-4" />
            <span>+ Pay Supplier</span>
          </button>
        </div>
      </div>

      {/* Two Main Summary Cards: Payments Received & Payments Paid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Payments Received Card */}
        <button
          onClick={() => {
            setActiveTab('RECEIVED');
            setPage(1);
          }}
          className={`p-6 rounded-2xl text-left transition-all border block shadow-subtle ${
            activeTab === 'RECEIVED'
              ? 'bg-emerald-900/90 text-white border-emerald-700 ring-2 ring-emerald-600/30 shadow-md'
              : 'bg-white text-brand-charcoal border-brand-muted hover:border-emerald-500'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span
              className={`text-xs font-bold uppercase tracking-wider ${
                activeTab === 'RECEIVED' ? 'text-emerald-200' : 'text-emerald-800'
              }`}
            >
              Payments Received
            </span>
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                activeTab === 'RECEIVED'
                  ? 'bg-emerald-800/80 text-emerald-200'
                  : 'bg-emerald-50 text-emerald-700'
              }`}
            >
              <ArrowDownLeft className="w-4 h-4" />
            </div>
          </div>
          <p
            className={`text-2xl sm:text-3xl font-extrabold tracking-tight ${
              activeTab === 'RECEIVED' ? 'text-white' : 'text-emerald-700'
            }`}
          >
            {formatPKR(summary.totalReceived || 0)}
          </p>
          <p
            className={`text-xs mt-1 ${
              activeTab === 'RECEIVED' ? 'text-emerald-200/80' : 'text-gray-500'
            }`}
          >
            Money actually received from customers • Click to view history
          </p>
        </button>

        {/* Payments Paid Card */}
        <button
          onClick={() => {
            setActiveTab('PAID');
            setPage(1);
          }}
          className={`p-6 rounded-2xl text-left transition-all border block shadow-subtle ${
            activeTab === 'PAID'
              ? 'bg-amber-950/90 text-white border-amber-800 ring-2 ring-amber-600/30 shadow-md'
              : 'bg-white text-brand-charcoal border-brand-muted hover:border-amber-500'
          }`}
        >
          <div className="flex items-center justify-between mb-2">
            <span
              className={`text-xs font-bold uppercase tracking-wider ${
                activeTab === 'PAID' ? 'text-amber-200' : 'text-amber-800'
              }`}
            >
              Payments Paid
            </span>
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                activeTab === 'PAID'
                  ? 'bg-amber-800/80 text-amber-200'
                  : 'bg-amber-50 text-amber-700'
              }`}
            >
              <ArrowUpRight className="w-4 h-4" />
            </div>
          </div>
          <p
            className={`text-2xl sm:text-3xl font-extrabold tracking-tight ${
              activeTab === 'PAID' ? 'text-white' : 'text-amber-700'
            }`}
          >
            {formatPKR(summary.totalPaid || 0)}
          </p>
          <p
            className={`text-xs mt-1 ${
              activeTab === 'PAID' ? 'text-amber-200/80' : 'text-gray-500'
            }`}
          >
            Money actually paid to suppliers • Click to view history
          </p>
        </button>
      </div>

      {/* Section Tabs and Search Filter Bar */}
      <div className="bg-white p-4 rounded-2xl border border-brand-muted shadow-subtle flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        {/* Toggle Buttons */}
        <div className="flex bg-brand-light p-1 rounded-xl border border-brand-muted shrink-0 text-xs font-semibold">
          <button
            onClick={() => {
              setActiveTab('RECEIVED');
              setPage(1);
            }}
            className={`px-4 py-2 rounded-lg transition flex items-center gap-1.5 ${
              activeTab === 'RECEIVED'
                ? 'bg-emerald-800 text-white shadow-xs'
                : 'text-gray-600 hover:text-black'
            }`}
          >
            <ArrowDownLeft className="w-3.5 h-3.5" />
            <span>Payments Received</span>
          </button>
          <button
            onClick={() => {
              setActiveTab('PAID');
              setPage(1);
            }}
            className={`px-4 py-2 rounded-lg transition flex items-center gap-1.5 ${
              activeTab === 'PAID'
                ? 'bg-amber-800 text-white shadow-xs'
                : 'text-gray-600 hover:text-black'
            }`}
          >
            <ArrowUpRight className="w-3.5 h-3.5" />
            <span>Payments Paid</span>
          </button>
        </div>

        {/* Search */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setPage(1);
            }}
            placeholder={
              activeTab === 'RECEIVED'
                ? 'Search customer name, invoice ref, payment #...'
                : 'Search supplier name, purchase ref, payment #...'
            }
            className="w-full pl-10 pr-4 py-2 bg-brand-light/50 border border-brand-muted rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-brand-fabric text-brand-charcoal"
          />
        </div>
      </div>

      {/* Main Payment History Table */}
      <div className="bg-white rounded-2xl border border-brand-muted shadow-subtle overflow-hidden">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <div className="w-8 h-8 border-4 border-brand-fabric border-t-transparent rounded-full animate-spin" />
            <p className="text-xs text-gray-500 font-semibold uppercase tracking-wider">
              Loading Payment Records...
            </p>
          </div>
        ) : payments.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <p className="text-sm font-semibold text-gray-600">
              {activeTab === 'RECEIVED'
                ? 'No customer payments recorded yet.'
                : 'No supplier payments recorded yet.'}
            </p>
            <p className="text-xs text-gray-400">
              {searchTerm
                ? 'No matching payments found for your search.'
                : 'Use the buttons above to record a new payment transaction.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-brand-light/60 border-b border-brand-muted text-gray-500 text-left font-bold uppercase tracking-wider text-[10px]">
                  <th className="py-3.5 px-4">Date</th>
                  <th className="py-3.5 px-4">
                    {activeTab === 'RECEIVED' ? 'Customer' : 'Supplier'}
                  </th>
                  <th className="py-3.5 px-4">Reference</th>
                  <th className="py-3.5 px-4">Payment #</th>
                  <th className="py-3.5 px-4">Notes</th>
                  <th className="py-3.5 px-4 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {payments.map((p: any) => {
                  const partyName =
                    activeTab === 'RECEIVED'
                      ? p.customer?.name || 'Customer'
                      : p.supplier?.name || 'Supplier';

                  const reference =
                    activeTab === 'RECEIVED'
                      ? p.allocations?.[0]?.sale?.invoiceNumber || p.referenceNumber || '-'
                      : p.allocations?.[0]?.purchase?.purchaseNumber || p.referenceNumber || '-';

                  return (
                    <tr key={p.id} className="hover:bg-brand-light/20 transition-colors">
                      <td className="py-3.5 px-4 text-gray-600 whitespace-nowrap">
                        <span className="font-medium text-brand-charcoal">
                          {new Date(p.paymentDate).toLocaleDateString()}
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="font-bold text-brand-charcoal">{partyName}</span>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="font-mono text-xs px-2 py-0.5 rounded bg-brand-light text-brand-fabric font-bold">
                          {reference}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-mono text-gray-500">{p.paymentNumber}</td>
                      <td className="py-3.5 px-4 text-gray-500 max-w-xs truncate">
                        {p.notes || '-'}
                      </td>
                      <td className="py-3.5 px-4 text-right font-extrabold whitespace-nowrap">
                        {activeTab === 'RECEIVED' ? (
                          <span className="text-emerald-700">+{formatPKR(p.amount)}</span>
                        ) : (
                          <span className="text-amber-700">-{formatPKR(p.amount)}</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Receive Customer Payment Modal */}
      {isReceiveModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-brand-muted space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <ArrowDownLeft className="w-5 h-5 text-emerald-700" />
                <h3 className="font-bold text-base text-brand-charcoal">Receive Customer Payment</h3>
              </div>
              <button
                onClick={() => setIsReceiveModalOpen(false)}
                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {formError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs font-semibold">
                {formError}
              </div>
            )}

            <form onSubmit={handleReceiveSubmit} className="space-y-4 text-xs">
              <div>
                <label className="font-semibold text-gray-700 block mb-1">Select Customer *</label>
                <select
                  required
                  value={selectedCustomerId}
                  onChange={(e) => setSelectedCustomerId(e.target.value)}
                  className="w-full px-3 py-2.5 border border-brand-muted rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-600 bg-white"
                >
                  <option value="">-- Choose Customer --</option>
                  {customers.map((c: any) => (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.currentBalance > 0 ? `(Khata Due: ${formatPKR(c.currentBalance)})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-bold text-brand-charcoal block mb-1">
                  Payment Amount Received (PKR) *
                </label>
                <input
                  type="number"
                  required
                  min={1}
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value === '' ? '' : Number(e.target.value))}
                  placeholder="e.g. 30000"
                  className="w-full px-3.5 py-2.5 border border-brand-muted rounded-xl text-sm font-bold text-emerald-800 focus:outline-none focus:ring-2 focus:ring-emerald-600"
                />
              </div>

              <div>
                <label className="font-semibold text-gray-700 block mb-1">Payment Date *</label>
                <input
                  type="date"
                  required
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                  className="w-full px-3 py-2 border border-brand-muted rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-600"
                />
              </div>

              <div>
                <label className="font-semibold text-gray-700 block mb-1">
                  Reference (Invoice # / Cheque / Bank Transfer Ref)
                </label>
                <input
                  type="text"
                  value={refNumber}
                  onChange={(e) => setRefNumber(e.target.value)}
                  placeholder="e.g. INV-001 or Cash / Cheque #1029"
                  className="w-full px-3 py-2 border border-brand-muted rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-600"
                />
              </div>

              <div>
                <label className="font-semibold text-gray-700 block mb-1">Notes (Optional)</label>
                <textarea
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                  rows={2}
                  placeholder="Remarks on received payment..."
                  className="w-full px-3 py-2 border border-brand-muted rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-600"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setIsReceiveModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={paymentMutation.isPending}
                  className="px-5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white font-bold shadow-sm transition disabled:opacity-50"
                >
                  {paymentMutation.isPending ? 'Recording...' : 'Confirm Received Payment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Pay Supplier Modal */}
      {isPayModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-brand-muted space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <ArrowUpRight className="w-5 h-5 text-amber-700" />
                <h3 className="font-bold text-base text-brand-charcoal">Pay Supplier</h3>
              </div>
              <button
                onClick={() => setIsPayModalOpen(false)}
                className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {formError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-xs font-semibold">
                {formError}
              </div>
            )}

            <form onSubmit={handlePaySubmit} className="space-y-4 text-xs">
              <div>
                <label className="font-semibold text-gray-700 block mb-1">Select Supplier *</label>
                <select
                  required
                  value={selectedSupplierId}
                  onChange={(e) => setSelectedSupplierId(e.target.value)}
                  className="w-full px-3 py-2.5 border border-brand-muted rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-600 bg-white"
                >
                  <option value="">-- Choose Supplier --</option>
                  {suppliers.map((s: any) => (
                    <option key={s.id} value={s.id}>
                      {s.name} {s.currentBalance > 0 ? `(Payable: ${formatPKR(s.currentBalance)})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-bold text-brand-charcoal block mb-1">
                  Payment Amount to Pay (PKR) *
                </label>
                <input
                  type="number"
                  required
                  min={1}
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value === '' ? '' : Number(e.target.value))}
                  placeholder="e.g. 20000"
                  className="w-full px-3.5 py-2.5 border border-brand-muted rounded-xl text-sm font-bold text-amber-800 focus:outline-none focus:ring-2 focus:ring-amber-600"
                />
              </div>

              <div>
                <label className="font-semibold text-gray-700 block mb-1">Payment Date *</label>
                <input
                  type="date"
                  required
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                  className="w-full px-3 py-2 border border-brand-muted rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-600"
                />
              </div>

              <div>
                <label className="font-semibold text-gray-700 block mb-1">
                  Reference (Purchase # / Cheque / Bank Transfer Ref)
                </label>
                <input
                  type="text"
                  value={refNumber}
                  onChange={(e) => setRefNumber(e.target.value)}
                  placeholder="e.g. PUR-001 or Cash / Cheque #1029"
                  className="w-full px-3 py-2 border border-brand-muted rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-600"
                />
              </div>

              <div>
                <label className="font-semibold text-gray-700 block mb-1">Notes (Optional)</label>
                <textarea
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                  rows={2}
                  placeholder="Remarks on supplier payment..."
                  className="w-full px-3 py-2 border border-brand-muted rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-600"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setIsPayModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={paymentMutation.isPending}
                  className="px-5 py-2 rounded-xl bg-amber-700 hover:bg-amber-800 text-white font-bold shadow-sm transition disabled:opacity-50"
                >
                  {paymentMutation.isPending ? 'Recording...' : 'Confirm Supplier Payment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
