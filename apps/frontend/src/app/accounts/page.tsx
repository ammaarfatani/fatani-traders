'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { formatPKR } from '@fatani/shared';
import {
  Landmark,
  Plus,
  ArrowRightLeft,
  Wallet,
  Building,
  CreditCard,
  X,
  Clock,
  CheckCircle,
} from 'lucide-react';

export default function AccountsPage() {
  const queryClient = useQueryClient();
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [isNewAccountModalOpen, setIsNewAccountModalOpen] = useState(false);

  // Transfer State
  const [fromAccountId, setFromAccountId] = useState('');
  const [toAccountId, setToAccountId] = useState('');
  const [transferAmount, setTransferAmount] = useState<number>(0);
  const [transferDate, setTransferDate] = useState(new Date().toISOString().split('T')[0]);
  const [transferNotes, setTransferNotes] = useState('');
  const [transferError, setTransferError] = useState<string | null>(null);

  // New Account State
  const [accName, setAccName] = useState('');
  const [accType, setAccType] = useState('BANK');
  const [bankName, setBankName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [openingBalance, setOpeningBalance] = useState<number>(0);
  const [accError, setAccError] = useState<string | null>(null);

  const { data: accounts, isLoading } = useQuery({
    queryKey: ['accounts'],
    queryFn: () => api.get<any[]>('/accounts'),
  });

  React.useEffect(() => {
    if (accounts && accounts.length >= 2) {
      if (!fromAccountId) setFromAccountId(accounts[0].id);
      if (!toAccountId) setToAccountId(accounts[1].id);
    }
  }, [accounts, fromAccountId, toAccountId]);

  // Transfer Mutation
  const transferMutation = useMutation({
    mutationFn: (payload: any) => api.post('/accounts/transfer', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      setIsTransferModalOpen(false);
      setTransferAmount(0);
      setTransferNotes('');
      setTransferError(null);
    },
    onError: (err: any) => {
      setTransferError(err.message || 'Transfer failed');
    },
  });

  // Create Account Mutation
  const createAccountMutation = useMutation({
    mutationFn: (payload: any) => api.post('/accounts', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      setIsNewAccountModalOpen(false);
      setAccName('');
      setBankName('');
      setAccountNumber('');
      setOpeningBalance(0);
      setAccError(null);
    },
    onError: (err: any) => {
      setAccError(err.message || 'Failed to create account');
    },
  });

  const handleTransferSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!transferAmount || transferAmount <= 0) {
      setTransferError('Transfer amount must be greater than zero');
      return;
    }
    if (fromAccountId === toAccountId) {
      setTransferError('Source and destination accounts must be different');
      return;
    }

    transferMutation.mutate({
      fromAccountId,
      toAccountId,
      amount: Number(transferAmount),
      date: transferDate,
      notes: transferNotes || undefined,
    });
  };

  const handleCreateAccountSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!accName.trim()) {
      setAccError('Account name is required');
      return;
    }

    createAccountMutation.mutate({
      name: accName,
      type: accType,
      bankName: accType === 'BANK' ? bankName : undefined,
      accountNumber: accountNumber || undefined,
      openingBalance: Number(openingBalance) || 0,
    });
  };

  const totalLiquidity = accounts?.reduce((sum, a) => sum + a.currentBalance, 0) || 0;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-slate-900 text-white flex items-center justify-center">
            <Landmark className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">Cashbook & Bankbook</h1>
            <p className="text-xs text-slate-500">Shop cash drawer, bank accounts & contra transfers</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsTransferModalOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-brand-light hover:bg-brand-muted text-brand-charcoal border border-brand-muted text-xs sm:text-sm font-semibold transition"
          >
            <ArrowRightLeft className="w-4 h-4 text-brand-fabric" />
            <span>Internal Transfer</span>
          </button>

          <button
            onClick={() => setIsNewAccountModalOpen(true)}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-brand-deep hover:bg-brand-fabric text-white text-xs sm:text-sm font-semibold shadow-sm active:scale-95 transition"
          >
            <Plus className="w-4 h-4" />
            <span>New Account</span>
          </button>
        </div>
      </div>

      {/* Total Liquidity Banner */}
      <div className="bg-brand-deep text-white p-5 sm:p-6 rounded-2xl shadow-subtle border border-brand-dark/40 flex items-center justify-between">
        <div>
          <span className="text-xs text-brand-light/90 font-semibold uppercase tracking-wider">
            Total Business Liquidity
          </span>
          <p className="text-2xl sm:text-3xl font-extrabold mt-1 text-emerald-300">
            {formatPKR(totalLiquidity)}
          </p>
          <p className="text-[11px] text-gray-300 mt-1">Sum of all Cash Drawer, Bank, and Mobile Wallet balances</p>
        </div>
        <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center">
          <Landmark className="w-6 h-6 text-white" />
        </div>
      </div>

      {/* Accounts Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {isLoading ? (
          <div className="col-span-full flex justify-center py-10">
            <div className="w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          accounts?.map((acc: any) => {
            const isCash = acc.type === 'CASH';
            const isBank = acc.type === 'BANK';

            return (
              <div
                key={acc.id}
                className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between text-slate-400 mb-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                      {acc.type}
                    </span>
                    {isCash ? (
                      <Wallet className="w-4 h-4 text-emerald-600" />
                    ) : isBank ? (
                      <Building className="w-4 h-4 text-blue-600" />
                    ) : (
                      <CreditCard className="w-4 h-4 text-amber-600" />
                    )}
                  </div>

                  <h3 className="font-bold text-sm text-slate-900 leading-tight">{acc.name}</h3>
                  {acc.accountNumber && (
                    <p className="text-[11px] text-slate-400 font-mono mt-0.5">{acc.accountNumber}</p>
                  )}
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 flex items-baseline justify-between">
                  <span className="text-xs text-slate-500">Balance:</span>
                  <span className="text-base font-extrabold text-slate-900">
                    {formatPKR(acc.currentBalance)}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Modal: Internal Transfer (Contra) */}
      {isTransferModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-bold text-base text-slate-900">Internal Account Transfer (Contra)</h3>
                <p className="text-xs text-slate-500">Move cash between shop drawer and bank accounts</p>
              </div>
              <button
                onClick={() => setIsTransferModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {transferError && (
              <div className="p-3 bg-red-50 text-red-700 text-xs rounded-xl border border-red-200">
                {transferError}
              </div>
            )}

            <form onSubmit={handleTransferSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">From Account (Source) *</label>
                <select
                  value={fromAccountId}
                  onChange={(e) => setFromAccountId(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium"
                >
                  {accounts?.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.name} ({formatPKR(acc.currentBalance)})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">To Account (Destination) *</label>
                <select
                  value={toAccountId}
                  onChange={(e) => setToAccountId(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium"
                >
                  {accounts?.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.name} ({formatPKR(acc.currentBalance)})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Transfer Amount (PKR) *</label>
                <input
                  type="number"
                  min="0"
                  required
                  value={transferAmount}
                  onChange={(e) => setTransferAmount(parseFloat(e.target.value) || 0)}
                  placeholder="0"
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-base font-bold text-slate-900"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Date</label>
                <input
                  type="date"
                  value={transferDate}
                  onChange={(e) => setTransferDate(e.target.value)}
                  required
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Remarks / Slip #</label>
                <input
                  type="text"
                  value={transferNotes}
                  onChange={(e) => setTransferNotes(e.target.value)}
                  placeholder="e.g. Bank deposit slip #8291"
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsTransferModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={transferMutation.isPending}
                  className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold transition disabled:opacity-50"
                >
                  {transferMutation.isPending ? 'Transferring...' : 'Execute Transfer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: New Account */}
      {isNewAccountModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full shadow-2xl space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-base text-slate-900">Add Financial Account</h3>
              <button
                onClick={() => setIsNewAccountModalOpen(false)}
                className="p-1 text-slate-400 hover:text-slate-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {accError && (
              <div className="p-3 bg-red-50 text-red-700 text-xs rounded-xl border border-red-200">
                {accError}
              </div>
            )}

            <form onSubmit={handleCreateAccountSubmit} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Account Name *</label>
                <input
                  type="text"
                  required
                  value={accName}
                  onChange={(e) => setAccName(e.target.value)}
                  placeholder="e.g. Meezan Bank Current A/c"
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Account Type *</label>
                <select
                  value={accType}
                  onChange={(e) => setAccType(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium"
                >
                  <option value="BANK">Bank Account</option>
                  <option value="CASH">Cash Drawer / Peti</option>
                  <option value="WALLET">Mobile Wallet (EasyPaisa / JazzCash)</option>
                </select>
              </div>

              {accType === 'BANK' && (
                <>
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Bank Name</label>
                    <input
                      type="text"
                      value={bankName}
                      onChange={(e) => setBankName(e.target.value)}
                      placeholder="e.g. Meezan Bank / HBL"
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">Account Number / IBAN</label>
                    <input
                      type="text"
                      value={accountNumber}
                      onChange={(e) => setAccountNumber(e.target.value)}
                      placeholder="PK00MEZN..."
                      className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono"
                    />
                  </div>
                </>
              )}

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Opening Balance (PKR)</label>
                <input
                  type="number"
                  value={openingBalance}
                  onChange={(e) => setOpeningBalance(parseFloat(e.target.value) || 0)}
                  placeholder="0"
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsNewAccountModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 font-semibold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createAccountMutation.isPending}
                  className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold transition disabled:opacity-50"
                >
                  {createAccountMutation.isPending ? 'Saving...' : 'Save Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
