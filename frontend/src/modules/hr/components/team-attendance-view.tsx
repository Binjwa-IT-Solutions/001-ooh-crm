'use client';

import { useState, useMemo, type ComponentType, type ReactNode } from 'react';
import {
  Search,
  Download,
  Printer,
  ChevronLeft,
  ChevronRight,
  Eye,
  X,
  MapPin,
  RotateCw,
  Users,
  Clock,
  UserX,
  Timer,
} from 'lucide-react';
import { Card, Spinner, DatePicker, Dropdown, Alert, cx } from '@/shared/ui';
import { useAuth } from '@/shared/auth/auth-context';
import { attendanceApi } from '@/modules/hr/api';
import { LateCalendarModal } from './late-calendar-modal';
import { useTeamAttendance } from '@/modules/hr/hooks/use-attendance';
import { useEmployeeList } from '@/modules/employees/hooks/use-employees';
import { DEPARTMENTS } from '@/modules/employees/types';
import { formatHoursToHM } from '@/shared/utils/formatters';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// Statuses that mean the person actually showed up for work
const IN_STATUSES = new Set(['Present', 'Late', 'On-duty', 'Half-Day', 'Break']);

type StatusFilter = '' | 'in' | 'Late' | 'Absent' | 'Leave' | 'Half-Day';

const STATUS_CHIPS: { value: StatusFilter; label: string }[] = [
  { value: '', label: 'Everyone' },
  { value: 'in', label: 'Checked in' },
  { value: 'Late', label: 'Late' },
  { value: 'Absent', label: 'Absent' },
  { value: 'Leave', label: 'On leave' },
  { value: 'Half-Day', label: 'Half-day' },
];

const STATUS_STYLES: Record<string, string> = {
  Present: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  Late: 'bg-amber-50 text-amber-700 border-amber-200',
  'Half-Day': 'bg-orange-50 text-orange-700 border-orange-200',
  Leave: 'bg-blue-50 text-blue-700 border-blue-200',
  'On-duty': 'bg-indigo-50 text-indigo-700 border-indigo-200',
  Break: 'bg-slate-50 text-slate-600 border-slate-200',
  Off: 'bg-slate-100 text-slate-500 border-slate-200',
  Absent: 'bg-rose-50 text-rose-700 border-rose-200',
};

/** Local YYYY-MM-DD (toISOString would shift to UTC and give yesterday's date early in the morning). */
function toLocalIso(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Local YYYY-MM-DD for either a plain date string or a full timestamp. */
function dayKey(value: string | Date): string {
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  return toLocalIso(new Date(value));
}

function parseIso(iso: string): Date {
  return new Date(`${iso}T00:00:00`);
}

function shiftIsoDate(iso: string, days: number): string {
  const d = parseIso(iso);
  d.setDate(d.getDate() + days);
  return toLocalIso(d);
}

function formatTime(value?: string | Date | null): string {
  if (!value) return '—';
  return new Date(value).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function formatDay(value: string | Date, withYear = false): string {
  const d = typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) ? parseIso(value) : new Date(value);
  return d.toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    ...(withYear ? { year: 'numeric' } : {}),
  });
}

