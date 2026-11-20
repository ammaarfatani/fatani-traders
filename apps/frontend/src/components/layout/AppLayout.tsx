'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import Sidebar from './Sidebar';
import MobileNavbar from './MobileNavbar';
import BottomNav from './BottomNav';
import MobileDrawer from './MobileDrawer';
import { useAuth } from '@/context/AuthContext';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { isLoading, user } = useAuth();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const isLoginPage = pathname === '/login';

  if (isLoginPage) {
    return <main className="min-h-screen bg-brand-ivory">{children}</main>;
  }

  if (isLoading && !user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-brand-ivory">
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 flex items-center justify-center shrink-0">
            <Image
              src="/logo.png"
              alt="Fatani Fabrics Logo"
              width={56}
              height={56}
              className="w-full h-full object-contain animate-pulse"
            />
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 border-2 border-brand-fabric border-t-transparent rounded-full animate-spin" />
            <p className="text-xs font-semibold uppercase tracking-wider text-brand-charcoal">
              Loading Fatani Traders ERP...
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-brand-ivory text-brand-charcoal">
      {/* Desktop Sidebar */}
      <Sidebar />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 pb-16 lg:pb-0">
        <MobileNavbar onOpenMenu={() => setDrawerOpen(true)} />

        <main className="flex-1 p-3 sm:p-5 lg:p-8 max-w-7xl w-full mx-auto">
          {children}
        </main>

        <BottomNav onOpenMenu={() => setDrawerOpen(true)} />
        <MobileDrawer isOpen={drawerOpen} onClose={() => setDrawerOpen(false)} />
      </div>
    </div>
  );
}
