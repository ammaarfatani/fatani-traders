'use client';

import React from 'react';
import {
  X,
  LayoutDashboard,
  ShoppingCart,
  Receipt,
  Users,
  Building2,
  Package,
  Wallet,
  Landmark,
  BarChart3,
  Settings,
  LogOut,
  Layers,
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

  if (!isOpen) return null;

  const links = [
    { name: 'Dashboard', href: '/', icon: LayoutDashboard },
    { name: 'Customer Khata', href: '/customers', icon: Users },
    { name: 'Sales & Invoices', href: '/sales', icon: Receipt },
    { name: 'Purchases & Lots', href: '/purchases', icon: ShoppingCart },
    { name: 'Supplier Khata', href: '/suppliers', icon: Building2 },
    { name: 'Lot Inventory', href: '/inventory', icon: Package },
    { name: 'Cash & Bank (Cashbook)', href: '/accounts', icon: Landmark },
    { name: 'Operating Expenses', href: '/expenses', icon: Wallet },
    { name: 'Profit & Loss Reports', href: '/reports', icon: BarChart3 },
    { name: 'Business Settings', href: '/settings', icon: Settings },
  ];

  return (
    <div className="lg:hidden fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Drawer Content */}
      <div className="relative ml-auto w-4/5 max-w-xs bg-slate-900 text-white h-full flex flex-col shadow-2xl z-10 animate-in slide-in-from-right duration-200">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center">
              <Layers className="w-4 h-4 text-white" />
            </div>
            <div>
              <p className="font-bold text-sm text-white">FATANI TRADERS</p>
              <p className="text-[10px] text-emerald-400">Navigation Menu</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto p-3 space-y-1">
          {links.map((link) => {
            const Icon = link.icon;
            return (
              <a
                key={link.href}
                href={link.href}
                onClick={onClose}
                className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-slate-300 hover:text-white hover:bg-slate-800"
              >
                <Icon className="w-5 h-5 text-emerald-400" />
                <span>{link.name}</span>
              </a>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-800 bg-slate-950/60">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center font-bold text-xs text-emerald-400">
              {user?.fullName?.charAt(0) || 'A'}
            </div>
            <div className="overflow-hidden">
              <p className="text-xs font-semibold text-white truncate">{user?.fullName}</p>
              <p className="text-[10px] text-slate-400 truncate">{user?.email}</p>
            </div>
          </div>

          <button
            onClick={() => {
              onClose();
              logout();
            }}
            className="w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-red-950/40 text-red-400 text-xs font-medium hover:bg-red-900/40 border border-red-900/30 transition"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out</span>
          </button>
        </div>
      </div>
    </div>
  );
}