/** "1h 05m" / "25 min" style for a minute count. */
function formatMinutes(mins: number): string {
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h}h ${String(m).padStart(2, '0')}m` : `${h}h`;
}

/** Minutes past the shift start time. Null when we can't tell. */
function getLateMinutes(record: any): number | null {
  if (!record.checkInTime || !record.shiftStart) return null;
  const [h, m] = String(record.shiftStart).split(':').map(Number);
  if (Number.isNaN(h)) return null;
  const checkIn = new Date(record.checkInTime);
  const expected = new Date(checkIn);
  expected.setHours(h, m || 0, 0, 0);
  const diff = Math.round((checkIn.getTime() - expected.getTime()) / 60000);
  return diff > 0 ? diff : 0;
}

function minutesOfDay(value: string | Date): number {
  const d = new Date(value);
  return d.getHours() * 60 + d.getMinutes();
}

function minutesToClock(mins: number): string {
  const d = new Date();
  d.setHours(Math.floor(mins / 60), Math.round(mins % 60), 0, 0);
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function getInitials(name?: string) {
  if (!name) return 'EM';
  const p = name.trim().split(/\s+/);
  return (p[0][0] + (p[1] ? p[1][0] : '')).toUpperCase();
}

function employeeName(emp: any): string {
  return emp?.fullName || emp?.name || 'Employee';
}

function employeeKey(emp: any): string {
  return String(emp?.id || emp?._id || emp?.employeeCode || '');
}

function plural(n: number, word: string, pluralWord = `${word}s`) {
  return `${n} ${n === 1 ? word : pluralWord}`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function TeamAttendanceView() {
  const todayIso = useMemo(() => toLocalIso(new Date()), []);

  const [department, setDepartment] = useState('');
  const [dateMode, setDateMode] = useState<'single' | 'range'>('single');
  const [singleDate, setSingleDate] = useState(todayIso);
  const [fromDate, setFromDate] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return toLocalIso(d);
  });
  const [toDate, setToDate] = useState(todayIso);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('');

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [sortField, setSortField] = useState<'name' | 'date' | 'status' | 'checkIn'>('name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  const [detailModalItem, setDetailModalItem] = useState<any | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  // Employee whose late-arrival calendar is open
  const [lateCalendarFor, setLateCalendarFor] = useState<any | null>(null);

  // HR / admin can fix today's punches for someone else
  const { user } = useAuth();
  const canCorrect = user?.role === 'hr' || user?.role === 'admin';

  const isSingle = dateMode === 'single';
  const isToday = isSingle && singleDate === todayIso;

  // ---- Data -------------------------------------------------------------
  // The API caps pageSize at 100 — asking for more fails validation and returns nothing.
  const { data: employeeData } = useEmployeeList({ pageSize: 100 });
  const allEmployees: any[] = useMemo(() => employeeData?.employees || [], [employeeData]);

  const attendanceQuery = useMemo(
    () => (isSingle ? { date: singleDate } : { fromDate, toDate }),
    [isSingle, singleDate, fromDate, toDate]
  );
  const { data: attendanceRecords, isLoading: isFetching, mutate: refetchAttendance } = useTeamAttendance(attendanceQuery);
  // Only show the big spinner on first load, not on background refreshes after an HR correction
  const isLoading = isFetching && !attendanceRecords;

  const departmentCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    allEmployees.forEach((emp: any) => {
      const dept = emp.department || 'Other';
      counts[dept] = (counts[dept] || 0) + 1;
    });
    return counts;
  }, [allEmployees]);

  // One row per employee (single day) or one row per punch (range)
  const unifiedRecords = useMemo(() => {
    if (!attendanceRecords && isLoading) return [];

    const toRow = (r: any, emp: any) => {
      const row: any = {
        id: r.id || r._id,
        employee: emp,
        date: r.date,
        status: r.status || 'Present',
        shift: r.shiftDetails?.name || 'General Shift',
        shiftStart: r.shiftDetails?.startTime,
        shiftEnd: r.shiftDetails?.endTime,
        checkInTime: r.checkInTime,
        checkOutTime: r.checkOutTime,
        checkInGps: r.checkInGps,
        checkOutGps: r.checkOutGps,
        hoursWorked: r.actualHours ?? r.totalHours ?? 0,
        overtimeHours: r.overtimeHours,
        totalBreakMinutes: r.totalBreakMinutes,
        workType: r.workType || 'Office',
        notes: r.deviceInfo,
        reviewNotes: r.reviewNotes,
      };
      row.lateMinutes = row.status === 'Late' ? getLateMinutes(row) : null;
      return row;
    };

    if (isSingle) {
      const punchMap = new Map<string, any>();
      (attendanceRecords || []).forEach((r: any) => {
        const key = employeeKey(r.employeeId) || String(r.employeeId);
        if (key) punchMap.set(key, r);
      });

      const isSunday = parseIso(singleDate).getDay() === 0;
      return allEmployees.map((emp: any) => {
        const punch = punchMap.get(employeeKey(emp));
        if (punch) return toRow(punch, emp);
        return {
          id: `absent-${employeeKey(emp)}`,
          employee: emp,
          date: singleDate,
          status: isSunday ? 'Off' : 'Absent',
          shift: '—',
          checkInTime: null,
          checkOutTime: null,
          hoursWorked: 0,
          lateMinutes: null,
          workType: '—',
          notes: 'No punch recorded',
        };
      });
    }

    return (attendanceRecords || []).map((r: any) => toRow(r, r.employeeId || {}));
  }, [attendanceRecords, allEmployees, isSingle, singleDate, isLoading]);

  // Department + search apply to everything (summary included)
  const scopedRecords = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return unifiedRecords.filter((item: any) => {
      if (department && (item.employee?.department || '') !== department) return false;
      if (q) {
        const haystack = [
          employeeName(item.employee),
          item.employee?.employeeCode,
          item.employee?.workEmail || item.employee?.email,
        ]
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [unifiedRecords, department, searchQuery]);

  // Status filter only narrows the table, so the summary stays meaningful
  const filteredRecords = useMemo(() => {
    if (!statusFilter) return scopedRecords;
    if (statusFilter === 'in') return scopedRecords.filter((r: any) => IN_STATUSES.has(r.status));
    return scopedRecords.filter((r: any) => r.status === statusFilter);
  }, [scopedRecords, statusFilter]);

  // ---- Summary ----------------------------------------------------------
  const summary = useMemo(() => {
    const counts: Record<string, number> = {};
    let checkedIn = 0;
    let stillWorking = 0;
    const checkInMins: number[] = [];
    const hours: number[] = [];
    const lateMins: number[] = [];

    scopedRecords.forEach((r: any) => {
      counts[r.status] = (counts[r.status] || 0) + 1;
      if (IN_STATUSES.has(r.status)) checkedIn++;
      if (r.checkInTime) checkInMins.push(minutesOfDay(r.checkInTime));
      if (r.checkInTime && !r.checkOutTime) stillWorking++;
      if (r.hoursWorked > 0 && r.checkOutTime) hours.push(r.hoursWorked);
      if (r.lateMinutes != null && r.lateMinutes > 0) lateMins.push(r.lateMinutes);
    });

    const total = scopedRecords.length;
    const off = counts['Off'] || 0;
    const expected = total - off;
    const avg = (arr: number[]) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null);

    return {
      total,
      expected,
      checkedIn,
      late: counts['Late'] || 0,
      absent: counts['Absent'] || 0,
      leave: counts['Leave'] || 0,
      halfDay: counts['Half-Day'] || 0,
      onDuty: counts['On-duty'] || 0,
      off,
      stillWorking,
      counts,
      attendanceRate: expected > 0 ? Math.round((checkedIn / expected) * 100) : 0,
      onTimeRate: checkedIn > 0 ? Math.round(((checkedIn - (counts['Late'] || 0)) / checkedIn) * 100) : null,
      avgCheckIn: avg(checkInMins),
      avgHours: avg(hours),
      avgLate: avg(lateMins),
      maxLate: lateMins.length ? Math.max(...lateMins) : null,
    };
  }, [scopedRecords]);

  // Late arrivals list: per record for a day, grouped per person for a range
  const lateList = useMemo(() => {
    const late = scopedRecords.filter((r: any) => r.status === 'Late');
    if (isSingle) {
      return late
        .map((r: any) => ({
          key: r.id,
          employee: r.employee,
          name: employeeName(r.employee),
          detail: `In at ${formatTime(r.checkInTime)}`,
          value: r.lateMinutes != null ? `${formatMinutes(r.lateMinutes)} late` : 'Late',
          sortBy: r.lateMinutes ?? 0,
        }))
        .sort((a, b) => b.sortBy - a.sortBy);
    }

    const byPerson = new Map<string, { employee: any; name: string; times: number; mins: number[] }>();
    late.forEach((r: any) => {
      const key = employeeKey(r.employee) || employeeName(r.employee);
      const entry = byPerson.get(key) || { employee: r.employee, name: employeeName(r.employee), times: 0, mins: [] };
      entry.times++;
      if (r.lateMinutes != null) entry.mins.push(r.lateMinutes);
      byPerson.set(key, entry);
    });
    return [...byPerson.entries()]
      .map(([key, e]) => {
        const avgMins = e.mins.length ? Math.round(e.mins.reduce((a, b) => a + b, 0) / e.mins.length) : null;
        return {
          key,
          employee: e.employee,
          name: e.name,
          detail: avgMins != null ? `Usually ${formatMinutes(avgMins)} late` : '',
          value: plural(e.times, 'time'),
          sortBy: e.times * 1000 + (avgMins ?? 0),
        };
      })
      .sort((a, b) => b.sortBy - a.sortBy);
  }, [scopedRecords, isSingle]);

  // Plain-language headline
  const headline = useMemo(() => {
    if (isLoading) return 'Loading attendance…';
    if (summary.total === 0) return 'No attendance to show for this selection.';

    if (isSingle) {
      if (summary.off === summary.total) return `${formatDay(singleDate)} is a weekly off — nobody was expected in.`;
      const who = department ? `in ${department}` : 'on the team';
      const lead = isToday
        ? `So far today, ${summary.checkedIn} of ${summary.expected} people ${who} have checked in.`
        : `On ${formatDay(singleDate)}, ${summary.checkedIn} of ${summary.expected} people ${who} came in.`;
      const parts: string[] = [];
      if (summary.late) {
        parts.push(
          `${plural(summary.late, 'person', 'people')} arrived late` +
            (summary.avgLate != null ? ` (by ${formatMinutes(Math.round(summary.avgLate))} on average)` : '')
        );
      } else if (summary.checkedIn) {
        parts.push('everyone who came in was on time');
      }
      if (summary.absent) parts.push(`${summary.absent} ${isToday ? "haven't checked in yet" : 'were absent'}`);
      if (summary.leave) parts.push(`${summary.leave} on leave`);
      const tail = parts.length ? ` ${parts.join(', ').replace(/^./, (c) => c.toUpperCase())}.` : '';
      return lead + tail;
    }

    const people = new Set(scopedRecords.map((r: any) => employeeKey(r.employee))).size;
    let text = `Between ${formatDay(fromDate)} and ${formatDay(toDate)}, ${plural(people, 'person', 'people')} logged ${plural(summary.checkedIn, 'working day')}.`;
    if (summary.late) {
      text += ` ${plural(summary.late, 'check-in')} ${summary.late === 1 ? 'was' : 'were'} late`;
      if (summary.avgLate != null) text += `, by ${formatMinutes(Math.round(summary.avgLate))} on average`;
      text += '.';
    } else if (summary.checkedIn) {
      text += ' No late arrivals.';
    }
    return text;
  }, [isLoading, summary, isSingle, isToday, singleDate, department, fromDate, toDate, scopedRecords]);

  // ---- Sort & paginate --------------------------------------------------
  const sortedRecords = useMemo(() => {
    return [...filteredRecords].sort((a: any, b: any) => {
      let cmp = 0;
      if (sortField === 'name') cmp = employeeName(a.employee).localeCompare(employeeName(b.employee));
      else if (sortField === 'date') cmp = new Date(a.date).getTime() - new Date(b.date).getTime();
      else if (sortField === 'status') cmp = String(a.status).localeCompare(String(b.status));
      else if (sortField === 'checkIn') {
        const ta = a.checkInTime ? new Date(a.checkInTime).getTime() : Infinity;
        const tb = b.checkInTime ? new Date(b.checkInTime).getTime() : Infinity;
        cmp = ta === tb ? 0 : ta < tb ? -1 : 1;
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [filteredRecords, sortField, sortDir]);

  const totalPages = Math.ceil(sortedRecords.length / pageSize) || 1;
  const paginatedRecords = useMemo(
    () => sortedRecords.slice((page - 1) * pageSize, page * pageSize),
    [sortedRecords, page, pageSize]
  );

  const toggleSort = (field: typeof sortField) => {
    if (sortField === field) setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    else {
      setSortField(field);
      setSortDir('asc');
    }
  };
  const sortArrow = (field: typeof sortField) => (sortField === field ? (sortDir === 'asc' ? ' ↑' : ' ↓') : '');

  const applyStatus = (value: StatusFilter) => {
    setStatusFilter((cur) => (cur === value ? '' : value));
    setPage(1);
  };

  // ---- Actions ----------------------------------------------------------
  const handleExportCsv = () => {
    const headers = ['Employee Code', 'Employee Name', 'Department', 'Date', 'Shift', 'Check-in', 'Check-out', 'Late By (min)', 'Hours Worked', 'Overtime', 'Status'];
    const rows = filteredRecords.map((r: any) => [
      r.employee?.employeeCode || '',
      employeeName(r.employee),
      r.employee?.department || '',
      new Date(r.date).toLocaleDateString(),
      r.shift || '',
      formatTime(r.checkInTime),
      formatTime(r.checkOutTime),
      r.lateMinutes ?? '',
      r.hoursWorked ? formatHoursToHM(r.hoursWorked) : '0h',
      r.overtimeHours ? formatHoursToHM(r.overtimeHours) : '0h',
      r.status,
    ]);
    const csv = [headers, ...rows]
      .map((row) => row.map((cell: any) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `attendance_${isSingle ? singleDate : `${fromDate}_to_${toDate}`}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const hasFilters = !!(department || statusFilter || searchQuery || (isSingle && singleDate !== todayIso));
  const handleClearFilters = () => {
    setDepartment('');
    setStatusFilter('');
    setSearchQuery('');
    setSingleDate(todayIso);
    setPage(1);
  };

  // ---- Render -----------------------------------------------------------
  return (
    <div className="space-y-5">
      {flash && (
        <Alert tone="success">
          <div className="flex items-center justify-between gap-3">
            <span>{flash}</span>
            <button type="button" aria-label="Dismiss" onClick={() => setFlash(null)} className="cursor-pointer">
              <X className="h-4 w-4" />
            </button>
          </div>
        </Alert>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
        <div className="space-y-1">
          <h2 className="text-xl font-bold text-slate-800 tracking-tight">Team Attendance</h2>
          <p className="text-sm text-slate-600 max-w-3xl leading-relaxed">{headline}</p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleExportCsv}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-xl shadow-xs transition-colors cursor-pointer"
          >
            <Download className="h-3.5 w-3.5 text-emerald-600" />
            Export CSV
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-xl shadow-xs transition-colors cursor-pointer"
          >
            <Printer className="h-3.5 w-3.5 text-[#6E1D1D]" />
            Print
          </button>
        </div>
      </div>

      {/* Filters — one compact row */}
      <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center gap-2">
        {/* Day / Range toggle */}
        <div className="flex items-center bg-slate-100 p-0.5 rounded-lg text-xs font-semibold shrink-0">
          {(['single', 'range'] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => {
                setDateMode(mode);
                setPage(1);
              }}
              className={cx(
                'px-3 py-1.5 rounded-md transition-all cursor-pointer',
                dateMode === mode ? 'bg-white text-[#6E1D1D] shadow-xs' : 'text-slate-500 hover:text-slate-700'
              )}
            >
              {mode === 'single' ? 'Day' : 'Date range'}
            </button>
          ))}
        </div>

        {/* Date controls */}
        {isSingle ? (
          <div className="flex items-center gap-1">
            <button
              type="button"
              aria-label="Previous day"
              onClick={() => {
                setSingleDate(shiftIsoDate(singleDate, -1));
                setPage(1);
              }}
              className="h-9 w-9 flex items-center justify-center rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 cursor-pointer"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <div className="w-40">
              <DatePicker
                value={singleDate}
                onChange={(val) => {
                  setSingleDate(val);
                  setPage(1);
                }}
                triggerClassName="h-9 px-3 text-xs font-medium w-full"
              />
            </div>
            <button
              type="button"
              aria-label="Next day"
              disabled={singleDate >= todayIso}
              onClick={() => {
                setSingleDate(shiftIsoDate(singleDate, 1));
                setPage(1);
              }}
              className="h-9 w-9 flex items-center justify-center rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-600 cursor-pointer disabled:opacity-40 disabled:pointer-events-none"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
            {!isToday && (
              <button
                type="button"
                onClick={() => setSingleDate(todayIso)}
                className="h-9 px-3 text-xs font-semibold text-[#6E1D1D] hover:bg-[#F8E6E6] rounded-xl cursor-pointer"
              >
                Today
              </button>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-1.5">
            <div className="w-36">
              <DatePicker
                value={fromDate}
                onChange={(val) => {
                  setFromDate(val);
                  setPage(1);
                }}
                triggerClassName="h-9 px-2.5 text-xs font-medium w-full"
              />
            </div>
            <span className="text-slate-400 text-xs">to</span>
            <div className="w-36">
              <DatePicker
                value={toDate}
                onChange={(val) => {
                  setToDate(val);
                  setPage(1);
                }}
                triggerClassName="h-9 px-2.5 text-xs font-medium w-full"
              />
            </div>
          </div>
        )}

        <div className="w-52">
          <Dropdown
            value={department}
            onChange={(val) => {
              setDepartment(val);
              setPage(1);
            }}
            options={[
              { value: '', label: `All departments (${allEmployees.length})` },
              ...DEPARTMENTS.map((dept) => ({ value: dept, label: `${dept} (${departmentCounts[dept] || 0})` })),
            ]}
            triggerClassName="h-9 px-3 text-xs font-medium w-full"
          />
        </div>

        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search by name, code or email"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setPage(1);
            }}
            className="w-full h-9 pl-8 pr-8 rounded-xl border border-slate-200 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#6E1D1D]/20 focus:border-[#6E1D1D]"
          />
          {searchQuery && (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {hasFilters && (
          <button
            type="button"
            onClick={handleClearFilters}
            className="flex items-center gap-1 px-2 text-xs text-slate-500 hover:text-rose-700 font-semibold cursor-pointer"
          >
            <RotateCw className="h-3.5 w-3.5" />
            Reset
          </button>
        )}
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Attendance */}
          <SummaryCard
            icon={Users}
            tone="emerald"
            active={statusFilter === 'in'}
            onClick={() => applyStatus('in')}
            title={isSingle ? (isToday ? 'Checked in today' : 'Came in') : 'Days worked'}
            value={
              isSingle ? (
                <>
                  {summary.checkedIn}
                  <span className="text-base font-semibold text-slate-400"> / {summary.expected}</span>
                </>
              ) : (
                summary.checkedIn
              )
            }
          >
            {isSingle && summary.expected > 0 && (
              <div className="space-y-1">
                <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                  <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${summary.attendanceRate}%` }} />
                </div>
                <p>{summary.attendanceRate}% attendance</p>
              </div>
            )}
            {!isSingle && <p>{summary.attendanceRate}% of logged days were worked</p>}
            {summary.onDuty > 0 && <p>{summary.onDuty} on field duty</p>}
          </SummaryCard>

          {/* Late */}
          <SummaryCard
            icon={Clock}
            tone="amber"
            active={statusFilter === 'Late'}
            onClick={() => applyStatus('Late')}
            title="Late arrivals"
            value={summary.late}
          >
            {summary.late > 0 ? (
              <>
                {summary.avgLate != null && <p>Late by {formatMinutes(Math.round(summary.avgLate))} on average</p>}
                {summary.maxLate != null && <p>Latest: {formatMinutes(summary.maxLate)} after shift start</p>}
              </>
            ) : (
              <p>{summary.checkedIn > 0 ? 'Everyone was on time' : 'No check-ins yet'}</p>
            )}
            {summary.onTimeRate != null && summary.late > 0 && <p>{summary.onTimeRate}% on time</p>}
          </SummaryCard>

          {/* Absent / leave */}
          <SummaryCard
            icon={UserX}
            tone="rose"
            active={statusFilter === 'Absent'}
            onClick={() => applyStatus('Absent')}
            title={isToday ? 'Not checked in' : 'Absent'}
            value={summary.absent}
          >
            <p>
              {summary.leave} on leave · {summary.halfDay} half-day
            </p>
            {summary.off > 0 && <p>{summary.off} on weekly off</p>}
          </SummaryCard>

          {/* Typical day */}
          <SummaryCard icon={Timer} tone="slate" title="Typical day" value={summary.avgCheckIn != null ? minutesToClock(summary.avgCheckIn) : '—'}>
            <p>Average check-in time</p>
            <p>
              {summary.avgHours != null ? `${formatHoursToHM(summary.avgHours)} worked on average` : 'No completed days yet'}
            </p>
            {isToday && summary.stillWorking > 0 && <p>{summary.stillWorking} still at work</p>}
          </SummaryCard>
        </div>

        {/* Late arrivals list */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-4 flex flex-col">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-slate-800">
              {isSingle ? 'Who came in late' : 'Most often late'}
            </h3>
            {lateList.length > 0 && <span className="text-[11px] font-semibold text-amber-700">{lateList.length}</span>}
          </div>
          {lateList.length === 0 ? (
            <div className="flex-1 flex items-center justify-center text-center text-xs text-slate-400 py-6">
              {summary.checkedIn > 0 ? 'No late arrivals 🎉' : 'Nothing to show yet'}
            </div>
          ) : (
            <ul className="space-y-2.5 flex-1">
              {lateList.slice(0, 6).map((item) => (
                <li key={item.key}>
                  <button
                    type="button"
                    onClick={() => setLateCalendarFor(item.employee)}
                    title="See which days they came in late"
                    className="w-full flex items-center gap-2.5 -mx-1.5 px-1.5 py-1 rounded-lg text-left hover:bg-amber-50/70 cursor-pointer group/late"
                  >
                    <div className="w-7 h-7 rounded-full bg-amber-50 text-amber-700 flex items-center justify-center font-bold text-[10px] border border-amber-200 shrink-0">
                      {getInitials(item.name)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-semibold text-slate-800 truncate group-hover/late:text-[#6E1D1D]">
                        {item.name}
                      </p>
                      {item.detail && <p className="text-[11px] text-slate-500">{item.detail}</p>}
                    </div>
                    <span className="text-xs font-bold text-amber-700 shrink-0">{item.value}</span>
                    <ChevronRight className="h-3.5 w-3.5 text-slate-300 group-hover/late:text-[#6E1D1D] shrink-0" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          {lateList.length > 6 && (
            <button
              type="button"
              onClick={() => applyStatus('Late')}
              className="mt-3 text-xs font-semibold text-[#6E1D1D] hover:underline cursor-pointer self-start"
            >
              See all {lateList.length} →
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <Card className="overflow-hidden border border-slate-200 rounded-2xl shadow-xs bg-white">
        <div className="p-3 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50">
          <div className="flex flex-wrap items-center gap-1.5">
            {STATUS_CHIPS.map((chip) => {
              const count =
                chip.value === ''
                  ? summary.total
                  : chip.value === 'in'
                  ? summary.checkedIn
                  : summary.counts[chip.value] || 0;
              const active = statusFilter === chip.value;
              return (
                <button
                  key={chip.value || 'all'}
                  type="button"
                  onClick={() => {
                    setStatusFilter(chip.value);
                    setPage(1);
                  }}
                  className={cx(
                    'px-2.5 py-1 rounded-full text-xs font-semibold border transition-colors cursor-pointer',
                    active
                      ? 'bg-[#6E1D1D] text-white border-[#6E1D1D]'
                      : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                  )}
                >
                  {chip.label} <span className={active ? 'text-white/70' : 'text-slate-400'}>{count}</span>
                </button>
              );
            })}
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span>Rows</span>
            <Dropdown
              value={String(pageSize)}
              onChange={(val) => {
                setPageSize(Number(val));
                setPage(1);
              }}
              options={['10', '25', '50', '100'].map((v) => ({ value: v, label: v }))}
              triggerClassName="h-7 px-2 text-xs font-semibold"
            />
          </div>
        </div>

        {isLoading ? (
          <div className="flex h-64 items-center justify-center">
            <Spinner />
          </div>
        ) : (
          <div className="overflow-x-auto w-full">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                <tr>
                  <th className="px-5 py-3 cursor-pointer hover:text-slate-900" onClick={() => toggleSort('name')}>
                    Employee{sortArrow('name')}
                  </th>
                  {!isSingle && (
                    <th className="px-5 py-3 cursor-pointer hover:text-slate-900" onClick={() => toggleSort('date')}>
                      Date{sortArrow('date')}
                    </th>
                  )}
                  <th className="px-5 py-3 cursor-pointer hover:text-slate-900" onClick={() => toggleSort('checkIn')}>
                    Came in{sortArrow('checkIn')}
                  </th>
                  <th className="px-5 py-3">Left</th>
                  <th className="px-5 py-3">Worked</th>
                  <th className="px-5 py-3 cursor-pointer hover:text-slate-900" onClick={() => toggleSort('status')}>
                    Status{sortArrow('status')}
                  </th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {paginatedRecords.map((record: any, index: number) => {
                  const name = employeeName(record.employee);
                  const working = record.checkInTime && !record.checkOutTime;
                  return (
                    <tr
                      key={`team-rec-${record.id}-${employeeKey(record.employee)}-${index}`}
                      className="hover:bg-slate-50/70 transition-colors group cursor-pointer"
                      onClick={() => setDetailModalItem(record)}
                    >
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-full bg-[#F8E6E6] text-[#6E1D1D] flex items-center justify-center font-bold text-xs border border-[#6E1D1D]/20 shrink-0">
                            {getInitials(name)}
                          </div>
                          <div>
                            <p className="font-semibold text-slate-900 group-hover:text-[#6E1D1D] transition-colors">{name}</p>
                            <p className="text-[11px] text-slate-400">
                              {[record.employee?.employeeCode, record.employee?.department].filter(Boolean).join(' · ') || '—'}
                            </p>
                          </div>
                        </div>
                      </td>

                      {!isSingle && <td className="px-5 py-3 text-slate-700">{formatDay(record.date)}</td>}

                      <td className="px-5 py-3">
                        {record.checkInTime ? (
                          <div>
                            <p className="font-medium text-slate-800">{formatTime(record.checkInTime)}</p>
                            {record.lateMinutes != null && record.lateMinutes > 0 ? (
                              <p className="text-[11px] font-semibold text-amber-700">{formatMinutes(record.lateMinutes)} late</p>
                            ) : record.status === 'Late' ? (
                              <p className="text-[11px] font-semibold text-amber-700">Late</p>
                            ) : (
                              <p className="text-[11px] text-emerald-600">On time</p>
                            )}
                          </div>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>

                      <td className="px-5 py-3">
                        {record.checkOutTime ? (
                          <span className="font-medium text-slate-800">{formatTime(record.checkOutTime)}</span>
                        ) : working ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                            {isToday ? 'Still working' : 'No check-out'}
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>

                      <td className="px-5 py-3 font-semibold text-slate-800">
                        {record.hoursWorked ? formatHoursToHM(record.hoursWorked) : <span className="text-slate-400 font-normal">—</span>}
                      </td>

                      <td className="px-5 py-3">
                        <span
                          className={cx(
                            'inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold border',
                            STATUS_STYLES[record.status] || STATUS_STYLES.Absent
                          )}
                        >
                          {record.status}
                        </span>
                      </td>

                      <td className="px-5 py-3 text-right">
                        <Eye className="h-4 w-4 text-slate-300 group-hover:text-[#6E1D1D] inline" />
                      </td>
                    </tr>
                  );
                })}

                {paginatedRecords.length === 0 && (
                  <tr>
                    <td colSpan={isSingle ? 6 : 7} className="px-6 py-12 text-center text-slate-400">
                      Nobody matches these filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        <div className="p-3 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-slate-500">
          <p>
            Showing {filteredRecords.length === 0 ? 0 : (page - 1) * pageSize + 1}–{Math.min(page * pageSize, filteredRecords.length)} of{' '}
            {filteredRecords.length}
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:pointer-events-none font-semibold text-slate-700 cursor-pointer"
            >
              Previous
            </button>
            <span className="font-bold text-slate-800">
              {page} / {totalPages}
            </span>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:pointer-events-none font-semibold text-slate-700 cursor-pointer"
            >
              Next
            </button>
          </div>
        </div>
      </Card>

      {lateCalendarFor && (
        <LateCalendarModal
          employee={lateCalendarFor}
          initialMonth={isSingle ? singleDate : toDate}
          onClose={() => setLateCalendarFor(null)}
        />
      )}

      {/* Details modal */}
      {detailModalItem && (
        <div
          className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => setDetailModalItem(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between p-4 border-b border-slate-100 bg-slate-50">
              <div>
                <h3 className="text-base font-bold text-slate-900">{employeeName(detailModalItem.employee)}</h3>
                <p className="text-xs text-slate-500">
                  {formatDay(detailModalItem.date, true)}
                  {detailModalItem.employee?.department ? ` · ${detailModalItem.employee.department}` : ''}
                  {detailModalItem.employee?.employeeCode ? ` · ${detailModalItem.employee.employeeCode}` : ''}
                </p>
              </div>
              <button
                type="button"
                aria-label="Close"
                onClick={() => setDetailModalItem(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <p className="text-sm text-slate-700 leading-relaxed">{describeDay(detailModalItem)}</p>

              <div className="grid grid-cols-2 gap-3">
                {(['in', 'out'] as const).map((side) => {
                  const time = side === 'in' ? detailModalItem.checkInTime : detailModalItem.checkOutTime;
                  const gps = side === 'in' ? detailModalItem.checkInGps : detailModalItem.checkOutGps;
                  return (
                    <div key={side} className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">
                        {side === 'in' ? 'Came in' : 'Left'}
                      </p>
                      <p className="text-sm font-bold text-slate-800 mt-0.5">{formatTime(time)}</p>
                      {time && (
                        <p className="text-[10px] text-slate-500 mt-1 flex items-center gap-1">
                          <MapPin className="h-3 w-3 text-[#6E1D1D]" />
                          {gps ? `${gps.lat.toFixed(4)}, ${gps.lng.toFixed(4)}` : detailModalItem.workType}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>

              <dl className="space-y-2">
                {[
                  [
                    'Shift',
                    detailModalItem.shiftStart
                      ? `${detailModalItem.shift} (${detailModalItem.shiftStart}–${detailModalItem.shiftEnd || '?'})`
                      : detailModalItem.shift,
                  ],
                  ['Worked', detailModalItem.hoursWorked ? formatHoursToHM(detailModalItem.hoursWorked) : '—'],
                  ['Overtime', detailModalItem.overtimeHours > 0 ? `+${formatHoursToHM(detailModalItem.overtimeHours)}` : 'None'],
                  ['Breaks', detailModalItem.totalBreakMinutes ? formatMinutes(Math.round(detailModalItem.totalBreakMinutes)) : 'None'],
                  ['Work type', detailModalItem.workType],
                  ['Device', detailModalItem.notes || '—'],
                ].map(([label, value]) => (
                  <div key={label} className="flex items-center justify-between gap-4 text-slate-600">
                    <dt>{label}</dt>
                    <dd className="font-semibold text-slate-800 text-right truncate">{value}</dd>
                  </div>
                ))}
              </dl>
            </div>

            {detailModalItem.reviewNotes && (
              <div className="mx-5 mb-4 p-3 rounded-xl bg-amber-50 border border-amber-100 text-[11px] text-amber-900 space-y-0.5">
                <p className="font-bold uppercase tracking-wider text-[10px] text-amber-700">Corrections</p>
                {String(detailModalItem.reviewNotes)
                  .split('\n')
                  .map((line: string, i: number) => (
                    <p key={i}>{line}</p>
                  ))}
              </div>
            )}

            {canCorrect && detailModalItem.employee && dayKey(detailModalItem.date) === todayIso && (
              <HrCorrectionPanel
                record={detailModalItem}
                onDone={async (message) => {
                  setDetailModalItem(null);
                  setFlash(message);
                  await refetchAttendance();
                }}
              />
            )}

            <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end">
              <button
                type="button"
                onClick={() => setDetailModalItem(null)}
                className="px-4 py-2 bg-white border border-slate-200 text-slate-700 font-semibold text-xs rounded-xl hover:bg-slate-100 transition-colors cursor-pointer shadow-xs"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

/** One-sentence plain-English summary of a single attendance row. */
function describeDay(r: any): string {
  const first = employeeName(r.employee).split(' ')[0];
  switch (r.status) {
    case 'Absent':
      return `${first} didn't check in on this day.`;
    case 'Off':
      return 'This was a weekly off.';
    case 'Leave':
      return `${first} was on leave.`;
  }
  let text = `${first} came in at ${formatTime(r.checkInTime)}`;
  if (r.lateMinutes > 0) text += `, ${formatMinutes(r.lateMinutes)} after the shift started`;
  else if (r.status !== 'Late') text += ', on time';
  text += r.checkOutTime
    ? ` and left at ${formatTime(r.checkOutTime)}, working ${formatHoursToHM(r.hoursWorked || 0)}.`
    : ' and has not checked out.';
  if (r.status === 'Half-Day') text += ' Counted as a half-day.';
  return text;
}

const TONES = {
  emerald: { icon: 'bg-emerald-50 text-emerald-600', ring: 'ring-emerald-400 border-emerald-300' },
  amber: { icon: 'bg-amber-50 text-amber-600', ring: 'ring-amber-400 border-amber-300' },
  rose: { icon: 'bg-rose-50 text-rose-600', ring: 'ring-rose-400 border-rose-300' },
  slate: { icon: 'bg-slate-100 text-slate-600', ring: 'ring-slate-400 border-slate-300' },
} as const;

function SummaryCard({
  icon: Icon,
  tone,
  title,
  value,
  active,
  onClick,
  children,
}: {
  icon: ComponentType<{ className?: string }>;
  tone: keyof typeof TONES;
  title: string;
  value: ReactNode;
  active?: boolean;
  onClick?: () => void;
  children?: ReactNode;
}) {
  const t = TONES[tone];
  const Wrapper: any = onClick ? 'button' : 'div';
  return (
    <Wrapper
      {...(onClick ? { type: 'button', onClick, 'aria-pressed': !!active } : {})}
      className={cx(
        'text-left bg-white rounded-2xl border border-slate-200 shadow-xs p-4 flex gap-3 transition-all',
        onClick && 'cursor-pointer hover:border-slate-300 hover:shadow-sm',
        active && `ring-2 ${t.ring}`
      )}
    >
      <div className={cx('w-9 h-9 rounded-xl flex items-center justify-center shrink-0', t.icon)}>
        <Icon className="h-4.5 w-4.5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-semibold text-slate-500">{title}</p>
        <p className="text-2xl font-bold text-slate-900 leading-tight mt-0.5">{value}</p>
        <div className="mt-1.5 space-y-0.5 text-[11px] text-slate-500">{children}</div>
      </div>
    </Wrapper>
  );
}

// ---------------------------------------------------------------------------
// HR correction panel (today only): check in / check out / undo check-out
// ---------------------------------------------------------------------------

function nowHHMM(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function todayAt(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number);
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d.toISOString();
}

const CORRECTION_COPY = {
  in: {
    title: (first: string) => `Check ${first} in`,
    hint: () => "Use this when their device isn't working.",
    button: 'Check in',
    done: (first: string) => `${first} has been checked in.`,
  },
  out: {
    title: (first: string) => `Check ${first} out`,
    hint: () => "Use this when they've left but couldn't check out themselves.",
    button: 'Check out',
    done: (first: string) => `${first} has been checked out.`,
  },
  resume: {
    title: () => 'Checked out by mistake?',
    hint: (first: string) => `Undo the check-out so ${first} continues working. They can check out normally later.`,
    button: 'Undo check-out — still working',
    done: (first: string) => `${first}'s check-out was undone. They're marked as still working.`,
  },
} as const;

function HrCorrectionPanel({ record, onDone }: { record: any; onDone: (message: string) => void | Promise<void> }) {
  const [time, setTime] = useState(nowHHMM);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const employeeId = employeeKey(record.employee);
  const first = employeeName(record.employee).split(' ')[0];

  let action: keyof typeof CORRECTION_COPY | null = null;
  if (!record.checkInTime && record.status !== 'Leave' && record.status !== 'Off') action = 'in';
  else if (record.checkInTime && !record.checkOutTime) action = 'out';
  else if (record.checkInTime && record.checkOutTime) action = 'resume';
  if (!action || !employeeId) return null;

  const copy = CORRECTION_COPY[action];
  const needsTime = action !== 'resume';

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      const payload = { reason: reason.trim() || undefined };
      if (action === 'in') await attendanceApi.hrCheckIn(employeeId, { ...payload, time: todayAt(time) });
      else if (action === 'out') await attendanceApi.hrCheckOut(employeeId, { ...payload, time: todayAt(time) });
      else await attendanceApi.hrResume(employeeId, payload);
      await onDone(copy.done(first));
    } catch (err: any) {
      setError(err?.message || 'Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-5 mb-4 p-4 rounded-xl border border-[#6E1D1D]/20 bg-[#FFF8F8] space-y-3 text-xs">
      <div>
        <p className="font-bold text-slate-800 text-sm">{copy.title(first)}</p>
        <p className="text-slate-500 mt-0.5">{copy.hint(first)}</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {needsTime && (
          <label className="flex flex-col gap-1">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Time</span>
            <input
              type="time"
              value={time}
              max={nowHHMM()}
              onChange={(e) => setTime(e.target.value)}
              className="h-9 px-2 rounded-lg border border-slate-200 bg-white text-xs"
            />
          </label>
        )}
        <label className="flex flex-col gap-1 flex-1 min-w-[160px]">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Reason (optional)</span>
          <input
            type="text"
            value={reason}
            maxLength={300}
            placeholder={action === 'resume' ? 'e.g. Pressed check-out by mistake' : 'e.g. Phone not working'}
            onChange={(e) => setReason(e.target.value)}
            className="h-9 px-2.5 rounded-lg border border-slate-200 bg-white text-xs"
          />
        </label>
      </div>

      {error && <p className="text-rose-700 font-medium">{error}</p>}

      <button
        type="button"
        disabled={busy || (needsTime && !time)}
        onClick={submit}
        className="w-full h-9 rounded-lg bg-[#6E1D1D] hover:bg-[#5a1717] text-white font-semibold disabled:opacity-50 cursor-pointer"
      >
        {busy ? 'Saving…' : copy.button}
      </button>
    </div>
  );
}
