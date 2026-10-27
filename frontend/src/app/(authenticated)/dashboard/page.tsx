'use client';

import React from 'react';
import Link from 'next/link';
import { useAuth } from '@/shared/auth/auth-context';
import { ROLE_LABELS } from '@/shared/auth/types';
import { AttendanceWidget } from '@/modules/hr/components/attendance-widget';
import { useAdminDashboard } from '@/modules/dashboard/hooks/use-dashboard';
import { BusinessSummaryCards } from '@/modules/dashboard/components/BusinessSummaryCards';
import { FinancialOverviewCards } from '@/modules/dashboard/components/FinancialOverviewCards';
import { MoneyMovementSection } from '@/modules/dashboard/components/MoneyMovementSection';
import { CashFlowExpectations } from '@/modules/dashboard/components/CashFlowExpectations';
import { FinancialTrendsChart } from '@/modules/dashboard/components/FinancialTrendsChart';
import { DashboardAlerts } from '@/modules/dashboard/components/DashboardAlerts';
import { FinanceDashboard } from '@/modules/dashboard/components/FinanceDashboard';
import {
  RefreshCw,
  ShieldCheck,
  Calendar,
  AlertCircle,
} from 'lucide-react';

export default function DashboardPage() {
  const { user } = useAuth();
  const { data, loading, error, refresh } = useAdminDashboard();

  if (!user) return null;

  if (user.role === 'finance') {
    return <FinanceDashboard />;
  }

  const todayFormatted = new Intl.DateTimeFormat('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date());

  return (
    <div className="space-y-6 pb-12 max-w-7xl mx-auto">
      {/* 1. Welcome Message & Date Range Bar */}
      <div className="bg-white rounded-2xl border border-gray-200/80 p-5 sm:p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-xl sm:text-2xl font-black text-gray-900 tracking-tight">
              Welcome back, {user.name.split(' ')[0]}
            </h1>
            <span className="px-2.5 py-0.5 text-xs font-bold rounded-full bg-[#F8E6E6] text-[#6E1D1D] border border-[#F0D0D0]">
              {ROLE_LABELS[user.role] ?? user.role}
            </span>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-gray-500 font-medium">
            <span className="flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-gray-400" />
              <span>{todayFormatted}</span>
            </span>
            <span>·</span>
            <span>Media Octus Enterprise CRM</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => refresh()}
            disabled={loading}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 hover:text-gray-900 transition-colors shadow-2xs disabled:opacity-50"
            title="Refresh dashboard metrics"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-[#6E1D1D]' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* Error Banner if any */}
      {error && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            onClick={() => refresh()}
            className="px-2.5 py-1 bg-red-100 hover:bg-red-200 text-red-900 rounded-md font-semibold"
          >
            Retry
          </button>
        </div>
      )}

      {/* 2. Existing Attendance Widget (Preserved Completely) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        <div className="lg:col-span-1">
          <div className="space-y-2">
            <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider px-1">
              My Attendance & Punch
            </h2>
            <AttendanceWidget />
          </div>
        </div>

        {/* User Context & Role Profile Snapshot */}
        <div className="lg:col-span-2">
          <div className="space-y-2">
            <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider px-1">
              Account Authority & Fast Access
            </h2>
            <div className="bg-white rounded-xl border border-gray-200/80 p-5 shadow-xs space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 pb-3.5">
                <div>
                  <h3 className="text-sm font-bold text-gray-900 flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-[#6E1D1D]" />
                    <span>Role Permissions ({user.permissions.length} Assigned)</span>
                  </h3>
                  <p className="text-xs text-gray-500 font-medium mt-0.5">
                    Authorized actions are enforced server-side on every request
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] font-bold text-gray-500 bg-gray-100 px-2 py-0.5 rounded-md">
                    {user.email}
                  </span>
                </div>
              </div>

              {/* Badges preview */}
              <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto no-scrollbar">
                {user.permissions.map((p) => (
                  <span
                    key={p}
                    className="px-2 py-0.5 text-[10px] font-mono font-medium rounded-md bg-gray-50 text-gray-700 border border-gray-200/60"
                  >
                    {p}
                  </span>
                ))}
              </div>

              <div className="pt-2 border-t border-gray-100 flex flex-wrap items-center gap-4 text-xs font-semibold text-gray-500">
                <span className="text-gray-400">Quick Jump:</span>
                <Link href="/leads" className="text-[#6E1D1D] hover:underline flex items-center gap-0.5">
                  <span>Leads</span>
                </Link>
                <Link href="/campaigns" className="text-[#6E1D1D] hover:underline flex items-center gap-0.5">
                  <span>Campaigns</span>
                </Link>
                <Link href="/quotations" className="text-[#6E1D1D] hover:underline flex items-center gap-0.5">
                  <span>Quotations</span>
                </Link>
                <Link href="/finance/invoices" className="text-[#6E1D1D] hover:underline flex items-center gap-0.5">
                  <span>Invoices</span>
                </Link>
                <Link href="/finance/profit-dashboard" className="text-[#6E1D1D] hover:underline flex items-center gap-0.5">
                  <span>Profit Dashboard</span>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Loading Skeletons */}
      {loading && !data && (
        <div className="space-y-6 animate-pulse">
          <div className="h-28 bg-gray-100 rounded-xl" />
          <div className="h-64 bg-gray-100 rounded-xl" />
          <div className="h-96 bg-gray-100 rounded-xl" />
        </div>
      )}

      {data && (
        <>
          {/* Operational Alerts Section */}
          {data.alerts && data.alerts.length > 0 && (
            <DashboardAlerts alerts={data.alerts} />
          )}

          {/* 3. Business Summary Cards */}
          <BusinessSummaryCards
            summary={data.businessSummary}
            permissions={user.permissions}
          />

          {/* 4. Financial Overview Cards (Highest Priority) */}
          {data.financialOverview ? (
            <FinancialOverviewCards overview={data.financialOverview} />
          ) : (
            <div className="p-4 rounded-xl bg-gray-50 border border-gray-200 text-xs text-gray-500 text-center">
              Financial overview metrics are restricted to users with Finance administration permissions.
            </div>
          )}

          {/* 5. Money Movement Section */}
          {data.moneyMovement && data.moneyMovement.length > 0 && (
            <MoneyMovementSection items={data.moneyMovement} />
          )}

          {/* 6. Where Money Needs to Go & Where It Is Coming From */}
          {data.expectedFromClients && data.moneyToBePaidToVendors && (
            <CashFlowExpectations
              expectedFromClients={data.expectedFromClients}
              moneyToBePaidToVendors={data.moneyToBePaidToVendors}
            />
          )}

          {/* 7. Financial Trends Charts */}
          {data.trends && (
            <FinancialTrendsChart trends={data.trends} />
          )}
        </>
      )}
    </div>
  );
}
