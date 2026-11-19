'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import {
  X,
  LayoutDashboard,
  ShoppingCart,
  Package,
  Receipt,
  Users,
  Building2,
  CreditCard,
  Wallet,
  RotateCcw,
  BarChart3,
  Settings,
  LogOut,
  ShieldCheck,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

export default function MobileDrawer({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const { user, logout } = useAuth();
  const pathname = usePathname();

  if (!isOpen) return null;

  const links = [
    { name: 'Dashboard', href: '/', icon: LayoutDashboard },
    { name: 'Purchases', href: '/purchases', icon: ShoppingCart },
    { name: 'Inventory', href: '/inventory', icon: Package },
    { name: 'Sales', href: '/sales', icon: Receipt },
    { name: 'Customers', href: '/customers', icon: Users },
    { name: 'Suppliers', href: '/suppliers', icon: Building2 },
    { name: 'Payments', href: '/payments', icon: CreditCard },
    { name: 'Expenses', href: '/expenses', icon: Wallet },
    { name: 'Returns', href: '/returns', icon: RotateCcw },
    { name: 'Reports', href: '/reports', icon: BarChart3 },
    { name: 'Settings', href: '/settings', icon: Settings },
  ];

  return (
    <div className="lg:hidden fixed inset-0 z-50 flex">
      {/* Backdrop overlay */}
      <div
        className="fixed inset-0 bg-brand-deep/80 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Drawer Panel */}
      <div className="relative ml-auto w-4/5 max-w-xs bg-brand-deep text-white h-full flex flex-col shadow-2xl z-10 animate-in slide-in-from-right duration-200 border-l border-white/10">
        <div className="p-4 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-white p-1 shadow flex items-center justify-center shrink-0">
              <Image
                src="/logo.png"
                alt="Fatani Fabrics Logo"
                width={36}
                height={36}
                className="w-full h-full object-contain"
              />
            </div>
            <div>
              <h2 className="font-bold text-sm tracking-wide text-white leading-tight font-sans">
                FATANI TRADERS
              </h2>
              <p className="text-[10px] text-brand-accent uppercase tracking-wider font-semibold">
                Textile ERP
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-300 hover:text-white hover:bg-white/10 transition-colors"
            aria-label="Close menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Links list */}
        <div className="flex-1 overflow-y-auto p-3 space-y-1">
          {links.map((link) => {
            const Icon = link.icon;
            const isActive = pathname === link.href || (link.href !== '/' && pathname.startsWith(link.href));

            return (
              <Link
                key={link.href}
                href={link.href}
                onClick={onClose}
                className={`flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-semibold transition-all ${
                  isActive
                    ? 'bg-brand-fabric text-white shadow-sm'
                    : 'text-gray-300 hover:bg-white/10 hover:text-white'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-brand-accent'}`} />
                <span>{link.name}</span>
              </Link>
            );
          })}
        </div>

        {/* User profile & logout */}
        <div className="p-4 border-t border-white/10 bg-brand-dark/50 space-y-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-brand-fabric flex items-center justify-center text-white text-xs font-bold">
              {user?.fullName?.charAt(0) || 'A'}
            </div>
            <div className="truncate">
              <p className="text-xs font-semibold text-white truncate">{user?.fullName || 'Admin User'}</p>
              <div className="flex items-center gap-1 text-[10px] text-emerald-400">
                <ShieldCheck className="w-3 h-3" />
                <span>{user?.email || 'admin@fatanitraders.com'}</span>
              </div>
            </div>
          </div>

          <button
            onClick={() => {
              onClose();
              logout();
            }}
            className="w-full flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs font-bold text-red-200 bg-red-950/60 hover:bg-red-900 border border-red-800/60 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out</span>
          </button>
        </div>
      </div>
    </div>
  );
}
