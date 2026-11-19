'use client';

import React, { useState } from 'react';
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
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center">
            <Receipt className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">Sales Invoices</h1>
            <p className="text-xs text-slate-500">Fabric billing & customer invoice records</p>
          </div>
        </div>

        <a
          href="/sales/new"
          className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm shadow-md shadow-emerald-600/20 active:scale-95 transition"
        >
          <Plus className="w-4 h-4" />
          <span>New Sales Invoice</span>
        </a>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          placeholder="Search by invoice #, customer name, or phone..."
          className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-sm"
        />
      </div>

      {/* Sales Invoices List */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : data?.sales?.length === 0 ? (
        <div className="bg-white p-8 rounded-2xl border border-slate-200 text-center space-y-3">
          <p className="text-sm font-medium text-slate-500">No sales invoices recorded yet.</p>
          <a
            href="/sales/new"
            className="inline-flex items-center gap-2 text-xs font-semibold text-emerald-600 hover:text-emerald-700"
          >
            <Plus className="w-4 h-4" />
            <span>Create a new invoice</span>
          </a>
        </div>
      ) : (
        <div className="space-y-3">
          {data?.sales?.map((sale: any) => {
            const totalGrams = sale.items?.reduce((sum: number, it: any) => sum + it.grams, 0) || 0;
            return (
              <a
                key={sale.id}
                href={`/sales/${sale.id}`}
                className="block bg-white p-4 rounded-2xl border border-slate-200 hover:border-emerald-300 transition shadow-sm active:scale-[0.99]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-slate-900">{sale.invoiceNumber}</span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                        sale.status === 'COMPLETED'
                          ? 'bg-emerald-100 text-emerald-800'
                          : sale.status === 'PARTIAL'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {sale.status}
                      </span>
                    </div>

                    <p className="text-xs font-semibold text-slate-800 mt-1 truncate">
                      {sale.customer?.name}
                    </p>

                    <p className="text-xs text-slate-500 mt-0.5">
                      {sale.items?.length} fabric {sale.items?.length === 1 ? 'item' : 'items'} •{' '}
                      <span className="font-semibold text-slate-700">{formatWeight(totalGrams)}</span>
                    </p>
                  </div>

                  <div className="text-right shrink-0">
                    <p className="text-base font-extrabold text-slate-900">
                      {formatPKR(sale.grandTotal)}
                    </p>
                    {sale.balanceAmount > 0 ? (
                      <p className="text-xs font-semibold text-red-600">
                        Due: {formatPKR(sale.balanceAmount)}
                      </p>
                    ) : (
                      <p className="text-xs font-semibold text-emerald-600">Paid in Full</p>
                    )}
                    <p className="text-[10px] text-slate-400 mt-1 flex items-center justify-end gap-1">
                      <Calendar className="w-3 h-3" />
                      <span>{new Date(sale.invoiceDate).toLocaleDateString()}</span>
                    </p>
                  </div>
                </div>

                <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                  <span>
                    Customer Khata Outstanding:{' '}
                    <strong className="text-slate-800">{formatPKR(sale.customer?.currentBalance || 0)}</strong>
                  </span>
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                </div>
              </a>
            );
          })}
        </div>
      )}
    </div>
  );
}
