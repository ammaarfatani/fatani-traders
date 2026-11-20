'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  Receipt,
  Users,
  Building2,
  Banknote,
  Wallet,
  RotateCcw,
  BarChart3,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

export default function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const [isCollapsed, setIsCollapsed] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem('fatani_sidebar_collapsed');
    if (saved !== null) {
      setIsCollapsed(saved === 'true');
    }
  }, []);

  const toggleCollapsed = () => {
    const next = !isCollapsed;
    setIsCollapsed(next);
    localStorage.setItem('fatani_sidebar_collapsed', String(next));
  };

  // 11 Simplified Primary Navigation Items
  const navItems = [
    { name: 'Dashboard', href: '/', icon: LayoutDashboard },
    { name: 'Purchases', href: '/purchases', icon: ShoppingCart },
    { name: 'Inventory', href: '/inventory', icon: Package },
    { name: 'Sales', href: '/sales', icon: Receipt },
    { name: 'Customers', href: '/customers', icon: Users },
    { name: 'Suppliers', href: '/suppliers', icon: Building2 },
    { name: 'Payments', href: '/payments', icon: Banknote },
    { name: 'Expenses', href: '/expenses', icon: Wallet },
    { name: 'Returns', href: '/returns', icon: RotateCcw },
    { name: 'Reports', href: '/reports', icon: BarChart3 },
    { name: 'Settings', href: '/settings', icon: Settings },
  ];

  return (
    <aside
      className={`hidden lg:flex flex-col bg-brand-deep text-white shrink-0 h-screen sticky top-0 border-r border-brand-dark/40 select-none transition-all duration-300 ease-in-out ${
        isCollapsed ? 'w-20' : 'w-64'
      }`}
    >
      {/* Brand Header */}
      <div className="h-20 border-b border-white/10 flex items-center justify-between px-4 relative">
        <Link href="/" className="flex items-center gap-3 overflow-hidden">
          <div className="w-11 h-11 shrink-0 flex items-center justify-center">
            <Image
              src="/logo.png"
              alt="Fatani Fabrics Logo"
              width={44}
              height={44}
              className="w-full h-full object-contain"
              priority
            />
          </div>
          {!isCollapsed && (
            <div className="truncate">
              <h1 className="font-bold text-base leading-tight tracking-wider text-white uppercase font-sans">
                FATANI TRADERS
              </h1>
              <p className="text-[10px] font-semibold text-brand-accent uppercase tracking-widest">
                Textile ERP
              </p>
            </div>
          )}
        </Link>

        {/* Collapse Toggle Button */}
        <button
          onClick={toggleCollapsed}
          title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className="absolute -right-3 top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-brand-fabric text-white border border-brand-light/30 flex items-center justify-center hover:bg-brand-accent transition-colors shadow-md z-20"
        >
          {isCollapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
        </button>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 overflow-y-auto py-3 px-3 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));

          return (
            <Link
              key={item.href}
              href={item.href}
              title={isCollapsed ? item.name : undefined}
              className={`flex items-center gap-3.5 px-3 py-2 rounded-xl text-xs font-medium transition-all group relative ${
                isActive
                  ? 'bg-brand-fabric text-white shadow-sm font-semibold'
                  : 'text-gray-300 hover:bg-white/10 hover:text-white'
              } ${isCollapsed ? 'justify-center' : ''}`}
            >
              <Icon
                className={`w-4 h-4 shrink-0 transition-colors ${
                  isActive ? 'text-white' : 'text-brand-accent group-hover:text-white'
                }`}
              />
              {!isCollapsed && <span className="truncate">{item.name}</span>}

              {/* Floating Tooltip for Collapsed State */}
              {isCollapsed && (
                <div className="absolute left-full ml-3 px-2.5 py-1 bg-brand-charcoal text-white text-xs font-semibold rounded-md shadow-lg opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50 whitespace-nowrap border border-white/10">
                  {item.name}
                </div>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Bottom User Profile & Logout */}
      <div className="p-3 border-t border-white/10 bg-brand-dark/40">
        {!isCollapsed ? (
          <div className="space-y-3">
            <div className="flex items-center gap-3 px-2">
              <div className="w-8 h-8 rounded-full bg-brand-fabric/80 flex items-center justify-center text-white font-bold text-xs border border-white/10">
                {user?.fullName?.charAt(0) || 'A'}
              </div>
              <div className="truncate flex-1">
                <p className="text-xs font-semibold text-white truncate">{user?.fullName || 'Admin User'}</p>
                <div className="flex items-center gap-1 text-[10px] text-emerald-400">
                  <ShieldCheck className="w-3 h-3" />
                  <span>Authenticated</span>
                </div>
              </div>
            </div>

            <button
              onClick={logout}
              className="w-full flex items-center justify-center gap-2 px-3 py-1.5 rounded-xl text-xs font-semibold text-red-300 bg-red-950/40 hover:bg-red-900/60 border border-red-800/40 transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out</span>
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2">
            <button
              onClick={logout}
              title="Sign Out"
              className="w-9 h-9 rounded-xl flex items-center justify-center text-red-300 hover:bg-red-950/60 transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
