'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { formatPKR } from '@fatani/shared';
import {
  TrendingUp,
  TrendingDown,
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
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-3">
        <div className="w-10 h-10 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm font-medium text-slate-500">Loading Business Dashboard...</p>
      </div>
    );
  }

  if (error || !dashboard) {
    return (
      <div className="p-6 bg-red-50 border border-red-200 rounded-2xl text-red-700 text-sm">
        Failed to load dashboard data. Please make sure the backend server is running.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Banner / Quick Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 sm:p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">Business Overview</h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            Fatani Traders — Real-time textile inventory, sales & Khata
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 sm:pb-0">
          <a
            href="/sales/new"
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs sm:text-sm shadow-md shadow-emerald-600/20 active:scale-95 transition shrink-0"
          >
            <Receipt className="w-4 h-4" />
            <span>+ New Sale</span>
          </a>

          <a
            href="/purchases/new"
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-semibold text-xs sm:text-sm shadow-sm active:scale-95 transition shrink-0"
          >
            <ShoppingCart className="w-4 h-4" />
            <span>+ Purchase Lot</span>
          </a>

          <a
            href="/expenses"
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium text-xs sm:text-sm transition shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Expense</span>
          </a>
        </div>
      </div>

      {/* Primary KPI Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        {/* Today's Sales */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Today's Sales</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <p className="text-lg sm:text-2xl font-extrabold text-slate-900">
            {formatPKR(dashboard.todaySales)}
          </p>
          <p className="text-[11px] font-medium text-emerald-600 mt-1 flex items-center gap-1">
            <Scale className="w-3.5 h-3.5" />
            <span>{dashboard.todaySalesKg.toLocaleString()} KG Sold Today</span>
          </p>
        </div>

        {/* Customer Receivables */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Customer Khata</span>
            <div className="w-8 h-8 rounded-lg bg-red-50 text-red-600 flex items-center justify-center">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <p className="text-lg sm:text-2xl font-extrabold text-red-600">
            {formatPKR(dashboard.totalReceivables)}
          </p>
          <p className="text-[11px] text-slate-500 mt-1">Total Market Receivables</p>
        </div>

        {/* Supplier Payables */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Supplier Payables</span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <Building2 className="w-4 h-4" />
            </div>
          </div>
          <p className="text-lg sm:text-2xl font-extrabold text-amber-600">
            {formatPKR(dashboard.totalSupplierPayables)}
          </p>
          <p className="text-[11px] text-slate-500 mt-1">Mill & Wholesaler Debt</p>
        </div>

        {/* Total Available Inventory */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider">Stock Valuation</span>
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <Package className="w-4 h-4" />
            </div>
          </div>
          <p className="text-lg sm:text-2xl font-extrabold text-slate-900">
            {formatPKR(dashboard.totalInventoryValuation)}
          </p>
          <p className="text-[11px] font-medium text-blue-600 mt-1">
            {dashboard.totalAvailableStockKg.toLocaleString()} KG Available
          </p>
        </div>
      </div>

      {/* Secondary Financial Indicators (Liquidity & Monthly P&L) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 sm:gap-4">
        {/* Cash & Bank Balances */}
        <div className="bg-gradient-to-br from-slate-900 to-slate-800 text-white p-5 rounded-2xl shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-300">Total Liquid Funds</span>
            <Landmark className="w-5 h-5 text-emerald-400" />
          </div>
          <p className="text-2xl sm:text-3xl font-extrabold text-white">
            {formatPKR(dashboard.totalCashAndBankBalance)}
          </p>
          <div className="mt-4 pt-3 border-t border-slate-700/80 space-y-1.5 text-xs text-slate-300">
            {dashboard.accounts?.slice(0, 3).map((acc: any) => (
              <div key={acc.id} className="flex justify-between items-center">
                <span className="truncate">{acc.name}</span>
                <span className="font-semibold text-emerald-400">{formatPKR(acc.currentBalance)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Month Gross Profit */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-slate-500 mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider">This Month Gross Profit</span>
              <DollarSign className="w-5 h-5 text-emerald-600" />
            </div>
            <p className="text-2xl sm:text-3xl font-extrabold text-emerald-600">
              {formatPKR(dashboard.monthGrossProfit)}
            </p>
            <p className="text-xs text-slate-500 mt-1">
              Sales Revenue minus Actual Lot Landed COGS
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 flex justify-between text-xs text-slate-500">
            <span>Operating Expenses:</span>
            <span className="font-semibold text-red-500">
              {formatPKR(dashboard.monthOperatingExpenses)}
            </span>
          </div>
        </div>

        {/* Month Net Profit */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-slate-500 mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider">This Month Net Profit</span>
              <TrendingUp className="w-5 h-5 text-indigo-600" />
            </div>
            <p className={`text-2xl sm:text-3xl font-extrabold ${dashboard.monthNetProfit >= 0 ? 'text-indigo-600' : 'text-red-600'}`}>
              {formatPKR(dashboard.monthNetProfit)}
            </p>
            <p className="text-xs text-slate-500 mt-1">
              Accrual basis (Gross Profit − Overhead)
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 flex justify-between text-xs text-slate-500">
            <span>Today's Cash Recovered:</span>
            <span className="font-semibold text-emerald-600">
              {formatPKR(dashboard.todayPaymentsReceived)}
            </span>
          </div>
        </div>
      </div>

      {/* Monthly Trends Chart */}
      {dashboard.monthlyTrends && dashboard.monthlyTrends.length > 0 && (
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-base font-bold text-slate-900">Revenue & Profit Trends</h2>
              <p className="text-xs text-slate-500">Monthly Sales Revenue vs. Cost of Goods Sold</p>
            </div>
          </div>
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dashboard.monthlyTrends} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(val) => `${val / 1000}k`} />
                <Tooltip
                  formatter={(value: any) => formatPKR(value)}
                  contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px', color: '#fff' }}
                />
                <Legend wrapperStyle={{ fontSize: '12px' }} />
                <Bar dataKey="sales" name="Sales" fill="#10b981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="cogs" name="COGS" fill="#94a3b8" radius={[4, 4, 0, 0]} />
                <Bar dataKey="grossProfit" name="Gross Profit" fill="#6366f1" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Alerts & Critical Action Lists Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Overdue / High Customer Receivables */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Users className="w-5 h-5 text-red-500" />
              <h3 className="font-bold text-sm text-slate-900">High Outstanding Customers</h3>
            </div>
            <a href="/customers" className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 flex items-center gap-1">
              <span>View All</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </a>
          </div>

          <div className="divide-y divide-slate-100">
            {dashboard.overdueCustomers?.length === 0 ? (
              <p className="text-xs text-slate-400 py-3 text-center">No overdue customers.</p>
            ) : (
              dashboard.overdueCustomers?.map((c: any) => (
                <a
                  key={c.id}
                  href={`/customers/${c.id}`}
                  className="py-3 flex items-center justify-between hover:bg-slate-50 rounded-xl px-2 transition"
                >
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{c.name}</p>
                    <p className="text-xs text-slate-400">{c.shopName || c.phone}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-red-600">{formatPKR(c.currentBalance)}</p>
                    <p className="text-[10px] text-slate-400">Khata Balance</p>
                  </div>
                </a>
              ))
            )}
          </div>
        </div>

        {/* Low Stock Lots */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              <h3 className="font-bold text-sm text-slate-900">Low Stock Lots (&lt; 50 KG)</h3>
            </div>
            <a href="/inventory" className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 flex items-center gap-1">
              <span>Inventory</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </a>
          </div>

          <div className="divide-y divide-slate-100">
            {dashboard.lowStockLots?.length === 0 ? (
              <p className="text-xs text-slate-400 py-3 text-center">All active lots have healthy stock levels.</p>
            ) : (
              dashboard.lowStockLots?.map((l: any) => (
                <a
                  key={l.id}
                  href={`/inventory/lots/${l.id}`}
                  className="py-3 flex items-center justify-between hover:bg-slate-50 rounded-xl px-2 transition"
                >
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{l.lotNumber}</p>
                    <p className="text-xs text-slate-500">{l.product?.name}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-amber-600">{l.availableKg.toFixed(3)} KG</p>
                    <p className="text-[10px] text-slate-400">Remaining</p>
                  </div>
                </a>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Recent Transactions (Recent Sales & Purchases) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Recent Sales Invoices */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-sm text-slate-900">Recent Sales Invoices</h3>
            <a href="/sales" className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 flex items-center gap-1">
              <span>All Sales</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </a>
          </div>

          <div className="divide-y divide-slate-100">
            {dashboard.recentSales?.map((s: any) => (
              <a
                key={s.id}
                href={`/sales/${s.id}`}
                className="py-3 flex items-center justify-between hover:bg-slate-50 rounded-xl px-2 transition"
              >
                <div>
                  <p className="text-sm font-semibold text-slate-900">{s.customer?.name}</p>
                  <p className="text-xs text-slate-400">{s.invoiceNumber} • {new Date(s.invoiceDate).toLocaleDateString()}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-slate-900">{formatPKR(s.grandTotal)}</p>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${
                    s.status === 'COMPLETED' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
                  }`}>
                    {s.status}
                  </span>
                </div>
              </a>
            ))}
          </div>
        </div>

        {/* Recent Purchases */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-sm text-slate-900">Recent Purchases</h3>
            <a href="/purchases" className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 flex items-center gap-1">
              <span>All Purchases</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </a>
          </div>

          <div className="divide-y divide-slate-100">
            {dashboard.recentPurchases?.map((p: any) => (
              <a
                key={p.id}
                href={`/purchases/${p.id}`}
                className="py-3 flex items-center justify-between hover:bg-slate-50 rounded-xl px-2 transition"
              >
                <div>
                  <p className="text-sm font-semibold text-slate-900">{p.supplier?.name}</p>
                  <p className="text-xs text-slate-400">{p.purchaseNumber} • {new Date(p.purchaseDate).toLocaleDateString()}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-slate-900">{formatPKR(p.totalLandedCost)}</p>
                  <p className="text-[10px] text-emerald-600 font-medium">Landed Cost</p>
                </div>
              </a>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
