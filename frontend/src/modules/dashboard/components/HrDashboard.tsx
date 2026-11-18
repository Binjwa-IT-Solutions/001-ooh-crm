'use client';

import Link from 'next/link';
import { AlertTriangle, CalendarDays, Clock, ShieldCheck, UserX, Users } from 'lucide-react';

import { dashboardApi } from '../api';
import { useDashboardData } from '../hooks/use-dashboard';
import type { HrDashboardData } from '../role-types';
import { Empty, LoadError, Panel, Row, SectionTitle, Skeleton, Stat, fmtDay, fmtRange, plural, relDay } from './dashboard-kit';

function headline(d: HrDashboardData): string {
  const t = d.today;
  if (t.isSunday) return "It's Sunday — a weekly off. Here's what's coming up this week.";
  const parts = [`${t.checkedIn} of ${t.total} people have checked in today`];
  if (t.late) parts.push(`${t.late} came in late`);
  if (t.notCheckedIn) parts.push(`${t.notCheckedIn} haven't checked in yet`);
  if (t.onLeave) parts.push(`${t.onLeave} on leave`);
  let text = parts.join(', ').replace(/, ([^,]*)$/, ' and $1') + '.';
  const todo: string[] = [];
  if (d.actions.pendingLeaves) todo.push(plural(d.actions.pendingLeaves, 'leave request'));
  if (d.actions.pendingLogins) todo.push(plural(d.actions.pendingLogins, 'login approval'));
  text += todo.length ? ` Waiting on you: ${todo.join(' and ')}.` : ' Nothing is waiting for your approval.';
  return text;
}

const PIPELINE_TONE: Record<string, string> = {
  Scheduled: 'bg-blue-50 text-blue-800 border-blue-100',
  Interviewed: 'bg-violet-50 text-violet-800 border-violet-100',
  Selected: 'bg-emerald-50 text-emerald-800 border-emerald-100',
  'On Hold': 'bg-amber-50 text-amber-800 border-amber-100',
  Rejected: 'bg-slate-50 text-slate-600 border-slate-200',
};

