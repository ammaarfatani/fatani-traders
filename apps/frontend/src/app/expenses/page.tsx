'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { RecordActions } from '@/components/ui/RecordActions';
import { api } from '@/lib/api';
import { formatPKR } from '@fatani/shared';
import {
  Wallet,
  Plus,
  Calendar,
  X,
  CreditCard,
  Building,
} from 'lucide-react';

const karachiDateKey = (date = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Karachi' }).format(date);
const shiftDateKey = (dateKey: string, days: number) => {
  const date = new Date(`${dateKey}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};

function ExpenseDayDetails({ date, categories }: { date: string; categories: any[] }) {
  const [page, setPage] = useState(1);
  const start = new Date(`${date}T00:00:00+05:00`).toISOString();
  const end = new Date(new Date(`${shiftDateKey(date, 1)}T00:00:00+05:00`).getTime() - 1).toISOString();
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['expense-day', date, page],
    queryFn: () => api.getEnvelope<any>(`/expenses?page=${page}&limit=50&startDate=${encodeURIComponent(start)}&endDate=${encodeURIComponent(end)}`),
  });
  const rows = Array.isArray(data?.data) ? data.data : [];
  const pageCount = data?.pagination?.totalPages || 1;
  if (isLoading) return <p className="py-4 text-center text-sm text-gray-500">Loading expense records…</p>;
  if (isError) return <div role="alert" className="p-3 text-sm text-red-700">{error instanceof Error ? error.message : 'Expense records failed to load.'}<button onClick={() => refetch()} className="ml-3 underline">Retry</button></div>;
  if (rows.length === 0) return <p className="py-4 text-center text-sm text-gray-500">No expense records for this day.</p>;
  return <div className="divide-y divide-gray-100">
    {rows.map((expense: any) => <div key={expense.id} className="flex flex-col sm:flex-row sm:items-center gap-3 py-3">
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-sm text-slate-900">{expense.title}</p>
        <p className="text-xs text-gray-500">{new Intl.DateTimeFormat('en-PK', { timeZone: 'Asia/Karachi', dateStyle: 'medium', timeStyle: 'short' }).format(new Date(expense.date))} · {expense.category?.name || 'Uncategorized'}{expense.account?.name ? ` · ${expense.account.name}` : ''}</p>
      </div>
      <span className="font-bold text-red-700">{formatPKR(expense.amount)}</span>
      <RecordActions record={expense} endpoint={`/expenses/${expense.id}`} label={`${expense.expenseNumber} — ${expense.title}`} fields={[
        { key: 'title', label: 'Title', required: true },
        { key: 'categoryId', label: 'Category', options: categories.map((category: any) => ({ value: category.id, label: category.name })) },
        { key: 'amount', label: 'Amount', type: 'number', min: 0.01, required: true },
        { key: 'date', label: 'Date', type: 'date', required: true },
        { key: 'notes', label: 'Notes' },
      ]} />
    </div>)}
    {pageCount > 1 && <div className="flex items-center justify-between pt-3 text-xs"><span>Page {page} of {pageCount}</span><div className="flex gap-2"><button disabled={page <= 1} onClick={() => setPage(value => value - 1)} className="rounded border px-3 py-2 disabled:opacity-40">Previous</button><button disabled={page >= pageCount} onClick={() => setPage(value => value + 1)} className="rounded border px-3 py-2 disabled:opacity-40">Next</button></div></div>}
  </div>;
}

export default function ExpensesPage() {
  const queryClient = useQueryClient();
  const [selectedCategory, setSelectedCategory] = useState('');
  const [datePreset, setDatePreset] = useState<'today' | 'yesterday' | '7days' | 'month' | 'lastMonth' | 'custom'>('month');
  const [customStart, setCustomStart] = useState(karachiDateKey().slice(0, 7) + '-01');
  const [customEnd, setCustomEnd] = useState(karachiDateKey());
  const [expandedDay, setExpandedDay] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Form State
  const [title, setTitle] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [amount, setAmount] = useState<number>(0);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [isPaid, setIsPaid] = useState(true);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  const todayKey = karachiDateKey();
  const dateRange = React.useMemo(() => {
    if (datePreset === 'today') return { startDate: todayKey, endDate: todayKey };
    if (datePreset === 'yesterday') { const date = shiftDateKey(todayKey, -1); return { startDate: date, endDate: date }; }
    if (datePreset === '7days') return { startDate: shiftDateKey(todayKey, -6), endDate: todayKey };
    if (datePreset === 'lastMonth') {
      const first = new Date(`${todayKey.slice(0, 7)}-01T12:00:00Z`);
      first.setUTCMonth(first.getUTCMonth() - 1);
      const startDate = first.toISOString().slice(0, 7) + '-01';
      return { startDate, endDate: shiftDateKey(`${todayKey.slice(0, 7)}-01`, -1) };
    }
    if (datePreset === 'custom') return { startDate: customStart, endDate: customEnd };
    return { startDate: todayKey.slice(0, 7) + '-01', endDate: todayKey };
  }, [datePreset, todayKey, customStart, customEnd]);

  const { data: analytics, isLoading: analyticsLoading, isError: analyticsError, error: analyticsErrorMessage, refetch: retryAnalytics } = useQuery({
    queryKey: ['expense-analytics', dateRange.startDate, dateRange.endDate, selectedCategory],
    queryFn: () => api.get<any>(`/expenses/analytics?startDate=${dateRange.startDate}&endDate=${dateRange.endDate}${selectedCategory ? `&categoryId=${selectedCategory}` : ''}`),
  });

  const { data: categories } = useQuery({
    queryKey: ['expenseCategories'],
    queryFn: () => api.get<any[]>('/expenses/categories'),
  });

  React.useEffect(() => {
    if (categories && categories.length > 0 && !categoryId) {
      const defaultOp = categories.find((c) => !c.isCapitalizableDefault) || categories[0];
      setCategoryId(defaultOp.id);
    }
  }, [categories, categoryId]);

  const createExpenseMutation = useMutation({
    mutationFn: (payload: any) => api.post('/expenses', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
      queryClient.invalidateQueries({ queryKey: ['expense-analytics'] });
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      setIsModalOpen(false);
      setTitle('');
      setAmount(0);
      setNotes('');
      setError(null);
    },
    onError: (err: any) => {
      setError(err.message || 'Failed to record expense');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Expense title is required');
      return;
    }
    if (!amount || amount <= 0) {
      setError('Amount must be greater than zero');
      return;
    }
    if (!categoryId) {
      setError('Please select an expense category');
      return;
    }

    createExpenseMutation.mutate({
      title,
      categoryId,
      amount: Number(amount),
      date,
      accountId: null,
      isPaid,
      notes: notes || undefined,
    });
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 sm:p-5 rounded-2xl border border-brand-muted shadow-subtle">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-brand-deep text-white flex items-center justify-center">
            <Wallet className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-brand-charcoal tracking-tight font-sans">Operating Expenses</h1>
            <p className="text-xs text-gray-500">Rent, utilities, staff salaries, chai & office overhead</p>
          </div>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-brand-deep hover:bg-brand-fabric text-white font-semibold text-sm shadow-sm active:scale-95 transition"
        >
          <Plus className="w-4 h-4" />
          <span>Record Expense</span>
        </button>
      </div>

      <details className="bg-white p-4 rounded-xl border"><summary className="cursor-pointer font-semibold">Manage expense categories</summary>
        <div className="space-y-3 mt-3">{categories?.map((c:any)=><div key={c.id}><p>{c.name}</p><RecordActions record={c} label={c.name} endpoint={`/expenses/categories/${c.id}`} fields={[{key:'name',label:'Name',required:true},{key:'description',label:'Description'}]} /></div>)}</div>
      </details>
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {([
          ['today', "Today's Expenses", analytics?.summaries?.today],
          ['yesterday', "Yesterday's Expenses", analytics?.summaries?.yesterday],
          ['7days', "This Week's Expenses", analytics?.summaries?.thisWeek],
          ['month', "This Month's Expenses", analytics?.summaries?.thisMonth],
          ['custom', 'Selected Period', analytics?.summaries?.selectedPeriod],
        ] as const).map(([preset, label, value]) => <button key={preset} onClick={() => setDatePreset(preset)} className={`rounded-2xl border p-4 text-left shadow-sm ${datePreset === preset ? 'border-brand-fabric bg-brand-light/50' : 'border-brand-muted bg-white'}`}>
          <span className="text-[10px] uppercase tracking-wide text-gray-500">{label}</span>
          <span className="mt-1 block text-lg font-extrabold text-brand-charcoal">{analyticsLoading ? '…' : analyticsError ? 'Unavailable' : formatPKR(value || 0)}</span>
        </button>)}
      </div>

      <div className="flex flex-wrap gap-2 rounded-2xl border border-brand-muted bg-white p-3">
        {([['today','Today'],['yesterday','Yesterday'],['7days','Last 7 Days'],['month','This Month'],['lastMonth','Last Month'],['custom','Custom']] as const).map(([preset,label]) => <button key={preset} onClick={() => setDatePreset(preset)} className={`rounded-lg px-3 py-2 text-xs font-semibold ${datePreset === preset ? 'bg-brand-deep text-white' : 'bg-brand-light text-gray-700'}`}>{label}</button>)}
        {datePreset === 'custom' && <div className="flex flex-wrap items-center gap-2"><input aria-label="Start date" type="date" value={customStart} onChange={event => setCustomStart(event.target.value)} className="rounded-lg border p-2 text-xs"/><span>to</span><input aria-label="End date" type="date" value={customEnd} onChange={event => setCustomEnd(event.target.value)} className="rounded-lg border p-2 text-xs"/></div>}
      </div>

      {analyticsError && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">Expense summary failed to load: {analyticsErrorMessage instanceof Error ? analyticsErrorMessage.message : 'Check your connection.'}<button onClick={() => retryAnalytics()} className="ml-3 font-bold underline">Retry</button></div>}

      {analytics?.categoryTotals?.length > 0 && <section className="rounded-2xl border border-brand-muted bg-white p-4"><h2 className="mb-3 font-bold text-brand-charcoal">Selected Period by Category</h2><div className="flex flex-wrap gap-2">{analytics.categoryTotals.map((item: any) => <button key={item.categoryId} onClick={() => setSelectedCategory(selectedCategory === item.categoryId ? '' : item.categoryId)} className={`rounded-xl border px-3 py-2 text-left text-xs ${selectedCategory === item.categoryId ? 'border-brand-deep bg-brand-light' : 'border-brand-muted'}`}><span className="block font-semibold">{item.categoryName}</span><span>{formatPKR(item.amount)} · {item.count} records</span></button>)}</div></section>}

      {/* Filter by Category */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        <button
          onClick={() => setSelectedCategory('')}
          className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition ${
            selectedCategory === ''
              ? 'bg-brand-deep text-white shadow-sm'
              : 'bg-white text-gray-600 border border-brand-muted hover:bg-brand-light'
          }`}
        >
          All Categories
        </button>
        {categories
          ?.filter((c) => !c.isCapitalizableDefault)
          .map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition ${
                selectedCategory === cat.id
                  ? 'bg-brand-deep text-white shadow-sm'
                  : 'bg-white text-gray-600 border border-brand-muted hover:bg-brand-light'
              }`}
            >
              {cat.name}
            </button>
          ))}
      </div>

      {/* Daily expense groups. Detailed rows are fetched a day at a time with pagination. */}
      {analyticsLoading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : !analyticsError && analytics?.days?.length === 0 ? (
        <div className="bg-white p-8 rounded-2xl border border-slate-200 text-center space-y-3">
          <p className="text-sm font-medium text-slate-500">No operating expenses found in this period.</p>
          <button
            onClick={() => setIsModalOpen(true)}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-600 hover:text-emerald-700"
          >
            <Plus className="w-4 h-4" />
            <span>Record an operating expense</span>
          </button>
        </div>
      ) : !analyticsError ? (
        <div className="space-y-3">
          {analytics?.days?.map((day: any) => <section key={day.date} className="overflow-hidden rounded-2xl border border-brand-muted bg-white shadow-sm">
            <button onClick={() => setExpandedDay(expandedDay === day.date ? null : day.date)} aria-expanded={expandedDay === day.date} className="flex w-full flex-wrap items-center justify-between gap-3 p-4 text-left hover:bg-brand-light/30">
              <span><span className="block font-bold text-brand-charcoal">{new Intl.DateTimeFormat('en-PK', { timeZone: 'Asia/Karachi', dateStyle: 'full' }).format(new Date(`${day.date}T12:00:00+05:00`))}</span><span className="text-xs text-gray-500">{day.count} expense records</span></span>
              <span className="text-right"><span className="block font-extrabold text-red-700">{formatPKR(day.total)}</span><span className="text-xs text-gray-500">{day.categories.map((category: any) => `${category.categoryName}: ${formatPKR(category.amount)}`).join(' · ')}</span></span>
            </button>
            {expandedDay === day.date && <div className="border-t border-gray-100 px-4"><ExpenseDayDetails date={day.date} categories={categories || []}/></div>}
          </section>)}
        </div>
      ) : null}

      {/* Modal: Record Operating Expense */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-brand-deep/70 backdrop-blur-sm">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4 animate-in fade-in zoom-in-95 border border-brand-muted">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div>
                <h3 className="font-bold text-base text-brand-charcoal">Record Operating Expense</h3>
                <p className="text-xs text-gray-500">Business overhead (Not capitalized into fabric inventory)</p>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 text-gray-400 hover:text-gray-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {error && (
              <div className="p-3 bg-red-50 text-red-700 text-xs rounded-xl border border-red-200">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Expense Title *</label>
                <input
                  type="text"
                  required
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Shop monthly rent / Staff chai & lunch"
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Category *</label>
                <select
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium"
                >
                  {categories?.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name} {cat.isCapitalizableDefault ? '(Landed)' : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Amount (PKR) *</label>
                <input
                  type="number"
                  min="0"
                  required
                  value={amount}
                  onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
                  placeholder="0"
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-base font-bold text-red-600"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Expense Date</label>
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  required
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium"
                />
              </div>

              <div>
                <label className="flex items-center gap-2 cursor-pointer mb-2">
                  <input
                    type="checkbox"
                    checked={isPaid}
                    onChange={(e) => setIsPaid(e.target.checked)}
                    className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                  />
                  <span className="font-semibold text-slate-800">Paid immediately</span>
                </label>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Notes</label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Optional details..."
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createExpenseMutation.isPending}
                  className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold transition disabled:opacity-50"
                >
                  {createExpenseMutation.isPending ? 'Saving...' : 'Record Expense'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
