'use client';

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { formatPKR, formatWeight } from '@fatani/shared';
import { ShoppingCart, Plus, Search, Calendar, ChevronRight } from 'lucide-react';

export default function PurchasesListPage() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['purchases', page, search],
    queryFn: () => api.get<any>(`/purchases?page=${page}&limit=20${search ? `&search=${encodeURIComponent(search)}` : ''}`),
  });

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center">
            <ShoppingCart className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">Purchase Lots</h1>
            <p className="text-xs text-slate-500">Fabric rolls & landed-cost inventory batches</p>
          </div>
        </div>

        <a
          href="/purchases/new"
          className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm shadow-md shadow-emerald-600/20 active:scale-95 transition"
        >
          <Plus className="w-4 h-4" />
          <span>New Purchase Entry</span>
        </a>
      </div>

      {/* Search Filter */}
      <div className="relative">
        <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          placeholder="Search by purchase #, invoice ref, or supplier..."
          className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-sm"
        />
      </div>

      {/* Purchases List */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : data?.purchases?.length === 0 ? (
        <div className="bg-white p-8 rounded-2xl border border-slate-200 text-center space-y-3">
          <p className="text-sm font-medium text-slate-500">No purchase records found.</p>
          <a
            href="/purchases/new"
            className="inline-flex items-center gap-2 text-xs font-semibold text-emerald-600 hover:text-emerald-700"
          >
            <Plus className="w-4 h-4" />
            <span>Create your first purchase batch</span>
          </a>
        </div>
      ) : (
        <div className="space-y-3">
          {data?.purchases?.map((pur: any) => {
            const lot = pur.lots?.[0];
            return (
              <a
                key={pur.id}
                href={`/purchases/${pur.id}`}
                className="block bg-white p-4 rounded-2xl border border-slate-200 hover:border-emerald-300 transition shadow-sm active:scale-[0.99]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-slate-900">{pur.purchaseNumber}</span>
                      {lot && (
                        <span className="text-[10px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded-md font-mono">
                          {lot.lotNumber}
                        </span>
                      )}
                    </div>
                    <p className="text-xs font-medium text-slate-700 mt-0.5 truncate">
                      {pur.supplier?.name}
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                      {lot?.product?.name} •{' '}
                      <span className="font-semibold text-slate-800">
                        {lot ? formatWeight(lot.purchasedGrams) : '0 KG'}
                      </span>
                    </p>
                  </div>

                  <div className="text-right shrink-0">
                    <p className="text-base font-extrabold text-slate-900">
                      {formatPKR(pur.totalLandedCost)}
                    </p>
                    <p className="text-xs font-semibold text-emerald-600">
                      {formatPKR(lot?.landedCostPerKg || 0)} / KG
                    </p>
                    <p className="text-[10px] text-slate-400 mt-1 flex items-center justify-end gap-1">
                      <Calendar className="w-3 h-3" />
                      <span>{new Date(pur.purchaseDate).toLocaleDateString()}</span>
                    </p>
                  </div>
                </div>

                {/* Additional expenses indicator */}
                {pur.totalExpenses > 0 && (
                  <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                    <span>
                      Base Cost: <strong className="text-slate-700">{formatPKR(pur.baseCost)}</strong> + Landed Expenses:{' '}
                      <strong className="text-emerald-600">{formatPKR(pur.totalExpenses)}</strong>
                    </span>
                    <ChevronRight className="w-4 h-4 text-slate-400" />
                  </div>
                )}
              </a>
            );
          })}
        </div>
      )}
    </div>
  );
}
