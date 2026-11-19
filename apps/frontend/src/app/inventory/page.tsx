'use client';

import React, { useState } from 'react';
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
  const [adjustKg, setAdjustKg] = useState<number>(0);
  const [adjustGrams, setAdjustGrams] = useState<number>(0);
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
      setAdjustKg(0);
      setAdjustGrams(0);
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

    if (!adjustReason.trim() || adjustReason.trim().length < 3) {
      setAdjustError('A detailed reason for the stock adjustment is mandatory');
      return;
    }

    const finalGramsChange = adjustType === 'deduct' ? -totalGrams : totalGrams;

    adjustStockMutation.mutate({
      lotId: selectedLotId,
      gramsChange: finalGramsChange,
      reason: adjustReason,
      date: new Date(),
      notes: adjustNotes || undefined,
    });
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center">
            <Package className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">Lot Inventory</h1>
            <p className="text-xs text-slate-500">Fabric rolls tracked separately by purchase lot</p>
          </div>
        </div>

        <button
          onClick={() => {
            if (data?.lots && data.lots.length > 0) {
              setSelectedLotId(data.lots[0].id);
            }
            setIsAdjustModalOpen(true);
          }}
          className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold text-sm shadow-sm active:scale-95 transition"
        >
          <SlidersHorizontal className="w-4 h-4" />
          <span>Stock Adjustment</span>
        </button>
      </div>

      {/* Inventory KPI Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
          <span className="text-xs text-slate-400 uppercase font-semibold">Total Stock in KG</span>
          <p className="text-xl sm:text-2xl font-black text-slate-900 mt-1">
            {invReport ? `${invReport.totalAvailableKg.toLocaleString()} KG` : '...'}
          </p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
          <span className="text-xs text-slate-400 uppercase font-semibold">Inventory Valuation</span>
          <p className="text-xl sm:text-2xl font-black text-emerald-600 mt-1">
            {invReport ? formatPKR(invReport.totalInventoryValuation) : '...'}
          </p>
        </div>

        <div className="col-span-2 sm:col-span-1 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
          <span className="text-xs text-slate-400 uppercase font-semibold">Active Lots</span>
          <p className="text-xl sm:text-2xl font-black text-slate-900 mt-1">
            {invReport ? invReport.totalLots : '...'} Lots
          </p>
        </div>
      </div>

      {/* Filters & Search */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search lot number or fabric name..."
            className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-sm"
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="p-2.5 bg-white border border-slate-200 rounded-xl text-xs font-semibold text-slate-700 shadow-sm"
        >
          <option value="">All Lots (Active & Depleted)</option>
          <option value="ACTIVE">Active Lots Only</option>
          <option value="DEPLETED">Depleted Lots</option>
        </select>
      </div>

      {/* Lots List */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : data?.lots?.length === 0 ? (
        <div className="bg-white p-8 rounded-2xl border border-slate-200 text-center">
          <p className="text-sm font-medium text-slate-500">No inventory lots found.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {data?.lots?.map((lot: any) => (
            <a
              key={lot.id}
              href={`/inventory/lots/${lot.id}`}
              className="block bg-white p-4 rounded-2xl border border-slate-200 hover:border-emerald-300 transition shadow-sm active:scale-[0.99]"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-slate-900">{lot.lotNumber}</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                      lot.status === 'ACTIVE'
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-slate-100 text-slate-600'
                    }`}>
                      {lot.status}
                    </span>
                  </div>

                  <p className="text-xs font-semibold text-slate-800 mt-1 truncate">
                    {lot.product?.name}
                  </p>

                  <p className="text-xs text-slate-500 mt-0.5">
                    Purchased: {formatWeight(lot.purchasedGrams)} • Sold: {formatWeight(lot.soldGrams)}
                  </p>
                </div>

                <div className="text-right shrink-0">
                  <p className="text-base font-extrabold text-slate-900">
                    {formatWeight(lot.availableGrams)}
                  </p>
                  <p className="text-xs font-semibold text-emerald-600">
                    Cost: {formatPKR(lot.landedCostPerKg)} / KG
                  </p>
                  <p className="text-[10px] text-slate-400 mt-1">
                    Value: {formatPKR(lot.inventoryValue)}
                  </p>
                </div>
              </div>
            </a>
          ))}
        </div>
      )}

      {/* Modal: Stock Adjustment with Mandatory Reason */}
      {isAdjustModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-bold text-base text-slate-900">Inventory Stock Adjustment</h3>
                <p className="text-xs text-slate-500">Mandatory audit trail for damages or stock counts</p>
              </div>
              <button
                onClick={() => setIsAdjustModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {adjustError && (
              <div className="p-3 bg-red-50 text-red-700 text-xs rounded-xl border border-red-200">
                {adjustError}
              </div>
            )}

            <form onSubmit={handleAdjustSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Select Lot *</label>
                <select
                  value={selectedLotId}
                  onChange={(e) => setSelectedLotId(e.target.value)}
                  required
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium"
                >
                  {data?.lots?.map((l: any) => (
                    <option key={l.id} value={l.id}>
                      {l.lotNumber} — {l.product?.name} (Avail: {formatWeight(l.availableGrams)})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Adjustment Action *</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setAdjustType('deduct')}
                    className={`py-2 px-3 rounded-xl border font-bold text-xs transition ${
                      adjustType === 'deduct'
                        ? 'bg-red-50 text-red-700 border-red-300'
                        : 'border-slate-200 text-slate-600'
                    }`}
                  >
                    - Deduct (Damaged/Loss)
                  </button>

                  <button
                    type="button"
                    onClick={() => setAdjustType('add')}
                    className={`py-2 px-3 rounded-xl border font-bold text-xs transition ${
                      adjustType === 'add'
                        ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                        : 'border-slate-200 text-slate-600'
                    }`}
                  >
                    + Add (Found/Surplus)
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Weight (KG) *</label>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    required
                    value={adjustKg}
                    onChange={(e) => setAdjustKg(parseFloat(e.target.value) || 0)}
                    placeholder="0"
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Extra Grams</label>
                  <input
                    type="number"
                    min="0"
                    max="999"
                    value={adjustGrams}
                    onChange={(e) => setAdjustGrams(parseInt(e.target.value, 10) || 0)}
                    placeholder="0"
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Mandatory Audit Reason *
                </label>
                <input
                  type="text"
                  required
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                  placeholder="e.g. Water damage during godown shifting / Weave tear inspection"
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Notes</label>
                <textarea
                  value={adjustNotes}
                  onChange={(e) => setAdjustNotes(e.target.value)}
                  rows={2}
                  placeholder="Additional context..."
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsAdjustModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={adjustStockMutation.isPending}
                  className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold transition disabled:opacity-50"
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
