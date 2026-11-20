'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { formatPKR } from '@fatani/shared';
import {
  TrendingUp,
  Package,
  Users,
  Building2,
  DollarSign,
  Plus,
  Receipt,
  ShoppingCart,
  Landmark,
  AlertTriangle,
  ArrowRight,
  Scale,
  Sparkles,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
} from 'recharts';

export default function DashboardPage() {
  const { data: dashboard, isLoading, error } = useQuery({
    queryKey: ['dashboard'],
    queryFn: () => api.get<any>('/reports/dashboard'),
  });

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="w-14 h-14 shrink-0 flex items-center justify-center">
          <Image
            src="/logo.png"
            alt="Fatani Fabrics Logo"
            width={48}
            height={48}
            className="w-full h-full object-contain animate-pulse"
          />
        </div>
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
    <div className="space-y-6">
      {/* Top Welcome & Quick Actions Header */}
      <div className="bg-white p-5 sm:p-6 rounded-2xl border border-brand-muted shadow-subtle flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 shrink-0 flex items-center justify-center">
            <Image
              src="/logo.png"
              alt="Fatani Fabrics Logo"
              width={52}
              height={52}
              className="w-full h-full object-contain"
            />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl sm:text-2xl font-extrabold text-brand-charcoal tracking-tight">
                Fatani Traders
              </h1>
              <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-brand-light text-brand-fabric border border-brand-muted">
                Live ERP
              </span>
            </div>
            <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
              Wholesale Textile Trading, Landed Cost & DigiKhata Ledgers
            </p>
          </div>
        </div>

        {/* Quick Action Buttons */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 md:pb-0">
          <Link
            href="/sales/new"
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-brand-deep hover:bg-brand-fabric text-white font-semibold text-xs sm:text-sm shadow-sm active:scale-95 transition shrink-0"
          >
            <Receipt className="w-4 h-4" />
            <span>+ New Sale</span>
          </Link>

          <Link
            href="/purchases/new"
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-brand-fabric hover:bg-brand-accent text-white font-semibold text-xs sm:text-sm shadow-sm active:scale-95 transition shrink-0"
          >
            <ShoppingCart className="w-4 h-4" />
            <span>+ Purchase Lot</span>
          </Link>

          <Link
            href="/expenses"
            className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-brand-light hover:bg-brand-muted text-brand-charcoal font-semibold text-xs sm:text-sm transition shrink-0 border border-brand-muted"
          >
            <Plus className="w-4 h-4" />
            <span>Expense</span>
          </Link>
        </div>
      </div>

      {/* Primary KPI Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Today's Sales */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-brand-muted shadow-subtle hover:border-brand-fabric/40 transition-colors">
          <div className="flex items-center justify-between text-gray-500 mb-2">
            <span className="text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-gray-500">
              Today's Sales
            </span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <p className="text-lg sm:text-2xl font-extrabold text-brand-charcoal">
            {formatPKR(dashboard.todaySales)}
          </p>
          <p className="text-[11px] font-medium text-emerald-700 mt-1.5 flex items-center gap-1">
            <Scale className="w-3.5 h-3.5" />
            <span>{dashboard.todaySalesKg.toLocaleString()} KG Sold Today</span>
          </p>
        </div>

        {/* Customer Receivables */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-brand-muted shadow-subtle hover:border-red-300 transition-colors">
          <div className="flex items-center justify-between text-gray-500 mb-2">
            <span className="text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-gray-500">
              Customer Khata
            </span>
            <div className="w-8 h-8 rounded-lg bg-red-50 text-red-600 flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <p className="text-lg sm:text-2xl font-extrabold text-red-600">
            {formatPKR(dashboard.totalReceivables)}
          </p>
          <p className="text-[11px] text-gray-500 mt-1.5">Total Market Receivables</p>
        </div>

        {/* Supplier Payables */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-brand-muted shadow-subtle hover:border-amber-300 transition-colors">
          <div className="flex items-center justify-between text-gray-500 mb-2">
            <span className="text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-gray-500">
              Supplier Payables
            </span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <Building2 className="w-4 h-4" />
            </div>
          </div>
          <p className="text-lg sm:text-2xl font-extrabold text-amber-600">
            {formatPKR(dashboard.totalSupplierPayables)}
          </p>
          <p className="text-[11px] text-gray-500 mt-1.5">Mill & Wholesaler Debt</p>
        </div>

        {/* Total Available Inventory */}
        <div className="bg-white p-4 sm:p-5 rounded-2xl border border-brand-muted shadow-subtle hover:border-brand-fabric/40 transition-colors">
          <div className="flex items-center justify-between text-gray-500 mb-2">
            <span className="text-[11px] sm:text-xs font-semibold uppercase tracking-wider text-gray-500">
              Stock Valuation
            </span>
            <div className="w-8 h-8 rounded-lg bg-brand-light text-brand-fabric flex items-center justify-center">
              <Package className="w-4 h-4" />
            </div>
          </div>
          <p className="text-lg sm:text-2xl font-extrabold text-brand-charcoal">
            {formatPKR(dashboard.totalInventoryValuation)}
          </p>
          <p className="text-[11px] font-medium text-brand-fabric mt-1.5">
            {dashboard.totalAvailableStockKg.toLocaleString()} KG Available
          </p>
        </div>
      </div>

      {/* Secondary Financial Indicators: Liquid Funds & Monthly Accrual Profit */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4">
        {/* Cash & Bank Balances (Teal Card) */}
        <div className="bg-brand-deep text-white p-5 sm:p-6 rounded-2xl shadow-subtle relative overflow-hidden border border-brand-dark/30">
          <div className="relative z-10">
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-brand-light/90">
                Total Liquid Funds
              </span>
              <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center">
                <Landmark className="w-4 h-4 text-white" />
              </div>
            </div>
            <p className="text-2xl sm:text-3xl font-extrabold text-white">
              {formatPKR(dashboard.totalCashAndBankBalance)}
            </p>
            <div className="mt-4 pt-3 border-t border-white/10 space-y-1.5 text-xs text-gray-200">
              {dashboard.accounts?.slice(0, 3).map((acc: any) => (
                <div key={acc.id} className="flex justify-between items-center">
                  <span className="truncate">{acc.name}</span>
                  <span className="font-semibold text-emerald-300">{formatPKR(acc.currentBalance)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Month Gross Profit */}
        <div className="bg-white p-5 sm:p-6 rounded-2xl border border-brand-muted shadow-subtle flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-gray-500 mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                This Month Gross Profit
              </span>
              <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center">
                <DollarSign className="w-4 h-4" />
              </div>
            </div>
            <p className="text-2xl sm:text-3xl font-extrabold text-emerald-700">
              {formatPKR(dashboard.monthGrossProfit)}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              Sales Revenue minus Actual Lot Landed COGS
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-gray-100 flex justify-between text-xs text-gray-500">
            <span>Operating Expenses:</span>
            <span className="font-semibold text-red-600">
              {formatPKR(dashboard.monthOperatingExpenses)}
            </span>
          </div>
        </div>

        {/* Month Net Profit */}
        <div className="bg-white p-5 sm:p-6 rounded-2xl border border-brand-muted shadow-subtle flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-gray-500 mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                This Month Net Profit
              </span>
              <div className="w-8 h-8 rounded-lg bg-brand-light text-brand-fabric flex items-center justify-center">
                <TrendingUp className="w-4 h-4" />
              </div>
            </div>
            <p
              className={`text-2xl sm:text-3xl font-extrabold ${
                dashboard.monthNetProfit >= 0 ? 'text-brand-fabric' : 'text-red-600'
              }`}
            >
              {formatPKR(dashboard.monthNetProfit)}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              Accrual basis (Gross Profit − Overhead)
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-gray-100 flex justify-between text-xs text-gray-500">
            <span>Today's Cash Recovered:</span>
            <span className="font-semibold text-emerald-700">
              {formatPKR(dashboard.todayPaymentsReceived)}
            </span>
          </div>
        </div>
      </div>

      {/* Monthly Trends Chart */}
      {dashboard.monthlyTrends && dashboard.monthlyTrends.length > 0 && (
        <div className="bg-white p-5 sm:p-6 rounded-2xl border border-brand-muted shadow-subtle">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-bold text-brand-charcoal">Revenue & Profit Trends</h2>
              <p className="text-xs text-gray-500">Monthly Sales Revenue vs. Cost of Goods Sold & Gross Margin</p>
            </div>
          </div>
          <div className="h-64 sm:h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dashboard.monthlyTrends} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: '#64748b' }} />
                <YAxis tick={{ fontSize: 11, fill: '#64748b' }} tickFormatter={(val) => `${val / 1000}k`} />
                <Tooltip
                  formatter={(value: any) => formatPKR(value)}
                  contentStyle={{
                    backgroundColor: '#172F35',
                    borderColor: '#28616C',
                    borderRadius: '12px',
                    color: '#fff',
                    fontSize: '12px',
                  }}
                />
                <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '10px' }} />
                <Bar dataKey="sales" name="Sales Revenue" fill="#28616C" radius={[4, 4, 0, 0]} />
                <Bar dataKey="cogs" name="Landed COGS" fill="#94A3B8" radius={[4, 4, 0, 0]} />
                <Bar dataKey="grossProfit" name="Gross Profit" fill="#1E7E55" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Alerts & Critical Action Lists Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Overdue / High Customer Receivables */}
        <div className="bg-white p-5 sm:p-6 rounded-2xl border border-brand-muted shadow-subtle">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-red-500" />
              <h3 className="font-bold text-sm text-brand-charcoal">High Outstanding Customers</h3>
            </div>
            <Link
              href="/customers"
              className="text-xs font-semibold text-brand-fabric hover:text-brand-accent flex items-center gap-1"
            >
              <span>View All</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="divide-y divide-gray-100">
            {dashboard.overdueCustomers?.length === 0 ? (
              <p className="text-xs text-gray-400 py-4 text-center">No overdue customers.</p>
            ) : (
              dashboard.overdueCustomers?.map((c: any) => (
                <Link
                  key={c.id}
                  href={`/customers/${c.id}`}
                  className="py-3 flex items-center justify-between hover:bg-brand-light/50 rounded-xl px-2 transition"
                >
                  <div>
                    <p className="text-sm font-semibold text-brand-charcoal">{c.name}</p>
                    <p className="text-xs text-gray-400">{c.shopName || c.phone}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-red-600">{formatPKR(c.currentBalance)}</p>
                    <p className="text-[10px] text-gray-400">Khata Balance</p>
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>

        {/* Low Stock Lots */}
        <div className="bg-white p-5 sm:p-6 rounded-2xl border border-brand-muted shadow-subtle">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              <h3 className="font-bold text-sm text-brand-charcoal">Low Stock Lots (&lt; 50 KG)</h3>
            </div>
            <Link
              href="/inventory"
              className="text-xs font-semibold text-brand-fabric hover:text-brand-accent flex items-center gap-1"
            >
              <span>Inventory</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="divide-y divide-gray-100">
            {dashboard.lowStockLots?.length === 0 ? (
              <p className="text-xs text-gray-400 py-4 text-center">All active lots have healthy stock levels.</p>
            ) : (
              dashboard.lowStockLots?.map((l: any) => (
                <Link
                  key={l.id}
                  href={`/inventory/lots/${l.id}`}
                  className="py-3 flex items-center justify-between hover:bg-brand-light/50 rounded-xl px-2 transition"
                >
                  <div>
                    <p className="text-sm font-semibold text-brand-charcoal">{l.lotNumber}</p>
                    <p className="text-xs text-gray-500">{l.product?.name}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-amber-600">{l.availableKg.toFixed(3)} KG</p>
                    <p className="text-[10px] text-gray-400">Remaining</p>
                  </div>
                </Link>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Recent Transactions Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Recent Sales Invoices */}
        <div className="bg-white p-5 sm:p-6 rounded-2xl border border-brand-muted shadow-subtle">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-sm text-brand-charcoal">Recent Sales Invoices</h3>
            <Link
              href="/sales"
              className="text-xs font-semibold text-brand-fabric hover:text-brand-accent flex items-center gap-1"
            >
              <span>All Sales</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="divide-y divide-gray-100">
            {dashboard.recentSales?.map((s: any) => (
              <Link
                key={s.id}
                href={`/sales/${s.id}`}
                className="py-3 flex items-center justify-between hover:bg-brand-light/50 rounded-xl px-2 transition"
              >
                <div>
                  <p className="text-sm font-semibold text-brand-charcoal">{s.customer?.name}</p>
                  <p className="text-xs text-gray-400">
                    {s.invoiceNumber} • {new Date(s.invoiceDate).toLocaleDateString()}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-brand-charcoal">{formatPKR(s.grandTotal)}</p>
                  <span
                    className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                      s.status === 'COMPLETED'
                        ? 'bg-emerald-50 text-emerald-700'
                        : 'bg-amber-50 text-amber-700'
                    }`}
                  >
                    {s.status}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Recent Purchases */}
        <div className="bg-white p-5 sm:p-6 rounded-2xl border border-brand-muted shadow-subtle">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-sm text-brand-charcoal">Recent Purchases</h3>
            <Link
              href="/purchases"
              className="text-xs font-semibold text-brand-fabric hover:text-brand-accent flex items-center gap-1"
            >
              <span>All Purchases</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="divide-y divide-gray-100">
            {dashboard.recentPurchases?.map((p: any) => (
              <Link
                key={p.id}
                href={`/purchases/${p.id}`}
                className="py-3 flex items-center justify-between hover:bg-brand-light/50 rounded-xl px-2 transition"
              >
                <div>
                  <p className="text-sm font-semibold text-brand-charcoal">{p.supplier?.name}</p>
                  <p className="text-xs text-gray-400">
                    {p.purchaseNumber} • {new Date(p.purchaseDate).toLocaleDateString()}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-brand-charcoal">{formatPKR(p.totalLandedCost)}</p>
                  <p className="text-[10px] text-brand-fabric font-semibold">Landed Cost</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
