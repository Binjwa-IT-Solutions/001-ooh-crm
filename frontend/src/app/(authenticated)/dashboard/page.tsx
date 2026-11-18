'use client';

import React from 'react';
import { useAuth } from '@/shared/auth/auth-context';
import { ROLE_LABELS } from '@/shared/auth/types';
import { useAdminDashboard } from '@/modules/dashboard/hooks/use-dashboard';
import { BusinessSummaryCards } from '@/modules/dashboard/components/BusinessSummaryCards';
import { FinancialOverviewCards } from '@/modules/dashboard/components/FinancialOverviewCards';
import { MoneyMovementSection } from '@/modules/dashboard/components/MoneyMovementSection';
import { CashFlowExpectations } from '@/modules/dashboard/components/CashFlowExpectations';
import { FinancialTrendsChart } from '@/modules/dashboard/components/FinancialTrendsChart';
import { DashboardAlerts } from '@/modules/dashboard/components/DashboardAlerts';
import { FinanceDashboard } from '@/modules/dashboard/components/FinanceDashboard';
import { HrDashboard } from '@/modules/dashboard/components/HrDashboard';
import { OpsDashboard } from '@/modules/dashboard/components/OpsDashboard';
import { MyDayPanel } from '@/modules/dashboard/components/MyDayPanel';
import { SectionTitle } from '@/modules/dashboard/components/dashboard-kit';
import { RefreshCw, Calendar, AlertCircle } from 'lucide-react';

/**
 * One dashboard route, a view per role:
 *
 *   finance                    → Finance dashboard
 *   hr                         → HR desk            + My day
 *   ops                        → Operations desk    + My day
 *   employee                   → My day (full)
 *   admin / manager / sales    → Business & finance overview (+ My day for manager / sales)
 */
export default function DashboardPage() {
  const { user } = useAuth();
  // Re-mounting the role view re-fetches everything — that's what Refresh does.
  const [refreshKey, setRefreshKey] = React.useState(0);

  if (!user) return null;
  if (user.role === 'finance') return <FinanceDashboard />;

  return (
    <div className="space-y-6 pb-12 max-w-7xl mx-auto">
      <WelcomeBar name={user.name} roleLabel={ROLE_LABELS[user.role] ?? user.role} onRefresh={() => setRefreshKey((k) => k + 1)} />

      <div key={refreshKey} className="space-y-8">
        {user.role === 'hr' && (
          <>
            <HrDashboard />
            <MyDayPanel compact />
          </>
        )}

        {user.role === 'ops' && (
          <>
            <OpsDashboard />
            <MyDayPanel compact />
          </>
        )}

        {user.role === 'employee' && <MyDayPanel />}

        {(user.role === 'admin' || user.role === 'manager' || user.role === 'sales_agent') && (
          <>
            {user.role !== 'admin' && <MyDayPanel compact />}
            <BusinessOverview permissions={user.permissions} />
          </>
        )}
      </div>
    </div>
  );
}

function WelcomeBar({ name, roleLabel, onRefresh }: { name: string; roleLabel: string; onRefresh: () => void }) {
  const todayFormatted = new Intl.DateTimeFormat('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date());

  return (
    <div className="bg-white rounded-2xl border border-gray-200/80 p-5 sm:p-6 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div>
        <div className="flex flex-wrap items-center gap-2.5">
          <h1 className="text-xl sm:text-2xl font-black text-gray-900 tracking-tight">Welcome back, {name.split(' ')[0]}</h1>
          <span className="px-2.5 py-0.5 text-xs font-bold rounded-full bg-[#F8E6E6] text-[#6E1D1D] border border-[#F0D0D0]">
            {roleLabel}
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

      <button
        onClick={onRefresh}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-gray-200 bg-white text-gray-700 hover:bg-gray-50 hover:text-gray-900 transition-colors shadow-2xs self-start sm:self-auto"
        title="Refresh dashboard"
      >
        <RefreshCw className="w-3.5 h-3.5" />
        <span>Refresh</span>
      </button>
    </div>
  );
}

/** The business & finance overview (admin, manager, sales). Unchanged content, minus the "restricted" placeholder. */
function BusinessOverview({ permissions }: { permissions: readonly string[] }) {
  const { data, loading, error, refresh } = useAdminDashboard();

  return (
    <div className="space-y-6">
      <SectionTitle>Business overview</SectionTitle>

      {error && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            <span>{error}</span>
          </div>
          <button onClick={() => refresh()} className="px-2.5 py-1 bg-red-100 hover:bg-red-200 text-red-900 rounded-md font-semibold">
            Retry
          </button>
        </div>
      )}

      {loading && !data && (
        <div className="space-y-6 animate-pulse">
          <div className="h-28 bg-gray-100 rounded-xl" />
          <div className="h-64 bg-gray-100 rounded-xl" />
        </div>
      )}

      {data && (
        <>
          {data.alerts && data.alerts.length > 0 && <DashboardAlerts alerts={data.alerts} />}
          <BusinessSummaryCards summary={data.businessSummary} permissions={[...permissions]} />
          {data.financialOverview && <FinancialOverviewCards overview={data.financialOverview} />}
          {data.moneyMovement && data.moneyMovement.length > 0 && <MoneyMovementSection items={data.moneyMovement} />}
          {data.expectedFromClients && data.moneyToBePaidToVendors && (
            <CashFlowExpectations
              expectedFromClients={data.expectedFromClients}
              moneyToBePaidToVendors={data.moneyToBePaidToVendors}
            />
          )}
          {data.trends && <FinancialTrendsChart trends={data.trends} />}
        </>
      )}
    </div>
  );
}