export function HrDashboard() {
  const { data, error, reload } = useDashboardData(dashboardApi.getHr);

  if (error) return <LoadError message={error} onRetry={reload} />;
  if (!data) return <Skeleton rows={3} />;

  const t = data.today;
  const maxDept = Math.max(1, ...data.people.byDepartment.map((d) => d.count));

  return (
    <div className="space-y-5">
      <p className="text-sm text-slate-700 leading-relaxed bg-[#FFF8F8] border border-[#F0D0D0] rounded-2xl px-4 py-3">
        {headline(data)}
      </p>

      {/* Today at a glance */}
      <div className="space-y-2">
        <SectionTitle>Today</SectionTitle>
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
          <Stat
            icon={Users}
            tone="emerald"
            label="Checked in"
            value={
              <>
                {t.checkedIn}
                <span className="text-base font-semibold text-slate-400"> / {t.total}</span>
              </>
            }
            hint={t.stillWorking ? `${t.stillWorking} still at work` : undefined}
            href="/attendance?tab=team"
          />
          <Stat icon={Clock} tone="amber" label="Late today" value={t.late} hint="After the grace period" href="/attendance?tab=team" />
          <Stat
            icon={UserX}
            tone="rose"
            label="Not checked in"
            value={t.notCheckedIn}
            hint={t.isSunday ? 'Weekly off' : 'You can check them in from Attendance'}
            href="/attendance?tab=team"
          />
          <Stat icon={CalendarDays} tone="blue" label="On leave" value={t.onLeave} href="/leave?tab=calendar" />
        </div>
      </div>

      {/* Needs your action */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Panel
          className="lg:col-span-2"
          title="Leave requests waiting for you"
          subtitle={data.actions.pendingLeaves ? `${data.actions.pendingLeaves} pending — oldest first` : 'All caught up'}
          action={{ href: '/leave?tab=approvals', label: 'Review' }}
        >
          {data.actions.leaveRequests.length === 0 ? (
            <Empty>No pending leave requests. 🎉</Empty>
          ) : (
            <ul>
              {data.actions.leaveRequests.map((l) => (
                <Row
                  key={l.id}
                  left={`${l.employeeName} · ${l.type}`}
                  sub={`${fmtRange(l.fromDate, l.toDate)} · ${plural(l.days, 'day')}`}
                  right={l.requestedAt ? `Asked ${relDay(l.requestedAt).toLowerCase()}` : undefined}
                />
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Other things to check">
          <ul className="space-y-2">
            <ActionLine
              href="/security/approvals"
              icon={ShieldCheck}
              count={data.actions.pendingLogins}
              label="login approvals"
              hint="New device or location"
            />
            <ActionLine
              href="/employees"
              icon={AlertTriangle}
              count={data.actions.incompleteProfiles}
              label="incomplete profiles"
              hint="Missing personal or bank details"
            />
          </ul>
        </Panel>
      </div>

      {/* People this week */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Panel title="Away this week" action={{ href: '/leave?tab=calendar', label: 'Calendar' }}>
          {data.awayThisWeek.length === 0 ? (
            <Empty>Nobody is on leave this week.</Empty>
          ) : (
            <ul>
              {data.awayThisWeek.map((a, i) => (
                <Row key={i} left={a.employeeName} sub={a.type} right={fmtRange(a.fromDate, a.toDate)} />
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Most often late this month" action={{ href: '/attendance?tab=team', label: 'Details' }}>
          {data.lateThisMonth.length === 0 ? (
            <Empty>No late arrivals this month.</Empty>
          ) : (
            <ul>
              {data.lateThisMonth.map((l) => (
                <Row key={l.employeeName} left={l.employeeName} right={plural(l.count, 'time')} tone="amber" />
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Celebrations & new faces">
          {data.people.birthdays.length === 0 && data.people.newJoiners.length === 0 ? (
            <Empty>No birthdays or new joiners this week.</Empty>
          ) : (
            <ul>
              {data.people.birthdays.map((b) => (
                <Row key={`b-${b.name}`} left={`🎂 ${b.name}`} sub="Birthday" right={relDay(b.date)} />
              ))}
              {data.people.newJoiners.map((j) => (
                <Row key={`j-${j.name}`} left={`👋 ${j.name}`} sub={`Joined${j.department ? ` ${j.department}` : ''}`} right={fmtDay(j.date)} />
              ))}
            </ul>
          )}
        </Panel>
      </div>

      {/* Recruitment + headcount */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Panel title="Recruitment" action={{ href: '/candidates', label: 'Candidates' }}>
          <div className="flex flex-wrap gap-1.5 mb-4">
            {Object.entries(data.recruitment.pipeline).map(([status, count]) => (
              <span key={status} className={`px-2 py-1 rounded-lg border text-[11px] font-semibold ${PIPELINE_TONE[status] ?? PIPELINE_TONE.Rejected}`}>
                {status} <span className="font-bold">{count}</span>
              </span>
            ))}
          </div>
          <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Interviews this week</p>
          {data.recruitment.upcomingInterviews.length === 0 ? (
            <Empty>No interviews scheduled.</Empty>
          ) : (
            <ul>
              {data.recruitment.upcomingInterviews.map((c, i) => (
                <Row
                  key={i}
                  left={c.name}
                  sub={c.position}
                  right={`${relDay(c.date)}, ${new Date(c.date).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`}
                />
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Headcount by department" subtitle={`${t.total} active employees`} action={{ href: '/employees', label: 'Employees' }}>
          <ul className="space-y-2">
            {data.people.byDepartment.map((d) => (
              <li key={d.department}>
                <div className="flex justify-between text-xs">
                  <span className="font-semibold text-slate-700">{d.department}</span>
                  <span className="font-bold text-slate-800">{d.count}</span>
                </div>
                <div className="h-1.5 rounded-full bg-slate-100 mt-1 overflow-hidden">
                  <div className="h-full rounded-full bg-[#6E1D1D]/70" style={{ width: `${(d.count / maxDept) * 100}%` }} />
                </div>
              </li>
            ))}
          </ul>
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
        </Panel>
      </div>
    </div>
  );
}

function ActionLine({
  href,
  icon: Icon,
  count,
  label,
  hint,
}: {
  href: string;
  icon: typeof ShieldCheck;
  count: number;
  label: string;
  hint: string;
}) {
  return (
    <li>
      <Link
        href={href}
        className="flex items-center gap-3 p-3 rounded-xl border border-slate-100 hover:border-slate-200 hover:bg-slate-50 transition-colors"
      >
        <span className={`w-9 h-9 rounded-lg flex items-center justify-center ${count ? 'bg-amber-50 text-amber-600' : 'bg-slate-50 text-slate-400'}`}>
          <Icon className="h-4 w-4" />
        </span>
        <span className="min-w-0">
          <span className="block text-sm font-bold text-slate-900">
            {count} <span className="text-xs font-semibold text-slate-600">{label}</span>
          </span>
          <span className="block text-[11px] text-slate-500">{hint}</span>
        </span>
      </Link>
    </li>
  );
}
