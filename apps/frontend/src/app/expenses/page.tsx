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

export default function ExpensesPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Form State
  const [title, setTitle] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [amount, setAmount] = useState<number>(0);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [isPaid, setIsPaid] = useState(true);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  const { data: expensesData, isLoading } = useQuery({
    queryKey: ['expenses', page, selectedCategory],
    queryFn: () =>
      api.get<any>(
        `/expenses?page=${page}&limit=20${
          selectedCategory ? `&categoryId=${selectedCategory}` : ''
        }`
      ),
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

      {/* Expense Entries List */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : expensesData?.length === 0 ? (
        <div className="bg-white p-8 rounded-2xl border border-slate-200 text-center space-y-3">
          <p className="text-sm font-medium text-slate-500">No operating expenses found.</p>
          <button
            onClick={() => setIsModalOpen(true)}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-600 hover:text-emerald-700"
          >
            <Plus className="w-4 h-4" />
            <span>Record an operating expense</span>
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {expensesData?.map((exp: any) => (
            <div
              key={exp.id}
              className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between gap-3"
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm text-slate-900 truncate">{exp.title}</span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-semibold">
                    {exp.category?.name}
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-1 flex items-center gap-2">
                  <span>{new Date(exp.date).toLocaleDateString()}</span>
                  {exp.account && <span>• Paid via {exp.account.name}</span>}
                </p>
              </div>

              <RecordActions record={exp} endpoint={`/expenses/${exp.id}`} label={`${exp.expenseNumber} — ${exp.title}`} fields={[
                {key:'title',label:'Title',required:true}, {key:'categoryId',label:'Category',options:(categories || []).map((c:any)=>({value:c.id,label:c.name}))},
                {key:'amount',label:'Amount',type:'number',min:0.01,required:true}, {key:'date',label:'Date',type:'date',required:true}, {key:'notes',label:'Notes'}
              ]} />
              <div className="text-right shrink-0">
                <p className="text-base font-extrabold text-red-600">{formatPKR(exp.amount)}</p>
                <span className={`text-[10px] font-bold ${exp.isPaid ? 'text-slate-400' : 'text-amber-600'}`}>
                  {exp.isPaid ? 'Paid' : 'Unpaid Liability'}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

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
