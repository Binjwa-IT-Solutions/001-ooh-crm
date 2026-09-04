'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { type ReactNode, useState } from 'react';
import {
  LayoutDashboard,
  Users,
  FileText,
  MapPin,
  CalendarCheck,
  Building2,
  ShoppingCart,
  Megaphone,
  ClipboardCheck,
  Camera,
  ArrowDownToLine,
  ArrowUpFromLine,
  BarChart3,
  TrendingUp,
  Clock,
  CalendarDays,
  FileBarChart,
  ShieldCheck,
  AlertTriangle,
  Search,
  Bell,
  Menu,
  X,
  LogOut,
  ChevronDown
} from 'lucide-react';

import { useAuth } from '../auth/auth-context';
import { ROLE_LABELS } from '../auth/types';
import { Button, cx } from '../ui';
import { type LucideIcon } from 'lucide-react';
import NotificationBell from './NotificationBell';

interface NavGroup {
  label: string;
  items: Array<{ href: string; label: string; icon: LucideIcon; permission?: string }>;
}

const NAV_GROUPS: NavGroup[] = [
  {
    label: 'Overview',
    items: [{ href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard }],
  },
  {
    label: 'SALES',
    items: [
      { href: '/leads', label: 'Leads', icon: Users, permission: 'leads.view' },
      { href: '/quotations', label: 'Quotations', icon: FileText, permission: 'quotations.view' },
    ],
  },
  {
    label: 'OPERATIONS',
    items: [
      { href: '/sites', label: 'Sites', icon: MapPin, permission: 'sites.view' },
      { href: '/booking', label: 'Bookings', icon: CalendarCheck, permission: 'bookings.view' },
      { href: '/vendors', label: 'Vendors', icon: Building2, permission: 'vendors.view' },
      { href: '/purchase-orders', label: 'Purchase Orders', icon: ShoppingCart, permission: 'purchase_orders.view' },
      { href: '/campaigns', label: 'Campaigns', icon: Megaphone, permission: 'campaigns.view' },
      { href: '/tasks', label: 'Tasks', icon: ClipboardCheck, permission: 'tasks.view' },
      { href: '/escalations', label: 'Escalations', icon: AlertTriangle, permission: 'tasks.view' },
      { href: '/proofs', label: 'Proofs', icon: Camera, permission: 'proofs.view' },
    ],
  },
  {
    label: 'FINANCE & ANALYTICS',
    items: [
      { href: '/payments-in', label: 'Payments In', icon: ArrowDownToLine, permission: 'finance.view' },
      { href: '/payments-out', label: 'Payments Out', icon: ArrowUpFromLine, permission: 'finance.view' },
      { href: '/analytics', label: 'Sales Analytics', icon: BarChart3, permission: 'analytics.view' },
      { href: '/profitability', label: 'Profitability', icon: TrendingUp, permission: 'profitability.view' },
    ],
  },
  {
    label: 'HR',
    items: [
      { href: '/employees', label: 'Employees', icon: Users, permission: 'employees.view' },
      { href: '/attendance', label: 'My Attendance', icon: Clock, permission: 'attendance.self' },
      { href: '/attendance/team', label: 'Team Attendance', icon: Users, permission: 'attendance.view_team' },
      { href: '/attendance/reports', label: 'Attendance Reports', icon: FileBarChart, permission: 'attendance.view_team' },
      { href: '/leave', label: 'My Leave', icon: CalendarDays, permission: 'leave.self' },
      { href: '/leave/approvals', label: 'Leave Approvals', icon: CalendarCheck, permission: 'leave.manage' },
      { href: '/leave/types', label: 'Leave Types', icon: CalendarCheck, permission: 'leave.manage' },
    ],
  },
  {
    label: 'COMPLIANCE',
    items: [
      { href: '/audit', label: 'Audit', icon: ShieldCheck, permission: 'audit.view' },
      { href: '/exceptions', label: 'Exceptions', icon: AlertTriangle, permission: 'exceptions.view' },
    ],
  },
];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { user, hasPermission, signOut } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-white font-sans">
      {/* Mobile sidebar backdrop */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-900/80 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar (Fixed on Desktop, Drawer on Mobile) */}
      <div
        className={cx(
          'fixed inset-y-0 left-0 z-50 w-64 flex-col border-r border-[#E6E8EC] bg-white transition-transform duration-300 lg:flex',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        )}
      >
        <div className="flex h-16 shrink-0 items-center px-6">
          <Link href="/dashboard" className="flex items-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/logo.png" alt="Media Octus" className="w-[160px] h-auto object-contain" />
          </Link>
          <button
            onClick={() => setSidebarOpen(false)}
            className="ml-auto p-1 text-slate-500 hover:text-slate-900 lg:hidden"
          >
            <X className="h-6 w-6" />
          </button>
        </div>
        
        <div className="flex flex-1 flex-col overflow-y-auto pt-4 pb-12 no-scrollbar">
          <nav className="flex-1 space-y-6">
            {NAV_GROUPS.map((group) => {
              const visibleItems = group.items.filter(
                (item) => !item.permission || hasPermission(item.permission)
              );
              
              if (visibleItems.length === 0) return null;
              
              const isOverview = group.label === 'Overview';

              return (
                <div key={group.label}>
                  {!isOverview && (
                    <h3 className="mb-2 px-6 text-[11px] font-semibold tracking-wider text-slate-500 uppercase">
                      {group.label}
                    </h3>
                  )}
                  <ul className="space-y-0.5">
                    {visibleItems.map((item) => {
                      const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
                      const Icon = item.icon;
                      
                      return (
                        <li key={item.href}>
                          <Link
                            href={item.href}
                            className={cx(
                              'flex items-center gap-3 px-6 py-2.5 text-sm transition-colors border-l-4',
                              isActive
                                ? 'bg-[#F8E6E6] text-[#6E1D1D] border-[#6E1D1D] font-medium'
                                : 'border-transparent text-slate-500 hover:bg-[#F8E6E6] hover:text-[#6E1D1D]'
                            )}
                            onClick={() => setSidebarOpen(false)}
                          >
                            <Icon className={cx('h-5 w-5', isActive ? 'text-[#6E1D1D]' : 'text-slate-500')} />
                            {item.label}
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Main content wrapper */}
      <div className="flex flex-1 flex-col lg:pl-64 min-h-screen">
        {/* Header (Sticky) */}
        <header className="sticky top-0 z-40 flex h-16 shrink-0 items-center justify-between gap-x-4 border-b border-[#E6E8EC] bg-white px-4 sm:gap-x-6 sm:px-6 lg:px-8">
          <div className="flex items-center gap-4">
            <button
              type="button"
              className="-m-2.5 p-2.5 text-slate-700 lg:hidden"
              onClick={() => setSidebarOpen(true)}
            >
              <span className="sr-only">Open sidebar</span>
              <Menu className="h-6 w-6" />
            </button>
          </div>

          <div className="flex flex-1 justify-end gap-x-4 lg:gap-x-6">
            <form className="relative flex max-w-md w-full items-center mr-auto ml-4 lg:ml-0" action="#" method="GET" onSubmit={(e) => e.preventDefault()}>
              <label htmlFor="search-field" className="sr-only">
                Search
              </label>
              <div className="relative w-full flex items-center">
                <Search className="absolute left-3 h-4 w-4 text-[#687280]" />
                <input
                  id="search-field"
                  className="block h-10 w-full rounded-full border border-[#E6E8EC] bg-white py-2 pl-10 pr-3 text-sm text-[#1F2937] placeholder:text-[#687280] focus:border-primary focus:ring-1 focus:ring-primary focus:outline-none sm:text-sm/6 shadow-sm"
                  placeholder="Search"
                  type="search"
                  name="search"
                />
              </div>
            </form>
            
            <div className="flex items-center gap-x-4 lg:gap-x-6">
              <NotificationBell />

              <div className="flex items-center gap-3 ml-2 border border-[#E6E8EC] rounded-full p-1 pr-3 shadow-sm cursor-pointer hover:bg-slate-50 transition-colors">
                <div className="flex items-center justify-center h-8 w-8 rounded-full bg-primary-100 text-primary font-bold text-sm shrink-0">
                  {user?.name?.[0]?.toUpperCase() ?? 'U'}
                </div>
                <div className="hidden sm:flex flex-col text-left">
                  <span className="text-sm font-semibold leading-none text-[#1F2937]">
                    {user?.name ?? 'Loading...'}
                  </span>
                  <span className="text-[10px] uppercase font-medium leading-snug text-[#687280] mt-1">
                    {user ? (ROLE_LABELS[user.role] ?? user.role) : ''}
                  </span>
                </div>
                <ChevronDown className="h-4 w-4 text-[#687280] ml-1 hidden sm:block" />
              </div>
              
              <Button variant="ghost" onClick={() => void signOut()} className="h-10 px-3 text-[#687280] hover:text-primary transition-colors border border-transparent" title="Sign out">
                <LogOut className="h-4 w-4" />
                <span className="sr-only">Sign out</span>
              </Button>
            </div>
          </div>
        </header>

        {/* Main content */}
        <main className="flex-1 bg-white p-4 sm:p-6 lg:p-8">
          <div className="mx-auto w-full max-w-[1200px]">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
