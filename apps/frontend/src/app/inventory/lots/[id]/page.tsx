'use client';

import React from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { formatPKR, formatWeight } from '@fatani/shared';
import {
  ArrowLeft,
  Package,
  Calendar,
  Clock,
  Building2,
  Receipt,
  Scale,
} from 'lucide-react';

export default function LotDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = Array.isArray(params.id) ? params.id[0] : (params.id as string);

  const { data: lot, isLoading, error } = useQuery({
    queryKey: ['lotDetail', id],
    queryFn: () => api.get<any>(`/inventory/lots/${id}`),
  });

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <div className="w-8 h-8 border-4 border-brand-fabric border-t-transparent rounded-full animate-spin" />
        <p className="text-xs text-gray-500 font-semibold uppercase tracking-wider">Loading Lot Details...</p>
      </div>
    );
  }

  if (error || !lot) {
    return (
      <div className="p-6 bg-red-50 border border-red-200 rounded-2xl text-red-700 text-sm">
        Lot not found or failed to load.
      </div>
    );
  }

  return (
    <div className="space-y-5 max-w-4xl mx-auto pb-16">
      {/* Header */}
      <div className="flex items-center justify-between bg-white p-4 sm:p-5 rounded-2xl border border-brand-muted shadow-subtle">
        <div className="flex items-center gap-3">
          <Link
            href="/inventory"
            className="p-2.5 rounded-xl bg-brand-light border border-brand-muted text-brand-charcoal hover:bg-brand-muted transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold text-brand-charcoal tracking-tight font-mono">{lot.lotNumber}</h1>
              <span
                className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold ${
                  lot.status === 'ACTIVE'
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                    : 'bg-gray-100 text-gray-600'
                }`}
              >
                {lot.status}
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-0.5">{lot.product?.name}</p>
          </div>
        </div>

        <div className="text-right">
          <span className="text-[10px] text-gray-400 uppercase font-semibold">Inventory Valuation</span>
          <p className="text-lg sm:text-xl font-extrabold text-emerald-700">
            {formatPKR(lot.inventoryValue)}
          </p>
        </div>
      </div>

      {/* Lot Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white p-4 rounded-2xl border border-brand-muted shadow-subtle">
          <span className="text-[11px] text-gray-500 font-semibold uppercase tracking-wider">Purchased Weight</span>
          <p className="text-base sm:text-lg font-extrabold text-brand-charcoal mt-1">
            {formatWeight(lot.purchasedGrams)}
          </p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-brand-muted shadow-subtle">
          <span className="text-[11px] text-gray-500 font-semibold uppercase tracking-wider">Available Stock</span>
          <p className="text-base sm:text-lg font-extrabold text-brand-fabric mt-1">
            {formatWeight(lot.availableGrams)}
          </p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-brand-muted shadow-subtle">
          <span className="text-[11px] text-gray-500 font-semibold uppercase tracking-wider">Sold Weight</span>
          <p className="text-base sm:text-lg font-extrabold text-brand-charcoal mt-1">
            {formatWeight(lot.soldGrams)}
          </p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-brand-muted shadow-subtle">
          <span className="text-[11px] text-gray-500 font-semibold uppercase tracking-wider">Landed Cost / KG</span>
          <p className="text-base sm:text-lg font-extrabold text-emerald-700 mt-1">
            {formatPKR(lot.landedCostPerKg)}
          </p>
        </div>
      </div>

      {/* Origin Purchase Information */}
      <div className="bg-white p-5 rounded-2xl border border-brand-muted shadow-subtle space-y-3">
        <h2 className="text-xs font-bold text-brand-charcoal uppercase tracking-wider flex items-center gap-2">
          <Building2 className="w-4 h-4 text-brand-fabric" />
          <span>Source Purchase Information</span>
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          <div>
            <span className="text-gray-400 uppercase text-[10px] font-semibold">Supplier</span>
            <p className="text-sm font-bold text-brand-charcoal mt-0.5">{lot.purchase?.supplier?.name || 'Unknown Supplier'}</p>
          </div>

          <div>
            <span className="text-gray-400 uppercase text-[10px] font-semibold">Purchase Reference #</span>
            <p className="text-sm font-semibold text-brand-charcoal mt-0.5">{lot.purchase?.purchaseNumber}</p>
          </div>

          <div>
            <span className="text-gray-400 uppercase text-[10px] font-semibold">Purchase Date</span>
            <p className="text-sm font-semibold text-brand-charcoal mt-0.5">
              {new Date(lot.purchase?.purchaseDate).toLocaleDateString()}
            </p>
          </div>
        </div>
      </div>

      {/* Stock Movement Audit Log */}
      <div className="bg-white p-5 rounded-2xl border border-brand-muted shadow-subtle space-y-3">
        <h2 className="text-xs font-bold text-brand-charcoal uppercase tracking-wider flex items-center gap-2">
          <Clock className="w-4 h-4 text-brand-fabric" />
          <span>Lot Stock Movements History</span>
        </h2>

        {lot.movements?.length === 0 ? (
          <p className="text-xs text-gray-400 py-4 text-center">No movements recorded.</p>
        ) : (
          <div className="divide-y divide-gray-100">
            {lot.movements?.map((m: any) => (
              <div key={m.id} className="py-2.5 flex items-center justify-between text-xs">
                <div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`font-bold px-2 py-0.5 rounded text-[10px] ${
                        m.type === 'PURCHASE' || m.type === 'SALES_RETURN'
                          ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                          : 'bg-red-50 text-red-800 border border-red-200'
                      }`}
                    >
                      {m.type}
                    </span>
                    <span className="text-gray-500">{new Date(m.date).toLocaleDateString()}</span>
                  </div>
                  <p className="text-gray-600 mt-1">{m.notes}</p>
                </div>

                <div className="text-right">
                  <p className={`font-bold ${m.gramsChange > 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                    {m.gramsChange > 0 ? '+' : ''}{formatWeight(m.gramsChange)}
                  </p>
                  <p className="text-[10px] text-gray-400">
                    Avail: {formatWeight(m.resultingAvailableGrams)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
