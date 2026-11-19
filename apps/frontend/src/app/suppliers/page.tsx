'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { formatPKR } from '@fatani/shared';
import {
  Building2,
  Plus,
  Search,
  Phone,
  CreditCard,
  X,
  ChevronRight,
} from 'lucide-react';

export default function SuppliersListPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Form State
  const [name, setName] = useState('');
  const [companyName, setCompany] = useState('');
  const [phone, setPhone] = useState('');
  const [alternatePhone, setAltPhone] = useState('');
  const [address, setAddress] = useState('');
  const [openingBalance, setOpeningBalance] = useState<number>(0);
  const [notes, setNotes] = useState('');
  const [modalError, setModalError] = useState<string | null>(null);

  const { data: suppliers, isLoading } = useQuery({
    queryKey: ['suppliers', search],
    queryFn: () => api.get<any[]>(`/suppliers${search ? `?search=${encodeURIComponent(search)}` : ''}`),
  });

  const createSupplierMutation = useMutation({
    mutationFn: (payload: any) => api.post('/suppliers', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
      setIsModalOpen(false);
      setName('');
      setCompany('');
      setPhone('');
      setAltPhone('');
      setAddress('');
      setOpeningBalance(0);
      setNotes('');
      setModalError(null);
    },
    onError: (err: any) => {
      setModalError(err.message || 'Failed to add supplier');
    },
  });

  const handleCreateSupplier = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setModalError('Supplier name is required');
      return;
    }
    if (!phone.trim()) {
      setModalError('Phone number is required');
      return;
    }

    createSupplierMutation.mutate({
      name,
      companyName: companyName || undefined,
      phone,
      alternatePhone: alternatePhone || undefined,
      address: address || undefined,
      openingBalance: Number(openingBalance) || 0,
      notes: notes || undefined,
    });
  };

  const totalPayables = suppliers?.reduce(
    (sum, s) => (s.currentBalance > 0 ? sum + s.currentBalance : sum),
    0
  ) || 0;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center">
            <Building2 className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">Supplier Khata</h1>
            <p className="text-xs text-slate-500">Mill payables & wholesale fabric suppliers</p>
          </div>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm shadow-md shadow-emerald-600/20 active:scale-95 transition"
        >
          <Plus className="w-4 h-4" />
          <span>Add Supplier</span>
        </button>
      </div>

      {/* Payables Summary Banner */}
      <div className="bg-gradient-to-r from-amber-600 to-orange-600 text-white p-4 rounded-2xl shadow-sm flex items-center justify-between">
        <div>
          <span className="text-xs text-amber-100 font-semibold uppercase tracking-wider">
            Total Supplier Payables (You Need to Pay)
          </span>
          <p className="text-xl sm:text-2xl font-black mt-0.5">{formatPKR(totalPayables)}</p>
        </div>
        <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center">
          <CreditCard className="w-5 h-5 text-white" />
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search supplier by name, company, or phone..."
          className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 shadow-sm"
        />
      </div>

      {/* List */}
      {isLoading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : suppliers?.length === 0 ? (
        <div className="bg-white p-8 rounded-2xl border border-slate-200 text-center space-y-3">
          <p className="text-sm font-medium text-slate-500">No suppliers found.</p>
          <button
            onClick={() => setIsModalOpen(true)}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-600 hover:text-emerald-700"
          >
            <Plus className="w-4 h-4" />
            <span>Add supplier now</span>
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {suppliers?.map((supp: any) => {
            const isPayable = supp.currentBalance > 0;
            const isAdvance = supp.currentBalance < 0;

            return (
              <a
                key={supp.id}
                href={`/suppliers/${supp.id}`}
                className="block bg-white p-4 rounded-2xl border border-slate-200 hover:border-emerald-300 transition shadow-sm active:scale-[0.99]"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center font-bold text-slate-700 text-sm shrink-0">
                      {supp.name.charAt(0)}
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-sm text-slate-900 truncate">{supp.name}</p>
                      {supp.companyName && (
                        <p className="text-xs text-slate-600 font-medium truncate">{supp.companyName}</p>
                      )}
                      <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                        <Phone className="w-3 h-3 shrink-0" />
                        <span>{supp.phone}</span>
                      </p>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <p className={`text-base font-extrabold ${
                      isPayable ? 'text-amber-600' : isAdvance ? 'text-emerald-600' : 'text-slate-700'
                    }`}>
                      {formatPKR(Math.abs(supp.currentBalance))}
                    </p>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                      isPayable
                        ? 'bg-amber-50 text-amber-700'
                        : isAdvance
                        ? 'bg-emerald-50 text-emerald-700'
                        : 'bg-slate-100 text-slate-600'
                    }`}>
                      {isPayable ? 'You Owe Supplier' : isAdvance ? 'Advance Given' : 'Settled'}
                    </span>
                  </div>
                </div>
              </a>
            );
          })}
        </div>
      )}

      {/* Modal: Add Supplier */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4 animate-in fade-in zoom-in-95 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
                <Building2 className="w-4 h-4 text-emerald-600" />
                <span>Add Fabric Supplier / Mill</span>
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {modalError && (
              <div className="p-3 bg-red-50 text-red-700 text-xs rounded-xl border border-red-200">
                {modalError}
              </div>
            )}

            <form onSubmit={handleCreateSupplier} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Supplier / Contact Name *</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Haji Noor Muhammad"
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Mill / Company Name</label>
                <input
                  type="text"
                  value={companyName}
                  onChange={(e) => setCompany(e.target.value)}
                  placeholder="e.g. Sitara Textile Mills"
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Mobile Number *</label>
                  <input
                    type="tel"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="03001234567"
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Alternate Phone</label>
                  <input
                    type="tel"
                    value={alternatePhone}
                    onChange={(e) => setAltPhone(e.target.value)}
                    placeholder="Optional"
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Address / Mill Hub</label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="e.g. Landhi Industrial Area, Karachi"
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Opening Payable Balance (PKR)</label>
                <input
                  type="number"
                  value={openingBalance}
                  onChange={(e) => setOpeningBalance(parseFloat(e.target.value) || 0)}
                  placeholder="0"
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Notes</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  placeholder="Payment terms, delivery transport..."
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
                  disabled={createSupplierMutation.isPending}
                  className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold transition disabled:opacity-50"
                >
                  {createSupplierMutation.isPending ? 'Saving...' : 'Save Supplier'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
