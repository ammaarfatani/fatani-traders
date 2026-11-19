'use client';

import React, { useState } from 'react';
import Link from 'next/link';
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
    <div className="space-y-5 max-w-5xl mx-auto pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 sm:p-5 rounded-2xl border border-brand-muted shadow-subtle">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-brand-deep text-white flex items-center justify-center">
            <ShoppingCart className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-brand-charcoal tracking-tight font-sans">Purchase Lots</h1>
            <p className="text-xs text-gray-500">Fabric rolls & landed-cost inventory batches</p>
          </div>
        </div>

        <Link
          href="/purchases/new"
          className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-brand-deep hover:bg-brand-fabric text-white font-semibold text-xs sm:text-sm shadow-sm active:scale-95 transition"
        >
          <Plus className="w-4 h-4" />
          <span>New Purchase Entry</span>
        </Link>
      </div>

      {/* Search Filter */}
      <div className="relative">
        <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          placeholder="Search by purchase #, invoice ref, or supplier..."
          className="w-full pl-10 pr-4 py-2.5 bg-white border border-brand-muted rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-fabric shadow-subtle text-brand-charcoal"
        />
      </div>

      {/* Purchases List */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <div className="w-8 h-8 border-4 border-brand-fabric border-t-transparent rounded-full animate-spin" />
          <p className="text-xs text-gray-500 font-semibold uppercase tracking-wider">Loading Purchases...</p>
        </div>
      ) : data?.purchases?.length === 0 ? (
        <div className="bg-white p-8 rounded-2xl border border-brand-muted text-center space-y-3">
          <p className="text-sm font-medium text-gray-500">No purchase records found.</p>
          <Link
            href="/purchases/new"
            className="inline-flex items-center gap-2 text-xs font-semibold text-brand-fabric hover:text-brand-accent"
          >
            <Plus className="w-4 h-4" />
            <span>Create your first purchase batch</span>
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {data?.purchases?.map((pur: any) => {
            const lot = pur.lots?.[0];
            return (
              <Link
                key={pur.id}
                href={`/purchases/${pur.id}`}
                className="block bg-white p-4 sm:p-5 rounded-2xl border border-brand-muted hover:border-brand-fabric/50 transition shadow-subtle active:scale-[0.99]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-brand-charcoal font-mono">{pur.purchaseNumber}</span>
                      {lot && (
                        <span className="text-[10px] bg-brand-light text-brand-fabric border border-brand-muted px-2 py-0.5 rounded-md font-mono font-bold">
                          {lot.lotNumber}
                        </span>
                      )}
                    </div>
                    <p className="text-xs font-medium text-gray-700 mt-1 truncate">
                      {pur.supplier?.name}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {lot?.product?.name} •{' '}
                      <span className="font-semibold text-brand-charcoal">
                        {lot ? formatWeight(lot.purchasedGrams) : '0 KG'}
                      </span>
                    </p>
                  </div>

                  <div className="text-right shrink-0">
                    <p className="text-base font-extrabold text-brand-charcoal">
                      {formatPKR(pur.totalLandedCost)}
                    </p>
                    <p className="text-xs font-semibold text-emerald-700">
                      {formatPKR(lot?.landedCostPerKg || 0)} / KG
                    </p>
                    <p className="text-[10px] text-gray-400 mt-1 flex items-center justify-end gap-1">
                      <Calendar className="w-3 h-3" />
                      <span>{new Date(pur.purchaseDate).toLocaleDateString()}</span>
                    </p>
                  </div>
                </div>

                {/* Additional expenses indicator */}
                {pur.totalExpenses > 0 && (
                  <div className="mt-3 pt-2.5 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
                    <span>
                      Base Cost: <strong className="text-gray-700">{formatPKR(pur.baseCost)}</strong> + Landed Expenses:{' '}
                      <strong className="text-emerald-700">{formatPKR(pur.totalExpenses)}</strong>
                    </span>
                    <ChevronRight className="w-4 h-4 text-gray-400" />
                  </div>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
