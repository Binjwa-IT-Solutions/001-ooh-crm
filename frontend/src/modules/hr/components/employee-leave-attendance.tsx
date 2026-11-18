'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ArrowUpRight, CalendarCheck, CalendarDays, Clock, UserX } from 'lucide-react';

import { Card, Spinner, cx } from '@/shared/ui';
import { leaveApi } from '../api';
import type { EmployeeLeaveSummary } from '../types';

/**
 * Employee profile → Attendance tab.
 * Leave used / left per type, approved leaves (and who approved them), pending
 * requests, and working days the person was away WITHOUT an approved leave.
 */

function fmtDay(value: string, opts: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short' }) {
  // Plain YYYY-MM-DD → local date; full timestamps as-is
  const d = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T00:00:00`) : new Date(value);
  return d.toLocaleDateString('en-GB', opts);
}
function fmtRange(from: string, to: string) {
  const a = fmtDay(from);
  const b = fmtDay(to);
  return a === b ? a : `${a} – ${b}`;
}
const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'}`;

function Tile({
  icon: Icon,
  tone,
  label,
  value,
  hint,
}: {
  icon: typeof Clock;
  tone: string;
  label: string;
  value: React.ReactNode;
  hint?: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 flex gap-3">
      <div className={cx('w-10 h-10 rounded-xl flex items-center justify-center shrink-0', tone)}>
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <p className="text-xs font-semibold text-slate-500">{label}</p>
        <p className="text-2xl font-bold text-slate-900 leading-tight">{value}</p>
        {hint && <p className="text-[11px] text-slate-500 mt-0.5">{hint}</p>}
      </div>
    </div>
  );
}

export function EmployeeLeaveAttendance({ employeeId, employeeName }: { employeeId: string; employeeName: string }) {
  const thisYear = new Date().getFullYear();
  const [year, setYear] = useState(thisYear);
  const [data, setData] = useState<EmployeeLeaveSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showAllAbsences, setShowAllAbsences] = useState(false);

  useEffect(() => {
    let cancelled = false;
    leaveApi
      .getEmployeeSummary(employeeId, year)
      .then((res) => {
        if (!cancelled) {
          setData(res);
          setError(null);
        }
      })
      .catch((err) => !cancelled && setError(err?.message || 'Could not load leave and attendance.'));
    return () => {
      cancelled = true;
    };
  }, [employeeId, year]);

  const changeYear = (y: number) => {
    setData(null);
    setShowAllAbsences(false);
    setYear(y);
  };

  if (error) return <p className="text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-xl p-4">{error}</p>;
  if (!data) {
    return (
      <div className="flex justify-center py-16">
        <Spinner />
      </div>
    );
  }

  const first = employeeName.split(' ')[0];
  const s = data.stats;
  const absences = showAllAbsences ? data.unapprovedAbsences : data.unapprovedAbsences.slice(0, 12);
  const limitedBalances = data.balances.filter((b) => !b.unlimited);
  const unlimitedUsed = data.balances.filter((b) => b.unlimited && b.used > 0);

  let summary = `In ${year}, ${first} has been present on ${s.presentDays} of ${s.workingDaysSoFar} working days`;
  summary += s.lateDays ? `, late ${plural(s.lateDays, 'time')}` : '';
  summary += `, and took ${plural(s.approvedLeaveDays, 'day')} of approved leave.`;
  summary += s.unapprovedAbsenceDays
    ? ` ${first} was away on ${plural(s.unapprovedAbsenceDays, 'working day')} without an approved leave.`
    : ` No unexplained absences. 👍`;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-slate-700 leading-relaxed max-w-3xl">{summary}</p>
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg text-xs font-semibold">
          {[thisYear - 1, thisYear].map((y) => (
            <button
              key={y}
              type="button"
              onClick={() => changeYear(y)}
              className={cx('px-3 py-1 rounded-md', y === year ? 'bg-white text-[#6E1D1D] shadow-xs' : 'text-slate-500')}
            >
              {y}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        <Tile
          icon={CalendarCheck}
          tone="bg-emerald-50 text-emerald-600"
          label="Present"
          value={
            <>
              {s.presentDays}
              <span className="text-base font-semibold text-slate-400"> / {s.workingDaysSoFar}</span>
            </>
          }
          hint={s.halfDays ? `${plural(s.halfDays, 'half-day')} too` : 'Working days so far'}
        />
        <Tile icon={Clock} tone="bg-amber-50 text-amber-600" label="Late arrivals" value={s.lateDays} />
        <Tile
          icon={CalendarDays}
          tone="bg-blue-50 text-blue-600"
          label="Approved leave"
          value={s.approvedLeaveDays}
          hint={`${plural(data.approvedLeaves.length, 'request')}${data.pendingLeaves.length ? ` · ${data.pendingLeaves.length} pending` : ''}`}
        />
        <Tile
          icon={UserX}
          tone={s.unapprovedAbsenceDays ? 'bg-rose-50 text-rose-600' : 'bg-slate-100 text-slate-500'}
          label="Absent without leave"
          value={s.unapprovedAbsenceDays}
          hint="No check-in and no approved leave"
        />
      </div>

      {/* Balances */}
      <Card className="p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-slate-900">Leave balance {year}</h3>
          <Link href="/leave?tab=types" className="text-xs font-semibold text-[#6E1D1D] hover:underline">
            Leave policies
          </Link>
        </div>
        {data.balances.length === 0 ? (
          <p className="text-xs text-slate-400 py-4 text-center">No leave types set up yet. Add them under Leave → Leave Types.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] font-bold uppercase tracking-wider text-slate-500 border-b border-slate-100">
                  <th className="py-2 pr-3">Leave</th>
                  <th className="py-2 pr-3">Credited</th>
                  <th className="py-2 pr-3">Carried over</th>
                  <th className="py-2 pr-3">Used</th>
                  <th className="py-2">Left</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {limitedBalances.map((b) => {
                  const credited = b.allocated - (b.carriedExpired ? 0 : b.carriedForward);
                  return (
                    <tr key={b.leaveTypeId}>
                      <td className="py-2.5 pr-3 font-semibold text-slate-800">
                        {b.leaveTypeName}
                        <span className="block text-[11px] font-normal text-slate-400">
                          {b.quotaPeriod === 'Monthly' ? `${b.quotaDays}/month` : `${b.yearEntitlement ?? credited}/year`}
                        </span>
                      </td>
                      <td className="py-2.5 pr-3 text-slate-700">
                        {credited}
                        {b.quotaPeriod === 'Monthly' && b.yearEntitlement != null && (
                          <span className="text-slate-400"> of {b.yearEntitlement}</span>
                        )}
                      </td>
                      <td className="py-2.5 pr-3 text-slate-700">
                        {b.carriedForward ? (
                          <span className={b.carriedExpired ? 'line-through text-slate-400' : ''}>
                            {b.carriedForward}
                            {b.carriedExpiresOn && (
                              <span className="block text-[11px] text-slate-400 no-underline">
                                {b.carriedExpired ? 'expired' : `use by ${fmtDay(b.carriedExpiresOn)}`}
                              </span>
                            )}
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="py-2.5 pr-3 text-slate-700">{b.used}</td>
                      <td className={cx('py-2.5 font-bold', b.balance > 0 ? 'text-emerald-700' : 'text-rose-600')}>{b.balance}</td>
                    </tr>
                  );
                })}
                {unlimitedUsed.map((b) => (
                  <tr key={b.leaveTypeId}>
                    <td className="py-2.5 pr-3 font-semibold text-slate-800">
                      {b.leaveTypeName}
                      <span className="block text-[11px] font-normal text-slate-400">No limit</span>
                    </td>
                    <td className="py-2.5 pr-3 text-slate-400">—</td>
                    <td className="py-2.5 pr-3 text-slate-400">—</td>
                    <td className="py-2.5 pr-3 text-slate-700">{b.used}</td>
                    <td className="py-2.5 text-slate-500">Unlimited</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Approved leaves */}
        <Card className="p-5">
          <h3 className="text-sm font-bold text-slate-900 mb-3">Approved leaves</h3>
          {data.approvedLeaves.length === 0 ? (
            <p className="text-xs text-slate-400 py-4 text-center">No approved leave in {year}.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {data.approvedLeaves.map((l) => (
                <li key={l.id} className="py-2.5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-800">
                        {l.type}
                        {l.upcoming && (
                          <span className="ml-2 align-middle px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700">
                            Upcoming
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-slate-500">
                        {fmtRange(l.fromDate, l.toDate)} · {plural(l.days, 'day')}
                      </p>
                      {l.reason && <p className="text-[11px] text-slate-500 italic truncate">&ldquo;{l.reason}&rdquo;</p>}
                    </div>
                    <p className="text-[11px] text-right text-slate-500 shrink-0">
                      {l.decidedByName ? (
                        <>
                          Approved by <span className="font-semibold text-slate-700">{l.decidedByName}</span>
                          {l.decidedByRole && <> ({l.decidedByRole})</>}
                        </>
                      ) : (
                        'Approved'
                      )}
                      {l.decidedAt && <span className="block">{fmtDay(l.decidedAt)}</span>}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          )}
          {data.pendingLeaves.length > 0 && (
            <div className="mt-3 pt-3 border-t border-slate-100">
              <p className="text-[11px] font-bold text-amber-700 uppercase tracking-wider mb-1">Waiting for approval</p>
              <ul>
                {data.pendingLeaves.map((l) => (
                  <li key={l.id} className="text-xs text-slate-600 py-0.5">
                    {l.type} · {fmtRange(l.fromDate, l.toDate)} · {plural(l.days, 'day')}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {data.rejectedLeaves > 0 && (
            <p className="mt-2 text-[11px] text-slate-400">{plural(data.rejectedLeaves, 'request')} rejected this year.</p>
          )}
        </Card>

        {/* Unapproved absences */}
        <Card className="p-5">
          <h3 className="text-sm font-bold text-slate-900">Absent without approved leave</h3>
          <p className="text-xs text-slate-500 mb-3">Working days with no check-in and no approved leave (Sundays and holidays excluded).</p>
          {data.unapprovedAbsences.length === 0 ? (
            <p className="text-xs text-slate-400 py-4 text-center">None in {year}. 👍</p>
          ) : (
            <>
              <ul className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {absences.map((a) => (
                  <li
                    key={a.date}
                    className="rounded-lg border border-rose-100 bg-rose-50/60 px-2.5 py-1.5"
                    title={a.markedAbsent ? 'Marked absent' : 'No check-in, no leave'}
                  >
                    <p className="text-xs font-semibold text-rose-800">{fmtDay(a.date, { weekday: 'short', day: 'numeric', month: 'short' })}</p>
                    <p className="text-[10px] text-rose-600">{a.markedAbsent ? 'Marked absent' : 'No check-in'}</p>
                  </li>
                ))}
              </ul>
              {data.unapprovedAbsences.length > 12 && (
                <button
                  type="button"
                  onClick={() => setShowAllAbsences((v) => !v)}
                  className="mt-3 text-xs font-semibold text-[#6E1D1D] hover:underline"
                >
                  {showAllAbsences ? 'Show fewer' : `Show all ${data.unapprovedAbsences.length}`}
                </button>
              )}
            </>
          )}
        </Card>
      </div>

      <div className="flex flex-wrap gap-3 text-xs font-semibold">
        <Link href="/attendance?tab=reports" className="inline-flex items-center gap-1 text-[#6E1D1D] hover:underline">
          Attendance reports <ArrowUpRight className="h-3.5 w-3.5" />
        </Link>
        <Link href="/leave?tab=approvals" className="inline-flex items-center gap-1 text-[#6E1D1D] hover:underline">
          Leave approvals <ArrowUpRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </div>
  );
}
