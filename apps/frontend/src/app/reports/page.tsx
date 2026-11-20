'use client';

import React, { useState } from 'react';
import Image from 'next/image';
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
      <div className="no-print flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 sm:p-5 rounded-2xl border border-brand-muted shadow-subtle">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-brand-deep text-white flex items-center justify-center">
            <BarChart3 className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-brand-charcoal tracking-tight font-sans">Financial Statements</h1>
            <p className="text-xs text-gray-500">Accrual Profit & Loss and Cash Flow Statements</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Date Presets */}
          <div className="bg-brand-light p-1 rounded-xl flex text-xs font-semibold border border-brand-muted">
            <button
              onClick={() => setDateRangePreset('today')}
              className={`px-3 py-1.5 rounded-lg transition ${
                dateRangePreset === 'today' ? 'bg-white text-brand-charcoal shadow-sm' : 'text-gray-500'
              }`}
            >
              Today
            </button>
            <button
              onClick={() => setDateRangePreset('month')}
              className={`px-3 py-1.5 rounded-lg transition ${
                dateRangePreset === 'month' ? 'bg-white text-brand-charcoal shadow-sm' : 'text-gray-500'
              }`}
            >
              This Month
            </button>
            <button
              onClick={() => setDateRangePreset('all')}
              className={`px-3 py-1.5 rounded-lg transition ${
                dateRangePreset === 'all' ? 'bg-white text-brand-charcoal shadow-sm' : 'text-gray-500'
              }`}
            >
              All Time
            </button>
          </div>

          <button
            onClick={() => window.print()}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-brand-deep hover:bg-brand-fabric text-white text-xs font-semibold shadow-sm transition active:scale-95"
          >
            <Printer className="w-4 h-4" />
            <span>Print</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="no-print flex border border-brand-muted bg-white rounded-2xl p-1.5 shadow-subtle gap-1">
        <button
          onClick={() => setActiveTab('pl')}
          className={`flex-1 py-2.5 px-3 rounded-xl text-xs sm:text-sm font-bold transition flex items-center justify-center gap-2 ${
            activeTab === 'pl'
              ? 'bg-brand-deep text-white shadow-sm'
              : 'text-gray-600 hover:text-brand-charcoal'
          }`}
        >
          <TrendingUp className="w-4 h-4" />
          <span>Accrual Profit & Loss</span>
        </button>

        <button
          onClick={() => setActiveTab('cashflow')}
          className={`flex-1 py-2.5 px-3 rounded-xl text-xs sm:text-sm font-bold transition flex items-center justify-center gap-2 ${
            activeTab === 'cashflow'
              ? 'bg-brand-deep text-white shadow-sm'
              : 'text-gray-600 hover:text-brand-charcoal'
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
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <div className="w-8 h-8 border-4 border-brand-fabric border-t-transparent rounded-full animate-spin" />
              <p className="text-xs text-gray-500 font-semibold uppercase tracking-wider">Generating P&L Statement...</p>
            </div>
          ) : plData ? (
            <div className="print-page bg-white p-6 sm:p-8 rounded-2xl border border-brand-muted shadow-subtle space-y-6">
              {/* Header with Brand Logo */}
              <div className="border-b border-brand-muted pb-4 flex justify-between items-start">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 flex items-center justify-center shrink-0">
                    <Image
                      src="/logo.png"
                      alt="Fatani Fabrics Logo"
                      width={44}
                      height={44}
                      className="w-full h-full object-contain"
                    />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-brand-charcoal font-sans">Profit & Loss Statement (Accrual)</h2>
                    <p className="text-xs text-gray-500">Fatani Traders Textile ERP</p>
                  </div>
                </div>
                <div className="text-right text-xs text-gray-500">
                  <span className="font-semibold text-brand-charcoal block">Reporting Period</span>
                  <span>{dateRangePreset === 'month' ? 'Current Fiscal Month' : dateRangePreset.toUpperCase()}</span>
                </div>
              </div>

              {/* 1. Revenue */}
              <div className="space-y-2 text-xs">
                <h3 className="font-bold text-xs uppercase tracking-wider text-brand-charcoal">
                  1. Sales Revenue
                </h3>
                <div className="p-4 bg-brand-light/60 border border-brand-muted rounded-xl space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Gross Invoiced Sales:</span>
                    <span className="font-semibold text-brand-charcoal">{formatPKR(plData.revenue.grossSales)}</span>
                  </div>
                  {plData.revenue.salesReturns > 0 && (
                    <div className="flex justify-between text-amber-700">
                      <span>Less: Sales Returns & Credit Adjustments:</span>
                      <span className="font-semibold">-{formatPKR(plData.revenue.salesReturns)}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-bold text-sm text-brand-charcoal border-t border-brand-muted pt-2">
                    <span>Net Sales Revenue:</span>
                    <span className="text-emerald-700">{formatPKR(plData.revenue.netSales)}</span>
                  </div>
                </div>
              </div>

              {/* 2. COGS */}
              <div className="space-y-2 text-xs">
                <h3 className="font-bold text-xs uppercase tracking-wider text-brand-charcoal">
                  2. Cost of Goods Sold (COGS)
                </h3>
                <div className="p-4 bg-brand-light/60 border border-brand-muted rounded-xl space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Lot Landed Cost of Fabric Sold:</span>
                    <span className="font-semibold text-brand-charcoal">{formatPKR(plData.costOfGoodsSold.grossCogs)}</span>
                  </div>
                  {plData.costOfGoodsSold.cogsReversed > 0 && (
                    <div className="flex justify-between text-emerald-700">
                      <span>Less: Restocked Returns Cost Reversal:</span>
                      <span className="font-semibold">-{formatPKR(plData.costOfGoodsSold.cogsReversed)}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-bold text-sm text-brand-charcoal border-t border-brand-muted pt-2">
                    <span>Net Cost of Goods Sold:</span>
                    <span className="text-brand-charcoal">{formatPKR(plData.costOfGoodsSold.netCogs)}</span>
                  </div>
                </div>
              </div>

              {/* GROSS PROFIT */}
              <div className="p-4 bg-emerald-50 rounded-xl border border-emerald-200 flex justify-between items-center">
                <div>
                  <span className="text-xs font-bold uppercase text-emerald-800 tracking-wider">
                    Gross Profit (Margin)
                  </span>
                  <p className="text-[11px] text-emerald-700 mt-0.5">
                    Net Sales Revenue − Net Lot Landed Cost
                  </p>
                </div>
                <span className="text-xl sm:text-2xl font-black text-emerald-800">
                  {formatPKR(plData.grossProfit)}
                </span>
              </div>

              {/* 3. Operating Expenses */}
              <div className="space-y-2 text-xs">
                <h3 className="font-bold text-xs uppercase tracking-wider text-brand-charcoal">
                  3. Operating Expenses (Overhead)
                </h3>
                <div className="p-4 bg-brand-light/60 border border-brand-muted rounded-xl space-y-2">
                  {plData.operatingExpenses.items?.length === 0 ? (
                    <p className="text-gray-400 py-1">No operating expenses recorded in this period.</p>
                  ) : (
                    plData.operatingExpenses.items?.map((item: any) => (
                      <div key={item.categoryId} className="flex justify-between">
                        <span className="text-gray-600">{item.categoryName}:</span>
                        <span className="font-semibold text-brand-charcoal">{formatPKR(item.amount)}</span>
                      </div>
                    ))
                  )}
                  <div className="flex justify-between font-bold text-sm text-red-600 border-t border-brand-muted pt-2">
                    <span>Total Operating Expenses:</span>
                    <span>{formatPKR(plData.operatingExpenses.total)}</span>
                  </div>
                </div>
              </div>

              {/* NET PROFIT */}
              <div
                className={`p-5 rounded-2xl flex justify-between items-center ${
                  plData.netProfit >= 0
                    ? 'bg-brand-deep text-white shadow-elevated border border-brand-dark/40'
                    : 'bg-red-600 text-white shadow-lg'
                }`}
              >
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-gray-300">
                    Net Profit / (Loss)
                  </span>
                  <p className="text-xs text-gray-300 mt-0.5">
                    Gross Profit − Operating Overhead
                  </p>
                </div>
                <span className="text-2xl sm:text-3xl font-black text-emerald-300">
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
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <div className="w-8 h-8 border-4 border-brand-fabric border-t-transparent rounded-full animate-spin" />
              <p className="text-xs text-gray-500 font-semibold uppercase tracking-wider">Generating Cash Flow Statement...</p>
            </div>
          ) : cfData ? (
            <div className="print-page bg-white p-6 sm:p-8 rounded-2xl border border-brand-muted shadow-subtle space-y-6">
              <div className="border-b border-brand-muted pb-4 flex justify-between items-start">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 flex items-center justify-center shrink-0">
                    <Image
                      src="/logo.png"
                      alt="Fatani Fabrics Logo"
                      width={44}
                      height={44}
                      className="w-full h-full object-contain"
                    />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-brand-charcoal font-sans">Statement of Cash Flows</h2>
                    <p className="text-xs text-gray-500">Fatani Traders Textile ERP</p>
                  </div>
                </div>
                <div className="text-right text-xs text-gray-500">
                  <span className="font-semibold text-brand-charcoal block">Reporting Period</span>
                  <span>{dateRangePreset === 'month' ? 'Current Fiscal Month' : dateRangePreset.toUpperCase()}</span>
                </div>
              </div>

              {/* Cash Inflows */}
              <div className="space-y-2 text-xs">
                <h3 className="font-bold text-xs uppercase tracking-wider text-emerald-700 flex items-center gap-1.5">
                  <ArrowDownRight className="w-4 h-4" />
                  <span>Cash Inflows (Collections & Receipts)</span>
                </h3>
                <div className="p-4 bg-emerald-50/50 rounded-xl border border-emerald-100 space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-700">Customer Payments Collected:</span>
                    <span className="font-semibold text-emerald-800">{formatPKR(cfData.inflows.customerCollections)}</span>
                  </div>
                  <div className="flex justify-between font-bold text-sm text-emerald-800 border-t border-emerald-200 pt-2">
                    <span>Total Cash Inflow:</span>
                    <span>{formatPKR(cfData.inflows.total)}</span>
                  </div>
                </div>
              </div>

              {/* Cash Outflows */}
              <div className="space-y-2 text-xs">
                <h3 className="font-bold text-xs uppercase tracking-wider text-red-600 flex items-center gap-1.5">
                  <ArrowUpRight className="w-4 h-4" />
                  <span>Cash Outflows (Disbursements & Payments)</span>
                </h3>
                <div className="p-4 bg-red-50/50 rounded-xl border border-red-100 space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-700">Supplier Purchases Paid:</span>
                    <span className="font-semibold text-red-700">{formatPKR(cfData.outflows.supplierPayments)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-700">Operating Overhead Paid:</span>
                    <span className="font-semibold text-red-700">{formatPKR(cfData.outflows.operatingExpenses)}</span>
                  </div>
                  <div className="flex justify-between font-bold text-sm text-red-700 border-t border-red-200 pt-2">
                    <span>Total Cash Outflow:</span>
                    <span>{formatPKR(cfData.outflows.total)}</span>
                  </div>
                </div>
              </div>

              {/* Net Cash Flow */}
              <div
                className={`p-5 rounded-2xl flex justify-between items-center ${
                  cfData.netCashFlow >= 0
                    ? 'bg-brand-deep text-white shadow-elevated border border-brand-dark/40'
                    : 'bg-red-600 text-white shadow-lg'
                }`}
              >
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-gray-300">
                    Net Cash Flow
                  </span>
                  <p className="text-xs text-gray-300 mt-0.5">
                    Total Inflow − Total Outflow (Liquid Position)
                  </p>
                </div>
                <span className="text-2xl sm:text-3xl font-black text-emerald-300">
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
