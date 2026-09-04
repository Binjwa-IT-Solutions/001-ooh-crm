'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Clock, Users, FileBarChart } from 'lucide-react';
import { cx } from '@/shared/ui';
import { useAuth } from '@/shared/auth/auth-context';

import { MyAttendanceView } from '@/modules/hr/components/my-attendance-view';
import { TeamAttendanceView } from '@/modules/hr/components/team-attendance-view';
import { AttendanceReportsView } from '@/modules/hr/components/attendance-reports-view';
import { usePageSubTitle } from '@/shared/layout/page-header-context';

type TabType = 'my' | 'team' | 'reports';

export default function AttendanceContainerPage() {
  const router = useRouter();
  const { hasPermission } = useAuth();
  const [activeTab, setActiveTab] = useState<TabType>('my');

  const canViewTeam = hasPermission('attendance.view_team');

  // Tab configuration
  const tabs = [
    { id: 'my', label: 'My Attendance', icon: Clock, show: hasPermission('attendance.self') },
    { id: 'team', label: 'Team Attendance', icon: Users, show: canViewTeam },
    { id: 'reports', label: 'Attendance Reports', icon: FileBarChart, show: canViewTeam },
  ].filter(tab => tab.show);

  // If the user doesn't have permission for the active tab (e.g. they somehow got there), default to the first available tab
  const currentTab = tabs.find(t => t.id === activeTab) ? activeTab : tabs[0]?.id;

  const currentTabDef = tabs.find(t => t.id === currentTab);
  usePageSubTitle(currentTabDef ? currentTabDef.label : null);

  if (tabs.length === 0) {
    return (
      <div className="flex flex-col h-full bg-slate-50/50 p-4 md:p-6 lg:p-8">
        <div className="max-w-7xl mx-auto space-y-6 w-full text-center py-12">
          <p className="text-slate-500">You do not have permission to view attendance records.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-slate-50/50">
      <div className="flex-1 overflow-auto p-4 md:p-6 lg:p-8">
        <div className="max-w-7xl mx-auto space-y-4">
          <div className="flex flex-col gap-1">
            <button
              onClick={() => router.back()}
              className="flex items-center text-sm font-medium text-slate-500 hover:text-slate-800 transition-colors w-fit"
            >
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back
            </button>
            <h1 className="text-2xl font-semibold text-slate-800">Attendance</h1>
          </div>

          {/* Tabs */}
          {tabs.length > 1 && (
            <div className="border-b border-slate-200">
              <nav className="-mb-px flex space-x-6" aria-label="Tabs">
                {tabs.map((tab) => {
                  const Icon = tab.icon;
                  const isActive = currentTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id as TabType)}
                      className={cx(
                        isActive
                          ? 'border-brand-500 text-brand-600'
                          : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700',
                        'group inline-flex items-center border-b-2 py-4 px-1 text-sm font-medium transition-colors'
                      )}
                      aria-current={isActive ? 'page' : undefined}
                    >
                      <Icon
                        className={cx(
                          isActive ? 'text-brand-500' : 'text-slate-400 group-hover:text-slate-500',
                          '-ml-0.5 mr-2 h-5 w-5'
                        )}
                        aria-hidden="true"
                      />
                      {tab.label}
                    </button>
                  );
                })}
              </nav>
            </div>
          )}

          {/* Tab Content */}
          <div className="pt-2 animate-in fade-in duration-300">
            {currentTab === 'my' && <MyAttendanceView />}
            {currentTab === 'team' && <TeamAttendanceView />}
            {currentTab === 'reports' && <AttendanceReportsView />}
          </div>
        </div>
      </div>
    </div>
  );
}
