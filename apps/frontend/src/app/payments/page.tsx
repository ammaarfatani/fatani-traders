'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { formatPKR } from '@fatani/shared';
import {
  CreditCard,
  Plus,
  ArrowDownLeft,
  ArrowUpRight,
  Search,
  Filter,
  Calendar,
  Wallet,
  Building,
  CheckCircle,
  X,
  FileText,
  Clock,
  Landmark,
} from 'lucide-react';

export default function PaymentsPage() {
  const queryClient = useQueryClient();
  const [filterType, setFilterType] = useState<string>('ALL');
  const [methodFilter, setMethodFilter] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  
  // Modals
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
  const [isDisbursementModalOpen, setIsDisbursementModalOpen] = useState(false);

  // Form States
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [selectedSupplierId, setSelectedSupplierId] = useState('');
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [paymentAmount, setPaymentAmount] = useState<number | ''>('');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [refNumber, setRefNumber] = useState('');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [formError, setFormError] = useState<string | null>(null);

  // Queries
  const { data: paymentsData, isLoading: isPaymentsLoading } = useQuery({
    queryKey: ['payments', filterType],
    queryFn: () => {
      const typeParam = filterType !== 'ALL' ? `?type=${filterType}` : '';
      return api.get<{ data: any[]; pagination: any }>(`/payments${typeParam}`);
    },
  });

  const { data: accounts } = useQuery({
    queryKey: ['accounts'],
    queryFn: () => api.get<any[]>('/accounts'),
  });

  const { data: customersData } = useQuery({
    queryKey: ['customers'],
    queryFn: () => api.get<{ customers: any[] }>('/customers?limit=100'),
  });

  const { data: suppliersData } = useQuery({
    queryKey: ['suppliers'],
    queryFn: () => api.get<{ suppliers: any[] }>('/suppliers?limit=100'),
  });

  const payments = paymentsData?.data || [];
  const accountsList = accounts || [];
  const customers = customersData?.customers || [];
  const suppliers = suppliersData?.suppliers || [];

  // Reset form helper
  const resetForm = () => {
    setSelectedCustomerId('');
    setSelectedSupplierId('');
    setSelectedAccountId(accountsList[0]?.id || '');
    setPaymentAmount('');
    setPaymentDate(new Date().toISOString().split('T')[0]);
    setRefNumber('');
    setPaymentNotes('');
    setFormError(null);
  };

  // Payment Mutation
  const paymentMutation = useMutation({
    mutationFn: (payload: any) => api.post('/payments', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      setIsReceiptModalOpen(false);
      setIsDisbursementModalOpen(false);
      resetForm();
    },
    onError: (err: any) => {
      setFormError(err.message || 'Failed to record payment');
    },
  });

  const handleCreateReceipt = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomerId) {
      setFormError('Please select a customer');
      return;
    }
    if (!selectedAccountId) {
      setFormError('Please select a payment account');
      return;
    }
    if (!paymentAmount || Number(paymentAmount) <= 0) {
      setFormError('Please enter a valid amount');
      return;
    }

    setFormError(null);
    paymentMutation.mutate({
      type: 'CUSTOMER_PAYMENT',
      customerId: selectedCustomerId,
      accountId: selectedAccountId,
      amount: Number(paymentAmount),
      paymentDate: new Date(paymentDate).toISOString(),
      referenceNumber: refNumber || undefined,
      notes: paymentNotes || undefined,
    });
  };

  const handleCreateDisbursement = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSupplierId) {
      setFormError('Please select a supplier');
      return;
    }
    if (!selectedAccountId) {
      setFormError('Please select a payment account');
      return;
    }
    if (!paymentAmount || Number(paymentAmount) <= 0) {
      setFormError('Please enter a valid amount');
      return;
    }

    setFormError(null);
    paymentMutation.mutate({
      type: 'SUPPLIER_PAYMENT',
      supplierId: selectedSupplierId,
      accountId: selectedAccountId,
      amount: Number(paymentAmount),
      paymentDate: new Date(paymentDate).toISOString(),
      referenceNumber: refNumber || undefined,
      notes: paymentNotes || undefined,
    });
  };

  // Filter payments
  const filteredPayments = payments.filter((p) => {
    // Search
    const partyName = p.customer?.name || p.supplier?.name || '';
    const paymentNum = p.paymentNumber || '';
    const refNum = p.referenceNumber || '';
    const matchesSearch =
      partyName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      paymentNum.toLowerCase().includes(searchTerm.toLowerCase()) ||
      refNum.toLowerCase().includes(searchTerm.toLowerCase());

    if (!matchesSearch) return false;

    // Method filter
    if (methodFilter !== 'ALL') {
      const accType = p.account?.type;
      if (methodFilter === 'CASH' && accType !== 'CASH') return false;
      if (methodFilter === 'BANK' && accType !== 'BANK') return false;
      if (methodFilter === 'OTHER' && (accType === 'CASH' || accType === 'BANK')) return false;
    }

    return true;
  });

  // KPI Calculations
  const totalInflow = payments
    .filter((p) => p.type === 'CUSTOMER_PAYMENT')
    .reduce((sum, p) => sum + (p.amount || 0), 0);

  const totalOutflow = payments
    .filter((p) => p.type === 'SUPPLIER_PAYMENT')
    .reduce((sum, p) => sum + (p.amount || 0), 0);

  const netCashflow = totalInflow - totalOutflow;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-brand-charcoal tracking-tight">
            Payments & Ledger
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Customer Receipts, Supplier Disbursements, and Cash/Bank settlement logs.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => {
              resetForm();
              if (accountsList.length > 0) setSelectedAccountId(accountsList[0].id);
              setIsReceiptModalOpen(true);
            }}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 transition shadow-sm active:scale-95"
          >
            <ArrowDownLeft className="w-4 h-4" />
            <span>+ Receive Money</span>
          </button>

          <button
            onClick={() => {
              resetForm();
              if (accountsList.length > 0) setSelectedAccountId(accountsList[0].id);
              setIsDisbursementModalOpen(true);
            }}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold text-white bg-brand-deep hover:bg-brand-fabric transition shadow-sm active:scale-95"
          >
            <ArrowUpRight className="w-4 h-4" />
            <span>+ Pay Supplier</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl p-5 border border-brand-muted shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Customer Inflow</p>
            <h3 className="text-xl sm:text-2xl font-bold text-emerald-700 mt-1">
              {formatPKR(totalInflow)}
            </h3>
            <p className="text-[11px] text-gray-400 mt-0.5">Recorded customer receipts</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <ArrowDownLeft className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-brand-muted shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Supplier Outflow</p>
            <h3 className="text-xl sm:text-2xl font-bold text-red-600 mt-1">
              {formatPKR(totalOutflow)}
            </h3>
            <p className="text-[11px] text-gray-400 mt-0.5">Disbursements & purchases paid</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-red-50 text-red-600 flex items-center justify-center">
            <ArrowUpRight className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-brand-muted shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Net Cash Balance</p>
            <h3 className={`text-xl sm:text-2xl font-bold mt-1 ${netCashflow >= 0 ? 'text-brand-charcoal' : 'text-red-600'}`}>
              {formatPKR(netCashflow)}
            </h3>
            <p className="text-[11px] text-gray-400 mt-0.5">Across {accountsList.length} payment channels</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-brand-light text-brand-fabric flex items-center justify-center">
            <Wallet className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Controls & Filter Bar */}
      <div className="bg-white rounded-2xl p-4 border border-brand-muted shadow-sm space-y-3">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Type Tabs */}
          <div className="flex items-center gap-1.5 p-1 bg-brand-light rounded-xl overflow-x-auto">
            <button
              onClick={() => setFilterType('ALL')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                filterType === 'ALL' ? 'bg-white text-brand-charcoal shadow-sm' : 'text-gray-500 hover:text-brand-charcoal'
              }`}
            >
              All Payments
            </button>
            <button
              onClick={() => setFilterType('CUSTOMER_PAYMENT')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                filterType === 'CUSTOMER_PAYMENT' ? 'bg-white text-emerald-700 shadow-sm' : 'text-gray-500 hover:text-brand-charcoal'
              }`}
            >
              Receipts (Inflow)
            </button>
            <button
              onClick={() => setFilterType('SUPPLIER_PAYMENT')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                filterType === 'SUPPLIER_PAYMENT' ? 'bg-white text-red-600 shadow-sm' : 'text-gray-500 hover:text-brand-charcoal'
              }`}
            >
              Disbursements (Outflow)
            </button>
          </div>

          {/* Search Input */}
          <div className="relative flex-1 max-w-xs">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search party or reference..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-brand-ivory border border-brand-muted rounded-xl text-brand-charcoal focus:ring-1 focus:ring-brand-fabric outline-none"
            />
          </div>
        </div>

        {/* Method Sub-Filter */}
        <div className="flex items-center gap-2 pt-2 border-t border-brand-muted/40 text-xs">
          <span className="text-gray-400 font-medium flex items-center gap-1">
            <Filter className="w-3.5 h-3.5" /> Method:
          </span>
          {['ALL', 'CASH', 'BANK', 'OTHER'].map((method) => (
            <button
              key={method}
              onClick={() => setMethodFilter(method)}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition ${
                methodFilter === method
                  ? 'bg-brand-deep text-white shadow-sm'
                  : 'bg-brand-light text-gray-600 hover:bg-brand-muted'
              }`}
            >
              {method === 'ALL' ? 'All Channels' : method === 'CASH' ? 'Cash' : method === 'BANK' ? 'Bank Transfer' : 'Other'}
            </button>
          ))}
        </div>
      </div>

      {/* Payments Table / List */}
      <div className="bg-white rounded-2xl border border-brand-muted shadow-sm overflow-hidden">
        {isPaymentsLoading ? (
          <div className="p-12 flex flex-col items-center justify-center gap-3">
            <div className="w-6 h-6 border-2 border-brand-fabric border-t-transparent rounded-full animate-spin" />
            <p className="text-xs text-gray-500">Loading payment ledger...</p>
          </div>
        ) : filteredPayments.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-12 h-12 rounded-2xl bg-brand-light text-brand-fabric flex items-center justify-center mx-auto mb-3">
              <CreditCard className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-brand-charcoal">No Payments Found</h3>
            <p className="text-xs text-gray-500 max-w-sm mx-auto mt-1">
              There are no recorded transactions matching your filter criteria. Use "+ Receive Money" or "+ Pay Supplier" to log your first payment.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-brand-light text-gray-600 font-semibold border-b border-brand-muted uppercase tracking-wider text-[11px]">
                  <th className="py-3 px-4">Payment #</th>
                  <th className="py-3 px-4">Date</th>
                  <th className="py-3 px-4">Type</th>
                  <th className="py-3 px-4">Party</th>
                  <th className="py-3 px-4">Account / Method</th>
                  <th className="py-3 px-4">Reference</th>
                  <th className="py-3 px-4 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-muted/40">
                {filteredPayments.map((p) => {
                  const isCustomer = p.type === 'CUSTOMER_PAYMENT';
                  const partyName = isCustomer ? p.customer?.name : p.supplier?.name;
                  const partyHref = isCustomer ? `/customers/${p.customerId}` : `/suppliers/${p.supplierId}`;
                  const accName = p.account?.name || 'Cash/Bank';
                  const accType = p.account?.type;

                  return (
                    <tr key={p.id} className="hover:bg-brand-light/40 transition">
                      <td className="py-3 px-4 font-mono font-semibold text-brand-deep">
                        {p.paymentNumber}
                      </td>
                      <td className="py-3 px-4 text-gray-600">
                        {new Date(p.paymentDate).toLocaleDateString('en-GB', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </td>
                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                            isCustomer
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : 'bg-red-50 text-red-700 border border-red-200'
                          }`}
                        >
                          {isCustomer ? (
                            <>
                              <ArrowDownLeft className="w-3 h-3" /> Receipt
                            </>
                          ) : (
                            <>
                              <ArrowUpRight className="w-3 h-3" /> Payment
                            </>
                          )}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <Link
                          href={partyHref}
                          className="font-semibold text-brand-charcoal hover:text-brand-fabric underline decoration-dotted"
                        >
                          {partyName || '—'}
                        </Link>
                      </td>
                      <td className="py-3 px-4 text-gray-600">
                        <div className="flex items-center gap-1.5">
                          {accType === 'CASH' ? (
                            <Wallet className="w-3.5 h-3.5 text-amber-600" />
                          ) : (
                            <Landmark className="w-3.5 h-3.5 text-blue-600" />
                          )}
                          <span>{accName}</span>
                        </div>
                      </td>
                      <td className="py-3 px-4 font-mono text-gray-500">
                        {p.referenceNumber || '—'}
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-sm">
                        <span className={isCustomer ? 'text-emerald-700' : 'text-red-600'}>
                          {isCustomer ? '+' : '-'} {formatPKR(p.amount)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Receive Money Modal */}
      {isReceiptModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-brand-deep/70 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-brand-muted relative">
            <div className="flex items-center justify-between pb-4 border-b border-brand-muted">
              <div className="flex items-center gap-2 text-emerald-700 font-bold">
                <ArrowDownLeft className="w-5 h-5" />
                <h3 className="text-base text-brand-charcoal">Record Customer Receipt</h3>
              </div>
              <button
                onClick={() => setIsReceiptModalOpen(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateReceipt} className="space-y-4 pt-4">
              {formError && (
                <div className="p-3 bg-red-50 text-red-700 text-xs rounded-xl border border-red-200">
                  {formError}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-brand-charcoal uppercase tracking-wider mb-1">
                  Customer *
                </label>
                <select
                  required
                  value={selectedCustomerId}
                  onChange={(e) => setSelectedCustomerId(e.target.value)}
                  className="w-full px-3 py-2 bg-brand-ivory border border-brand-muted rounded-xl text-xs font-medium text-brand-charcoal focus:ring-1 focus:ring-brand-fabric outline-none"
                >
                  <option value="">Select customer...</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} {c.currentBalance > 0 ? `(Owes: ${formatPKR(c.currentBalance)})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-brand-charcoal uppercase tracking-wider mb-1">
                  Deposit Account *
                </label>
                <select
                  required
                  value={selectedAccountId}
                  onChange={(e) => setSelectedAccountId(e.target.value)}
                  className="w-full px-3 py-2 bg-brand-ivory border border-brand-muted rounded-xl text-xs font-medium text-brand-charcoal focus:ring-1 focus:ring-brand-fabric outline-none"
                >
                  {accountsList.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} ({a.type})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-brand-charcoal uppercase tracking-wider mb-1">
                    Amount (PKR) *
                  </label>
                  <input
                    type="number"
                    required
                    min="1"
                    step="any"
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value === '' ? '' : Number(e.target.value))}
                    placeholder="e.g. 50000"
                    className="w-full px-3 py-2 bg-brand-ivory border border-brand-muted rounded-xl text-xs font-bold text-brand-charcoal focus:ring-1 focus:ring-brand-fabric outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-brand-charcoal uppercase tracking-wider mb-1">
                    Receipt Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={paymentDate}
                    onChange={(e) => setPaymentDate(e.target.value)}
                    className="w-full px-3 py-2 bg-brand-ivory border border-brand-muted rounded-xl text-xs font-medium text-brand-charcoal focus:ring-1 focus:ring-brand-fabric outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-brand-charcoal uppercase tracking-wider mb-1">
                  Reference / Cheque #
                </label>
                <input
                  type="text"
                  value={refNumber}
                  onChange={(e) => setRefNumber(e.target.value)}
                  placeholder="Optional cheque or online transfer TID"
                  className="w-full px-3 py-2 bg-brand-ivory border border-brand-muted rounded-xl text-xs font-medium text-brand-charcoal focus:ring-1 focus:ring-brand-fabric outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-brand-charcoal uppercase tracking-wider mb-1">
                  Notes
                </label>
                <textarea
                  rows={2}
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                  placeholder="Additional remarks..."
                  className="w-full px-3 py-2 bg-brand-ivory border border-brand-muted rounded-xl text-xs font-medium text-brand-charcoal focus:ring-1 focus:ring-brand-fabric outline-none"
                />
              </div>

              <div className="pt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsReceiptModalOpen(false)}
                  className="flex-1 py-2 px-4 rounded-xl text-xs font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={paymentMutation.isPending}
                  className="flex-1 py-2 px-4 rounded-xl text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 transition disabled:opacity-60"
                >
                  {paymentMutation.isPending ? 'Recording...' : 'Confirm Receipt'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Pay Supplier Modal */}
      {isDisbursementModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-brand-deep/70 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-brand-muted relative">
            <div className="flex items-center justify-between pb-4 border-b border-brand-muted">
              <div className="flex items-center gap-2 text-red-600 font-bold">
                <ArrowUpRight className="w-5 h-5" />
                <h3 className="text-base text-brand-charcoal">Record Supplier Payment</h3>
              </div>
              <button
                onClick={() => setIsDisbursementModalOpen(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateDisbursement} className="space-y-4 pt-4">
              {formError && (
                <div className="p-3 bg-red-50 text-red-700 text-xs rounded-xl border border-red-200">
                  {formError}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-brand-charcoal uppercase tracking-wider mb-1">
                  Supplier *
                </label>
                <select
                  required
                  value={selectedSupplierId}
                  onChange={(e) => setSelectedSupplierId(e.target.value)}
                  className="w-full px-3 py-2 bg-brand-ivory border border-brand-muted rounded-xl text-xs font-medium text-brand-charcoal focus:ring-1 focus:ring-brand-fabric outline-none"
                >
                  <option value="">Select supplier...</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} {s.currentBalance > 0 ? `(Payable: ${formatPKR(s.currentBalance)})` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-brand-charcoal uppercase tracking-wider mb-1">
                  Payment Account *
                </label>
                <select
                  required
                  value={selectedAccountId}
                  onChange={(e) => setSelectedAccountId(e.target.value)}
                  className="w-full px-3 py-2 bg-brand-ivory border border-brand-muted rounded-xl text-xs font-medium text-brand-charcoal focus:ring-1 focus:ring-brand-fabric outline-none"
                >
                  {accountsList.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} ({a.type} - Bal: {formatPKR(a.currentBalance)})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-brand-charcoal uppercase tracking-wider mb-1">
                    Amount (PKR) *
                  </label>
                  <input
                    type="number"
                    required
                    min="1"
                    step="any"
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value === '' ? '' : Number(e.target.value))}
                    placeholder="e.g. 75000"
                    className="w-full px-3 py-2 bg-brand-ivory border border-brand-muted rounded-xl text-xs font-bold text-brand-charcoal focus:ring-1 focus:ring-brand-fabric outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-brand-charcoal uppercase tracking-wider mb-1">
                    Payment Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={paymentDate}
                    onChange={(e) => setPaymentDate(e.target.value)}
                    className="w-full px-3 py-2 bg-brand-ivory border border-brand-muted rounded-xl text-xs font-medium text-brand-charcoal focus:ring-1 focus:ring-brand-fabric outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-brand-charcoal uppercase tracking-wider mb-1">
                  Reference / Cheque #
                </label>
                <input
                  type="text"
                  value={refNumber}
                  onChange={(e) => setRefNumber(e.target.value)}
                  placeholder="Optional cheque or online transfer TID"
                  className="w-full px-3 py-2 bg-brand-ivory border border-brand-muted rounded-xl text-xs font-medium text-brand-charcoal focus:ring-1 focus:ring-brand-fabric outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-brand-charcoal uppercase tracking-wider mb-1">
                  Notes
                </label>
                <textarea
                  rows={2}
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                  placeholder="Additional remarks..."
                  className="w-full px-3 py-2 bg-brand-ivory border border-brand-muted rounded-xl text-xs font-medium text-brand-charcoal focus:ring-1 focus:ring-brand-fabric outline-none"
                />
              </div>

              <div className="pt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsDisbursementModalOpen(false)}
                  className="flex-1 py-2 px-4 rounded-xl text-xs font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={paymentMutation.isPending}
                  className="flex-1 py-2 px-4 rounded-xl text-xs font-bold text-white bg-red-600 hover:bg-red-700 transition disabled:opacity-60"
                >
                  {paymentMutation.isPending ? 'Processing...' : 'Confirm Payment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
