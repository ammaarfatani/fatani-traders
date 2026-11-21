'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useQuery, useQueryClient } from '@tanstack/react-query';
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
  Building2,
  Package,
  Edit,
  Trash2,
} from 'lucide-react';
import { ConfirmDeleteModal } from '@/components/ui/ConfirmDeleteModal';
import { EditPurchaseModal } from '@/components/purchases/EditPurchaseModal';

export default function PurchasesHistoryPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PAID' | 'PARTIAL' | 'UNPAID'>('ALL');
  const [supplierFilter, setSupplierFilter] = useState<string>('ALL'); // 'ALL' | 'UNKNOWN' | supplierId
  const [page, setPage] = useState(1);

  // Edit and Delete state
  const [editingPurchase, setEditingPurchase] = useState<any | null>(null);
  const [deletingPurchase, setDeletingPurchase] = useState<any | null>(null);

  const handleDeletePurchase = async () => {
    if (!deletingPurchase) return;
    await api.delete(`/purchases/${deletingPurchase.id}`);
    queryClient.invalidateQueries();
    setDeletingPurchase(null);
  };

  // Fetch suppliers for filter dropdown
  const { data: suppliersData } = useQuery({
    queryKey: ['suppliers-list'],
    queryFn: () => api.get<any>('/suppliers?limit=100'),
  });
  const suppliers = suppliersData?.data || suppliersData?.suppliers || [];
  const supplierOptions = suppliersData?.data || suppliersData?.suppliers || [];

  // Build query string
  const queryParams = new URLSearchParams({
    page: String(page),
    limit: '50',
  });
  if (search) queryParams.set('search', search);
  if (statusFilter !== 'ALL') queryParams.set('status', statusFilter);
  if (supplierFilter === 'UNKNOWN') {
    queryParams.set('unknownSupplier', 'true');
  } else if (supplierFilter !== 'ALL') {
    queryParams.set('supplierId', supplierFilter);
  }

  const { data, isLoading } = useQuery({
    queryKey: ['purchases', page, search, statusFilter, supplierFilter],
    queryFn: () => api.get<any>(`/purchases?${queryParams.toString()}`),
  });

  const purchasesList = data?.data || data?.purchases || [];
  const summary = data?.summary || {
    totalPurchases: purchasesList.reduce((sum: number, p: any) => sum + (p.totalLandedCost || 0), 0),
    totalPaid: purchasesList.reduce((sum: number, p: any) => sum + (p.paidAmount || 0), 0),
    totalBalance: purchasesList.reduce((sum: number, p: any) => sum + (p.balanceAmount || 0), 0),
    totalWeightKg: 0,
  };

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
              Fabric purchases, suppliers, landed costs & payment tracking
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
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        <div className="bg-brand-deep text-white p-4 rounded-2xl shadow-subtle">
          <span className="text-[11px] font-bold uppercase tracking-wider text-brand-light/90 block mb-1">
            Total Purchases
          </span>
          <p className="text-xl sm:text-2xl font-extrabold text-white">
            {formatPKR(summary.totalPurchases || 0)}
          </p>
          <p className="text-[11px] text-brand-light/70 mt-1">Total landed inventory cost</p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-brand-muted shadow-subtle">
          <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700 block mb-1">
            Total Paid
          </span>
          <p className="text-xl sm:text-2xl font-extrabold text-emerald-700">
            {formatPKR(summary.totalPaid || 0)}
          </p>
          <p className="text-[11px] text-gray-500 mt-1">Payments made for purchases</p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-brand-muted shadow-subtle">
          <span className="text-[11px] font-bold uppercase tracking-wider text-amber-700 block mb-1">
            Remaining Payable
          </span>
          <p className="text-xl sm:text-2xl font-extrabold text-amber-700">
            {formatPKR(summary.totalBalance || 0)}
          </p>
          <p className="text-[11px] text-gray-500 mt-1">Outstanding purchase balance</p>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-brand-muted shadow-subtle">
          <span className="text-[11px] font-bold uppercase tracking-wider text-brand-charcoal block mb-1">
            Total Weight
          </span>
          <p className="text-xl sm:text-2xl font-extrabold text-brand-charcoal">
            {((summary.totalWeightKg || 0)).toLocaleString('en-US', {
              minimumFractionDigits: 0,
              maximumFractionDigits: 3,
            })}{' '}
            KG
          </p>
          <p className="text-[11px] text-gray-500 mt-1">Total fabric purchased</p>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white p-3 sm:p-4 rounded-2xl border border-brand-muted shadow-subtle space-y-3">
        <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search by purchase #, supplier, fabric name, lot #..."
              className="w-full pl-10 pr-4 py-2 bg-brand-light/50 border border-brand-muted rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-brand-fabric text-brand-charcoal"
            />
          </div>

          {/* Supplier Filter Dropdown */}
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-gray-400 shrink-0" />
            <select
              value={supplierFilter}
              onChange={(e) => {
                setSupplierFilter(e.target.value);
                setPage(1);
              }}
              className="px-3 py-2 bg-brand-light/50 border border-brand-muted rounded-xl text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-brand-fabric text-brand-charcoal font-medium"
            >
              <option value="ALL">All Suppliers & Unknown</option>
              <option value="UNKNOWN">Unknown Supplier Only</option>
              {suppliers.map((s: any) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Status Filter Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 pt-1 border-t border-gray-100">
          {(['ALL', 'PAID', 'PARTIAL', 'UNPAID'] as const).map((st) => (
            <button
              key={st}
              onClick={() => {
                setStatusFilter(st);
                setPage(1);
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition ${
                statusFilter === st
                  ? 'bg-brand-deep text-white shadow-sm'
                  : 'bg-brand-light text-gray-600 hover:bg-brand-muted/70'
              }`}
            >
              {st === 'ALL'
                ? 'All Statuses'
                : st === 'PAID'
                ? 'Fully Paid'
                : st === 'PARTIAL'
                ? 'Partially Paid'
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
      ) : purchasesList.length === 0 ? (
        <div className="bg-white p-12 rounded-2xl border border-brand-muted text-center space-y-3">
          <p className="text-sm font-semibold text-gray-600">No purchase records found.</p>
          <p className="text-xs text-gray-400">
            {search || supplierFilter !== 'ALL' || statusFilter !== 'ALL'
              ? 'Try adjusting your search query or filter options.'
              : 'Record your first purchase batch to start tracking inventory.'}
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
          {purchasesList.map((pur: any) => {
            const lot = pur.lots?.[0];
            const isFullyPaid = pur.balanceAmount === 0 || (pur.paidAmount >= pur.totalLandedCost && pur.totalLandedCost > 0);
            const isPartial = pur.paidAmount > 0 && pur.balanceAmount > 0;
            const fabricName = lot?.product?.name || 'Fabric Lot';
            const supplierName = pur.supplier?.name || 'Unknown Supplier';

            return (
              <Link
                key={pur.id}
                href={`/purchases/${pur.id}`}
                className="block bg-white p-4 sm:p-5 rounded-2xl border border-brand-muted hover:border-brand-fabric/60 transition shadow-subtle hover:shadow-md active:scale-[0.99] group"
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 sm:gap-4">
                  {/* Left Column: Identifiers, Supplier, Fabric */}
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
                        {isFullyPaid ? 'Paid' : isPartial ? 'Partially Paid' : 'Unpaid'}
                      </span>
                      <span className="text-[11px] text-gray-400 flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        <span>{new Date(pur.purchaseDate).toLocaleDateString()}</span>
                      </span>
                    </div>

                    {/* Fabric Name & Supplier */}
                    <div className="mt-2 flex items-center gap-3 flex-wrap">
                      <span className="text-sm font-bold text-brand-charcoal">
                        {fabricName}
                      </span>
                      <span className="text-xs text-gray-500 font-medium bg-gray-100 px-2 py-0.5 rounded-md">
                        {supplierName}
                      </span>
                      {pur.invoiceRefNumber && (
                        <span className="text-xs text-gray-400 font-normal">
                          (Ref: {pur.invoiceRefNumber})
                        </span>
                      )}
                    </div>

                    {/* Quantity & Rate details */}
                    <div className="mt-1.5 text-xs text-gray-600 space-y-0.5">
                      <p>
                        {lot?.purchasedGrams && (
                          <span className="mr-3">
                            Weight: <strong className="text-brand-charcoal font-mono">{formatWeight(lot.purchasedGrams)}</strong>
                          </span>
                        )}
                        {lot?.purchaseRatePerKg && (
                          <span>
                            Rate: <strong className="text-brand-charcoal font-mono">Rs. {lot.purchaseRatePerKg.toLocaleString()}/KG</strong>
                          </span>
                        )}
                      </p>
                    </div>
                  </div>

                  {/* Right Column: Financial Figures */}
                  <div className="text-left sm:text-right shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-gray-100 flex sm:flex-col justify-between sm:justify-start items-center sm:items-end">
                    <div>
                      <span className="text-[10px] text-gray-400 uppercase font-semibold block sm:inline mr-1">
                        Total Landed Cost:
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
                      <span className="ml-2">
                        + Additional Expenses: <strong className="text-brand-fabric">{formatPKR(pur.totalExpenses)}</strong>
                      </span>
                    )}
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setEditingPurchase(pur);
                      }}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-brand-fabric hover:bg-brand-light transition"
                      title="Edit Purchase"
                    >
                      <Edit className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setDeletingPurchase(pur);
                      }}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition"
                      title="Delete Purchase"
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

      {/* Edit Purchase Modal */}
      {editingPurchase && (
        <EditPurchaseModal
          isOpen={!!editingPurchase}
          onClose={() => setEditingPurchase(null)}
          purchase={editingPurchase}
          suppliers={supplierOptions}
          onSuccess={() => {
            queryClient.invalidateQueries();
          }}
        />
      )}

      {/* Delete Purchase Confirmation Modal */}
      {deletingPurchase && (
        <ConfirmDeleteModal
          isOpen={!!deletingPurchase}
          onClose={() => setDeletingPurchase(null)}
          onConfirm={handleDeletePurchase}
          title="Delete Purchase"
          description="Confirm deletion of this purchase and its lot records. Purchase-only payments will be voided and reversed; shared payments will remain active but be detached from this purchase."
          itemIdentifier={`${deletingPurchase.purchaseNumber} (${deletingPurchase.lots?.[0]?.product?.name || 'Fabric'})`}
          consequences={[
            `Removes purchase record ${deletingPurchase.purchaseNumber}.`,
            'Restores inventory stock for the lot.',
            `Reverses supplier payable balance of ${formatPKR(deletingPurchase.totalLandedCost)}.`,
            'Fully purchase-only payments are voided, their account/supplier balances are reversed, and payment/ledger audit history is retained.',
            'Payments shared with other purchases remain active; only their allocation to this purchase is detached. Deletion is blocked if sales, returns, or payment/account ledger mismatches are found.',
          ]}
          confirmButtonText="Delete Purchase"
        />
      )}
    </div>
  );
}
