'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import {
  Settings,
  Building,
  FileText,
  Lock,
  ShieldCheck,
  CheckCircle,
  AlertCircle,
  Image as ImageIcon,
} from 'lucide-react';

export default function SettingsPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'business' | 'template' | 'security' | 'audit'>('business');

  // Business Settings State
  const [businessName, setBusinessName] = useState('');
  const [tagline, setTagline] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [ntn, setNtn] = useState('');
  const [bizSuccess, setBizSuccess] = useState(false);
  const [bizError, setBizError] = useState<string | null>(null);

  // Template State
  const [footerText, setFooterText] = useState('');
  const [terms, setTerms] = useState('');
  const [showPrevBal, setShowPrevBal] = useState(true);
  const [showTotalOut, setShowTotalOut] = useState(true);
  const [tmplSuccess, setTmplSuccess] = useState(false);
  const [tmplError, setTmplError] = useState<string | null>(null);

  // Password State
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwdSuccess, setPwdSuccess] = useState(false);
  const [pwdError, setPwdError] = useState<string | null>(null);

  // Fetch Business Settings
  const { data: settings } = useQuery({
    queryKey: ['settings'],
    queryFn: () => api.get<any>('/settings'),
  });

  // Fetch Template
  const { data: template } = useQuery({
    queryKey: ['invoiceTemplate'],
    queryFn: () => api.get<any>('/settings/invoice-template'),
  });

  // Fetch Audit Logs
  const { data: auditData } = useQuery({
    queryKey: ['auditLogs'],
    queryFn: () => api.get<any>('/settings/audit-logs'),
  });

  React.useEffect(() => {
    if (settings) {
      setBusinessName(settings.businessName || '');
      setTagline(settings.tagline || '');
      setPhone(settings.phone || '');
      setAddress(settings.address || '');
      setNtn(settings.ntnOrTaxNumber || '');
    }
  }, [settings]);

  React.useEffect(() => {
    if (template) {
      setFooterText(template.footerText || '');
      setTerms(template.termsAndConditions || '');
      setShowPrevBal(template.showPreviousBalance ?? true);
      setShowTotalOut(template.showTotalOutstanding ?? true);
    }
  }, [template]);

  // Mutations
  const updateSettingsMutation = useMutation({
    mutationFn: (payload: any) => api.put('/settings', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
      setBizSuccess(true);
      setBizError(null);
      setTimeout(() => setBizSuccess(false), 3000);
    },
    onError: (err: any) => setBizError(err.message || 'Failed to update settings'),
  });

  const updateTemplateMutation = useMutation({
    mutationFn: (payload: any) => api.put('/settings/invoice-template', payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invoiceTemplate'] });
      setTmplSuccess(true);
      setTmplError(null);
      setTimeout(() => setTmplSuccess(false), 3000);
    },
    onError: (err: any) => setTmplError(err.message || 'Failed to update template'),
  });

  const changePasswordMutation = useMutation({
    mutationFn: (payload: any) => api.post('/auth/change-password', payload),
    onSuccess: () => {
      setPwdSuccess(true);
      setPwdError(null);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => setPwdSuccess(false), 3000);
    },
    onError: (err: any) => setPwdError(err.message || 'Failed to change password'),
  });

  const handleSaveBusiness = (e: React.FormEvent) => {
    e.preventDefault();
    updateSettingsMutation.mutate({
      businessName,
      tagline,
      phone,
      address,
      ntnOrTaxNumber: ntn,
    });
  };

  const handleSaveTemplate = (e: React.FormEvent) => {
    e.preventDefault();
    updateTemplateMutation.mutate({
      footerText,
      termsAndConditions: terms,
      showPreviousBalance: showPrevBal,
      showTotalOutstanding: showTotalOut,
    });
  };

  const handleChangePassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setPwdError('New passwords do not match');
      return;
    }
    if (newPassword.length < 6) {
      setPwdError('New password must be at least 6 characters');
      return;
    }
    changePasswordMutation.mutate({
      currentPassword,
      newPassword,
      confirmPassword,
    });
  };

  return (
    <div className="space-y-5 max-w-4xl mx-auto pb-16">
      {/* Header */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-brand-muted shadow-subtle flex items-center gap-3.5">
        <div className="w-11 h-11 rounded-xl bg-brand-deep text-white flex items-center justify-center">
          <Settings className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-brand-charcoal tracking-tight font-sans">System Settings</h1>
          <p className="text-xs text-gray-500">Business identity, invoice template, and security</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border border-brand-muted bg-white rounded-2xl p-1.5 shadow-subtle overflow-x-auto text-xs font-bold gap-1">
        <button
          onClick={() => setActiveTab('business')}
          className={`flex-1 py-2.5 px-3 rounded-xl whitespace-nowrap transition flex items-center justify-center gap-1.5 ${
            activeTab === 'business' ? 'bg-brand-deep text-white shadow-sm' : 'text-gray-600 hover:text-brand-charcoal'
          }`}
        >
          <Building className="w-4 h-4" />
          <span>Business Info</span>
        </button>

        <button
          onClick={() => setActiveTab('template')}
          className={`flex-1 py-2.5 px-3 rounded-xl whitespace-nowrap transition flex items-center justify-center gap-1.5 ${
            activeTab === 'template' ? 'bg-brand-deep text-white shadow-sm' : 'text-gray-600 hover:text-brand-charcoal'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>Invoice Template</span>
        </button>

        <button
          onClick={() => setActiveTab('security')}
          className={`flex-1 py-2.5 px-3 rounded-xl whitespace-nowrap transition flex items-center justify-center gap-1.5 ${
            activeTab === 'security' ? 'bg-brand-deep text-white shadow-sm' : 'text-gray-600 hover:text-brand-charcoal'
          }`}
        >
          <Lock className="w-4 h-4" />
          <span>Change Password</span>
        </button>

        <button
          onClick={() => setActiveTab('audit')}
          className={`flex-1 py-2.5 px-3 rounded-xl whitespace-nowrap transition flex items-center justify-center gap-1.5 ${
            activeTab === 'audit' ? 'bg-brand-deep text-white shadow-sm' : 'text-gray-600 hover:text-brand-charcoal'
          }`}
        >
          <ShieldCheck className="w-4 h-4" />
          <span>Audit Logs</span>
        </button>
      </div>

      {/* TAB 1: BUSINESS INFO */}
      {activeTab === 'business' && (
        <form onSubmit={handleSaveBusiness} className="bg-white p-5 sm:p-6 rounded-2xl border border-brand-muted shadow-subtle space-y-5 text-xs">
          {/* Logo Showcase Banner */}
          <div className="p-4 rounded-2xl bg-brand-light border border-brand-muted flex flex-col sm:flex-row items-center gap-4">
            <div className="w-20 h-20 flex items-center justify-center shrink-0">
              <Image
                src="/logo.png"
                alt="Fatani Fabrics Logo"
                width={80}
                height={80}
                className="w-full h-full object-contain"
              />
            </div>
            <div className="text-center sm:text-left">
              <span className="text-[10px] font-bold uppercase tracking-wider text-brand-fabric bg-white px-2 py-0.5 rounded-full border border-brand-muted">
                Official ERP Brand Asset
              </span>
              <h3 className="font-extrabold text-sm sm:text-base text-brand-charcoal mt-1">
                Fatani Fabrics Brand Logo
              </h3>
              <p className="text-xs text-gray-500 mt-0.5">
                Saved in <code className="font-mono text-brand-fabric font-semibold">apps/frontend/public/logo.png</code> with web optimization. Appears on desktop & mobile navigation, invoices, and login.
              </p>
            </div>
          </div>

          {bizSuccess && (
            <div className="p-3 bg-emerald-50 text-emerald-800 rounded-xl border border-emerald-200 flex items-center gap-2 font-medium">
              <CheckCircle className="w-4 h-4" />
              <span>Business settings updated successfully!</span>
            </div>
          )}
          {bizError && (
            <div className="p-3 bg-red-50 text-red-700 rounded-xl border border-red-200">
              {bizError}
            </div>
          )}

          <div>
            <label className="block font-semibold text-brand-charcoal uppercase tracking-wider mb-1">Business Name *</label>
            <input
              type="text"
              required
              value={businessName}
              onChange={(e) => setBusinessName(e.target.value)}
              className="w-full p-2.5 bg-brand-light border border-brand-muted rounded-xl font-bold text-sm text-brand-charcoal focus:ring-2 focus:ring-brand-fabric outline-none"
            />
          </div>

          <div>
            <label className="block font-semibold text-brand-charcoal uppercase tracking-wider mb-1">Tagline / Sub-heading</label>
            <input
              type="text"
              value={tagline}
              onChange={(e) => setTagline(e.target.value)}
              className="w-full p-2.5 bg-brand-light border border-brand-muted rounded-xl text-brand-charcoal focus:ring-2 focus:ring-brand-fabric outline-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-brand-charcoal uppercase tracking-wider mb-1">Phone Number *</label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full p-2.5 bg-brand-light border border-brand-muted rounded-xl font-medium text-brand-charcoal focus:ring-2 focus:ring-brand-fabric outline-none"
              />
            </div>

            <div>
              <label className="block font-semibold text-brand-charcoal uppercase tracking-wider mb-1">NTN / Tax ID</label>
              <input
                type="text"
                value={ntn}
                onChange={(e) => setNtn(e.target.value)}
                className="w-full p-2.5 bg-brand-light border border-brand-muted rounded-xl text-brand-charcoal focus:ring-2 focus:ring-brand-fabric outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-brand-charcoal uppercase tracking-wider mb-1">Business Address *</label>
            <textarea
              rows={2}
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="w-full p-2.5 bg-brand-light border border-brand-muted rounded-xl text-brand-charcoal focus:ring-2 focus:ring-brand-fabric outline-none"
            />
          </div>

          <div className="pt-2 flex justify-end">
            <button
              type="submit"
              disabled={updateSettingsMutation.isPending}
              className="px-6 py-2.5 rounded-xl bg-brand-deep hover:bg-brand-fabric text-white font-bold transition disabled:opacity-50 shadow-sm"
            >
              {updateSettingsMutation.isPending ? 'Saving...' : 'Save Business Settings'}
            </button>
          </div>
        </form>
      )}

      {/* TAB 2: INVOICE TEMPLATE */}
      {activeTab === 'template' && (
        <form onSubmit={handleSaveTemplate} className="bg-white p-5 sm:p-6 rounded-2xl border border-brand-muted shadow-subtle space-y-4 text-xs">
          {tmplSuccess && (
            <div className="p-3 bg-emerald-50 text-emerald-800 rounded-xl border border-emerald-200 flex items-center gap-2 font-medium">
              <CheckCircle className="w-4 h-4" />
              <span>Invoice template updated successfully!</span>
            </div>
          )}
          {tmplError && (
            <div className="p-3 bg-red-50 text-red-700 rounded-xl border border-red-200">
              {tmplError}
            </div>
          )}

          <div>
            <label className="block font-semibold text-brand-charcoal uppercase tracking-wider mb-1">Footer Message</label>
            <input
              type="text"
              value={footerText}
              onChange={(e) => setFooterText(e.target.value)}
              placeholder="e.g. Thank you for your business! No claims after fabric is cut."
              className="w-full p-2.5 bg-brand-light border border-brand-muted rounded-xl text-brand-charcoal focus:ring-2 focus:ring-brand-fabric outline-none"
            />
          </div>

          <div>
            <label className="block font-semibold text-brand-charcoal uppercase tracking-wider mb-1">Terms & Conditions</label>
            <textarea
              rows={4}
              value={terms}
              onChange={(e) => setTerms(e.target.value)}
              className="w-full p-2.5 bg-brand-light border border-brand-muted rounded-xl font-mono text-xs text-brand-charcoal focus:ring-2 focus:ring-brand-fabric outline-none"
            />
          </div>

          <div className="space-y-2 pt-2 border-t border-gray-100">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={showPrevBal}
                onChange={(e) => setShowPrevBal(e.target.checked)}
                className="rounded border-gray-300 text-brand-fabric focus:ring-brand-fabric"
              />
              <span className="font-semibold text-brand-charcoal">Show Previous Customer Balance on Invoices</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={showTotalOut}
                onChange={(e) => setShowTotalOut(e.target.checked)}
                className="rounded border-gray-300 text-brand-fabric focus:ring-brand-fabric"
              />
              <span className="font-semibold text-brand-charcoal">Show Total Updated Customer Outstanding</span>
            </label>
          </div>

          <div className="pt-2 flex justify-end">
            <button
              type="submit"
              disabled={updateTemplateMutation.isPending}
              className="px-6 py-2.5 rounded-xl bg-brand-deep hover:bg-brand-fabric text-white font-bold transition disabled:opacity-50 shadow-sm"
            >
              {updateTemplateMutation.isPending ? 'Saving...' : 'Save Template Settings'}
            </button>
          </div>
        </form>
      )}

      {/* TAB 3: SECURITY / CHANGE PASSWORD */}
      {activeTab === 'security' && (
        <form onSubmit={handleChangePassword} className="bg-white p-5 sm:p-6 rounded-2xl border border-brand-muted shadow-subtle space-y-4 text-xs max-w-md">
          {pwdSuccess && (
            <div className="p-3 bg-emerald-50 text-emerald-800 rounded-xl border border-emerald-200 flex items-center gap-2 font-medium">
              <CheckCircle className="w-4 h-4" />
              <span>Password changed successfully!</span>
            </div>
          )}
          {pwdError && (
            <div className="p-3 bg-red-50 text-red-700 rounded-xl border border-red-200">
              {pwdError}
            </div>
          )}

          <div>
            <label className="block font-semibold text-brand-charcoal uppercase tracking-wider mb-1">Current Password *</label>
            <input
              type="password"
              required
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className="w-full p-2.5 bg-brand-light border border-brand-muted rounded-xl text-brand-charcoal focus:ring-2 focus:ring-brand-fabric outline-none"
            />
          </div>

          <div>
            <label className="block font-semibold text-brand-charcoal uppercase tracking-wider mb-1">New Password *</label>
            <input
              type="password"
              required
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full p-2.5 bg-brand-light border border-brand-muted rounded-xl text-brand-charcoal focus:ring-2 focus:ring-brand-fabric outline-none"
            />
          </div>

          <div>
            <label className="block font-semibold text-brand-charcoal uppercase tracking-wider mb-1">Confirm New Password *</label>
            <input
              type="password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full p-2.5 bg-brand-light border border-brand-muted rounded-xl text-brand-charcoal focus:ring-2 focus:ring-brand-fabric outline-none"
            />
          </div>

          <div className="pt-2 flex justify-end">
            <button
              type="submit"
              disabled={changePasswordMutation.isPending}
              className="px-6 py-2.5 rounded-xl bg-brand-deep hover:bg-brand-fabric text-white font-bold transition disabled:opacity-50 shadow-sm"
            >
              {changePasswordMutation.isPending ? 'Updating...' : 'Update Password'}
            </button>
          </div>
        </form>
      )}

      {/* TAB 4: AUDIT LOGS */}
      {activeTab === 'audit' && (
        <div className="bg-white p-5 rounded-2xl border border-brand-muted shadow-subtle space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold text-brand-charcoal uppercase tracking-wider flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-brand-fabric" />
              <span>Security & Audit Log Trail</span>
            </h2>
            <span className="text-xs text-gray-400">{auditData?.logs?.length || 0} recent actions</span>
          </div>

          {auditData?.logs?.length === 0 ? (
            <p className="text-xs text-gray-400 py-4 text-center">No audit logs recorded yet.</p>
          ) : (
            <div className="divide-y divide-gray-100 text-xs">
              {auditData?.logs?.map((log: any) => (
                <div key={log.id} className="py-2.5 flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-brand-charcoal">{log.action}</span>
                      <span className="text-[10px] bg-brand-light text-brand-fabric border border-brand-muted px-2 py-0.5 rounded font-mono font-semibold">
                        {log.entity}
                      </span>
                    </div>
                    <p className="text-[11px] text-gray-400 mt-0.5">
                      User: {log.user?.fullName || 'System'} • IP: {log.ipAddress || '127.0.0.1'}
                    </p>
                  </div>
                  <span className="text-[10px] text-gray-400">
                    {new Date(log.timestamp).toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
