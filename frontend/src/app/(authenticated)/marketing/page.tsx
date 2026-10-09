'use client';

import { useState } from 'react';
import {
  LayoutDashboard,
  Clock,
  Layers,
  CreditCard,
  Megaphone,
} from 'lucide-react';
import MarketingOverviewTab from '@/modules/marketing/components/MarketingOverviewTab';
import DailyLogsTab from '@/modules/marketing/components/DailyLogsTab';
import TasksContentTab from '@/modules/marketing/components/TasksContentTab';
import BudgetLeadsTab from '@/modules/marketing/components/BudgetLeadsTab';

type TabKey = 'overview' | 'logs' | 'tasks' | 'budget';

export default function MarketingHubPage() {
  const [activeTab, setActiveTab] = useState<TabKey>('overview');

  const tabs = [
    {
      id: 'overview' as TabKey,
      label: 'Executive Overview',
      subtitle: 'ROI, ROAS, Spend & Output',
      icon: LayoutDashboard,
    },
    {
      id: 'logs' as TabKey,
      label: 'Daily Work Logs',
      subtitle: 'Fast log (<2 min) & Rollup',
      icon: Clock,
    },
    {
      id: 'tasks' as TabKey,
      label: 'Tasks & Content',
      subtitle: 'Kanban, WIP <= 3, Post Links',
      icon: Layers,
    },
    {
      id: 'budget' as TabKey,
      label: 'Budget, Spend & Leads',
      subtitle: 'Spend Ledger & Attribution',
      icon: CreditCard,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-indigo-600 text-white rounded-xl shadow-xs">
              <Megaphone className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-slate-900">
                Media Octus Marketing Hub
              </h1>
              <p className="text-xs text-slate-500">
                Internal marketing execution, accountability, budget tracking & deal attribution.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      <div className="border-b border-slate-200">
        <nav className="flex space-x-2 sm:space-x-4 overflow-x-auto" aria-label="Tabs">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`group inline-flex items-center gap-2.5 py-3 px-3 border-b-2 font-medium text-xs sm:text-sm whitespace-nowrap transition cursor-pointer ${
                  isActive
                    ? 'border-indigo-600 text-indigo-600 font-bold'
                    : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                }`}
              >
                <Icon
                  className={`w-4 h-4 shrink-0 transition ${
                    isActive ? 'text-indigo-600' : 'text-slate-400 group-hover:text-slate-500'
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
        {activeTab === 'overview' && <MarketingOverviewTab />}
        {activeTab === 'logs' && <DailyLogsTab />}
        {activeTab === 'tasks' && <TasksContentTab />}
        {activeTab === 'budget' && <BudgetLeadsTab />}
      </div>
    </div>
  );
}
