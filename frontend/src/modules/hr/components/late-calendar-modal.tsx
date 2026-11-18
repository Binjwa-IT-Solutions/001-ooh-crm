'use client';

import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';

import { attendanceApi } from '@/modules/hr/api';
import type { Attendance } from '@/modules/hr/types';
import { Spinner, cx } from '@/shared/ui';

/**
 * A month calendar for one employee that shows, day by day, when they came in
 * and how late they were — opened from the "Most often late" list.
 */

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const WEEKDAY_NAMES = ['Sundays', 'Mondays', 'Tuesdays', 'Wednesdays', 'Thursdays', 'Fridays', 'Saturdays'];

function pad(n: number) {
  return String(n).padStart(2, '0');
}
function isoDay(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function formatTime(value?: string | Date | null) {
  if (!value) return '—';
  return new Date(value).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}
function formatMinutes(mins: number) {
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h}h ${pad(m)}m` : `${h}h`;
}
function lateMinutes(r: Attendance): number | null {
  const start = r.shiftDetails?.startTime;
  if (!r.checkInTime || !start) return null;
  const [h, m] = start.split(':').map(Number);
  if (Number.isNaN(h)) return null;
  const checkIn = new Date(r.checkInTime);
  const expected = new Date(checkIn);
  expected.setHours(h, m || 0, 0, 0);
  return Math.max(0, Math.round((checkIn.getTime() - expected.getTime()) / 60000));
}

type DayKind = 'late' | 'ontime' | 'halfday' | 'leave' | 'absent' | 'off' | 'future';

interface DayCell {
  day: number;
  iso: string;
  kind: DayKind;
  record?: Attendance;
  lateBy?: number | null;
}

const LEGEND: { kind: DayKind; label: string; className: string }[] = [
  { kind: 'ontime', label: 'On time', className: 'bg-emerald-50 border-emerald-200' },
  { kind: 'late', label: 'Late (darker = later)', className: 'bg-amber-300 border-amber-400' },
  { kind: 'halfday', label: 'Half-day', className: 'bg-orange-50 border-orange-300' },
  { kind: 'leave', label: 'Leave', className: 'bg-blue-50 border-blue-200' },
  { kind: 'absent', label: 'Absent', className: 'bg-rose-50 border-rose-200' },
  { kind: 'off', label: 'Weekly off', className: 'bg-slate-100 border-slate-200' },
];

function lateShade(mins: number | null | undefined) {
  if (mins == null || mins < 30) return 'bg-amber-100 border-amber-200 text-amber-900';
  if (mins < 60) return 'bg-amber-300 border-amber-400 text-amber-950';
  return 'bg-orange-500 border-orange-600 text-white';
}

export function LateCalendarModal({
  employee,
  initialMonth,
  onClose,
}: {
  employee: { id?: string; _id?: string; fullName?: string; name?: string; department?: string; employeeCode?: string };
  /** Any YYYY-MM-DD inside the month to open on. */
  initialMonth: string;
  onClose: () => void;
}) {
  const employeeId = String(employee.id || employee._id || '');
  const name = employee.fullName || employee.name || 'Employee';
  const first = name.split(' ')[0];

  const [cursor, setCursor] = useState(() => {
    const d = new Date(`${initialMonth}T00:00:00`);
    return { year: d.getFullYear(), month: d.getMonth() };
  });
  const [records, setRecords] = useState<Attendance[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const now = new Date();
  const isCurrentMonth = cursor.year === now.getFullYear() && cursor.month === now.getMonth();

  useEffect(() => {
    let cancelled = false;
    const from = new Date(cursor.year, cursor.month, 1);
    const to = new Date(cursor.year, cursor.month + 1, 0);
    attendanceApi
      .getTeamAttendance({ employeeId, fromDate: isoDay(from), toDate: isoDay(to) })
      .then((res) => !cancelled && setRecords(res))
      .catch((err) => !cancelled && setError(err?.message || 'Could not load attendance.'));
    return () => {
      cancelled = true;
    };
  }, [cursor, employeeId]);

  // Close on Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const { cells, leadingBlanks, stats } = useMemo(() => {
    const byDay = new Map<string, Attendance>();
    (records || []).forEach((r) => byDay.set(isoDay(new Date(r.date)), r));

    const daysInMonth = new Date(cursor.year, cursor.month + 1, 0).getDate();
    const todayIso = isoDay(new Date());
    const out: DayCell[] = [];
    const lateList: { mins: number | null; weekday: number; iso: string }[] = [];
    let workingDays = 0;

    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(cursor.year, cursor.month, day);
      const iso = isoDay(date);
      const record = byDay.get(iso);
      let kind: DayKind;
      let lateBy: number | null | undefined;

      if (iso > todayIso) kind = 'future';
      else if (record?.status === 'Late') {
        kind = 'late';
        lateBy = lateMinutes(record);
        lateList.push({ mins: lateBy, weekday: date.getDay(), iso });
      } else if (record?.status === 'Leave') kind = 'leave';
      else if (record?.status === 'Half-Day') kind = 'halfday';
      else if (record?.checkInTime || record?.status === 'Present') kind = 'ontime';
      else if (date.getDay() === 0) kind = 'off';
      else if (iso === todayIso) kind = 'future'; // today, not in yet — don't call it absent
      else kind = 'absent';

      if (kind === 'late' || kind === 'ontime' || kind === 'halfday') workingDays++;
      out.push({ day, iso, kind, record, lateBy });
    }

    const mins = lateList.map((l) => l.mins).filter((m): m is number => m != null);
    const avg = mins.length ? Math.round(mins.reduce((a, b) => a + b, 0) / mins.length) : null;
    const worst = lateList.reduce<(typeof lateList)[number] | null>(
      (best, l) => (l.mins != null && (best == null || (best.mins ?? -1) < l.mins) ? l : best),
      null
    );

    // Which weekday do they tend to be late on?
    const weekdayCounts = new Array(7).fill(0);
    lateList.forEach((l) => weekdayCounts[l.weekday]++);
    const topWeekday = weekdayCounts.indexOf(Math.max(...weekdayCounts));
    const pattern =
      lateList.length >= 3 && weekdayCounts[topWeekday] >= 2 && weekdayCounts[topWeekday] / lateList.length >= 0.4
        ? WEEKDAY_NAMES[topWeekday]
        : null;

    return {
      cells: out,
      leadingBlanks: new Date(cursor.year, cursor.month, 1).getDay(),
      stats: { late: lateList.length, workingDays, avg, worst, pattern },
    };
  }, [records, cursor]);

  const monthLabel = new Date(cursor.year, cursor.month, 1).toLocaleDateString('en-GB', {
    month: 'long',
    year: 'numeric',
  });

  const summary = (() => {
    if (!records) return null;
    if (stats.workingDays === 0) return `No check-ins recorded for ${first} in ${monthLabel}.`;
    if (stats.late === 0) return `${first} was on time every day they came in during ${monthLabel}. 🎉`;
    let text = `${first} came in late on ${stats.late} of ${stats.workingDays} working days`;
    if (stats.avg != null) text += `, usually by about ${formatMinutes(stats.avg)}`;
    text += '.';
    if (stats.worst?.mins != null) {
      const d = new Date(`${stats.worst.iso}T00:00:00`);
      text += ` Latest was ${formatMinutes(stats.worst.mins)} on ${d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}.`;
    }
    if (stats.pattern) text += ` Most late days fall on ${stats.pattern}.`;
    return text;
  })();

  const move = (delta: number) => {
    setRecords(null); // show the spinner while the new month loads
    setError(null);
    setCursor((c) => {
      const d = new Date(c.year, c.month + delta, 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-label={`Late arrivals for ${name}`}
        className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-2xl max-h-[92vh] overflow-y-auto animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 p-5 border-b border-slate-100">
          <div>
            <h3 className="text-base font-bold text-slate-900">{name}</h3>
            <p className="text-xs text-slate-500">
              {[employee.employeeCode, employee.department].filter(Boolean).join(' · ') || 'Arrival times'}
            </p>
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Month switcher */}
          <div className="flex items-center justify-between">
            <button
              type="button"
              aria-label="Previous month"
              onClick={() => move(-1)}
              className="h-8 w-8 flex items-center justify-center rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <p className="text-sm font-bold text-slate-800">{monthLabel}</p>
            <button
              type="button"
              aria-label="Next month"
              disabled={isCurrentMonth}
              onClick={() => move(1)}
              className="h-8 w-8 flex items-center justify-center rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer disabled:opacity-40 disabled:pointer-events-none"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          {/* Plain-language summary */}
          {summary && (
            <p className="text-sm text-slate-700 leading-relaxed bg-amber-50/60 border border-amber-100 rounded-xl px-3.5 py-2.5">
              {summary}
            </p>
          )}

          {error ? (
            <p className="text-sm text-rose-700 py-10 text-center">{error}</p>
          ) : !records ? (
            <div className="flex justify-center py-16">
              <Spinner />
            </div>
          ) : (
            <>
              <div className="grid grid-cols-7 gap-1.5 text-center text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                {WEEKDAYS.map((d) => (
                  <div key={d}>{d}</div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1.5">
                {Array.from({ length: leadingBlanks }).map((_, i) => (
                  <div key={`blank-${i}`} />
                ))}
                {cells.map((c) => (
                  <DayBox key={c.iso} cell={c} />
                ))}
              </div>

              {/* Legend */}
              <div className="flex flex-wrap gap-x-4 gap-y-1.5 pt-1">
                {LEGEND.map((l) => (
                  <span key={l.kind} className="inline-flex items-center gap-1.5 text-[11px] text-slate-600">
                    <span className={cx('w-3 h-3 rounded border', l.className)} />
                    {l.label}
                  </span>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function DayBox({ cell }: { cell: DayCell }) {
  const { day, kind, record, lateBy } = cell;

  const styles: Record<DayKind, string> = {
    late: lateShade(lateBy),
    ontime: 'bg-emerald-50 border-emerald-200 text-emerald-900',
    halfday: 'bg-orange-50 border-orange-300 text-orange-900',
    leave: 'bg-blue-50 border-blue-200 text-blue-800',
    absent: 'bg-rose-50 border-rose-200 text-rose-700',
    off: 'bg-slate-100 border-slate-200 text-slate-400',
    future: 'bg-white border-slate-100 text-slate-300',
  };

  let line: string | null = null;
  let title = new Date(`${cell.iso}T00:00:00`).toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  if (kind === 'late') {
    line = lateBy != null ? `+${formatMinutes(lateBy)}` : 'Late';
    title += ` — came in at ${formatTime(record?.checkInTime)}${lateBy != null ? `, ${formatMinutes(lateBy)} after the shift started (${record?.shiftDetails?.startTime})` : ''}`;
  } else if (kind === 'ontime' || kind === 'halfday') {
    line = formatTime(record?.checkInTime);
    title += ` — came in at ${line}${kind === 'halfday' ? ' (half-day)' : ', on time'}`;
  } else if (kind === 'leave') {
    line = 'Leave';
    title += ' — on leave';
  } else if (kind === 'absent') {
    line = 'Absent';
    title += ' — no check-in';
  } else if (kind === 'off') {
    line = 'Off';
    title += ' — weekly off';
  }

  return (
    <div
      title={title}
      className={cx('min-h-[3.25rem] rounded-lg border p-1 flex flex-col justify-between text-left', styles[kind])}
    >
      <span className="text-[11px] font-bold leading-none">{day}</span>
      {line && <span className="text-[10px] font-semibold leading-tight truncate">{line}</span>}
    </div>
  );
}
