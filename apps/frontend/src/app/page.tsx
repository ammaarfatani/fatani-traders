'use client';

import React from 'react';
import Link from 'next/link';
import { BrandLogo } from '@/components/brand/BrandLogo';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { formatPKR, formatWeight } from '@fatani/shared';
import {
  TrendingUp,
  Package,
  Users,
  Building2,
  DollarSign,
  Plus,
  Receipt,
  ShoppingCart,
  ArrowDownLeft,
  ArrowUpRight,
  ArrowRight,
  Scale,
  Calendar,
  CheckCircle,
  Clock,
  ChevronRight,
  Banknote,
} from 'lucide-react';

export default function DashboardPage() {
  const { data: dashboard, isLoading, error } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => api.get<any>('/reports/dashboard'),
  });

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
          <BrandLogo size="large" />
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 border-2 border-brand-fabric border-t-transparent rounded-full animate-spin" />
          <p className="text-xs font-semibold uppercase tracking-wider text-brand-charcoal">
            Loading Real-Time Business Data...
          </p>
        </div>
      </div>
    );
  }

  if (error || !dashboard) {
    return (
      <div className="p-6 bg-red-50 border border-red-200 rounded-2xl text-red-700 text-sm">
        Failed to load dashboard data. Please verify the backend connection.
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Top Welcome & Quick Actions Header */}
      <div className="bg-white p-5 sm:p-6 rounded-2xl border border-brand-muted shadow-subtle flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3 sm:gap-4">
          <BrandLogo size="large" />
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-extrabold text-brand-charcoal tracking-tight font-sans">
                Fatani Traders
              </h1>
              <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-brand-light text-brand-fabric border border-brand-muted">
                Wholesale Textile ERP
              </span>
            </div>
            <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
              Fabric Purchases, Sales Billing, Payments & Digikhata History
            </p>
          </div>
        </div>

        {/* Quick Action Buttons */}
        <div className="grid w-full grid-cols-2 gap-2 lg:flex lg:w-auto lg:items-center lg:gap-2 lg:pb-0">
          <Link
            href="/sales/new"
            className="flex min-w-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl bg-brand-deep px-2 py-2.5 text-xs font-semibold text-white shadow-sm transition hover:bg-brand-fabric active:scale-95 sm:px-3 sm:text-sm md:px-4"
          >
            <Receipt className="w-4 h-4" />
            <span>+ New Sale</span>
          </Link>

          <Link
            href="/purchases/new"
            className="flex min-w-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl bg-brand-fabric px-2 py-2.5 text-xs font-semibold text-white shadow-sm transition hover:bg-brand-accent active:scale-95 sm:px-3 sm:text-sm md:px-4"
          >
            <ShoppingCart className="w-4 h-4" />
            <span>+ New Purchase</span>
          </Link>

          <Link
            href="/payments"
            className="col-span-2 flex min-w-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-xl border border-brand-muted bg-brand-light px-3 py-2.5 text-xs font-semibold text-brand-charcoal transition hover:bg-brand-muted sm:text-sm lg:col-span-1 lg:px-3.5"
          >
            <Banknote className="w-4 h-4 text-emerald-700" />
            <span>Payments</span>
          </Link>
        </div>
      </div>

      {/* 4 Main Summary Cards (Clickable to open relevant detailed history) */}
      <div>
        <div className="flex items-center justify-between mb-3 px-1">
          <h2 className="text-sm font-bold uppercase tracking-wider text-gray-500">
            Business Summary
          </h2>
          <span className="text-xs text-gray-400">Click any card to view complete history</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
          {/* 1. Total Purchases */}
          <Link
            href="/purchases"
            className="group block bg-white p-5 rounded-2xl border border-brand-muted shadow-subtle hover:border-brand-fabric hover:shadow-md transition-all active:scale-[0.99]"
          >
            <div className="flex items-center justify-between text-gray-500 mb-2.5">
              <span className="text-xs font-bold uppercase tracking-wider text-gray-500 group-hover:text-brand-fabric transition-colors">
                Total Purchases
              </span>
              <div className="w-9 h-9 rounded-xl bg-brand-light text-brand-fabric flex items-center justify-center group-hover:bg-brand-deep group-hover:text-white transition-colors">
                <ShoppingCart className="w-4 h-4" />
              </div>
            </div>
            <p className="text-2xl sm:text-3xl font-extrabold text-brand-charcoal tracking-tight">
              {formatPKR(dashboard.totalPurchases || 0)}
            </p>
            <div className="mt-3 pt-2.5 border-t border-gray-100 flex items-center justify-between text-xs text-brand-fabric font-medium">
              <span>View purchase history</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
            </div>
          </Link>

          {/* 2. Total Sales */}
          <Link
            href="/sales"
            className="group block bg-white p-5 rounded-2xl border border-brand-muted shadow-subtle hover:border-brand-fabric hover:shadow-md transition-all active:scale-[0.99]"
          >
            <div className="flex items-center justify-between text-gray-500 mb-2.5">
              <span className="text-xs font-bold uppercase tracking-wider text-gray-500 group-hover:text-brand-fabric transition-colors">
                Total Sales
              </span>
              <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center group-hover:bg-emerald-700 group-hover:text-white transition-colors">
                <Receipt className="w-4 h-4" />
              </div>
            </div>
            <p className="text-2xl sm:text-3xl font-extrabold text-brand-charcoal tracking-tight">
              {formatPKR(dashboard.totalSales || 0)}
            </p>
            <div className="mt-3 pt-2.5 border-t border-gray-100 flex items-center justify-between text-xs text-brand-fabric font-medium">
              <span>View sales history</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
            </div>
          </Link>

          {/* 3. Total Payments Received */}
          <Link
            href="/payments?tab=received"
            className="group block bg-white p-5 rounded-2xl border border-brand-muted shadow-subtle hover:border-emerald-500 hover:shadow-md transition-all active:scale-[0.99]"
          >
            <div className="flex items-center justify-between text-gray-500 mb-2.5">
              <span className="text-xs font-bold uppercase tracking-wider text-emerald-800 group-hover:text-emerald-700 transition-colors">
                Payments Received
              </span>
              <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center group-hover:bg-emerald-700 group-hover:text-white transition-colors">
                <ArrowDownLeft className="w-4 h-4" />
              </div>
            </div>
            <p className="text-2xl sm:text-3xl font-extrabold text-emerald-700 tracking-tight">
              {formatPKR(dashboard.totalPaymentsReceived || 0)}
            </p>
            <div className="mt-3 pt-2.5 border-t border-gray-100 flex items-center justify-between text-xs text-emerald-800 font-medium">
              <span>Customer receipts</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
            </div>
          </Link>

          {/* 4. Total Payments Paid */}
          <Link
            href="/payments?tab=paid"
            className="group block bg-white p-5 rounded-2xl border border-brand-muted shadow-subtle hover:border-amber-500 hover:shadow-md transition-all active:scale-[0.99]"
          >
            <div className="flex items-center justify-between text-gray-500 mb-2.5">
              <span className="text-xs font-bold uppercase tracking-wider text-amber-800 group-hover:text-amber-700 transition-colors">
                Payments Paid
              </span>
              <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center group-hover:bg-amber-700 group-hover:text-white transition-colors">
                <ArrowUpRight className="w-4 h-4" />
              </div>
            </div>
            <p className="text-2xl sm:text-3xl font-extrabold text-amber-700 tracking-tight">
              {formatPKR(dashboard.totalPaymentsPaid || 0)}
            </p>
            <div className="mt-3 pt-2.5 border-t border-gray-100 flex items-center justify-between text-xs text-amber-800 font-medium">
              <span>Supplier payouts</span>
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
            </div>
          </Link>
        </div>
      </div>

      {/* Secondary Indicators: Market Balances & Stock */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 sm:gap-4">
        {/* Customer Receivables */}
        <Link
          href="/customers"
          className="bg-white p-4 sm:p-5 rounded-2xl border border-brand-muted shadow-subtle hover:border-red-300 transition block group"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-gray-500">
              Customer Khata (Receivables)
            </span>
            <div className="w-8 h-8 rounded-lg bg-red-50 text-red-600 flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <p className="text-xl sm:text-2xl font-extrabold text-red-600">
            {formatPKR(dashboard.totalReceivables || 0)}
          </p>
          <p className="text-xs text-gray-500 mt-1 flex items-center justify-between">
            <span>Outstanding market balances</span>
            <span className="text-brand-fabric font-semibold group-hover:underline">View Khata →</span>
          </p>
        </Link>

        {/* Supplier Payables */}
        <Link
          href="/suppliers"
          className="bg-white p-4 sm:p-5 rounded-2xl border border-brand-muted shadow-subtle hover:border-amber-300 transition block group"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-gray-500">
              Supplier Khata (Payables)
            </span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <Building2 className="w-4 h-4" />
            </div>
          </div>
          <p className="text-xl sm:text-2xl font-extrabold text-amber-600">
            {formatPKR(dashboard.totalSupplierPayables || 0)}
          </p>
          <p className="text-xs text-gray-500 mt-1 flex items-center justify-between">
            <span>Mill & wholesale balances</span>
            <span className="text-brand-fabric font-semibold group-hover:underline">View Suppliers →</span>
          </p>
        </Link>

        {/* Stock Inventory */}
        <Link
          href="/inventory"
          className="bg-white p-4 sm:p-5 rounded-2xl border border-brand-muted shadow-subtle hover:border-brand-fabric/50 transition block group"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold uppercase tracking-wider text-gray-500">
              Fabric Inventory Available
            </span>
            <div className="w-8 h-8 rounded-lg bg-brand-light text-brand-fabric flex items-center justify-center">
              <Package className="w-4 h-4" />
            </div>
          </div>
          <p className="text-xl sm:text-2xl font-extrabold text-brand-charcoal">
            {Number(dashboard.totalAvailableStockKg || 0).toLocaleString()} KG
          </p>
          <p className="text-xs text-gray-500 mt-1 flex items-center justify-between">
            <span>Valuation: {formatPKR(dashboard.totalInventoryValuation || 0)}</span>
            <span className="text-brand-fabric font-semibold group-hover:underline">View Stock →</span>
          </p>
        </Link>
      </div>

      {/* 4 Recent Activity Sections (Recent Sales, Purchases, Payments Received, Payments Paid) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* 1. Recent Sales */}
        <div className="bg-white p-5 sm:p-6 rounded-2xl border border-brand-muted shadow-subtle flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3.5 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <Receipt className="w-4 h-4 text-brand-fabric" />
                <h3 className="font-bold text-sm text-brand-charcoal">Recent Sales</h3>
              </div>
              <Link
                href="/sales"
                className="text-xs font-semibold text-brand-fabric hover:text-brand-accent flex items-center gap-1"
              >
                <span>All Sales</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            <div className="divide-y divide-gray-100 mt-1">
              {!dashboard.recentSales || dashboard.recentSales.length === 0 ? (
                <p className="text-xs text-gray-400 py-6 text-center">No sales recorded yet.</p>
              ) : (
                dashboard.recentSales.map((sale: any) => (
                  <Link
                    key={sale.id}
                    href={`/sales/${sale.id}`}
                    className="py-3 flex items-center justify-between gap-3 hover:bg-brand-light/40 px-1 rounded-xl transition block"
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-brand-charcoal truncate">
                        {sale.customer?.name}
                      </p>
                      <p className="text-[11px] text-gray-500 mt-0.5">
                        <span className="font-mono text-gray-600">{sale.invoiceNumber}</span> •{' '}
                        {new Date(sale.invoiceDate).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs font-bold text-brand-charcoal">
                        {formatPKR(sale.grandTotal)}
                      </p>
                      <span
                        className={`inline-block text-[10px] px-1.5 py-0.2 rounded font-medium mt-0.5 ${
                          sale.status === 'COMPLETED'
                            ? 'text-emerald-700 bg-emerald-50'
                            : sale.status === 'PARTIAL'
                            ? 'text-amber-700 bg-amber-50'
                            : 'text-red-700 bg-red-50'
                        }`}
                      >
                        {sale.status}
                      </span>
                    </div>
                  </Link>
                ))
              )}
            </div>
          </div>
        </div>

        {/* 2. Recent Purchases */}
        <div className="bg-white p-5 sm:p-6 rounded-2xl border border-brand-muted shadow-subtle flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3.5 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <ShoppingCart className="w-4 h-4 text-brand-fabric" />
                <h3 className="font-bold text-sm text-brand-charcoal">Recent Purchases</h3>
              </div>
              <Link
                href="/purchases"
                className="text-xs font-semibold text-brand-fabric hover:text-brand-accent flex items-center gap-1"
              >
                <span>All Purchases</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            <div className="divide-y divide-gray-100 mt-1">
              {!dashboard.recentPurchases || dashboard.recentPurchases.length === 0 ? (
                <p className="text-xs text-gray-400 py-6 text-center">No purchases recorded yet.</p>
              ) : (
                dashboard.recentPurchases.map((pur: any) => (
                  <Link
                    key={pur.id}
                    href={`/purchases/${pur.id}`}
                    className="py-3 flex items-center justify-between gap-3 hover:bg-brand-light/40 px-1 rounded-xl transition block"
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-brand-charcoal truncate">
                        {pur.supplier?.name || 'Unknown Supplier'}
                      </p>
                      <p className="text-[11px] text-gray-500 mt-0.5">
                        <span className="font-mono text-gray-600">{pur.purchaseNumber}</span> •{' '}
                        {new Date(pur.purchaseDate).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-xs font-bold text-brand-charcoal">
                        {formatPKR(pur.totalLandedCost)}
                      </p>
                      <p className="text-[10px] text-gray-500 mt-0.5">
                        Paid: {formatPKR(pur.paidAmount)}
                      </p>
                    </div>
                  </Link>
                ))
              )}
            </div>
          </div>
        </div>

        {/* 3. Recent Payments Received */}
        <div className="bg-white p-5 sm:p-6 rounded-2xl border border-brand-muted shadow-subtle flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3.5 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <ArrowDownLeft className="w-4 h-4 text-emerald-700" />
                <h3 className="font-bold text-sm text-brand-charcoal">Recent Payments Received</h3>
              </div>
              <Link
                href="/payments?tab=received"
                className="text-xs font-semibold text-emerald-700 hover:text-emerald-800 flex items-center gap-1"
              >
                <span>View All</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            <div className="divide-y divide-gray-100 mt-1">
              {!dashboard.recentPaymentsReceived || dashboard.recentPaymentsReceived.length === 0 ? (
                <p className="text-xs text-gray-400 py-6 text-center">No customer payments recorded yet.</p>
              ) : (
                dashboard.recentPaymentsReceived.map((p: any) => {
                  const invRef = p.allocations?.[0]?.sale?.invoiceNumber || p.referenceNumber || 'Direct Payment';
                  return (
                    <div
                      key={p.id}
                      className="py-3 flex items-center justify-between gap-3 px-1 rounded-xl"
                    >
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-brand-charcoal truncate">
                          {p.customer?.name}
                        </p>
                        <p className="text-[11px] text-gray-500 mt-0.5">
                          Ref: <span className="font-mono text-gray-700">{invRef}</span> •{' '}
                          {new Date(p.paymentDate).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-xs font-extrabold text-emerald-700">
                          +{formatPKR(p.amount)}
                        </p>
                        <span className="text-[10px] text-gray-400 font-mono">{p.paymentNumber}</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* 4. Recent Payments Paid */}
        <div className="bg-white p-5 sm:p-6 rounded-2xl border border-brand-muted shadow-subtle flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3.5 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <ArrowUpRight className="w-4 h-4 text-amber-700" />
                <h3 className="font-bold text-sm text-brand-charcoal">Recent Payments Paid</h3>
              </div>
              <Link
                href="/payments?tab=paid"
                className="text-xs font-semibold text-amber-700 hover:text-amber-800 flex items-center gap-1"
              >
                <span>View All</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>

            <div className="divide-y divide-gray-100 mt-1">
              {!dashboard.recentPaymentsPaid || dashboard.recentPaymentsPaid.length === 0 ? (
                <p className="text-xs text-gray-400 py-6 text-center">No supplier payments recorded yet.</p>
              ) : (
                dashboard.recentPaymentsPaid.map((p: any) => {
                  const purRef = p.allocations?.[0]?.purchase?.purchaseNumber || p.referenceNumber || 'Direct Payment';
                  return (
                    <div
                      key={p.id}
                      className="py-3 flex items-center justify-between gap-3 px-1 rounded-xl"
                    >
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-brand-charcoal truncate">
                          {p.supplier?.name || 'Unknown Supplier'}
                        </p>
                        <p className="text-[11px] text-gray-500 mt-0.5">
                          Ref: <span className="font-mono text-gray-700">{purRef}</span> •{' '}
                          {new Date(p.paymentDate).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-xs font-extrabold text-amber-700">
                          -{formatPKR(p.amount)}
                        </p>
                        <span className="text-[10px] text-gray-400 font-mono">{p.paymentNumber}</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
