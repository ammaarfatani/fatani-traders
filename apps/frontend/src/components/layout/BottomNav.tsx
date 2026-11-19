'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  ShoppingCart,
  Receipt,
  Users,
  Menu,
} from 'lucide-react';

export default function BottomNav({ onOpenMenu }: { onOpenMenu: () => void }) {
  const pathname = usePathname();

  const isHome = pathname === '/';
  const isPurchases = pathname.startsWith('/purchases');
  const isSales = pathname.startsWith('/sales') && pathname !== '/sales/new';
  const isCustomers = pathname.startsWith('/customers');

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-brand-muted py-1 px-2 flex justify-between items-center shadow-[0_-4px_10px_rgba(0,0,0,0.04)] no-print">
      {/* Home */}
      <Link
        href="/"
        className={`flex flex-col items-center justify-center flex-1 py-1 transition-colors ${
          isHome ? 'text-brand-fabric font-bold' : 'text-gray-500 hover:text-brand-charcoal'
        }`}
      >
        <LayoutDashboard className="w-5 h-5 mb-0.5" />
        <span className="text-[10px] tracking-tight">Home</span>
      </Link>

      {/* Purchases */}
      <Link
        href="/purchases"
        className={`flex flex-col items-center justify-center flex-1 py-1 transition-colors ${
          isPurchases ? 'text-brand-fabric font-bold' : 'text-gray-500 hover:text-brand-charcoal'
        }`}
      >
        <ShoppingCart className="w-5 h-5 mb-0.5" />
        <span className="text-[10px] tracking-tight">Purchases</span>
      </Link>

      {/* Center + Quick New Sale */}
      <div className="flex-1 flex justify-center -mt-5">
        <Link
          href="/sales/new"
          className="w-12 h-12 rounded-full bg-brand-deep hover:bg-brand-fabric text-white flex items-center justify-center shadow-lg shadow-brand-deep/30 active:scale-90 transition-all border-2 border-white"
          aria-label="New Sale"
        >
          <Receipt className="w-5 h-5" />
        </Link>
      </div>

      {/* Customers / Khata */}
      <Link
        href="/customers"
        className={`flex flex-col items-center justify-center flex-1 py-1 transition-colors ${
          isCustomers ? 'text-brand-fabric font-bold' : 'text-gray-500 hover:text-brand-charcoal'
        }`}
      >
        <Users className="w-5 h-5 mb-0.5" />
        <span className="text-[10px] tracking-tight">Customers</span>
      </Link>

      {/* Full Menu Drawer Toggle */}
      <button
        onClick={onOpenMenu}
        className="flex flex-col items-center justify-center flex-1 py-1 text-gray-500 hover:text-brand-charcoal transition-colors"
        aria-label="Open ERP Navigation"
      >
        <Menu className="w-5 h-5 mb-0.5" />
        <span className="text-[10px] tracking-tight">Menu</span>
      </button>
    </nav>
  );
}
