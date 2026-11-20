'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { formatPKR, formatWeight } from '@fatani/shared';
import {
  ShoppingCart,
  Plus,
  Search,
  Calendar,
  ChevronRight,
  Filter,
  CheckCircle,
  Clock,
  ArrowRight,
} from 'lucide-react';

export default function PurchasesHistoryPage() {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'COMPLETED' | 'PARTIAL' | 'UNPAID'>('ALL');
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['purchases', page, search],
    queryFn: () =>
      api.get<any>(
        `/purchases?page=${page}&limit=50${search ? `&search=${encodeURIComponent(search)}` : ''}`
      ),
  });

  const purchasesList = data?.data || data?.purchases || [];
  const summary = data?.summary || {
    totalPurchases: purchasesList.reduce((sum: number, p: any) => sum + (p.totalLandedCost || 0), 0),
    totalPaid: purchasesList.reduce((sum: number, p: any) => sum + (p.paidAmount || 0), 0),
    totalBalance: purchasesList.reduce((sum: number, p: any) => sum + (p.balanceAmount || 0), 0),
  };

  const filteredPurchases = purchasesList.filter((pur: any) => {
    const isPaid = pur.balanceAmount === 0 || (pur.paidAmount >= pur.totalLandedCost && pur.totalLandedCost > 0);
    const isPartial = pur.paidAmount > 0 && pur.balanceAmount > 0;
    const isUnpaid = pur.paidAmount === 0;

    if (statusFilter === 'ALL') return true;
    if (statusFilter === 'COMPLETED') return isPaid;
    if (statusFilter === 'PARTIAL') return isPartial;
    if (statusFilter === 'UNPAID') return isUnpaid;
    return true;
  });

  return (
    <div className="space-y-5 max-w-6xl mx-auto pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 sm:p-5 rounded-2xl border border-brand-muted shadow-subtle">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-brand-deep text-white flex items-center justify-center shrink-0">
            <ShoppingCart className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-brand-charcoal tracking-tight font-sans">
              Purchase History
            </h1>
            <p className="text-xs text-gray-500">
              Fabric purchases, mill suppliers, landed costs & payment tracking
            </p>
          </div>
        </div>

        <Link
          href="/purchases/new"
          className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-brand-fabric hover:bg-brand-accent text-white font-semibold text-xs sm:text-sm shadow-sm active:scale-95 transition"
        >
          <Plus className="w-4 h-4" />
          <span>+ New Purchase</span>
        </Link>
      </div>

      {/* Purchase Summary Banner */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
        <div className="bg-brand-deep text-white p-5 rounded-2xl shadow-subtle">
          <span className="text-[11px] font-bold uppercase tracking-wider text-brand-light/90 block mb-1">
            Total Purchases
          </span>
          <p className="text-2xl sm:text-3xl font-extrabold text-white">
            {formatPKR(summary.totalPurchases || 0)}
          </p>
          <p className="text-xs text-brand-light/70 mt-1">Total landed inventory cost</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-brand-muted shadow-subtle">
          <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 block mb-1">
            Total Paid
          </span>
          <p className="text-2xl sm:text-3xl font-extrabold text-emerald-700">
            {formatPKR(summary.totalPaid || 0)}
          </p>
          <p className="text-xs text-gray-500 mt-1">Total payments made to suppliers</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-brand-muted shadow-subtle">
          <span className="text-[11px] font-bold uppercase tracking-wider text-amber-700 block mb-1">
            Remaining Payable
          </span>
          <p className="text-2xl sm:text-3xl font-extrabold text-amber-700">
            {formatPKR(summary.totalBalance || 0)}
          </p>
          <p className="text-xs text-gray-500 mt-1">Supplier balance to be settled</p>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white p-3 sm:p-4 rounded-2xl border border-brand-muted shadow-subtle flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search by purchase #, supplier, fabric, lot #, or invoice ref..."
            className="w-full pl-10 pr-4 py-2 bg-brand-light/50 border border-brand-muted rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-brand-fabric text-brand-charcoal"
          />
        </div>

        {/* Status Filter Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0">
          {(['ALL', 'COMPLETED', 'PARTIAL', 'UNPAID'] as const).map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition ${
                statusFilter === st
                  ? 'bg-brand-deep text-white shadow-sm'
                  : 'bg-brand-light text-gray-600 hover:bg-brand-muted/70'
              }`}
            >
              {st === 'ALL'
                ? 'All Purchases'
                : st === 'COMPLETED'
                ? 'Fully Paid'
                : st === 'PARTIAL'
                ? 'Partial'
                : 'Unpaid'}
            </button>
          ))}
        </div>
      </div>

      {/* Purchases List */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <div className="w-8 h-8 border-4 border-brand-fabric border-t-transparent rounded-full animate-spin" />
          <p className="text-xs text-gray-500 font-semibold uppercase tracking-wider">
            Loading Purchase History...
          </p>
        </div>
      ) : filteredPurchases.length === 0 ? (
        <div className="bg-white p-12 rounded-2xl border border-brand-muted text-center space-y-3">
          <p className="text-sm font-semibold text-gray-600">No purchase records found.</p>
          <p className="text-xs text-gray-400">
            {search ? 'Try adjusting your search query or status filter.' : 'Record your first purchase batch to start tracking inventory.'}
          </p>
          <Link
            href="/purchases/new"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-brand-deep text-white text-xs font-semibold hover:bg-brand-fabric transition mt-2"
          >
            <Plus className="w-4 h-4" />
            <span>Create Purchase Entry</span>
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredPurchases.map((pur: any) => {
            const lot = pur.lots?.[0];
            const isFullyPaid = pur.balanceAmount === 0;
            const isPartial = pur.paidAmount > 0 && pur.balanceAmount > 0;

            return (
              <Link
                key={pur.id}
                href={`/purchases/${pur.id}`}
                className="block bg-white p-4 sm:p-5 rounded-2xl border border-brand-muted hover:border-brand-fabric/60 transition shadow-subtle hover:shadow-md active:scale-[0.99] group"
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 sm:gap-4">
                  {/* Left Column: Identifiers & Supplier */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-sm text-brand-charcoal font-mono group-hover:text-brand-fabric transition-colors">
                        {pur.purchaseNumber}
                      </span>
                      {lot?.lotNumber && (
                        <span className="text-[10px] bg-brand-light text-brand-fabric border border-brand-muted px-2 py-0.5 rounded-md font-mono font-bold">
                          Lot #{lot.lotNumber}
                        </span>
                      )}
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-md font-bold uppercase tracking-wider ${
                          isFullyPaid
                            ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                            : isPartial
                            ? 'bg-amber-50 text-amber-800 border border-amber-200'
                            : 'bg-red-50 text-red-800 border border-red-200'
                        }`}
                      >
                        {isFullyPaid ? 'Paid' : isPartial ? 'Partial' : 'Unpaid'}
                      </span>
                      <span className="text-[11px] text-gray-400 flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        <span>{new Date(pur.purchaseDate).toLocaleString()}</span>
                      </span>
                    </div>

                    <p className="text-sm font-bold text-brand-charcoal mt-1.5 truncate">
                      {pur.supplier?.name}
                      {pur.invoiceRefNumber && (
                        <span className="text-xs font-normal text-gray-500 ml-2">
                          (Ref: {pur.invoiceRefNumber})
                        </span>
                      )}
                    </p>

                    {/* Product & Quantity details */}
                    <div className="mt-1.5 text-xs text-gray-600 space-y-0.5">
                      <p className="truncate">
                        <strong className="text-gray-800">{lot?.product?.name || 'Fabric Lot'}</strong>
                        {lot?.purchasedGrams && (
                          <span className="ml-2 text-gray-600">
                            Quantity: <strong className="text-gray-800">{formatWeight(lot.purchasedGrams)}</strong>
                          </span>
                        )}
                        {lot?.purchaseRatePerKg && (
                          <span className="ml-2 text-gray-600">
                            • Rate: <strong className="text-gray-800">Rs. {lot.purchaseRatePerKg}/KG</strong>
                          </span>
                        )}
                      </p>
                    </div>
                  </div>

                  {/* Right Column: Financial Figures */}
                  <div className="text-left sm:text-right shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-gray-100 flex sm:flex-col justify-between sm:justify-start items-center sm:items-end">
                    <div>
                      <span className="text-[10px] text-gray-400 uppercase font-semibold block sm:inline mr-1">
                        Total Purchase Amount:
                      </span>
                      <span className="text-base sm:text-lg font-extrabold text-brand-charcoal">
                        {formatPKR(pur.totalLandedCost)}
                      </span>
                    </div>

                    <div className="text-right text-xs mt-1 space-y-0.5">
                      <p className="text-emerald-700 font-semibold">
                        Paid: {formatPKR(pur.paidAmount || 0)}
                      </p>
                      {pur.balanceAmount > 0 ? (
                        <p className="text-amber-700 font-bold">
                          Remaining: {formatPKR(pur.balanceAmount)}
                        </p>
                      ) : (
                        <p className="text-emerald-700 text-[11px] font-bold">✓ Fully Settled</p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="mt-3 pt-2.5 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
                  <span>
                    Base Cost: <strong>{formatPKR(pur.baseCost)}</strong>
                    {pur.totalExpenses > 0 && (
                      <span> + Landed Expenses: <strong className="text-emerald-700">{formatPKR(pur.totalExpenses)}</strong></span>
                    )}
                  </span>
                  <div className="flex items-center gap-1 text-brand-fabric font-semibold text-xs group-hover:translate-x-1 transition-transform">
                    <span>Details & Payments</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
