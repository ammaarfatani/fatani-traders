'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { RecordActions } from '@/components/ui/RecordActions';
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
  const [openingBalance, setOpeningBalance] = useState<number | ''>('');
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
      setOpeningBalance('');
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
      name: name.trim(),
      companyName: companyName.trim() || undefined,
      phone: phone.trim(),
      alternatePhone: alternatePhone.trim() || undefined,
      address: address.trim() || undefined,
      openingBalance: openingBalance === '' ? undefined : Number(openingBalance),
      notes: notes.trim() || undefined,
    });
  };

  const totalPayables =
    suppliers?.reduce((sum, s) => (s.currentBalance > 0 ? sum + s.currentBalance : sum), 0) || 0;

  return (
    <div className="space-y-5 max-w-4xl mx-auto pb-16">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 sm:p-5 rounded-2xl border border-brand-muted shadow-subtle">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-brand-deep text-white flex items-center justify-center">
            <Building2 className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-brand-charcoal tracking-tight font-sans">
              Supplier Khata (Payables)
            </h1>
            <p className="text-xs text-gray-500">Fabric mills, brokers, and wholesale suppliers</p>
          </div>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-brand-deep hover:bg-brand-fabric text-white font-semibold text-xs sm:text-sm shadow-sm active:scale-95 transition"
        >
          <Plus className="w-4 h-4" />
          <span>Add Supplier</span>
        </button>
      </div>

      {/* Total Payables Banner */}
      <div className="bg-brand-deep text-white p-5 sm:p-6 rounded-2xl shadow-subtle border border-brand-dark/40 flex items-center justify-between">
        <div>
          <span className="text-xs text-brand-light/90 font-semibold uppercase tracking-wider">
            Total Supplier Payables (Mill Dues)
          </span>
          <p className="text-2xl sm:text-3xl font-extrabold mt-1 text-amber-300">{formatPKR(totalPayables)}</p>
          <p className="text-[11px] text-gray-300 mt-1">Outstanding amounts owed for fabric purchases</p>
        </div>
        <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center">
          <CreditCard className="w-6 h-6 text-white" />
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative">
        <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search supplier by name, company, or phone..."
          className="w-full pl-10 pr-4 py-2.5 bg-white border border-brand-muted rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-brand-fabric shadow-subtle text-brand-charcoal"
        />
      </div>

      {/* List */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <div className="w-8 h-8 border-4 border-brand-fabric border-t-transparent rounded-full animate-spin" />
          <p className="text-xs text-gray-500 font-semibold uppercase tracking-wider">Loading Suppliers...</p>
        </div>
      ) : suppliers?.length === 0 ? (
        <div className="bg-white p-8 rounded-2xl border border-brand-muted text-center space-y-3">
          <p className="text-sm font-medium text-gray-500">No suppliers found.</p>
          <button
            onClick={() => setIsModalOpen(true)}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-brand-fabric hover:text-brand-accent"
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
              <div
                key={supp.id}
                className="block bg-white p-4 sm:p-5 rounded-2xl border border-brand-muted hover:border-brand-fabric/50 transition shadow-subtle active:scale-[0.99]"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 rounded-full bg-brand-light border border-brand-muted flex items-center justify-center font-bold text-brand-charcoal text-sm shrink-0">
                      {supp.name.charAt(0)}
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-sm text-brand-charcoal truncate">{supp.name}</p>
                      {supp.companyName && (
                        <p className="text-xs text-gray-600 font-medium truncate">{supp.companyName}</p>
                      )}
                      <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                        <Phone className="w-3 h-3 shrink-0" />
                        <span>{supp.phone}</span>
                      </p>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <p
                      className={`text-base font-extrabold ${
                        isPayable ? 'text-amber-600' : isAdvance ? 'text-emerald-700' : 'text-brand-charcoal'
                      }`}
                    >
                      {formatPKR(Math.abs(supp.currentBalance))}
                    </p>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                        isPayable
                          ? 'bg-amber-50 text-amber-700 border border-amber-200'
                          : isAdvance
                          ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                          : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {isPayable ? 'Payable' : isAdvance ? 'Advance Paid' : 'Settled'}
                    </span>
                  </div>
                </div>
              <Link href={`/suppliers/${supp.id}`} className="inline-block py-3 text-sm underline">View history</Link>
                <RecordActions record={supp} endpoint={`/suppliers/${supp.id}`} label={supp.name} fields={[
                  {key:'name',label:'Name',required:true}, {key:'companyName',label:'Business name'},
                  {key:'phone',label:'Phone',required:true}, {key:'alternatePhone',label:'Alternate phone'},
                  {key:'address',label:'Address'}, {key:'notes',label:'Notes'}
                ]} />
              </div>
            );
          })}
        </div>
      )}

      {/* Modal: Add Supplier */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-brand-deep/70 backdrop-blur-sm">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4 animate-in fade-in zoom-in-95 max-h-[90vh] overflow-y-auto border border-brand-muted">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h3 className="font-bold text-base text-brand-charcoal flex items-center gap-2">
                <Building2 className="w-4 h-4 text-brand-fabric" />
                <span>Add Fabric Supplier</span>
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 text-gray-400 hover:text-gray-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {modalError && (
              <div className="p-3 bg-red-50 text-red-700 text-xs rounded-xl border border-red-200 font-medium">
                {modalError}
              </div>
            )}

            <form onSubmit={handleCreateSupplier} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold uppercase tracking-wider text-brand-charcoal mb-1">Supplier / Contact Person *</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Al-Karam Mills / Haji Usman"
                  className="w-full p-2.5 bg-brand-light border border-brand-muted rounded-xl text-sm font-bold text-brand-charcoal focus:ring-2 focus:ring-brand-fabric outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold uppercase tracking-wider text-brand-charcoal mb-1">Mill / Company Name</label>
                <input
                  type="text"
                  value={companyName}
                  onChange={(e) => setCompany(e.target.value)}
                  placeholder="e.g. Al-Karam Textile Mills Ltd"
                  className="w-full p-2.5 bg-brand-light border border-brand-muted rounded-xl text-brand-charcoal focus:ring-2 focus:ring-brand-fabric outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold uppercase tracking-wider text-brand-charcoal mb-1">Phone Number *</label>
                  <input
                    type="text"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="03001234567"
                    className="w-full p-2.5 bg-brand-light border border-brand-muted rounded-xl text-brand-charcoal focus:ring-2 focus:ring-brand-fabric outline-none"
                  />
                </div>

                <div>
                  <label className="block font-semibold uppercase tracking-wider text-brand-charcoal mb-1">Alternate Phone</label>
                  <input
                    type="text"
                    value={alternatePhone}
                    onChange={(e) => setAltPhone(e.target.value)}
                    placeholder="021-..."
                    className="w-full p-2.5 bg-brand-light border border-brand-muted rounded-xl text-brand-charcoal focus:ring-2 focus:ring-brand-fabric outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold uppercase tracking-wider text-brand-charcoal mb-1">Address / Mill Location</label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="e.g. SITE Area, Karachi"
                  className="w-full p-2.5 bg-brand-light border border-brand-muted rounded-xl text-brand-charcoal focus:ring-2 focus:ring-brand-fabric outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold uppercase tracking-wider text-brand-charcoal mb-1">Opening Payable (PKR)</label>
                <input
                  type="number"
                  value={openingBalance}
                  onChange={(e) => setOpeningBalance(e.target.value === '' ? '' : Number(e.target.value))}
                  placeholder="0"
                  className="w-full p-2.5 bg-brand-light border border-brand-muted rounded-xl text-brand-charcoal focus:ring-2 focus:ring-brand-fabric outline-none"
                />
              </div>

              <div>
                <label className="block font-semibold uppercase tracking-wider text-brand-charcoal mb-1">Notes</label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. Lawn supplier, 15-day payment term"
                  className="w-full p-2.5 bg-brand-light border border-brand-muted rounded-xl text-brand-charcoal focus:ring-2 focus:ring-brand-fabric outline-none"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-brand-muted font-semibold text-gray-600 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createSupplierMutation.isPending}
                  className="px-5 py-2.5 rounded-xl bg-brand-deep hover:bg-brand-fabric text-white font-bold transition disabled:opacity-50 shadow-sm"
                >
                  {createSupplierMutation.isPending ? 'Saving...' : 'Add Supplier'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
