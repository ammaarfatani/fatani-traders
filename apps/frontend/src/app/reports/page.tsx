'use client';

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { formatPKR } from '@fatani/shared';
import {
  BarChart3,
  Calendar,
  Printer,
  TrendingUp,
  DollarSign,
  ArrowDownRight,
  ArrowUpRight,
} from 'lucide-react';

export default function ReportsPage() {
  const [activeTab, setActiveTab] = useState<'pl' | 'cashflow'>('pl');
  const [dateRangePreset, setDateRangePreset] = useState<'month' | 'today' | 'all'>('month');

  const dateFilter = React.useMemo(() => {
    const today = new Date();
    if (dateRangePreset === 'today') {
      const start = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString();
      return `?startDate=${start}`;
    }
    if (dateRangePreset === 'month') {
      const start = new Date(today.getFullYear(), today.getMonth(), 1).toISOString();
      return `?startDate=${start}`;
    }
    return '';
  }, [dateRangePreset]);

  const { data: plData, isLoading: isPlLoading } = useQuery({
    queryKey: ['profit-loss', dateFilter],
    queryFn: () => api.get<any>(`/reports/profit-loss${dateFilter}`),
  });

  const { data: cfData, isLoading: isCfLoading } = useQuery({
    queryKey: ['cash-flow', dateFilter],
    queryFn: () => api.get<any>(`/reports/cash-flow${dateFilter}`),
  });

  return (
    <div className="space-y-4 max-w-4xl mx-auto pb-16">
      {/* Header */}
      <div className="no-print flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center">
            <BarChart3 className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">Financial Reports</h1>
            <p className="text-xs text-slate-500">Accrual Profit & Loss and Cash Flow Statements</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Date Presets */}
          <div className="bg-slate-100 p-1 rounded-xl flex text-xs font-semibold">
            <button
              onClick={() => setDateRangePreset('today')}
              className={`px-3 py-1.5 rounded-lg transition ${
                dateRangePreset === 'today' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'
              }`}
            >
              Today
            </button>
            <button
              onClick={() => setDateRangePreset('month')}
              className={`px-3 py-1.5 rounded-lg transition ${
                dateRangePreset === 'month' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'
              }`}
            >
              This Month
            </button>
            <button
              onClick={() => setDateRangePreset('all')}
              className={`px-3 py-1.5 rounded-lg transition ${
                dateRangePreset === 'all' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'
              }`}
            >
              All Time
            </button>
          </div>

          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold shadow-sm transition"
          >
            <Printer className="w-4 h-4" />
            <span>Print</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="no-print flex border-b border-slate-200 bg-white rounded-2xl p-1.5 shadow-sm">
        <button
          onClick={() => setActiveTab('pl')}
          className={`flex-1 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition flex items-center justify-center gap-2 ${
            activeTab === 'pl'
              ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <TrendingUp className="w-4 h-4" />
          <span>Accrual Profit & Loss</span>
        </button>

        <button
          onClick={() => setActiveTab('cashflow')}
          className={`flex-1 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition flex items-center justify-center gap-2 ${
            activeTab === 'cashflow'
              ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <DollarSign className="w-4 h-4" />
          <span>Cash Flow Statement</span>
        </button>
      </div>

      {/* TAB 1: ACCRUAL PROFIT & LOSS */}
      {activeTab === 'pl' && (
        <div className="space-y-4">
          {isPlLoading ? (
            <div className="flex justify-center py-20">
              <div className="w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : plData ? (
            <div className="print-page bg-white p-6 sm:p-8 rounded-2xl border border-slate-200 shadow-sm space-y-6">
              <div className="border-b border-slate-200 pb-4 flex justify-between items-start">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">Profit & Loss Statement (Accrual)</h2>
                  <p className="text-xs text-slate-500">Fatani Traders Textile ERP</p>
                </div>
                <div className="text-right text-xs text-slate-400">
                  <span className="font-semibold text-slate-700 block">Period</span>
                  <span>{dateRangePreset === 'month' ? 'Current Fiscal Month' : dateRangePreset.toUpperCase()}</span>
                </div>
              </div>

              {/* 1. Revenue */}
              <div className="space-y-2 text-xs">
                <h3 className="font-bold text-sm text-slate-900 uppercase tracking-wider">
                  1. Sales Revenue
                </h3>
                <div className="p-4 bg-slate-50 rounded-xl space-y-2">
                  <div className="flex justify-between">
                    <span className="text-slate-600">Gross Invoiced Sales:</span>
                    <span className="font-semibold text-slate-900">{formatPKR(plData.revenue.grossSales)}</span>
                  </div>
                  {plData.revenue.salesReturns > 0 && (
                    <div className="flex justify-between text-amber-700">
                      <span>Less: Sales Returns & Credit Adjustments:</span>
                      <span className="font-semibold">-{formatPKR(plData.revenue.salesReturns)}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-bold text-sm text-slate-900 border-t border-slate-200 pt-2">
                    <span>Net Sales Revenue:</span>
                    <span className="text-emerald-700">{formatPKR(plData.revenue.netSales)}</span>
                  </div>
                </div>
              </div>

              {/* 2. COGS */}
              <div className="space-y-2 text-xs">
                <h3 className="font-bold text-sm text-slate-900 uppercase tracking-wider">
                  2. Cost of Goods Sold (COGS)
                </h3>
                <div className="p-4 bg-slate-50 rounded-xl space-y-2">
                  <div className="flex justify-between">
                    <span className="text-slate-600">Lot Landed Cost of Fabric Sold:</span>
                    <span className="font-semibold text-slate-900">{formatPKR(plData.costOfGoodsSold.grossCogs)}</span>
                  </div>
                  {plData.costOfGoodsSold.cogsReversed > 0 && (
                    <div className="flex justify-between text-emerald-700">
                      <span>Less: Restocked Returns Cost Reversal:</span>
                      <span className="font-semibold">-{formatPKR(plData.costOfGoodsSold.cogsReversed)}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-bold text-sm text-slate-900 border-t border-slate-200 pt-2">
                    <span>Net Cost of Goods Sold:</span>
                    <span className="text-slate-800">{formatPKR(plData.costOfGoodsSold.netCogs)}</span>
                  </div>
                </div>
              </div>

              {/* GROSS PROFIT */}
              <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-200 flex justify-between items-center">
                <div>
                  <span className="text-xs font-bold uppercase text-emerald-800 tracking-wider">
                    Gross Profit (Margin)
                  </span>
                  <p className="text-[11px] text-emerald-600 mt-0.5">
                    Net Sales Revenue − Net Lot Landed Cost
                  </p>
                </div>
                <span className="text-xl sm:text-2xl font-black text-emerald-700">
                  {formatPKR(plData.grossProfit)}
                </span>
              </div>

              {/* 3. Operating Expenses */}
              <div className="space-y-2 text-xs">
                <h3 className="font-bold text-sm text-slate-900 uppercase tracking-wider">
                  3. Operating Expenses (Overhead)
                </h3>
                <div className="p-4 bg-slate-50 rounded-xl space-y-2">
                  {plData.operatingExpenses.items?.length === 0 ? (
                    <p className="text-slate-400 py-1">No operating expenses recorded in this period.</p>
                  ) : (
                    plData.operatingExpenses.items?.map((item: any) => (
                      <div key={item.categoryId} className="flex justify-between">
                        <span className="text-slate-600">{item.categoryName}:</span>
                        <span className="font-semibold text-slate-900">{formatPKR(item.amount)}</span>
                      </div>
                    ))
                  )}
                  <div className="flex justify-between font-bold text-sm text-red-600 border-t border-slate-200 pt-2">
                    <span>Total Operating Expenses:</span>
                    <span>{formatPKR(plData.operatingExpenses.total)}</span>
                  </div>
                </div>
              </div>

              {/* NET PROFIT */}
              <div className={`p-5 rounded-2xl flex justify-between items-center ${
                plData.netProfit >= 0
                  ? 'bg-slate-900 text-white'
                  : 'bg-red-600 text-white'
              }`}>
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
                    Net Profit / (Loss)
                  </span>
                  <p className="text-xs text-slate-300 mt-0.5">
                    Gross Profit − Operating Overhead
                  </p>
                </div>
                <span className="text-2xl sm:text-3xl font-black text-emerald-400">
                  {formatPKR(plData.netProfit)}
                </span>
              </div>
            </div>
          ) : null}
        </div>
      )}

      {/* TAB 2: CASH FLOW STATEMENT */}
      {activeTab === 'cashflow' && (
        <div className="space-y-4">
          {isCfLoading ? (
            <div className="flex justify-center py-20">
              <div className="w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : cfData ? (
            <div className="print-page bg-white p-6 sm:p-8 rounded-2xl border border-slate-200 shadow-sm space-y-6">
              <div className="border-b border-slate-200 pb-4">
                <h2 className="text-lg font-bold text-slate-900">Cash Flow Statement</h2>
                <p className="text-xs text-slate-500">
                  Distinguishes actual cash liquidity received & paid from accrued profit
                </p>
              </div>

              {/* Inflows */}
              <div className="space-y-2 text-xs">
                <h3 className="font-bold text-sm text-emerald-700 uppercase tracking-wider flex items-center gap-1.5">
                  <ArrowDownRight className="w-4 h-4" />
                  <span>Cash Inflows</span>
                </h3>
                <div className="p-4 bg-emerald-50/50 rounded-xl space-y-2">
                  <div className="flex justify-between">
                    <span className="text-slate-600">Customer Collections & Direct Payments:</span>
                    <span className="font-bold text-emerald-700">{formatPKR(cfData.totalInflow)}</span>
                  </div>
                  <div className="flex justify-between text-slate-500 text-[11px]">
                    <span>Total Deposit Transactions:</span>
                    <span>{cfData.customerCollectionsCount} collections</span>
                  </div>
                </div>
              </div>

              {/* Outflows */}
              <div className="space-y-2 text-xs">
                <h3 className="font-bold text-sm text-red-600 uppercase tracking-wider flex items-center gap-1.5">
                  <ArrowUpRight className="w-4 h-4" />
                  <span>Cash Outflows</span>
                </h3>
                <div className="p-4 bg-red-50/50 rounded-xl space-y-2">
                  <div className="flex justify-between">
                    <span className="text-slate-600">Supplier Payments & Expenses Paid:</span>
                    <span className="font-bold text-red-600">-{formatPKR(cfData.totalOutflow)}</span>
                  </div>
                  <div className="flex justify-between text-slate-500 text-[11px]">
                    <span>Disbursement Transactions:</span>
                    <span>
                      {cfData.supplierDisbursementsCount} to suppliers, {cfData.expenseDisbursementsCount} expenses
                    </span>
                  </div>
                </div>
              </div>

              {/* Net Cash Flow */}
              <div className="p-5 bg-slate-900 text-white rounded-2xl flex justify-between items-center">
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
                    Net Cash Flow
                  </span>
                  <p className="text-xs text-slate-400 mt-0.5">Total Inflows − Total Outflows</p>
                </div>
                <span className={`text-2xl sm:text-3xl font-black ${
                  cfData.netCashFlow >= 0 ? 'text-emerald-400' : 'text-red-400'
                }`}>
                  {formatPKR(cfData.netCashFlow)}
                </span>
              </div>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
