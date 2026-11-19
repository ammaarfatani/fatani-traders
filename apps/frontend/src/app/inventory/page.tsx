'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { formatPKR, formatWeight, kgAndGramsToGrams } from '@fatani/shared';
import {
  Package,
  Plus,
  Search,
  Scale,
  Calendar,
  AlertTriangle,
  X,
  SlidersHorizontal,
  ChevronRight,
} from 'lucide-react';

export default function InventoryReportPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [isAdjustModalOpen, setIsAdjustModalOpen] = useState(false);

  // Adjustment Form State
  const [selectedLotId, setSelectedLotId] = useState('');
  const [adjustType, setAdjustType] = useState<'deduct' | 'add'>('deduct');
  const [adjustKg, setAdjustKg] = useState<number | ''>('');
  const [adjustGrams, setAdjustGrams] = useState<number | ''>('');
  const [adjustReason, setAdjustReason] = useState('');
  const [adjustNotes, setAdjustNotes] = useState('');
  const [adjustError, setAdjustError] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['inventoryLots', statusFilter, search],
    queryFn: () =>
      api.get<any>(
        `/inventory/all-lots?${statusFilter ? `status=${statusFilter}&` : ''}${
          search ? `search=${encodeURIComponent(search)}` : ''
        }`
      ),
  });

  const { data: invReport } = useQuery({
    queryKey: ['inventoryReportSummary'],
    queryFn: () => api.get<any>('/reports/inventory'),
  });

  const adjustStockMutation = useMutation({
    mutationFn: (payload: any) => api.post('/inventory/adjust', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventoryLots'] });
      queryClient.invalidateQueries({ queryKey: ['inventoryReportSummary'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      setIsAdjustModalOpen(false);
      setAdjustKg('');
      setAdjustGrams('');
      setAdjustReason('');
      setAdjustNotes('');
      setAdjustError(null);
    },
    onError: (err: any) => {
      setAdjustError(err.message || 'Failed to adjust stock');
    },
  });

  const handleAdjustSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLotId) {
      setAdjustError('Please select a purchase lot');
      return;
    }

    const totalGrams = kgAndGramsToGrams(Number(adjustKg) || 0, Number(adjustGrams) || 0);
    if (totalGrams <= 0) {
      setAdjustError('Adjustment weight must be greater than zero');
      return;
    }

    if (!adjustReason) {
      setAdjustReason('Periodic physical inventory reconciliation');
    }

    adjustStockMutation.mutate({
      lotId: selectedLotId,
      gramsChange: adjustType === 'deduct' ? -totalGrams : totalGrams,
      reason: adjustReason || 'Physical Audit Adjustment',
      notes: adjustNotes || undefined,
    });
  };

  return (
    <div className="space-y-5 max-w-5xl mx-auto pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 sm:p-5 rounded-2xl border border-brand-muted shadow-subtle">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-brand-deep text-white flex items-center justify-center">
            <Package className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-brand-charcoal tracking-tight font-sans">
              Lot-Wise Fabric Inventory
            </h1>
            <p className="text-xs text-gray-500">Separated inventory lots, landed costs, and movements</p>
          </div>
        </div>

        <button
          onClick={() => setIsAdjustModalOpen(true)}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-brand-deep hover:bg-brand-fabric text-white text-xs sm:text-sm font-semibold shadow-sm active:scale-95 transition"
        >
          <SlidersHorizontal className="w-4 h-4" />
          <span>Stock Adjustment</span>
        </button>
      </div>

      {/* Inventory KPI Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-brand-muted shadow-subtle">
          <span className="text-[11px] text-gray-500 uppercase tracking-wider font-semibold">Total Stock in KG</span>
          <p className="text-xl sm:text-2xl font-extrabold text-brand-charcoal mt-1">
            {invReport ? `${invReport.totalAvailableKg.toLocaleString()} KG` : '...'}
          </p>
        </div>

        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-brand-muted shadow-subtle">
          <span className="text-[11px] text-gray-500 uppercase tracking-wider font-semibold">Inventory Valuation</span>
          <p className="text-xl sm:text-2xl font-extrabold text-emerald-700 mt-1">
            {invReport ? formatPKR(invReport.totalInventoryValuation) : '...'}
          </p>
        </div>

        <div className="col-span-2 sm:col-span-1 bg-white p-4 sm:p-5 rounded-2xl border border-brand-muted shadow-subtle">
          <span className="text-[11px] text-gray-500 uppercase tracking-wider font-semibold">Active Lots</span>
          <p className="text-xl sm:text-2xl font-extrabold text-brand-charcoal mt-1">
            {invReport ? invReport.totalLots : '...'} Lots
          </p>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search lot number or fabric name..."
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-brand-muted rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-fabric shadow-subtle text-brand-charcoal"
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="p-2.5 bg-white border border-brand-muted rounded-xl text-xs font-semibold text-brand-charcoal shadow-subtle outline-none"
        >
          <option value="">All Lots (Active & Depleted)</option>
          <option value="ACTIVE">Active Lots Only</option>
          <option value="DEPLETED">Depleted Lots</option>
        </select>
      </div>

      {/* Lots List */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <div className="w-8 h-8 border-4 border-brand-fabric border-t-transparent rounded-full animate-spin" />
          <p className="text-xs text-gray-500 font-semibold uppercase tracking-wider">Loading Inventory Lots...</p>
        </div>
      ) : data?.lots?.length === 0 ? (
        <div className="bg-white p-8 rounded-2xl border border-brand-muted text-center">
          <p className="text-sm font-medium text-gray-500">No inventory lots found.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {data?.lots?.map((lot: any) => (
            <Link
              key={lot.id}
              href={`/inventory/lots/${lot.id}`}
              className="block bg-white p-4 sm:p-5 rounded-2xl border border-brand-muted hover:border-brand-fabric/50 transition shadow-subtle active:scale-[0.99]"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-brand-charcoal font-mono">{lot.lotNumber}</span>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                        lot.status === 'ACTIVE'
                          ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                          : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {lot.status}
                    </span>
                  </div>

                  <p className="text-xs font-semibold text-brand-charcoal mt-1 truncate">
                    {lot.product?.name}
                  </p>

                  <p className="text-xs text-gray-500 mt-0.5">
                    Purchased: {formatWeight(lot.purchasedGrams)} • Sold: {formatWeight(lot.soldGrams)}
                  </p>
                </div>

                <div className="text-right shrink-0">
                  <p className="text-base font-extrabold text-brand-charcoal">
                    {formatWeight(lot.availableGrams)}
                  </p>
                  <p className="text-xs font-semibold text-emerald-700">
                    Cost: {formatPKR(lot.landedCostPerKg)} / KG
                  </p>
                  <p className="text-[10px] text-gray-400 mt-1">
                    Value: {formatPKR(lot.inventoryValue)}
                  </p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* Stock Adjustment Modal */}
      {isAdjustModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-brand-deep/70 backdrop-blur-sm">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-brand-muted animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-4 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="w-5 h-5 text-brand-fabric" />
                <h3 className="font-extrabold text-base text-brand-charcoal">Stock Adjustment / Audit</h3>
              </div>
              <button
                onClick={() => setIsAdjustModalOpen(false)}
                className="p-1 rounded-lg text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAdjustSubmit} className="space-y-4 pt-4">
              {adjustError && (
                <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs font-semibold">
                  {adjustError}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-brand-charcoal mb-1">
                  Select Purchase Lot *
                </label>
                <select
                  required
                  value={selectedLotId}
                  onChange={(e) => setSelectedLotId(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-brand-muted text-xs text-brand-charcoal focus:ring-2 focus:ring-brand-fabric outline-none bg-white"
                >
                  <option value="">-- Choose Lot to Adjust --</option>
                  {data?.lots?.map((l: any) => (
                    <option key={l.id} value={l.id}>
                      {l.lotNumber} — {l.product?.name} (Avail: {formatWeight(l.availableGrams)})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-brand-charcoal mb-1">
                  Adjustment Type
                </label>
                <div className="grid grid-cols-2 gap-2 text-xs font-semibold">
                  <button
                    type="button"
                    onClick={() => setAdjustType('deduct')}
                    className={`py-2 px-3 rounded-xl border transition ${
                      adjustType === 'deduct'
                        ? 'bg-red-50 text-red-700 border-red-300 font-bold'
                        : 'border-brand-muted text-gray-600'
                    }`}
                  >
                    Deduct (Loss/Damage)
                  </button>

                  <button
                    type="button"
                    onClick={() => setAdjustType('add')}
                    className={`py-2 px-3 rounded-xl border transition ${
                      adjustType === 'add'
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-300 font-bold'
                        : 'border-brand-muted text-gray-600'
                    }`}
                  >
                    Add (Surplus Audit)
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-brand-charcoal mb-1">
                    Weight in KG *
                  </label>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={adjustKg}
                    onChange={(e) => setAdjustKg(e.target.value === '' ? '' : Number(e.target.value))}
                    placeholder="e.g. 5"
                    className="w-full px-3 py-2 rounded-xl border border-brand-muted text-sm font-bold text-brand-charcoal focus:ring-2 focus:ring-brand-fabric outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-brand-charcoal mb-1">
                    Extra Grams (0-999)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="999"
                    value={adjustGrams}
                    onChange={(e) => setAdjustGrams(e.target.value === '' ? '' : Number(e.target.value))}
                    placeholder="0"
                    className="w-full px-3 py-2 rounded-xl border border-brand-muted text-sm font-bold text-brand-charcoal focus:ring-2 focus:ring-brand-fabric outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-brand-charcoal mb-1">
                  Reason for Adjustment *
                </label>
                <input
                  type="text"
                  required
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                  placeholder="e.g. Fabric stained by moisture, physical count difference"
                  className="w-full px-3 py-2 rounded-xl border border-brand-muted text-xs text-brand-charcoal focus:ring-2 focus:ring-brand-fabric outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-brand-charcoal mb-1">
                  Additional Notes
                </label>
                <input
                  type="text"
                  value={adjustNotes}
                  onChange={(e) => setAdjustNotes(e.target.value)}
                  placeholder="Optional audit details"
                  className="w-full px-3 py-2 rounded-xl border border-brand-muted text-xs text-brand-charcoal focus:ring-2 focus:ring-brand-fabric outline-none"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAdjustModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-brand-muted text-xs font-semibold text-gray-600 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={adjustStockMutation.isPending}
                  className="px-5 py-2 rounded-xl bg-brand-deep hover:bg-brand-fabric text-white text-xs font-bold shadow-sm disabled:opacity-50"
                >
                  {adjustStockMutation.isPending ? 'Saving...' : 'Apply Stock Adjustment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
