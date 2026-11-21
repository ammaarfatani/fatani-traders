'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowLeft, Plus } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import { BrandLogo } from '@/components/brand/BrandLogo';

export default function MobileNavbar({ onOpenMenu }: { onOpenMenu: () => void }) {
  const pathname = usePathname();
  const router = useRouter();

  const isHome = pathname === '/';

  return (
    <header className="lg:hidden sticky top-0 z-30 flex items-center justify-between gap-2 border-b border-brand-dark/50 bg-brand-deep px-3 py-2.5 text-white shadow-md sm:px-4">
      <div className="flex min-w-0 items-center gap-1.5 sm:gap-2.5">
        {!isHome && (
          <button
            onClick={() => router.back()}
            className="-ml-1 shrink-0 p-1 text-gray-300 hover:text-white"
            aria-label="Go Back"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
        )}
        <Link href="/" className="flex min-w-0 items-center gap-2">
          <BrandLogo />
          <div className="min-w-0">
            <h1 className="truncate font-sans text-xs font-bold leading-tight tracking-wide text-white sm:text-sm">
              FATANI TRADERS
            </h1>
            <p className="truncate text-[10px] font-semibold uppercase tracking-wider text-brand-accent">
              Textile ERP
            </p>
          </div>
        </Link>
      </div>

      <div className="flex shrink-0 items-center gap-2">
        <Link
          href="/sales/new"
          className="flex items-center gap-1 rounded-lg bg-brand-fabric px-2.5 py-2 text-[11px] font-semibold text-white shadow-sm transition hover:bg-brand-accent active:scale-95 sm:px-3 sm:text-xs"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>New Sale</span>
        </Link>
      </div>
    </header>
  );
}
