'use client';

import { useState, useMemo, useEffect } from 'react';
import {
  LayoutDashboard,
  Clock,
  Layers,
  CreditCard,
  Megaphone,
} from 'lucide-react';
import { useAuth } from '@/shared/auth/auth-context';
import MarketingOverviewTab from '@/modules/marketing/components/MarketingOverviewTab';
import DailyLogsTab from '@/modules/marketing/components/DailyLogsTab';
import TasksContentTab from '@/modules/marketing/components/TasksContentTab';
import BudgetLeadsTab from '@/modules/marketing/components/BudgetLeadsTab';

type TabKey = 'overview' | 'logs' | 'tasks' | 'budget';

export default function MarketingHubPage() {
  const { user } = useAuth();
  const userRole = (user?.role || '').toLowerCase();
  const isManagerOrAdmin = ['admin', 'superadmin', 'managing_director', 'manager'].includes(userRole);

  const [activeTab, setActiveTab] = useState<TabKey>('logs');

  useEffect(() => {
    if (isManagerOrAdmin) {
      setActiveTab('overview');
    } else {
      setActiveTab('logs');
    }
  }, [isManagerOrAdmin, user]);

  const allTabs = [
    {
      id: 'overview' as TabKey,
      label: 'Executive Overview',
      subtitle: 'ROI, ROAS, Spend & Output',
      icon: LayoutDashboard,
      managerOnly: true,
    },
    {
      id: 'logs' as TabKey,
      label: 'Daily Work Logs',
      subtitle: 'Fast log (<2 min) & Rollup',
      icon: Clock,
      managerOnly: false,
    },
    {
      id: 'tasks' as TabKey,
      label: 'Tasks & Content',
      subtitle: 'Kanban, WIP <= 3, Post Links',
      icon: Layers,
      managerOnly: false,
    },
    {
      id: 'budget' as TabKey,
      label: 'Budget, Spend & Leads',
      subtitle: 'Spend Ledger & Attribution',
      icon: CreditCard,
      managerOnly: true,
    },
  ];

  // Strictly filter tabs for non-managers
  const visibleTabs = useMemo(() => {
    if (!isManagerOrAdmin) {
      return allTabs.filter((tab) => !tab.managerOnly);
    }
    return allTabs;
  }, [isManagerOrAdmin]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-[#8B2424] text-white rounded-xl shadow-xs">
              <Megaphone className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight text-slate-900">
                Marketing Operations &amp; Performance
              </h1>
              <p className="text-xs text-slate-500">
                {isManagerOrAdmin
                  ? 'Internal marketing governance, team accountability, budget tracking & deal attribution.'
                  : 'Creative deliverables, daily execution logs, and assigned task pipeline.'}
              </p>
            </div>
          </div>
        </div>

        {/* Current User & Role Mode Badge */}
        <div className="flex items-center gap-2">
          <div className="text-right">
            <p className="text-xs font-bold text-slate-800">{user?.name || 'User'}</p>
            <p className="text-[10px] text-slate-400 capitalize">{user?.designation || user?.role || 'Guest'}</p>
          </div>
          <span
            className={`px-3 py-1 rounded-lg text-xs font-bold border shadow-xs ${
              isManagerOrAdmin
                ? 'bg-[#F8E6E6] border-[#8B2424]/30 text-[#8B2424]'
                : 'bg-emerald-50 border-emerald-200 text-emerald-700'
            }`}
          >
            {isManagerOrAdmin ? '👑 Management Mode' : '🎨 Contributor Mode'}
          </span>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="border-b border-slate-200">
        <nav className="flex space-x-2 sm:space-x-4 overflow-x-auto" aria-label="Tabs">
          {visibleTabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`group inline-flex items-center gap-2.5 py-3 px-3 border-b-2 font-medium text-xs sm:text-sm whitespace-nowrap transition cursor-pointer ${
                  isActive
                    ? 'border-[#8B2424] text-[#8B2424] font-bold'
                    : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                }`}
              >
                <Icon
                  className={`w-4 h-4 shrink-0 transition ${
                    isActive ? 'text-[#8B2424]' : 'text-slate-400 group-hover:text-slate-500'
                  }`}
                />
                <div className="text-left">
                  <span>{tab.label}</span>
                </div>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Tab Panels */}
      <div className="mt-4">
        {activeTab === 'overview' && isManagerOrAdmin && <MarketingOverviewTab />}
        {activeTab === 'logs' && <DailyLogsTab />}
        {activeTab === 'tasks' && <TasksContentTab />}
        {activeTab === 'budget' && isManagerOrAdmin && <BudgetLeadsTab />}
      </div>
    </div>
  );
}
