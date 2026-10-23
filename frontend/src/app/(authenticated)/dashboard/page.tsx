'use client';

import { useAuth } from '@/shared/auth/auth-context';
import { ROLE_LABELS } from '@/shared/auth/types';
import { Badge, Card, EmptyState } from '@/shared/ui';

import { AttendanceWidget } from '@/modules/hr/components/attendance-widget';
import { SalesAgentDashboard } from '@/modules/dashboard/components/SalesAgentDashboard';

export default function DashboardPage() {
  const { user } = useAuth();
  if (!user) return null;

  const isSalesAgent = user.role === 'sales_agent';

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-50">
            Welcome back, {user.name.split(' ')[0]} 👋
          </h1>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
            {new Date().toLocaleDateString('en-IN', {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
              year: 'numeric',
            })}
          </p>
        </div>
      </div>

      {isSalesAgent ? (
        <SalesAgentDashboard />
      ) : (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="sm:col-span-1">
              <AttendanceWidget />
            </div>
            <div className="sm:col-span-2 grid gap-4 grid-cols-1 sm:grid-cols-2">
              <Card>
                <h2 className="text-sm font-medium text-slate-900 dark:text-slate-100">Your role</h2>
                <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-50">
                  {ROLE_LABELS[user.role] ?? user.role}
                </p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Role and permissions come from the server on every request.
                </p>
              </Card>

              <Card>
                <h2 className="text-sm font-medium text-slate-900 dark:text-slate-100">
                  Permissions ({user.permissions.length})
                </h2>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {user.permissions.map((permission) => (
                    <Badge key={permission}>{permission}</Badge>
                  ))}
                </div>
              </Card>
            </div>
          </div>

          <EmptyState
            title="Module Overview"
            description="Access your allocated workspace actions using the sidebar navigation."
          />
        </div>
      )}
    </div>
  );
}

