'use client';

import { useState } from 'react';
import { useMyAttendanceSummary } from '@/modules/hr/hooks/use-attendance';
import { formatHoursToHM } from '@/shared/utils/formatters';
import { cx, Card, Dropdown } from '@/shared/ui';
import {
  Calendar,
  Clock,
  AlertCircle,
  FileText,
  Loader2,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  CalendarDays,
  X,
  MapPin,
} from 'lucide-react';
import { Attendance } from '../types';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const YEARS = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);

export function MyAttendanceView() {
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());
  const [viewMode, setViewMode] = useState<'calendar' | 'list'>('list');
  const [selectedDay, setSelectedDay] = useState<{
    date: Date;
    dateStr: string;
    record?: Attendance & { regularHours?: number; overtime?: number };
    isWeekend: boolean;
  } | null>(null);

  const { data, isLoading, error } = useMyAttendanceSummary(month, year);

  const handlePrevMonth = () => {
    if (month === 1) {
      setMonth(12);
      setYear((y) => y - 1);
    } else {
      setMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (month === 12) {
      setMonth(1);
      setYear((y) => y + 1);
    } else {
      setMonth((m) => m + 1);
    }
  };

  // Generate days for selected month
  const daysInMonth = new Date(year, month, 0).getDate();
  const allDays = Array.from({ length: daysInMonth }, (_, i) => {
    const d = new Date(year, month - 1, i + 1);
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(i + 1).padStart(2, '0')}`;
    const dayOfWeek = d.getDay(); // 0 is Sunday, 1 is Monday ...
    const isWeekend = dayOfWeek === 0; // Sunday is weekend
    const record = data?.records.find((r) => {
      const rd = new Date(r.date);
      const rDateStr = `${rd.getFullYear()}-${String(rd.getMonth() + 1).padStart(2, '0')}-${String(rd.getDate()).padStart(2, '0')}`;
      return rDateStr === dateStr;
    });
    return { date: d, dateStr, dayOfWeek, isWeekend, record };
  });

  // Calculate first day offset for Monday-first calendar (Mon=0, Tue=1, ..., Sun=6)
  const firstDay = new Date(year, month - 1, 1).getDay();
  const leadingBlankDays = firstDay === 0 ? 6 : firstDay - 1;

  const todayStr = (() => {
    const t = new Date();
    return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
  })();

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800 tracking-tight">My Attendance</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Personal attendance record · Standard requirement: 8 hours work per day (excluding breaks)
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Month Navigation */}
          <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200 shadow-xs">
            <button
              type="button"
              onClick={handlePrevMonth}
              className="p-1.5 text-slate-600 hover:text-[#6E1D1D] hover:bg-slate-50 rounded-lg transition-colors cursor-pointer"
              title="Previous Month"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <Dropdown
              showArrow={false}
              value={String(month)}
              onChange={(val) => setMonth(Number(val))}
              options={MONTH_NAMES.map((m, i) => ({ value: String(i + 1), label: m }))}
              triggerClassName="h-8 px-2.5 border-transparent text-xs font-bold text-slate-800 bg-transparent min-w-[95px]"
            />
            <Dropdown
              showArrow={false}
              value={String(year)}
              onChange={(val) => setYear(Number(val))}
              options={YEARS.map((y) => ({ value: String(y), label: String(y) }))}
              triggerClassName="h-8 px-2 border-transparent text-xs font-bold text-slate-800 bg-transparent min-w-[65px]"
            />
            <button
              type="button"
              onClick={handleNextMonth}
              className="p-1.5 text-slate-600 hover:text-[#6E1D1D] hover:bg-slate-50 rounded-lg transition-colors cursor-pointer"
              title="Next Month"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          {/* View Toggle: List / Calendar */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200/60">
            <button
              type="button"
              onClick={() => setViewMode('calendar')}
              className={cx(
                'flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer',
                viewMode === 'calendar'
                  ? 'bg-white text-[#6E1D1D] shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              )}
            >
              <CalendarDays className="h-3.5 w-3.5" />
              Calendar
            </button>
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className={cx(
                'flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer',
                viewMode === 'list'
                  ? 'bg-white text-[#6E1D1D] shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              )}
            >
              <FileText className="h-3.5 w-3.5" />
              List
            </button>
          </div>
        </div>
      </div>

      {error ? (
        <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl flex items-center gap-3">
          <AlertCircle className="h-5 w-5" />
          <p>Failed to load attendance data. Please try again.</p>
        </div>
      ) : (
        <>
          {/* Summary Stat Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="p-4 flex items-center gap-4 border-l-4 border-l-emerald-500 shadow-xs">
              <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl">
                <Calendar className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-medium text-slate-500">Present</p>
                <p className="text-xl font-bold text-slate-800">
                  {isLoading ? '...' : (data?.stats.presentCount ?? 0)}
                </p>
              </div>
            </Card>

            <Card className="p-4 flex items-center gap-4 border-l-4 border-l-rose-500 shadow-xs">
              <div className="p-3 bg-rose-50 text-rose-600 rounded-xl">
                <AlertCircle className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-medium text-slate-500">Absent</p>
                <p className="text-xl font-bold text-slate-800">
                  {isLoading ? '...' : (data?.stats.absentCount ?? 0)}
                </p>
              </div>
            </Card>

            <Card className="p-4 flex items-center gap-4 border-l-4 border-l-amber-500 shadow-xs">
              <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
                <FileText className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-medium text-slate-500">Leave / Half-Day</p>
                <p className="text-xl font-bold text-slate-800">
                  {isLoading ? '...' : (data?.stats.leaveHalfCount ?? 0)}
                </p>
              </div>
            </Card>

            <Card className="p-4 flex items-center gap-4 border-l-4 border-l-[#6E1D1D] shadow-xs">
              <div className="p-3 bg-[#F8E6E6] text-[#6E1D1D] rounded-xl">
                <Clock className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-medium text-slate-500">Actual Work Hours</p>
                <p className="text-xl font-bold text-slate-800">
                  {isLoading ? '...' : formatHoursToHM(data?.stats.totalWorkHours)}
                </p>
              </div>
            </Card>
          </div>

          {/* VIEW MODE 1: CALENDAR VIEW */}
          {viewMode === 'calendar' && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
                <h3 className="text-base font-bold text-slate-800">
                  {MONTH_NAMES[month - 1]} {year} Calendar
                </h3>
                <div className="flex flex-wrap items-center gap-3 text-xs text-slate-600">
                  <span className="flex items-center gap-1.5">
                    <span className="text-emerald-600 font-bold">✓</span> Present (on time)
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="text-amber-500 font-bold">⚠</span> Late
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="text-rose-500 font-bold">✕</span> Absent
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="text-slate-400 font-bold">—</span> Weekend/Holiday
                  </span>
                </div>
              </div>

              {isLoading ? (
                <div className="flex h-72 items-center justify-center">
                  <Loader2 className="h-6 w-6 animate-spin text-[#6E1D1D]" />
                </div>
              ) : (
                <div className="grid grid-cols-7 gap-2">
                  {/* Day of Week Headers (Mon-Sun) */}
                  {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((dayName, idx) => (
                    <div
                      key={dayName}
                      className={cx(
                        'text-center py-2 text-xs font-bold uppercase tracking-wider',
                        idx === 6 ? 'text-rose-500' : 'text-slate-600'
                      )}
                    >
                      {dayName}
                    </div>
                  ))}

                  {/* Empty leading slots */}
                  {Array.from({ length: leadingBlankDays }).map((_, i) => (
                    <div key={`blank-${i}`} className="min-h-[72px] sm:min-h-[88px] rounded-xl bg-slate-50/50 border border-slate-100/60 opacity-40" />
                  ))}

                  {/* Calendar Days */}
                  {allDays.map((item) => {
                    const { date, dateStr, isWeekend, record } = item;
                    const dayNum = date.getDate();
                    const isToday = dateStr === todayStr;
                    const isPastOrToday = dateStr <= todayStr;

                    let statusSymbol = '—';
                    let statusColor = 'text-slate-400';
                    let bgHover = 'hover:bg-slate-50';
                    let borderClass = 'border-slate-200';
                    let subText = '';

                    if (record) {
                      const workHours = record.actualHours ?? record.totalHours;
                      const inTime = record.checkInTime
                        ? new Date(record.checkInTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                        : '';

                      if (record.status === 'Present') {
                        statusSymbol = '✓';
                        statusColor = 'text-emerald-600';
                        subText = inTime || (workHours ? formatHoursToHM(workHours) : '8h');
                        borderClass = 'border-emerald-200 bg-emerald-50/30';
                      } else if (record.status === 'Late') {
                        statusSymbol = '⚠';
                        statusColor = 'text-amber-600';
                        subText = inTime || (workHours ? formatHoursToHM(workHours) : 'Late');
                        borderClass = 'border-amber-200 bg-amber-50/30';
                      } else if (record.status === 'Half-Day') {
                        statusSymbol = '½';
                        statusColor = 'text-orange-600';
                        subText = inTime || 'Half-Day';
                        borderClass = 'border-orange-200 bg-orange-50/30';
                      } else if (record.status === 'Leave') {
                        statusSymbol = 'L';
                        statusColor = 'text-blue-600';
                        subText = 'Leave';
                        borderClass = 'border-blue-200 bg-blue-50/30';
                      } else if (record.status === 'Absent') {
                        statusSymbol = '✕';
                        statusColor = 'text-rose-600';
                        subText = 'Absent';
                        borderClass = 'border-rose-200 bg-rose-50/30';
                      }
                    } else if (isWeekend) {
                      statusSymbol = '—';
                      statusColor = 'text-slate-400';
                      subText = 'Weekend';
                      borderClass = 'border-slate-100 bg-slate-50/60';
                    } else if (isPastOrToday) {
                      statusSymbol = '✕';
                      statusColor = 'text-rose-500';
                      subText = 'Absent';
                      borderClass = 'border-rose-100 bg-rose-50/20';
                    }

                    return (
                      <button
                        key={dateStr}
                        type="button"
                        onClick={() => setSelectedDay({ date, dateStr, record, isWeekend })}
                        className={cx(
                          'flex flex-col justify-between p-2 min-h-[72px] sm:min-h-[88px] rounded-xl border text-left transition-all cursor-pointer relative group',
                          borderClass,
                          bgHover,
                          isToday && 'ring-2 ring-[#6E1D1D] ring-offset-1'
                        )}
                      >
                        <div className="flex items-center justify-between w-full">
                          <span
                            className={cx(
                              'text-xs font-bold rounded-md px-1.5 py-0.5',
                              isToday
                                ? 'bg-[#6E1D1D] text-white'
                                : isWeekend
                                  ? 'text-slate-400'
                                  : 'text-slate-700'
                            )}
                          >
                            {dayNum}
                          </span>
                          <span className={cx('text-sm font-extrabold', statusColor)}>
                            {statusSymbol}
                          </span>
                        </div>

                        {subText && (
                          <span className={cx('text-[11px] font-semibold truncate', statusColor)}>
                            {subText}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}

              <p className="text-xs text-slate-400 text-center pt-2">
                Click on any calendar day to view full shift details, punch times, and working hours.
              </p>
            </div>
          )}

          {/* VIEW MODE 2: LIST VIEW */}
          {viewMode === 'list' && (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden flex flex-col">
              <div className="p-4 border-b border-slate-200 bg-slate-50/50 flex justify-between items-center">
                <h3 className="text-sm font-bold text-slate-800">Daily Punch Records</h3>
                <span className="text-xs text-slate-500">
                  {MONTH_NAMES[month - 1]} {year}
                </span>
              </div>

              <div className="overflow-x-auto w-full">
                <table className="w-full text-left text-sm whitespace-nowrap">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold text-xs uppercase tracking-wider">
                    <tr>
                      <th className="px-5 py-3.5">Date</th>
                      <th className="px-5 py-3.5">Shift</th>
                      <th className="px-5 py-3.5">Status</th>
                      <th className="px-5 py-3.5">Clock In</th>
                      <th className="px-5 py-3.5">Clock Out</th>
                      <th className="px-5 py-3.5">Break</th>
                      <th className="px-5 py-3.5 font-bold text-slate-800">Working Hours</th>
                      <th className="px-5 py-3.5 font-bold text-emerald-700">Overtime</th>
                      <th className="px-5 py-3.5 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs">
                    {isLoading ? (
                      <tr key="my-loading-row">
                        <td colSpan={9} className="px-4 py-12 text-center text-slate-500">
                          <Loader2 className="h-6 w-6 animate-spin mx-auto text-[#6E1D1D] mb-2" />
                          <p>Loading attendance records...</p>
                        </td>
                      </tr>
                    ) : (
                      allDays.map((item) => {
                        const { date, dateStr, isWeekend, record } = item;
                        if (!record) {
                          return (
                            <tr key={dateStr} className={cx('hover:bg-slate-50/70', isWeekend && 'bg-slate-50/40 text-slate-400')}>
                              <td className="px-5 py-3.5 font-medium text-slate-600">
                                {date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', weekday: 'short' })}
                              </td>
                              <td className="px-5 py-3.5 text-slate-400">General</td>
                              <td className="px-5 py-3.5">
                                {isWeekend ? (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-slate-100 text-slate-600">
                                    Weekend
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-rose-50 text-rose-600">
                                    Absent
                                  </span>
                                )}
                              </td>
                              <td className="px-5 py-3.5 text-slate-400">—</td>
                              <td className="px-5 py-3.5 text-slate-400">—</td>
                              <td className="px-5 py-3.5 text-slate-400">—</td>
                              <td className="px-5 py-3.5 text-slate-400">—</td>
                              <td className="px-5 py-3.5 text-slate-400">—</td>
                              <td className="px-5 py-3.5 text-right">
                                <button
                                  type="button"
                                  onClick={() => setSelectedDay({ date, dateStr, record, isWeekend })}
                                  className="text-xs font-semibold text-[#6E1D1D] hover:underline cursor-pointer"
                                >
                                  Details
                                </button>
                              </td>
                            </tr>
                          );
                        }

                        const shiftLabel = record.shiftDetails?.name
                          ? `${record.shiftDetails.name} (${record.shiftDetails.startTime})`
                          : 'General';
                        const hasCheckedOut = !!record.checkOutTime;
                        const breakMinutes = record.totalBreakMinutes ?? 0;
                        const workHours = record.actualHours ?? record.totalHours;
                        const ovt = record.overtimeHours ?? record.overtime ?? (workHours && workHours > 8 ? workHours - 8 : 0);

                        return (
                          <tr key={dateStr} className="hover:bg-slate-50/70 transition-colors">
                            <td className="px-5 py-3.5 font-semibold text-slate-800">
                              {date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', weekday: 'short' })}
                            </td>
                            <td className="px-5 py-3.5 text-slate-600">{shiftLabel}</td>
                            <td className="px-5 py-3.5">
                              <span
                                className={cx(
                                  'inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-semibold',
                                  record.status === 'Present'
                                    ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                    : record.status === 'Late'
                                      ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                      : record.status === 'Half-Day'
                                        ? 'bg-orange-50 text-orange-700 border border-orange-200'
                                        : record.status === 'Leave'
                                          ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                          : 'bg-rose-50 text-rose-700 border border-rose-200'
                                )}
                              >
                                {record.status}
                              </span>
                            </td>
                            <td className="px-5 py-3.5 font-mono text-slate-700">
                              {record.checkInTime
                                ? new Date(record.checkInTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                                : '—'}
                            </td>
                            <td className="px-5 py-3.5 font-mono text-slate-700">
                              {hasCheckedOut ? (
                                new Date(record.checkOutTime!).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                              ) : (
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-50 text-blue-700">
                                  In Progress
                                </span>
                              )}
                            </td>
                            <td className="px-5 py-3.5 text-slate-600">
                              {breakMinutes > 0 ? `${Math.round(breakMinutes)}m` : '0m'}
                            </td>
                            <td className="px-5 py-3.5 font-bold text-slate-900">
                              {hasCheckedOut && workHours ? formatHoursToHM(workHours) : '--'}
                            </td>
                            <td className="px-5 py-3.5">
                              {hasCheckedOut && ovt > 0 ? (
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                  +{formatHoursToHM(ovt)}
                                </span>
                              ) : (
                                <span className="text-slate-400">—</span>
                              )}
                            </td>
                            <td className="px-5 py-3.5 text-right">
                              <button
                                type="button"
                                onClick={() => setSelectedDay({ date, dateStr, record, isWeekend })}
                                className="text-xs font-semibold text-[#6E1D1D] hover:underline cursor-pointer"
                              >
                                Details
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}

      {/* DAY DETAILS MODAL */}
      {selectedDay && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-slate-50">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  {selectedDay.date.toLocaleDateString('default', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  })}
                </h3>
                <p className="text-xs text-slate-500">
                  {selectedDay.date.toLocaleDateString('default', { weekday: 'long' })}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedDay(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 space-y-4 text-xs">
              <div className="flex items-center justify-between py-2 border-b border-slate-100">
                <span className="font-medium text-slate-500">Status</span>
                <span
                  className={cx(
                    'px-2.5 py-1 rounded-lg font-bold text-xs inline-flex items-center gap-1',
                    selectedDay.record?.status === 'Present'
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : selectedDay.record?.status === 'Late'
                        ? 'bg-amber-50 text-amber-700 border border-amber-200'
                        : selectedDay.record?.status === 'Half-Day'
                          ? 'bg-orange-50 text-orange-700 border border-orange-200'
                          : selectedDay.record?.status === 'Leave'
                            ? 'bg-blue-50 text-blue-700 border border-blue-200'
                            : selectedDay.isWeekend
                              ? 'bg-slate-100 text-slate-600'
                              : 'bg-rose-50 text-rose-700 border border-rose-200'
                  )}
                >
                  {selectedDay.record?.status || (selectedDay.isWeekend ? 'Weekend' : 'Absent')}
                </span>
              </div>

              <div className="flex items-center justify-between py-2 border-b border-slate-100">
                <span className="font-medium text-slate-500">Shift</span>
                <span className="font-semibold text-slate-800">
                  {selectedDay.record?.shiftDetails?.name || 'General (8:00 AM - 5:00 PM)'}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 py-1">
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                  <p className="text-[11px] text-slate-500 font-medium">Check-in</p>
                  <p className="text-sm font-bold text-slate-800 mt-0.5">
                    {selectedDay.record?.checkInTime
                      ? new Date(selectedDay.record.checkInTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                      : '—'}
                  </p>
                  <p className="text-[10px] text-slate-400 mt-1 flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    {selectedDay.record?.checkInGps
                      ? `${selectedDay.record.checkInGps.lat.toFixed(4)}, ${selectedDay.record.checkInGps.lng.toFixed(4)}`
                      : selectedDay.record?.workType || 'Office'}
                  </p>
                </div>

                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                  <p className="text-[11px] text-slate-500 font-medium">Check-out</p>
                  <p className="text-sm font-bold text-slate-800 mt-0.5">
                    {selectedDay.record?.checkOutTime
                      ? new Date(selectedDay.record.checkOutTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                      : '—'}
                  </p>
                  <p className="text-[10px] text-slate-400 mt-1 flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    {selectedDay.record?.checkOutGps
                      ? `${selectedDay.record.checkOutGps.lat.toFixed(4)}, ${selectedDay.record.checkOutGps.lng.toFixed(4)}`
                      : selectedDay.record?.workType || 'Office'}
                  </p>
                </div>
              </div>

              <div className="space-y-2 pt-1">
                <div className="flex items-center justify-between text-slate-600">
                  <span>Working Hours</span>
                  <span className="font-bold text-slate-900">
                    {selectedDay.record?.actualHours || selectedDay.record?.totalHours
                      ? formatHoursToHM(selectedDay.record.actualHours || selectedDay.record.totalHours)
                      : '0h 00m'}
                  </span>
                </div>

                <div className="flex items-center justify-between text-slate-600">
                  <span>Overtime</span>
                  <span className="font-bold text-emerald-700">
                    {selectedDay.record?.overtimeHours && selectedDay.record.overtimeHours > 0
                      ? `+${formatHoursToHM(selectedDay.record.overtimeHours)}`
                      : 'None'}
                  </span>
                </div>

                <div className="flex items-center justify-between text-slate-600">
                  <span>Break Duration</span>
                  <span className="font-medium text-slate-700">
                    {selectedDay.record?.totalBreakMinutes ? `${Math.round(selectedDay.record.totalBreakMinutes)} minutes` : '0 minutes'}
                  </span>
                </div>

                <div className="flex items-center justify-between text-slate-600">
                  <span>Work Type / Notes</span>
                  <span className="text-slate-500 italic">
                    {selectedDay.record?.deviceInfo || selectedDay.record?.workType || 'None'}
                  </span>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedDay(null)}
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
