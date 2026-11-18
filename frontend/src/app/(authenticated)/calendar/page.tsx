'use client';

import { useMemo } from 'react';

import { HolidayCalendar } from '@/modules/hr/components/holiday-calendar';
import { useHolidays } from '@/modules/hr/hooks/use-leave';
import { useAuth } from '@/shared/auth/auth-context';

/** Calendar for everyone: company holidays, Sundays, and approved leave. */
export default function CalendarPage() {
  const { hasPermission } = useAuth();
  const { data: holidays } = useHolidays();

  const upcoming = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return (holidays ?? [])
      .filter((h) => new Date(h.date) >= today)
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .slice(0, 6);
  }, [holidays]);

  const daysAway = (date: string) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const d = new Date(date);
    d.setHours(0, 0, 0, 0);
    const n = Math.round((d.getTime() - today.getTime()) / 86_400_000);
    return n === 0 ? 'Today' : n === 1 ? 'Tomorrow' : `in ${n} days`;
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-800">Calendar</h1>
        <p className="text-sm text-slate-500">
          Company holidays, weekly offs{hasPermission('leave.manage') ? ' and who is on leave' : ' and your approved leave'}.
          Click any day for details.
        </p>
      </div>

      {upcoming.length > 0 && (
        <div className="flex gap-3 overflow-x-auto pb-1">
          {upcoming.map((h, i) => (
            <div
              key={h.id ?? h.date}
              className={`shrink-0 min-w-[170px] rounded-2xl border px-4 py-3 ${
                i === 0 ? 'border-emerald-300 bg-emerald-50' : 'border-slate-200 bg-white'
              }`}
            >
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                {i === 0 ? 'Next holiday' : 'Coming up'}
              </p>
              <p className="text-sm font-bold text-slate-900 mt-0.5 truncate">{h.name}</p>
              <p className="text-xs text-slate-600">
                {new Date(h.date).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' })}
                <span className="text-slate-400"> · {daysAway(h.date)}</span>
              </p>
            </div>
          ))}
        </div>
      )}

      <HolidayCalendar />
    </div>
  );
}
