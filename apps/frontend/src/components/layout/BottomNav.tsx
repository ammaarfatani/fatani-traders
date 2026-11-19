'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  PlusCircle,
  ShoppingCart,
  Menu,
} from 'lucide-react';

export default function BottomNav({ onOpenMenu }: { onOpenMenu: () => void }) {
  const pathname = usePathname();

  const isHome = pathname === '/';
  const isKhata = pathname.startsWith('/customers');
  const isPurchases = pathname.startsWith('/purchases');
  const isNewSale = pathname === '/sales/new';

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-slate-200 py-1 px-3 flex justify-between items-center shadow-lg">
      {/* Home */}
      <a
        href="/"
        className={`flex flex-col items-center justify-center flex-1 py-1 ${
          isHome ? 'text-emerald-700 font-bold' : 'text-slate-500'
        }`}
      >
        <LayoutDashboard className="w-5 h-5 mb-0.5" />
        <span className="text-[11px]">Home</span>
      </a>

      {/* Customer Khata */}
      <a
        href="/customers"
        className={`flex flex-col items-center justify-center flex-1 py-1 ${
          isKhata ? 'text-emerald-700 font-bold' : 'text-slate-500'
        }`}
      >
        <Users className="w-5 h-5 mb-0.5" />
        <span className="text-[11px]">Khata</span>
      </a>

      {/* Center + New Sale Action */}
      <div className="flex-1 flex justify-center -mt-5">
        <a
          href="/sales/new"
          className="w-12 h-12 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white flex items-center justify-center shadow-lg shadow-emerald-600/40 active:scale-95 transition-transform"
          aria-label="New Sale"
        >
          <PlusCircle className="w-6 h-6" />
        </a>
      </div>

      {/* Purchases */}
      <a
        href="/purchases"
        className={`flex flex-col items-center justify-center flex-1 py-1 ${
          isPurchases ? 'text-emerald-700 font-bold' : 'text-slate-500'
        }`}
      >
        <ShoppingCart className="w-5 h-5 mb-0.5" />
        <span className="text-[11px]">Purchases</span>
      </a>

      {/* Menu / Drawer Toggle */}
      <button
        type="button"
        onClick={onOpenMenu}
        className="flex flex-col items-center justify-center flex-1 py-1 text-slate-500 hover:text-slate-900"
      >
        <Menu className="w-5 h-5 mb-0.5" />
        <span className="text-[11px]">More</span>
      </button>
    </nav>
  );
}
