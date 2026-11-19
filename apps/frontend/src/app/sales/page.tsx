'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { formatPKR, formatWeight } from '@fatani/shared';
import { Receipt, Plus, Search, Calendar, ChevronRight } from 'lucide-react';

export default function SalesListPage() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ['sales', page, search],
    queryFn: () => api.get<any>(`/sales?page=${page}&limit=20${search ? `&search=${encodeURIComponent(search)}` : ''}`),
  });

  return (
    <div className="space-y-5 max-w-5xl mx-auto pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 sm:p-5 rounded-2xl border border-brand-muted shadow-subtle">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-brand-deep text-white flex items-center justify-center">
            <Receipt className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-brand-charcoal tracking-tight font-sans">Sales Invoices</h1>
            <p className="text-xs text-gray-500">Fabric billing, lot deductions & customer invoice records</p>
          </div>
        </div>

        <Link
          href="/sales/new"
          className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-brand-deep hover:bg-brand-fabric text-white font-semibold text-xs sm:text-sm shadow-sm active:scale-95 transition"
        >
          <Plus className="w-4 h-4" />
          <span>New Sales Invoice</span>
        </Link>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          placeholder="Search by invoice #, customer name, or phone..."
          className="w-full pl-10 pr-4 py-2.5 bg-white border border-brand-muted rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-fabric shadow-subtle text-brand-charcoal"
        />
      </div>

      {/* Sales Invoices List */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <div className="w-8 h-8 border-4 border-brand-fabric border-t-transparent rounded-full animate-spin" />
          <p className="text-xs text-gray-500 font-semibold uppercase tracking-wider">Loading Sales Invoices...</p>
        </div>
      ) : data?.sales?.length === 0 ? (
        <div className="bg-white p-8 rounded-2xl border border-brand-muted text-center space-y-3">
          <p className="text-sm font-medium text-gray-500">No sales invoices recorded yet.</p>
          <Link
            href="/sales/new"
            className="inline-flex items-center gap-2 text-xs font-semibold text-brand-fabric hover:text-brand-accent"
          >
            <Plus className="w-4 h-4" />
            <span>Create a new invoice</span>
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {data?.sales?.map((sale: any) => {
            const totalGrams = sale.items?.reduce((sum: number, it: any) => sum + it.grams, 0) || 0;
            return (
              <Link
                key={sale.id}
                href={`/sales/${sale.id}`}
                className="block bg-white p-4 sm:p-5 rounded-2xl border border-brand-muted hover:border-brand-fabric/50 transition shadow-subtle active:scale-[0.99]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-brand-charcoal font-mono">{sale.invoiceNumber}</span>
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                          sale.status === 'COMPLETED'
                            ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                            : sale.status === 'PARTIAL'
                            ? 'bg-amber-50 text-amber-800 border border-amber-200'
                            : 'bg-red-50 text-red-800 border border-red-200'
                        }`}
                      >
                        {sale.status}
                      </span>
                    </div>

                    <p className="text-xs font-semibold text-brand-charcoal mt-1 truncate">
                      {sale.customer?.name}
                    </p>

                    <p className="text-xs text-gray-500 mt-0.5">
                      {sale.items?.length} fabric {sale.items?.length === 1 ? 'item' : 'items'} •{' '}
                      <span className="font-semibold text-gray-700">{formatWeight(totalGrams)}</span>
                    </p>
                  </div>

                  <div className="text-right shrink-0">
                    <p className="text-base font-extrabold text-brand-charcoal">
                      {formatPKR(sale.grandTotal)}
                    </p>
                    {sale.balanceAmount > 0 ? (
                      <p className="text-xs font-semibold text-red-600">
                        Due: {formatPKR(sale.balanceAmount)}
                      </p>
                    ) : (
                      <p className="text-xs font-semibold text-emerald-700">Paid in Full</p>
                    )}
                    <p className="text-[10px] text-gray-400 mt-1 flex items-center justify-end gap-1">
                      <Calendar className="w-3 h-3" />
                      <span>{new Date(sale.invoiceDate).toLocaleDateString()}</span>
                    </p>
                  </div>
                </div>

                <div className="mt-3 pt-2.5 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
                  <span>
                    Customer Khata Outstanding:{' '}
                    <strong className="text-brand-charcoal">{formatPKR(sale.customer?.currentBalance || 0)}</strong>
                  </span>
                  <ChevronRight className="w-4 h-4 text-gray-400" />
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
