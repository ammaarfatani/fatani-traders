'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { useAuth } from '@/context/AuthContext';
import { Lock, Mail, ArrowRight, ShieldCheck, CheckCircle2, AlertCircle } from 'lucide-react';

export default function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState('admin@fatanitraders.com');
  const [password, setPassword] = useState('Fatani@Admin2026!');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      await login(email, password);
    } catch (err: any) {
      setError(err.message || 'Login failed. Please check your credentials.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-brand-ivory flex flex-col lg:flex-row">
      {/* Desktop Left / Mobile Top: Brand Visual & Textile Imagery */}
      <div className="relative w-full lg:w-1/2 min-h-[280px] lg:min-h-screen flex flex-col justify-between p-6 sm:p-10 lg:p-16 overflow-hidden bg-brand-deep">
        {/* Background Image with Dark Teal Overlay */}
        <div
          className="absolute inset-0 bg-cover bg-center opacity-30 mix-blend-overlay"
          style={{ backgroundImage: `url('/textile-hero.jpg')` }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-brand-deep via-brand-deep/90 to-brand-deep/75" />

        {/* Top Logo & Identity */}
        <div className="relative z-10 flex items-center gap-4">
          <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl bg-white/95 p-2 shadow-xl shadow-black/20 flex items-center justify-center backdrop-blur-sm border border-white/20">
            <Image
              src="/logo.png"
              alt="Fatani Fabrics Logo"
              width={64}
              height={64}
              className="w-full h-full object-contain"
              priority
            />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-wider text-white uppercase font-sans">
              FATANI TRADERS
            </h1>
            <p className="text-xs sm:text-sm font-medium text-brand-accent tracking-widest uppercase">
              Textile Trading & Khata ERP
            </p>
          </div>
        </div>

        {/* Middle Feature Highlights (Desktop) */}
        <div className="relative z-10 hidden lg:block my-auto max-w-lg space-y-6">
          <div className="inline-block px-3 py-1 rounded-full bg-brand-fabric/40 border border-brand-accent/30 text-xs font-semibold text-brand-light tracking-wide uppercase">
            Specialized Wholesale Platform
          </div>
          <h2 className="text-3xl lg:text-4xl font-extrabold text-white leading-tight">
            Precision fabric inventory, lot-wise landed cost & instant khata.
          </h2>
          <p className="text-sm text-gray-300 leading-relaxed">
            Engineered exclusively for fabric rolls, thaan by weight, multi-step landed cost accounting, and customer credit management.
          </p>

          <div className="space-y-3 pt-2">
            {[
              'Integer-Gram precision for zero weight discrepancy',
              'Dynamic landed-cost engine with post-purchase adjustments',
              'DigiKhata-inspired customer & supplier ledgers with WhatsApp export',
              'Real-time accrual Profit & Loss and inventory valuation',
            ].map((feat, i) => (
              <div key={i} className="flex items-center gap-3 text-xs sm:text-sm text-gray-200">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{feat}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom Trust Badge */}
        <div className="relative z-10 pt-4 border-t border-white/10 flex items-center justify-between text-xs text-gray-300">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Single-Admin Encrypted Access</span>
          </div>
          <span className="text-gray-400">v1.0 Production</span>
        </div>
      </div>

      {/* Right Form Section: Clean, Elegant, Mobile-First */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-6 sm:p-12 lg:p-16">
        <div className="w-full max-w-md space-y-8">
          <div>
            <h2 className="text-2xl sm:text-3xl font-extrabold text-brand-charcoal tracking-tight">
              Sign In to ERP
            </h2>
            <p className="mt-1.5 text-sm text-gray-600">
              Enter your credentials to access inventory, sales, and accounts.
            </p>
          </div>

          <form className="space-y-6" onSubmit={handleSubmit}>
            {error && (
              <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-800 text-sm flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-xs uppercase tracking-wider text-red-900">Authentication Error</p>
                  <p className="text-xs sm:text-sm mt-0.5">{error}</p>
                </div>
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-brand-charcoal uppercase tracking-wider mb-2">
                  Admin Email Address
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                    <Mail className="w-5 h-5" />
                  </div>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="block w-full pl-11 pr-4 py-3.5 bg-white border border-brand-muted rounded-xl text-brand-charcoal text-sm font-medium focus:ring-2 focus:ring-brand-fabric focus:border-brand-fabric outline-none transition-shadow shadow-sm"
                    placeholder="admin@fatanitraders.com"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-brand-charcoal uppercase tracking-wider mb-2">
                  Admin Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-gray-400">
                    <Lock className="w-5 h-5" />
                  </div>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="block w-full pl-11 pr-4 py-3.5 bg-white border border-brand-muted rounded-xl text-brand-charcoal text-sm font-medium focus:ring-2 focus:ring-brand-fabric focus:border-brand-fabric outline-none transition-shadow shadow-sm"
                    placeholder="••••••••••••"
                  />
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full flex items-center justify-center gap-2 py-3.5 px-6 rounded-xl text-sm font-bold text-white bg-brand-deep hover:bg-brand-fabric active:scale-[0.99] transition-all shadow-md shadow-brand-deep/20 disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <span>Sign In to Dashboard</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>

            {/* Quick Demo Credentials Pill */}
            <div className="p-4 rounded-xl bg-brand-light/70 border border-brand-muted text-xs text-brand-charcoal space-y-1.5">
              <div className="flex items-center gap-1.5 font-semibold text-brand-fabric">
                <CheckCircle2 className="w-4 h-4 text-brand-fabric" />
                <span>Initial Admin Seed Credentials</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 text-gray-600 font-mono text-[11px] pt-1">
                <div>Email: <span className="text-brand-deep font-semibold">admin@fatanitraders.com</span></div>
                <div>Pass: <span className="text-brand-deep font-semibold">Fatani@Admin2026!</span></div>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
