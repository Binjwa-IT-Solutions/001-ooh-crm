'use client';

import { AttendanceReportsView } from '@/modules/hr/components/attendance-reports-view';

export default function AttendanceReportsPage() {
  return (
    <div className="flex flex-col h-full bg-slate-50/50 p-4 md:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto space-y-4 w-full">
        <AttendanceReportsView />
      </div>
    </div>
  );
}
