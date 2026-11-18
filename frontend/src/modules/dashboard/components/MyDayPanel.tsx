'use client';

import { CalendarCheck, CalendarDays, ClipboardCheck, Clock, Timer } from 'lucide-react';

import { cx } from '@/shared/ui';
import { dashboardApi } from '../api';
import { useDashboardData } from '../hooks/use-dashboard';
import type { MyDashboard } from '../role-types';
import { Empty, LoadError, Panel, Row, SectionTitle, Skeleton, Stat, fmtClock, fmtDay, fmtMins, fmtRange, fmtTime, plural, relDay } from './dashboard-kit';

type Profile = Extract<MyDashboard, { hasProfile: true }>;

/** Leave types that only apply to some people are hidden unless they've actually been used. */
const SITUATIONAL = /maternity|paternity/i;

function todayLine(t: Profile['today']): { value: string; hint: string; tone: 'emerald' | 'amber' | 'rose' | 'blue' | 'slate' } {
  if (t.status === 'Leave') return { value: 'On leave', hint: 'Enjoy your day off', tone: 'blue' };
  if (t.checkOutTime) return { value: 'Done', hint: `${fmtTime(t.checkInTime)} – ${fmtTime(t.checkOutTime)}`, tone: 'slate' };
  if (t.checkInTime) {
    return t.lateMinutes
      ? { value: `In at ${fmtTime(t.checkInTime)}`, hint: `${fmtMins(t.lateMinutes)} after shift start`, tone: 'amber' }
      : { value: `In at ${fmtTime(t.checkInTime)}`, hint: 'On time — still working', tone: 'emerald' };
  }
  if (t.isSunday) return { value: 'Day off', hint: 'Sunday', tone: 'slate' };
  return { value: 'Not checked in', hint: 'Use Check in in the top bar', tone: 'rose' };
}

function summarySentence(d: Profile): string {
  const m = d.month;
  const first = d.employee.name.split(' ')[0];
  if (m.workingDays === 0) return `Welcome, ${first}. Your attendance for this month will show up here.`;
  const parts = [`This month you've been in on ${m.present} of ${m.workingDays} working days`];
  if (m.late) parts.push(`came in late ${plural(m.late, 'time')}${m.avgLateMinutes ? ` (usually by about ${fmtMins(m.avgLateMinutes)})` : ''}`);
  else if (m.present) parts.push('and were on time every day 🎉');
  if (m.absent) parts.push(`missed ${plural(m.absent, 'day')} without a check-in`);
  let text = parts.join(', ').replace(/, ([^,]*)$/, ' and $1') + '.';
  if (d.tasks.overdue) text += ` You have ${plural(d.tasks.overdue, 'overdue task')}.`;
  if (d.leave.next) text += ` Your next leave starts ${relDay(d.leave.next.fromDate).toLowerCase()}.`;
  return text;
}

/**
 * "My day" — attendance, leave, tasks and holidays for the signed-in person.
 * `compact` renders a single row of tiles for dashboards that lead with other work.
 */
