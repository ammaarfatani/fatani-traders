'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { formatPKR, gramsToKg, kgToGrams } from '@fatani/shared';
import {
  RotateCcw,
  Plus,
  Search,
  Filter,
  CheckCircle2,
  AlertTriangle,
  X,
  PackageCheck,
  PackageX,
  Receipt,
  ShoppingCart,
  Users,
  Building2,
} from 'lucide-react';

export default function ReturnsPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'SALES' | 'PURCHASES'>('SALES');
  const [searchTerm, setSearchTerm] = useState('');

  // Modals
  const [isSalesReturnModalOpen, setIsSalesReturnModalOpen] = useState(false);
  const [isPurchaseReturnModalOpen, setIsPurchaseReturnModalOpen] = useState(false);

  // Sales Return Form State
  const [selectedSaleId, setSelectedSaleId] = useState('');
  const [salesReturnDate, setSalesReturnDate] = useState(new Date().toISOString().split('T')[0]);
  const [salesReturnNotes, setSalesReturnNotes] = useState('');
  const [salesReturnItems, setSalesReturnItems] = useState<
    Array<{
      saleItemId: string;
      lotId: string;
      productName: string;
      maxGrams: number;
      returnedKg: number | '';
      ratePerKg: number;
      isRestocked: boolean;
    }>
  >([]);
  const [salesReturnRefundAmount, setSalesReturnRefundAmount] = useState<number | ''>('');
  const [formError, setFormError] = useState<string | null>(null);

  // Purchase Return Form State
  const [selectedLotId, setSelectedLotId] = useState('');
  const [purchaseReturnDate, setPurchaseReturnDate] = useState(new Date().toISOString().split('T')[0]);
  const [purchaseReturnKg, setPurchaseReturnKg] = useState<number | ''>('');
  const [purchaseReturnRate, setPurchaseReturnRate] = useState<number | ''>('');
  const [purchaseReturnNotes, setPurchaseReturnNotes] = useState('');
  const [purchaseReturnImmediateRefund, setPurchaseReturnImmediateRefund] = useState<number | ''>('');

  // Queries
  const { data: salesReturnsData, isLoading: isSalesLoading } = useQuery({
    queryKey: ['returns-sales'],
    queryFn: () => api.get<{ data: any[]; pagination: any }>('/returns/sales'),
  });

  const { data: purchaseReturnsData, isLoading: isPurchasesLoading } = useQuery({
    queryKey: ['returns-purchases'],
    queryFn: () => api.get<{ data: any[]; pagination: any }>('/returns/purchases'),
  });

  const { data: salesList } = useQuery({
    queryKey: ['sales-for-return'],
    queryFn: () => api.get<{ sales: any[] }>('/sales?limit=50'),
    enabled: isSalesReturnModalOpen,
  });

  const { data: lotsList } = useQuery({
    queryKey: ['lots-for-return'],
    queryFn: () => api.get<any[]>('/inventory/all-lots'),
    enabled: isPurchaseReturnModalOpen,
  });

  const salesReturns = salesReturnsData?.data || [];
  const purchaseReturns = purchaseReturnsData?.data || [];

  // When sale is selected in modal, load its items
  const handleSelectSale = async (saleId: string) => {
    setSelectedSaleId(saleId);
    setFormError(null);
    if (!saleId) {
      setSalesReturnItems([]);
      return;
    }
    try {
      const saleDetails = await api.get<any>(`/sales/${saleId}`);
      if (saleDetails && saleDetails.items) {
        setSalesReturnItems(
          saleDetails.items.map((item: any) => ({
            saleItemId: item.id,
            lotId: item.lotId,
            productName: item.lot?.product?.name || item.lot?.lotNumber || 'Fabric',
            maxGrams: item.grams,
            returnedKg: '',
            ratePerKg: item.ratePerKg,
            isRestocked: true,
          }))
        );
      }
    } catch (err: any) {
      setFormError('Failed to fetch invoice details');
    }
  };

  // Mutations
  const salesReturnMutation = useMutation({
    mutationFn: (payload: any) => api.post('/returns/sales', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['returns-sales'] });
      queryClient.invalidateQueries({ queryKey: ['customers'] });
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      setIsSalesReturnModalOpen(false);
      resetSalesForm();
    },
    onError: (err: any) => {
      setFormError(err.message || 'Failed to process sales return');
    },
  });

  const purchaseReturnMutation = useMutation({
    mutationFn: (payload: any) => api.post('/returns/purchases', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['returns-purchases'] });
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      setIsPurchaseReturnModalOpen(false);
      resetPurchaseForm();
    },
    onError: (err: any) => {
      setFormError(err.message || 'Failed to process purchase return');
    },
  });

  const resetSalesForm = () => {
    setSelectedSaleId('');
    setSalesReturnDate(new Date().toISOString().split('T')[0]);
    setSalesReturnNotes('');
    setSalesReturnItems([]);
    setSalesReturnRefundAmount('');
    setFormError(null);
  };

  const resetPurchaseForm = () => {
    setSelectedLotId('');
    setPurchaseReturnDate(new Date().toISOString().split('T')[0]);
    setPurchaseReturnKg('');
    setPurchaseReturnRate('');
    setPurchaseReturnNotes('');
    setPurchaseReturnImmediateRefund('');
    setFormError(null);
  };

  const handleSalesReturnSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSaleId) {
      setFormError('Please select a sale invoice');
      return;
    }

    const itemsToReturn = salesReturnItems
      .filter((it) => it.returnedKg !== '' && Number(it.returnedKg) > 0)
      .map((it) => ({
        saleItemId: it.saleItemId,
        lotId: it.lotId,
        returnedGrams: kgToGrams(Number(it.returnedKg)),
        ratePerKg: it.ratePerKg,
        isRestocked: it.isRestocked,
      }));

    if (itemsToReturn.length === 0) {
      setFormError('Please enter returned KG for at least one fabric item');
      return;
    }

    const selectedSale = (salesList?.sales || []).find((s) => s.id === selectedSaleId);

    salesReturnMutation.mutate({
      saleId: selectedSaleId,
      customerId: selectedSale?.customerId,
      returnDate: new Date(salesReturnDate).toISOString(),
      items: itemsToReturn,
      refundAmount: salesReturnRefundAmount ? Number(salesReturnRefundAmount) : 0,
      refundAccountId: null,
      notes: salesReturnNotes || undefined,
    });
  };

  const handlePurchaseReturnSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLotId) {
      setFormError('Please select a purchase lot');
      return;
    }
    if (!purchaseReturnKg || Number(purchaseReturnKg) <= 0) {
      setFormError('Please enter valid returned KG');
      return;
    }

    const chosenLot = (lotsList || []).find((l: any) => l.id === selectedLotId);
    if (!chosenLot) {
      setFormError('Selected lot not found');
      return;
    }

    purchaseReturnMutation.mutate({
      purchaseId: chosenLot.purchaseId,
      lotId: chosenLot.id,
      supplierId: chosenLot.purchase?.supplierId,
      returnDate: new Date(purchaseReturnDate).toISOString(),
      grams: kgToGrams(Number(purchaseReturnKg)),
      ratePerKg: purchaseReturnRate ? Number(purchaseReturnRate) : chosenLot.purchaseRatePerKg,
      refundAmount: purchaseReturnImmediateRefund ? Number(purchaseReturnImmediateRefund) : 0,
      refundAccountId: null,
      notes: purchaseReturnNotes || undefined,
    });
  };

  // KPIs
  const totalSalesReturnPKR = salesReturns.reduce((sum, r) => sum + (r.totalRefundAmount || 0), 0);
  const totalPurchaseReturnPKR = purchaseReturns.reduce((sum, r) => sum + (r.totalAmount || 0), 0);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-brand-charcoal tracking-tight">
            Returns Management
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Sales returns, supplier rejections, and inventory restock reconciliation.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => {
              resetSalesForm();
              setIsSalesReturnModalOpen(true);
            }}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold text-white bg-amber-700 hover:bg-amber-800 transition shadow-sm active:scale-95"
          >
            <RotateCcw className="w-4 h-4" />
            <span>+ Sales Return</span>
          </button>

          <button
            onClick={() => {
              resetPurchaseForm();
              setIsPurchaseReturnModalOpen(true);
            }}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold text-white bg-brand-deep hover:bg-brand-fabric transition shadow-sm active:scale-95"
          >
            <ShoppingCart className="w-4 h-4" />
            <span>+ Purchase Return</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl p-5 border border-brand-muted shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Total Sales Returns</p>
            <h3 className="text-xl sm:text-2xl font-bold text-amber-700 mt-1">
              {formatPKR(totalSalesReturnPKR)}
            </h3>
            <p className="text-[11px] text-gray-400 mt-0.5">{salesReturns.length} returned customer orders</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
            <RotateCcw className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-brand-muted shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Supplier Rejections</p>
            <h3 className="text-xl sm:text-2xl font-bold text-brand-charcoal mt-1">
              {formatPKR(totalPurchaseReturnPKR)}
            </h3>
            <p className="text-[11px] text-gray-400 mt-0.5">{purchaseReturns.length} mill/supplier returns</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-brand-light text-brand-fabric flex items-center justify-center">
            <ShoppingCart className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white rounded-2xl p-5 border border-brand-muted shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Restock Integrity</p>
            <h3 className="text-xl sm:text-2xl font-bold text-emerald-700 mt-1">
              Integer-Gram
            </h3>
            <p className="text-[11px] text-gray-400 mt-0.5">Stock automatically adjusted</p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
            <PackageCheck className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Tabs and Search Bar */}
      <div className="bg-white rounded-2xl p-4 border border-brand-muted shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 p-1 bg-brand-light rounded-xl">
          <button
            onClick={() => setActiveTab('SALES')}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition ${
              activeTab === 'SALES' ? 'bg-white text-brand-charcoal shadow-sm' : 'text-gray-500 hover:text-brand-charcoal'
            }`}
          >
            Customer Sales Returns ({salesReturns.length})
          </button>
          <button
            onClick={() => setActiveTab('PURCHASES')}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition ${
              activeTab === 'PURCHASES' ? 'bg-white text-brand-charcoal shadow-sm' : 'text-gray-500 hover:text-brand-charcoal'
            }`}
          >
            Supplier Purchase Returns ({purchaseReturns.length})
          </button>
        </div>

        <div className="relative max-w-xs w-full">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search return # or party..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs bg-brand-ivory border border-brand-muted rounded-xl text-brand-charcoal focus:ring-1 focus:ring-brand-fabric outline-none"
          />
        </div>
      </div>

      {/* Tables */}
      <div className="bg-white rounded-2xl border border-brand-muted shadow-sm overflow-hidden">
        {activeTab === 'SALES' ? (
          isSalesLoading ? (
            <div className="p-12 text-center text-xs text-gray-500">Loading sales returns...</div>
          ) : salesReturns.length === 0 ? (
            <div className="p-12 text-center">
              <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto mb-3">
                <RotateCcw className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-brand-charcoal">No Sales Returns</h3>
              <p className="text-xs text-gray-500 max-w-sm mx-auto mt-1">
                Zero fabric returns recorded from customers. When fabric rolls or thaan are returned, click "+ Sales Return" to restore inventory and credit customer khata.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-brand-light text-gray-600 font-semibold border-b border-brand-muted uppercase tracking-wider text-[11px]">
                    <th className="py-3 px-4">Return #</th>
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4">Customer</th>
                    <th className="py-3 px-4">Invoice #</th>
                    <th className="py-3 px-4">Items / Restocked</th>
                    <th className="py-3 px-4 text-right">Refund Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-brand-muted/40">
                  {salesReturns.map((r) => (
                    <tr key={r.id} className="hover:bg-brand-light/40 transition">
                      <td className="py-3 px-4 font-mono font-semibold text-brand-deep">
                        {r.returnNumber}
                      </td>
                      <td className="py-3 px-4 text-gray-600">
                        {new Date(r.returnDate).toLocaleDateString('en-GB', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </td>
                      <td className="py-3 px-4 font-semibold text-brand-charcoal">
                        <Link href={`/customers/${r.customerId}`} className="hover:text-brand-fabric underline decoration-dotted">
                          {r.customer?.name || 'Customer'}
                        </Link>
                      </td>
                      <td className="py-3 px-4 font-mono text-gray-500">
                        <Link href={`/sales/${r.saleId}`} className="hover:text-brand-fabric">
                          {r.sale?.invoiceNumber || 'Invoice'}
                        </Link>
                      </td>
                      <td className="py-3 px-4 text-gray-600">
                        <div className="space-y-1">
                          {(r.items || []).map((item: any, idx: number) => (
                            <div key={idx} className="flex items-center gap-1.5">
                              {item.isRestocked ? (
                                <PackageCheck className="w-3.5 h-3.5 text-emerald-600" />
                              ) : (
                                <PackageX className="w-3.5 h-3.5 text-red-500" />
                              )}
                              <span>{gramsToKg(item.grams)} KG</span>
                              <span className="text-[10px] text-gray-400">
                                ({item.isRestocked ? 'Restocked' : 'Scrap/Damaged'})
                              </span>
                            </div>
                          ))}
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-amber-700 text-sm">
                        {formatPKR(r.totalRefundAmount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : (
          isPurchasesLoading ? (
            <div className="p-12 text-center text-xs text-gray-500">Loading purchase returns...</div>
          ) : purchaseReturns.length === 0 ? (
            <div className="p-12 text-center">
              <div className="w-12 h-12 rounded-2xl bg-brand-light text-brand-fabric flex items-center justify-center mx-auto mb-3">
                <ShoppingCart className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-brand-charcoal">No Purchase Returns</h3>
              <p className="text-xs text-gray-500 max-w-sm mx-auto mt-1">
                Zero purchase returns recorded to suppliers. When damaged or defective lots are sent back to mills, click "+ Purchase Return" to deduct stock and adjust payables.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-brand-light text-gray-600 font-semibold border-b border-brand-muted uppercase tracking-wider text-[11px]">
                    <th className="py-3 px-4">Return #</th>
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4">Supplier</th>
                    <th className="py-3 px-4">Lot # / Fabric</th>
                    <th className="py-3 px-4 text-right">Returned Weight</th>
                    <th className="py-3 px-4 text-right">Rate / KG</th>
                    <th className="py-3 px-4 text-right">Total Debit</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-brand-muted/40">
                  {purchaseReturns.map((r) => (
                    <tr key={r.id} className="hover:bg-brand-light/40 transition">
                      <td className="py-3 px-4 font-mono font-semibold text-brand-deep">
                        {r.returnNumber}
                      </td>
                      <td className="py-3 px-4 text-gray-600">
                        {new Date(r.returnDate).toLocaleDateString('en-GB', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </td>
                      <td className="py-3 px-4 font-semibold text-brand-charcoal">
                        {r.supplierId ? (
                          <Link href={`/suppliers/${r.supplierId}`} className="hover:text-brand-fabric underline decoration-dotted">
                            {r.supplier?.name || 'Supplier'}
                          </Link>
                        ) : (
                          <span className="text-gray-500 font-normal">Unknown Supplier</span>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        <span className="font-mono text-brand-fabric font-medium">{r.lot?.lotNumber}</span>
                        <span className="text-gray-500 text-[11px] block">{r.lot?.product?.name}</span>
                      </td>
                      <td className="py-3 px-4 text-right font-semibold">
                        {gramsToKg(r.grams)} KG
                      </td>
                      <td className="py-3 px-4 text-right text-gray-600">
                        {formatPKR(r.ratePerKg)}
                      </td>
                      <td className="py-3 px-4 text-right font-bold text-brand-charcoal text-sm">
                        {formatPKR(r.totalAmount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}
      </div>

      {/* Sales Return Modal */}
      {isSalesReturnModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-brand-deep/70 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-brand-muted relative max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-brand-muted">
              <div className="flex items-center gap-2 text-amber-700 font-bold">
                <RotateCcw className="w-5 h-5" />
                <h3 className="text-base text-brand-charcoal">Process Customer Sales Return</h3>
              </div>
              <button
                onClick={() => setIsSalesReturnModalOpen(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSalesReturnSubmit} className="space-y-4 pt-4">
              {formError && (
                <div className="p-3 bg-red-50 text-red-700 text-xs rounded-xl border border-red-200">
                  {formError}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-brand-charcoal uppercase tracking-wider mb-1">
                  Sale Invoice *
                </label>
                <select
                  required
                  value={selectedSaleId}
                  onChange={(e) => handleSelectSale(e.target.value)}
                  className="w-full px-3 py-2 bg-brand-ivory border border-brand-muted rounded-xl text-xs font-medium text-brand-charcoal focus:ring-1 focus:ring-brand-fabric outline-none"
                >
                  <option value="">Select Invoice to Return...</option>
                  {(salesList?.sales || []).map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.invoiceNumber} — {s.customer?.name} ({formatPKR(s.totalAmount)})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-brand-charcoal uppercase tracking-wider mb-1">
                  Return Date *
                </label>
                <input
                  type="date"
                  required
                  value={salesReturnDate}
                  onChange={(e) => setSalesReturnDate(e.target.value)}
                  className="w-full px-3 py-2 bg-brand-ivory border border-brand-muted rounded-xl text-xs font-medium text-brand-charcoal focus:ring-1 focus:ring-brand-fabric outline-none"
                />
              </div>

              {/* Items in Invoice */}
              {salesReturnItems.length > 0 && (
                <div className="space-y-3 pt-2 border-t border-brand-muted">
                  <h4 className="text-xs font-bold text-brand-charcoal uppercase tracking-wider">
                    Select Fabric Items to Return:
                  </h4>
                  <div className="space-y-2">
                    {salesReturnItems.map((item, idx) => (
                      <div
                        key={item.saleItemId}
                        className="p-3 rounded-xl bg-brand-light/60 border border-brand-muted text-xs space-y-2"
                      >
                        <div className="flex justify-between items-center">
                          <span className="font-semibold text-brand-deep">{item.productName}</span>
                          <span className="text-gray-500 text-[11px]">
                            Sold: {gramsToKg(item.maxGrams)} KG @ {formatPKR(item.ratePerKg)}/KG
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 items-center">
                          <div>
                            <label className="block text-[10px] text-gray-500 font-semibold mb-0.5">
                              Return KG:
                            </label>
                            <input
                              type="number"
                              step="any"
                              min="0"
                              max={gramsToKg(item.maxGrams)}
                              value={item.returnedKg}
                              onChange={(e) => {
                                const val = e.target.value === '' ? '' : Number(e.target.value);
                                const updated = [...salesReturnItems];
                                updated[idx].returnedKg = val;
                                setSalesReturnItems(updated);
                              }}
                              placeholder={`0 to ${gramsToKg(item.maxGrams)}`}
                              className="w-full px-2.5 py-1.5 bg-white border border-brand-muted rounded-lg text-xs font-bold"
                            />
                          </div>

                          <div className="pt-3">
                            <label className="flex items-center gap-1.5 text-xs text-brand-charcoal cursor-pointer">
                              <input
                                type="checkbox"
                                checked={item.isRestocked}
                                onChange={(e) => {
                                  const updated = [...salesReturnItems];
                                  updated[idx].isRestocked = e.target.checked;
                                  setSalesReturnItems(updated);
                                }}
                                className="w-4 h-4 text-emerald-600 rounded border-brand-muted"
                              />
                              <span className="text-[11px] font-medium">Restock to Available</span>
                            </label>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Immediate Cash Refund (Optional) */}
              <div className="pt-2">
                <label className="block text-xs font-semibold text-brand-charcoal uppercase tracking-wider mb-1">
                  Cash Refunded (Optional)
                </label>
                <input
                  type="number"
                  step="any"
                  value={salesReturnRefundAmount}
                  onChange={(e) =>
                    setSalesReturnRefundAmount(e.target.value === '' ? '' : Number(e.target.value))
                  }
                  placeholder="Leave 0 for Khata credit"
                  className="w-full px-3 py-2 bg-brand-ivory border border-brand-muted rounded-xl text-xs font-bold text-brand-charcoal focus:ring-1 focus:ring-brand-fabric outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-brand-charcoal uppercase tracking-wider mb-1">
                  Reason / Notes
                </label>
                <textarea
                  rows={2}
                  value={salesReturnNotes}
                  onChange={(e) => setSalesReturnNotes(e.target.value)}
                  placeholder="Reason for return, condition of fabric..."
                  className="w-full px-3 py-2 bg-brand-ivory border border-brand-muted rounded-xl text-xs font-medium text-brand-charcoal focus:ring-1 focus:ring-brand-fabric outline-none"
                />
              </div>

              <div className="pt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsSalesReturnModalOpen(false)}
                  className="flex-1 py-2 px-4 rounded-xl text-xs font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={salesReturnMutation.isPending}
                  className="flex-1 py-2 px-4 rounded-xl text-xs font-bold text-white bg-amber-700 hover:bg-amber-800 transition disabled:opacity-60"
                >
                  {salesReturnMutation.isPending ? 'Processing...' : 'Confirm Return'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Purchase Return Modal */}
      {isPurchaseReturnModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-brand-deep/70 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-brand-muted relative max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-brand-muted">
              <div className="flex items-center gap-2 text-brand-deep font-bold">
                <ShoppingCart className="w-5 h-5" />
                <h3 className="text-base text-brand-charcoal">Process Supplier Purchase Return</h3>
              </div>
              <button
                onClick={() => setIsPurchaseReturnModalOpen(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handlePurchaseReturnSubmit} className="space-y-4 pt-4">
              {formError && (
                <div className="p-3 bg-red-50 text-red-700 text-xs rounded-xl border border-red-200">
                  {formError}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-brand-charcoal uppercase tracking-wider mb-1">
                  Purchase Lot *
                </label>
                <select
                  required
                  value={selectedLotId}
                  onChange={(e) => {
                    setSelectedLotId(e.target.value);
                    const chosen = (lotsList || []).find((l: any) => l.id === e.target.value);
                    if (chosen) {
                      setPurchaseReturnRate(chosen.purchaseRatePerKg);
                    }
                  }}
                  className="w-full px-3 py-2 bg-brand-ivory border border-brand-muted rounded-xl text-xs font-medium text-brand-charcoal focus:ring-1 focus:ring-brand-fabric outline-none"
                >
                  <option value="">Select Lot to Return...</option>
                  {(lotsList || []).map((l: any) => (
                    <option key={l.id} value={l.id}>
                      {l.lotNumber} — {l.product?.name} (Available: {gramsToKg(l.availableGrams)} KG)
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-brand-charcoal uppercase tracking-wider mb-1">
                    Returned Weight (KG) *
                  </label>
                  <input
                    type="number"
                    step="any"
                    required
                    min="0.1"
                    value={purchaseReturnKg}
                    onChange={(e) => setPurchaseReturnKg(e.target.value === '' ? '' : Number(e.target.value))}
                    placeholder="e.g. 50"
                    className="w-full px-3 py-2 bg-brand-ivory border border-brand-muted rounded-xl text-xs font-bold text-brand-charcoal focus:ring-1 focus:ring-brand-fabric outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-brand-charcoal uppercase tracking-wider mb-1">
                    Rate / KG (PKR) *
                  </label>
                  <input
                    type="number"
                    step="any"
                    required
                    value={purchaseReturnRate}
                    onChange={(e) => setPurchaseReturnRate(e.target.value === '' ? '' : Number(e.target.value))}
                    placeholder="e.g. 850"
                    className="w-full px-3 py-2 bg-brand-ivory border border-brand-muted rounded-xl text-xs font-bold text-brand-charcoal focus:ring-1 focus:ring-brand-fabric outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-brand-charcoal uppercase tracking-wider mb-1">
                  Return Date *
                </label>
                <input
                  type="date"
                  required
                  value={purchaseReturnDate}
                  onChange={(e) => setPurchaseReturnDate(e.target.value)}
                  className="w-full px-3 py-2 bg-brand-ivory border border-brand-muted rounded-xl text-xs font-medium text-brand-charcoal focus:ring-1 focus:ring-brand-fabric outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-brand-charcoal uppercase tracking-wider mb-1">
                  Reason / Notes
                </label>
                <textarea
                  rows={2}
                  value={purchaseReturnNotes}
                  onChange={(e) => setPurchaseReturnNotes(e.target.value)}
                  placeholder="Defect, misweave, mill rejection details..."
                  className="w-full px-3 py-2 bg-brand-ivory border border-brand-muted rounded-xl text-xs font-medium text-brand-charcoal focus:ring-1 focus:ring-brand-fabric outline-none"
                />
              </div>

              <div className="pt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsPurchaseReturnModalOpen(false)}
                  className="flex-1 py-2 px-4 rounded-xl text-xs font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={purchaseReturnMutation.isPending}
                  className="flex-1 py-2 px-4 rounded-xl text-xs font-bold text-white bg-brand-deep hover:bg-brand-fabric transition disabled:opacity-60"
                >
                  {purchaseReturnMutation.isPending ? 'Processing...' : 'Confirm Return'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
