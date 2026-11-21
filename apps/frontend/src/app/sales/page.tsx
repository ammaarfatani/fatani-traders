'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { formatPKR, formatWeight } from '@fatani/shared';
import {
  Receipt,
  Plus,
  Search,
  Calendar,
  ChevronRight,
  Filter,
  CheckCircle,
  Clock,
  AlertCircle,
  ArrowRight,
  Edit,
  Trash2,
} from 'lucide-react';
import { ConfirmDeleteModal } from '@/components/ui/ConfirmDeleteModal';
import { EditSaleModal } from '@/components/sales/EditSaleModal';

export default function SalesHistoryPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'COMPLETED' | 'PARTIAL' | 'UNPAID'>('ALL');
  const [page, setPage] = useState(1);

  // Edit and Delete state
  const [editingSale, setEditingSale] = useState<any | null>(null);
  const [deletingSale, setDeletingSale] = useState<any | null>(null);

  const handleDeleteSale = async () => {
    if (!deletingSale) return;
    await api.delete(`/sales/${deletingSale.id}`);
    queryClient.invalidateQueries();
    setDeletingSale(null);
  };

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['sales', page, search],
    queryFn: () =>
      api.getEnvelope<any>(
        `/sales?page=${page}&limit=50${search ? `&search=${encodeURIComponent(search)}` : ''}`
      ),
  });

  const salesList = Array.isArray(data?.data) ? data.data : Array.isArray(data?.sales) ? data.sales : [];
  const summary = data?.summary || {
    totalSales: salesList.reduce((sum: number, s: any) => sum + (s.grandTotal || 0), 0),
    totalPaid: salesList.reduce((sum: number, s: any) => sum + (s.paidAmount || 0), 0),
    totalBalance: salesList.reduce((sum: number, s: any) => sum + (s.balanceAmount || 0), 0),
  };

  // Filter by status if not ALL
  const filteredSales = salesList.filter((sale: any) => {
    if (statusFilter === 'ALL') return true;
    if (statusFilter === 'COMPLETED') return sale.status === 'COMPLETED' || sale.balanceAmount === 0;
    if (statusFilter === 'PARTIAL') return sale.status === 'PARTIAL' || (sale.paidAmount > 0 && sale.balanceAmount > 0);
    if (statusFilter === 'UNPAID') return sale.status === 'UNPAID' || sale.paidAmount === 0;
    return true;
  });

  return (
    <div className="space-y-5 max-w-6xl mx-auto pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 sm:p-5 rounded-2xl border border-brand-muted shadow-subtle">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-brand-deep text-white flex items-center justify-center shrink-0">
            <Receipt className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-brand-charcoal tracking-tight font-sans">
              Sales History
            </h1>
            <p className="text-xs text-gray-500">
              Fabric sales, customer billing, and payment records
            </p>
          </div>
        </div>

        <Link
          href="/sales/new"
          className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-brand-deep hover:bg-brand-fabric text-white font-semibold text-xs sm:text-sm shadow-sm active:scale-95 transition"
        >
          <Plus className="w-4 h-4" />
          <span>+ New Sale</span>
        </Link>
      </div>

      {/* Sales Summary Banner */}
      {isError && (
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <p className="font-semibold">Sales history could not be loaded.</p>
          <p className="mt-1">{error instanceof Error ? error.message : 'Check your connection and try again.'}</p>
          <button type="button" onClick={() => refetch()} className="mt-3 rounded-lg bg-red-700 px-3 py-2 font-semibold text-white">Retry</button>
        </div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
        <div className="bg-brand-deep text-white p-5 rounded-2xl shadow-subtle">
          <span className="text-[11px] font-bold uppercase tracking-wider text-brand-light/90 block mb-1">
            Total Sales
          </span>
          <p className="text-2xl sm:text-3xl font-extrabold text-white">
            {isError ? 'Unavailable' : formatPKR(summary.totalSales || 0)}
          </p>
          <p className="text-xs text-brand-light/70 mt-1">Cumulative invoice gross amount</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-brand-muted shadow-subtle">
          <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 block mb-1">
            Payment Received
          </span>
          <p className="text-2xl sm:text-3xl font-extrabold text-emerald-700">
            {isError ? 'Unavailable' : formatPKR(summary.totalPaid || 0)}
          </p>
          <p className="text-xs text-gray-500 mt-1">Total collected customer payments</p>
        </div>

        <div className="bg-white p-5 rounded-2xl border border-brand-muted shadow-subtle">
          <span className="text-[11px] font-bold uppercase tracking-wider text-red-600 block mb-1">
            Remaining Receivable
          </span>
          <p className="text-2xl sm:text-3xl font-extrabold text-red-600">
            {isError ? 'Unavailable' : formatPKR(summary.totalBalance || 0)}
          </p>
          <p className="text-xs text-gray-500 mt-1">Customer balance to be collected</p>
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
            placeholder="Search by invoice #, customer name, fabric, or phone..."
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
                ? 'All Sales'
                : st === 'COMPLETED'
                ? 'Fully Paid'
                : st === 'PARTIAL'
                ? 'Partial'
                : 'Unpaid'}
            </button>
          ))}
        </div>
      </div>

      {/* Sales Invoices List */}
      {isError ? null : isLoading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <div className="w-8 h-8 border-4 border-brand-fabric border-t-transparent rounded-full animate-spin" />
          <p className="text-xs text-gray-500 font-semibold uppercase tracking-wider">
            Loading Sales History...
          </p>
        </div>
      ) : filteredSales.length === 0 ? (
        <div className="bg-white p-12 rounded-2xl border border-brand-muted text-center space-y-3">
          <p className="text-sm font-semibold text-gray-600">No sales records found.</p>
          <p className="text-xs text-gray-400">
            {search ? 'Try adjusting your search query or status filter.' : 'Start recording fabric sales to view them here.'}
          </p>
          <Link
            href="/sales/new"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-brand-deep text-white text-xs font-semibold hover:bg-brand-fabric transition mt-2"
          >
            <Plus className="w-4 h-4" />
            <span>Create New Sale</span>
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredSales.map((sale: any) => {
            const firstItem = sale.items?.[0];
            const totalGrams =
              sale.items?.reduce((sum: number, it: any) => sum + (it.grams || 0), 0) || 0;
            const itemsCount = sale.items?.length || 0;

            const isFullyPaid = sale.status === 'COMPLETED' || sale.balanceAmount === 0;
            const isPartial = sale.status === 'PARTIAL' || (sale.paidAmount > 0 && sale.balanceAmount > 0);

            return (
              <Link
                key={sale.id}
                href={`/sales/${sale.id}`}
                className="block bg-white p-4 sm:p-5 rounded-2xl border border-brand-muted hover:border-brand-fabric/60 transition shadow-subtle hover:shadow-md active:scale-[0.99] group"
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 sm:gap-4">
                  {/* Left Column: Identifiers & Customer */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-sm text-brand-charcoal font-mono group-hover:text-brand-fabric transition-colors">
                        {sale.invoiceNumber}
                      </span>
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
                        <span>{new Date(sale.invoiceDate).toLocaleString()}</span>
                      </span>
                    </div>

                    <p className="text-sm font-bold text-brand-charcoal mt-1.5 truncate">
                      {sale.customer?.name}
                      {sale.customer?.phone && (
                        <span className="text-xs font-normal text-gray-500 ml-2">
                          ({sale.customer.phone})
                        </span>
                      )}
                    </p>

                    {/* Product & Lot details */}
                    <div className="mt-1.5 text-xs text-gray-600 space-y-0.5">
                      <p className="truncate">
                        <strong className="text-gray-800">{firstItem?.product?.name || 'Fabric Roll'}</strong>
                        {firstItem?.lot?.lotNumber && (
                          <span className="ml-2 px-1.5 py-0.5 rounded bg-brand-light text-brand-fabric font-mono text-[10px] font-bold">
                            Lot #{firstItem.lot.lotNumber}
                          </span>
                        )}
                        {itemsCount > 1 && (
                          <span className="ml-1 text-[11px] text-gray-500 font-medium">
                            +{itemsCount - 1} more items
                          </span>
                        )}
                      </p>
                      <p className="text-[11px] text-gray-500">
                        Quantity: <span className="font-semibold text-gray-700">{formatWeight(totalGrams)}</span>
                        {firstItem?.ratePerKg && (
                          <span> • Rate: <span className="font-semibold text-gray-700">Rs. {firstItem.ratePerKg}/KG</span></span>
                        )}
                      </p>
                    </div>
                  </div>

                  {/* Right Column: Financial Figures */}
                  <div className="text-left sm:text-right shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-gray-100 flex sm:flex-col justify-between sm:justify-start items-center sm:items-end">
                    <div>
                      <span className="text-[10px] text-gray-400 uppercase font-semibold block sm:inline mr-1">
                        Total Amount:
                      </span>
                      <span className="text-base sm:text-lg font-extrabold text-brand-charcoal">
                        {formatPKR(sale.grandTotal)}
                      </span>
                    </div>

                    <div className="text-right text-xs mt-1 space-y-0.5">
                      <p className="text-emerald-700 font-semibold">
                        Received: {formatPKR(sale.paidAmount || 0)}
                      </p>
                      {sale.balanceAmount > 0 ? (
                        <p className="text-red-600 font-bold">
                          Remaining: {formatPKR(sale.balanceAmount)}
                        </p>
                      ) : (
                        <p className="text-emerald-700 text-[11px] font-bold">✓ Fully Settled</p>
                      )}
                    </div>
                  </div>
                </div>

                <div className="mt-3 pt-2.5 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
                  <span>
                    Click to view full invoice & all payment transactions
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setEditingSale(sale);
                      }}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-brand-fabric hover:bg-brand-light transition"
                      title="Edit Sale"
                    >
                      <Edit className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setDeletingSale(sale);
                      }}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition"
                      title="Delete Sale"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                    <div className="flex items-center gap-1 text-brand-fabric font-semibold text-xs group-hover:translate-x-1 transition-transform ml-1">
                      <span>Details</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {/* Edit Sale Modal */}
      {editingSale && (
        <EditSaleModal
          isOpen={!!editingSale}
          onClose={() => setEditingSale(null)}
          sale={editingSale}
          onSuccess={() => {
            queryClient.invalidateQueries();
          }}
        />
      )}

      {/* Delete Sale Confirmation Modal */}
      {deletingSale && (
        <ConfirmDeleteModal
          isOpen={!!deletingSale}
          onClose={() => setDeletingSale(null)}
          onConfirm={handleDeleteSale}
          title="Delete Sales Invoice"
          description="Are you sure you want to permanently delete this sales invoice? This action will reverse inventory deductions and restore customer Khata balance."
          itemIdentifier={`${deletingSale.invoiceNumber} (${deletingSale.customer?.name})`}
          consequences={[
            `Removes sales invoice ${deletingSale.invoiceNumber}.`,
            'Restores inventory quantities to the respective purchase lots.',
            `Credits customer balance by ${formatPKR(deletingSale.grandTotal)} (removes invoice debit).`,
            'Protected: If any customer payments or sales returns are linked to this invoice, deletion will be blocked.',
          ]}
          confirmButtonText="Delete Invoice"
        />
      )}
    </div>
  );
}
