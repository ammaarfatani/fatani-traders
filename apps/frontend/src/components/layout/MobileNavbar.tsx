'use client';

import React from 'react';
import { Layers, ArrowLeft } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';

export default function MobileNavbar({ onOpenMenu }: { onOpenMenu: () => void }) {
  const pathname = usePathname();
  const router = useRouter();

  const isHome = pathname === '/';

  return (
    <header className="lg:hidden sticky top-0 z-30 bg-slate-900 text-white px-4 py-3 flex items-center justify-between border-b border-slate-800 shadow-md">
      <div className="flex items-center gap-2.5">
        {!isHome && (
          <button
            onClick={() => router.back()}
            className="p-1 -ml-1 text-slate-300 hover:text-white"
            aria-label="Go Back"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
        )}
        <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-emerald-600 to-teal-400 flex items-center justify-center shadow">
          <Layers className="w-4 h-4 text-white" />
        </div>
        <div>
          <h1 className="font-bold text-sm tracking-wide text-white leading-tight">FATANI TRADERS</h1>
          <p className="text-[10px] text-emerald-400 uppercase tracking-wider font-semibold">Textile ERP</p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <a
          href="/sales/new"
          className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-medium px-2.5 py-1.5 rounded-lg active:scale-95 transition"
        >
          + Sale
        </a>
      </div>
    </header>
  );
}
