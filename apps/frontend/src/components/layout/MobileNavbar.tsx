'use client';

import React from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { ArrowLeft, Plus } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';

export default function MobileNavbar({ onOpenMenu }: { onOpenMenu: () => void }) {
  const pathname = usePathname();
  const router = useRouter();

  const isHome = pathname === '/';

  return (
    <header className="lg:hidden sticky top-0 z-30 bg-brand-deep text-white px-4 py-3 flex items-center justify-between border-b border-brand-dark/50 shadow-md">
      <div className="flex items-center gap-2.5">
        {!isHome && (
          <button
            onClick={() => router.back()}
            className="p-1 -ml-1 text-gray-300 hover:text-white"
            aria-label="Go Back"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
        )}
        <Link href="/" className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-white p-1 shadow flex items-center justify-center shrink-0">
            <Image
              src="/logo.png"
              alt="Fatani Fabrics Logo"
              width={32}
              height={32}
              className="w-full h-full object-contain"
            />
          </div>
          <div>
            <h1 className="font-bold text-sm tracking-wide text-white leading-tight font-sans">
              FATANI TRADERS
            </h1>
            <p className="text-[10px] text-brand-accent uppercase tracking-wider font-semibold">
              Textile ERP
            </p>
          </div>
        </Link>
      </div>

      <div className="flex items-center gap-2">
        <Link
          href="/sales/new"
          className="flex items-center gap-1 text-xs bg-brand-fabric hover:bg-brand-accent text-white font-semibold px-3 py-1.5 rounded-lg active:scale-95 transition shadow-sm"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>New Sale</span>
        </Link>
      </div>
    </header>
  );
}
