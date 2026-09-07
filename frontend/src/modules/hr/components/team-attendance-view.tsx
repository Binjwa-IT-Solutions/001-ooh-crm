'use client';

import { useState } from 'react';
import { Card, Spinner, Field } from '@/shared/ui';
import { useTeamAttendance } from '@/modules/hr/hooks/use-attendance';
import { TeamAttendanceTable } from '@/modules/hr/components/team-attendance-table';

export function TeamAttendanceView() {
  const [dateFilter, setDateFilter] = useState(new Date().toISOString().split('T')[0]);
  
  const { data: attendance, isLoading } = useTeamAttendance({ date: dateFilter });

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-800">Team Attendance</h2>
          <p className="text-sm text-slate-500">Monitor daily attendance for all employees.</p>
        </div>
        <div className="w-48">
          <Field
            type="date"
            label="Date"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
          />
        </div>
      </div>

      <Card className="overflow-hidden">
        {isLoading ? (
          <div className="flex h-64 items-center justify-center">
            <Spinner />
          </div>
        ) : (
          <TeamAttendanceTable records={attendance} />
        )}
      </Card>
    </div>
  );
}