export function MyDayPanel({ compact = false }: { compact?: boolean }) {
  const { data, error, reload } = useDashboardData(dashboardApi.getMine);

  if (error) return <LoadError message={error} onRetry={reload} />;
  if (!data) return <Skeleton rows={compact ? 1 : 2} />;
  if (!data.hasProfile) {
    return compact ? null : (
      <Panel title="My day">
        <Empty>Your employee profile isn&apos;t set up yet, so there&apos;s no attendance or leave to show. Ask HR to link your account.</Empty>
      </Panel>
    );
  }

  const today = todayLine(data.today);
  const balances = data.leave.balances.filter((b) => !SITUATIONAL.test(b.type) || b.used > 0);
  const mainBalances = balances.slice(0, 3);

  const tiles = (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
      <Stat icon={Clock} tone={today.tone} label="Today" value={<span className="text-lg">{today.value}</span>} hint={today.hint} href="/attendance?tab=my" />
      <Stat
        icon={CalendarCheck}
        tone="emerald"
        label="Attendance this month"
        value={
          <>
            {data.month.present}
            <span className="text-base font-semibold text-slate-400"> / {data.month.workingDays} days</span>
          </>
        }
        hint={
          <>
            <span className={cx(data.month.late > 0 && 'text-amber-700 font-semibold')}>{data.month.late} late</span>
            {' · '}
            <span className={cx(data.month.absent > 0 && 'text-rose-700 font-semibold')}>{data.month.absent} absent</span>
            {data.month.halfDay ? ` · ${data.month.halfDay} half-day` : ''}
          </>
        }
        href="/attendance?tab=my"
      />
      <Stat
        icon={Timer}
        tone="violet"
        label="Hours worked this month"
        value={`${data.month.hoursWorked}h`}
        hint={data.month.avgCheckInMinutes != null ? `You usually arrive at ${fmtClock(data.month.avgCheckInMinutes)}` : 'No completed days yet'}
      />
      <Stat
        icon={CalendarDays}
        tone="blue"
        label="Leave left"
        value={mainBalances.length ? mainBalances.reduce((s, b) => s + b.balance, 0) : '—'}
        hint={
          mainBalances.length
            ? mainBalances.map((b) => `${b.type.replace(/ Leave$/, '')} ${b.balance}`).join(' · ')
            : 'No leave allocated yet'
        }
        href="/leave?tab=my"
      />
    </div>
  );

  if (compact) {
    return (
      <div className="space-y-2">
        <SectionTitle>My day</SectionTitle>
        {tiles}
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <p className="text-sm text-slate-700 leading-relaxed bg-[#FFF8F8] border border-[#F0D0D0] rounded-2xl px-4 py-3">
        {summarySentence(data)}
      </p>

      {tiles}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Panel
          title="My tasks"
          subtitle={data.tasks.open ? `${plural(data.tasks.open, 'open task')}${data.tasks.overdue ? `, ${data.tasks.overdue} overdue` : ''}` : undefined}
          action={{ href: '/my-campaigns', label: 'Open' }}
        >
          {data.tasks.items.length === 0 ? (
            <Empty>Nothing assigned to you right now. ✅</Empty>
          ) : (
            <ul>
              {data.tasks.items.map((t) => {
                const overdue = new Date(t.deadline) < new Date(new Date().toDateString());
                return (
                  <Row
                    key={t.id}
                    left={t.title}
                    sub={`${t.type} · ${t.status === 'InProgress' ? 'In progress' : t.status}`}
                    right={overdue ? `Overdue · ${fmtDay(t.deadline, false)}` : `Due ${relDay(t.deadline)}`}
                    tone={overdue ? 'rose' : undefined}
                  />
                );
              })}
            </ul>
          )}
        </Panel>

        <Panel title="My leave" action={{ href: '/leave?tab=my', label: 'Apply / view' }}>
          <div className="space-y-3">
            {data.leave.next ? (
              <div className="p-3 rounded-xl bg-blue-50 border border-blue-100 text-xs text-blue-900">
                <p className="font-semibold">Next leave: {data.leave.next.type}</p>
                <p className="mt-0.5">
                  {fmtRange(data.leave.next.fromDate, data.leave.next.toDate)} · {plural(data.leave.next.days, 'day')}
                </p>
              </div>
            ) : null}
            {data.leave.pending > 0 && (
              <p className="text-xs text-amber-800 bg-amber-50 border border-amber-100 rounded-xl px-3 py-2">
                {plural(data.leave.pending, 'request')} waiting for approval
              </p>
            )}
            {balances.length === 0 ? (
              <Empty>No leave allocated yet.</Empty>
            ) : (
              <ul className="space-y-2.5">
                {balances.map((b) => {
                  const pct = b.allocated > 0 ? Math.min(100, (b.balance / b.allocated) * 100) : 0;
                  return (
                    <li key={b.type}>
                      <div className="flex justify-between text-xs">
                        <span className="font-semibold text-slate-700">{b.type}</span>
                        <span className="text-slate-500">
                          <span className="font-bold text-slate-800">{b.balance}</span> of {b.allocated} left
                        </span>
                      </div>
                      <div className="h-1.5 rounded-full bg-slate-100 mt-1 overflow-hidden">
                        <div className="h-full rounded-full bg-blue-500" style={{ width: `${pct}%` }} />
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </Panel>

        <Panel title="Upcoming holidays" action={{ href: '/leave?tab=calendar', label: 'Calendar' }}>
          {data.holidays.length === 0 ? (
            <Empty>No holidays scheduled.</Empty>
          ) : (
            <ul>
              {data.holidays.map((h) => (
                <Row key={h.date} left={h.name} right={relDay(h.date)} />
              ))}
            </ul>
          )}
          <div className="mt-3 flex items-center gap-2 text-[11px] text-slate-500">
            <ClipboardCheck className="h-3.5 w-3.5" /> Sundays are weekly offs.
          </div>
        </Panel>
      </div>
    </div>
  );
}
