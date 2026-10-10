'use client';

import { useState, useMemo } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  Clock,
  MapPin,
  X,
} from 'lucide-react';
import { cx, Card, Dropdown } from '@/shared/ui';
import {
  toBusinessDateString,
  formatBusinessDateDMY,
  formatBusinessTime,
  formatDurationHM,
} from '@/shared/utils/formatters';
import { Attendance, EmployeeRef, DayAttendanceDetail } from '../types';

export interface AttendanceCalendarProps {
  /** Optional raw records array for backward compatibility */
  records?: Attendance[] | null;
  /** Employee being viewed */
  employee?: EmployeeRef | null;
  /** Currently active month (1-12) */
  month?: number;
  /** Currently active year */
  year?: number;
  /** Range start month (for multi-month custom ranges) */
  fromMonth?: number;
  fromYear?: number;
  /** Range end month (for multi-month custom ranges) */
  toMonth?: number;
  toYear?: number;
  /** Custom range date limits YYYY-MM-DD */
  customStartDate?: string;
  customEndDate?: string;
  /** Authoritative day-by-day status map */
  attendanceMap?: Record<string | number, string>;
  /** Authoritative day-by-day detail map */
  detailsMap?: Record<string | number, DayAttendanceDetail>;
  /** Navigation handlers */
  onPrevMonth?: () => void;
  onNextMonth?: () => void;
  onMonthChange?: (month: number, year: number) => void;
  /** Calendar range (1, 2, 3, 4, 6, 9) */
  calendarRange?: number;
  onCalendarRangeChange?: (range: number) => void;
  isLoading?: boolean;
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function AttendanceCalendar({
  records,
  employee,
  month: propMonth,
  year: propYear,
  fromMonth: propFromMonth,
  fromYear: propFromYear,
  toMonth: propToMonth,
  toYear: propToYear,
  customStartDate,
  customEndDate,
  attendanceMap = {},
  detailsMap = {},
  onPrevMonth,
  onNextMonth,
  onMonthChange,
  calendarRange = 1,
  onCalendarRangeChange,
  isLoading = false,
}: AttendanceCalendarProps) {
  const [internalDate, setInternalDate] = useState(() => new Date());
  const [selectedDay, setSelectedDay] = useState<{
    dateStr: string;
    dayNum: number;
    dowName: string;
    status: string;
    detail?: DayAttendanceDetail;
    isWeekend: boolean;
    isHoliday: boolean;
  } | null>(null);

  // Determine active month/year range
  const curMonth = propMonth ?? (propFromMonth ?? internalDate.getMonth() + 1);
  const curYear = propYear ?? (propFromYear ?? internalDate.getFullYear());

  const fromM = propFromMonth ?? curMonth;
  const fromY = propFromYear ?? curYear;
  const toM = propToMonth ?? curMonth;
  const toY = propToYear ?? curYear;

  // Normalize attendance and details maps using canonical business dates
  const effectiveData = useMemo(() => {
    const attMap: Record<string, string> = { ...attendanceMap };
    const detMap: Record<string, DayAttendanceDetail> = { ...detailsMap };

    if (records && records.length > 0 && Object.keys(attMap).length === 0) {
      records.forEach((r) => {
        const dateKey = toBusinessDateString(r.date);
        if (!dateKey) return;

        attMap[dateKey] = r.status;
        detMap[dateKey] = {
          status: r.status,
          checkInTime: r.checkInTime,
          checkOutTime: r.checkOutTime,
          totalHours: r.totalHours,
          actualHours: r.actualHours ?? r.totalHours,
          overtimeHours: r.overtimeHours ?? (r.actualHours ? Math.max(0, r.actualHours - 8) : 0),
          totalBreakMinutes: r.totalBreakMinutes ?? 0,
          breaks: r.breaks ?? [],
          shiftDetails: r.shiftDetails,
          workType: r.workType,
          location: r.checkInGps
            ? `${r.checkInGps.lat.toFixed(4)}, ${r.checkInGps.lng.toFixed(4)}`
            : r.workType || 'Office',
        };
      });
    }

    return { attMap, detMap };
  }, [records, attendanceMap, detailsMap]);

  // Compute month list for rendering vertical sequential monthly calendars
  const monthList = useMemo(() => {
    const list: { month: number; year: number; label: string }[] = [];
    let curY = fromY;
    let curM = fromM;
    const targetCount = (toY - fromY) * 12 + (toM - fromM) + 1;
    const count = Math.max(1, targetCount);

    for (let i = 0; i < count; i++) {
      list.push({
        month: curM,
        year: curY,
        label: `${MONTH_NAMES[curM - 1]} ${curY}`,
      });
      curM++;
      if (curM > 12) {
        curM = 1;
        curY++;
      }
    }
    return list;
  }, [fromM, fromY, toM, toY]);

  // Compute summary stats across the active date range
  const summaryStats = useMemo(() => {
    let presentCount = 0;
    let halfDaysCount = 0;
    let leaveCount = 0;
    let absentCount = 0;
    let totalWorkHours = 0;
    let totalBreakHours = 0;
    let totalOvertimeHours = 0;
    let totalWorkingDays = 0;

    const start = customStartDate ? new Date(customStartDate) : new Date(fromY, fromM - 1, 1);
    const end = customEndDate ? new Date(customEndDate) : new Date(toY, toM, 0);

    const todayStr = toBusinessDateString(new Date());

    const curr = new Date(start.getFullYear(), start.getMonth(), start.getDate(), 12, 0, 0);
    const endTarget = new Date(end.getFullYear(), end.getMonth(), end.getDate(), 12, 0, 0);

    while (curr <= endTarget) {
      const y = curr.getFullYear();
      const m = String(curr.getMonth() + 1).padStart(2, '0');
      const d = String(curr.getDate()).padStart(2, '0');
      const dateStr = `${y}-${m}-${d}`;

      const dow = curr.getDay();
      const isSunday = dow === 0;

      const detail = effectiveData.detMap[dateStr];
      const status = detail?.status || effectiveData.attMap[dateStr] || '';

      const isWeekend = isSunday || status === 'Weekend';
      const isHoliday = status === 'Holiday';

      if (!isWeekend && !isHoliday && dateStr <= todayStr) {
        totalWorkingDays++;
      }

      if (status === 'Present' || status === 'Late' || status === 'Break') {
        presentCount += 1;
      } else if (status === 'Half-Day') {
        halfDaysCount += 1;
        presentCount += 0.5;
      } else if (status === 'Leave') {
        leaveCount += 1;
      } else if (status === 'Absent') {
        absentCount += 1;
      }

      const effectiveHours = detail?.actualHours ?? detail?.totalHours ?? 0;
      totalWorkHours += effectiveHours;
      totalBreakHours += (detail?.totalBreakMinutes ?? 0) / 60;
      totalOvertimeHours += detail?.overtimeHours ?? (effectiveHours > 8 ? effectiveHours - 8 : 0);

      curr.setDate(curr.getDate() + 1);
    }

    const attendancePercent = totalWorkingDays > 0 ? (presentCount / totalWorkingDays) * 100 : 0;

    return {
      presentCount,
      halfDaysCount,
      leaveCount,
      absentCount,
      totalWorkHours,
      totalBreakHours,
      totalOvertimeHours,
      attendancePercent,
    };
  }, [effectiveData, fromM, fromY, toM, toY, customStartDate, customEndDate]);

  const handlePrev = () => {
    if (onPrevMonth) {
      onPrevMonth();
    } else {
      const newD = new Date(curYear, curMonth - 2, 1);
      setInternalDate(newD);
      onMonthChange?.(newD.getMonth() + 1, newD.getFullYear());
    }
  };

  const handleNext = () => {
    if (onNextMonth) {
      onNextMonth();
    } else {
      const newD = new Date(curYear, curMonth, 1);
      setInternalDate(newD);
      onMonthChange?.(newD.getMonth() + 1, newD.getFullYear());
    }
  };

  const todayStr = toBusinessDateString(new Date());

  return (
    <div className="space-y-6">
      {/* Top Range and Navigation Controls */}
      {onCalendarRangeChange && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs print:hidden">
          <div className="flex items-center gap-3">
            <CalendarIcon className="h-5 w-5 text-[#6E1D1D]" />
            <div>
              <h3 className="text-sm font-bold text-slate-800">
                Attendance Calendar
              </h3>
              <p className="text-xs text-slate-500">
                {monthList.length > 1
                  ? `${MONTH_NAMES[fromM - 1]} ${fromY} — ${MONTH_NAMES[toM - 1]} ${toY} (${monthList.length} Months)`
                  : `${MONTH_NAMES[fromM - 1]} ${fromY}`}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-600">Calendar Range:</span>
              <div className="w-32">
                <Dropdown
                  showArrow={false}
                  value={String(calendarRange || 1)}
                  onChange={(val) => onCalendarRangeChange(parseInt(val, 10))}
                  options={[
                    { value: '1', label: '1 Month' },
                    { value: '2', label: '2 Months' },
                    { value: '3', label: '3 Months' },
                    { value: '4', label: '4 Months' },
                    { value: '6', label: '6 Months' },
                    { value: '9', label: '9 Months' },
                  ]}
                  triggerClassName="h-9 px-3 text-xs font-semibold"
                />
              </div>
            </div>

            <div className="flex items-center gap-1 bg-slate-50 p-1 rounded-xl border border-slate-200">
              <button
                type="button"
                onClick={handlePrev}
                className="p-1 text-slate-600 hover:text-[#6E1D1D] rounded-lg transition-colors cursor-pointer"
                title="Previous Month"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="text-xs font-bold text-slate-800 px-2 min-w-[95px] text-center">
                {MONTH_NAMES[fromM - 1]} {fromY}
              </span>
              <button
                type="button"
                onClick={handleNext}
                className="p-1 text-slate-600 hover:text-[#6E1D1D] rounded-lg transition-colors cursor-pointer"
                title="Next Month"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 8 Top Summary Stat Cards matching Media Octus Theme */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
        {/* PRESENT */}
        <div className="bg-[#EAF8ED] border border-[#C8E6C9] rounded-2xl p-3.5 flex flex-col justify-center items-center text-center shadow-xs">
          <span className="text-[10px] font-bold text-emerald-700 tracking-wider uppercase mb-1">
            PRESENT
          </span>
          <span className="text-2xl font-extrabold text-emerald-700">
            {summaryStats.presentCount}
          </span>
        </div>

        {/* HALF DAYS */}
        <div className="bg-[#FEF9E7] border border-[#FDECB8] rounded-2xl p-3.5 flex flex-col justify-center items-center text-center shadow-xs">
          <span className="text-[10px] font-bold text-[#B7791F] tracking-wider uppercase mb-1">
            HALF DAYS
          </span>
          <span className="text-2xl font-extrabold text-[#B7791F]">
            {summaryStats.halfDaysCount}
          </span>
        </div>

        {/* LEAVE */}
        <div className="bg-[#FFF3E8] border border-[#FDD8B3] rounded-2xl p-3.5 flex flex-col justify-center items-center text-center shadow-xs">
          <span className="text-[10px] font-bold text-[#D35400] tracking-wider uppercase mb-1">
            LEAVE
          </span>
          <span className="text-2xl font-extrabold text-[#D35400]">
            {summaryStats.leaveCount}
          </span>
        </div>

        {/* ABSENT */}
        <div className="bg-[#FDEDEC] border border-[#FADBD8] rounded-2xl p-3.5 flex flex-col justify-center items-center text-center shadow-xs">
          <span className="text-[10px] font-bold text-[#C0392B] tracking-wider uppercase mb-1">
            ABSENT
          </span>
          <span className="text-2xl font-extrabold text-[#C0392B]">
            {summaryStats.absentCount}
          </span>
        </div>

        {/* WORK HOURS */}
        <div className="bg-[#EBF5FB] border border-[#D4E6F1] rounded-2xl p-3.5 flex flex-col justify-center items-center text-center shadow-xs">
          <span className="text-[10px] font-bold text-[#2980B9] tracking-wider uppercase mb-1">
            WORK HOURS
          </span>
          <span className="text-lg sm:text-xl font-extrabold text-[#2980B9] whitespace-nowrap">
            {formatDurationHM(summaryStats.totalWorkHours)}
          </span>
        </div>

        {/* BREAK HOURS */}
        <div className="bg-[#F4F6F6] border border-[#EAEDED] rounded-2xl p-3.5 flex flex-col justify-center items-center text-center shadow-xs">
          <span className="text-[10px] font-bold text-slate-600 tracking-wider uppercase mb-1">
            BREAK HOURS
          </span>
          <span className="text-lg sm:text-xl font-extrabold text-slate-700 whitespace-nowrap">
            {formatDurationHM(summaryStats.totalBreakHours)}
          </span>
        </div>

        {/* OVERTIME */}
        <div className="bg-[#F4ECF7] border border-[#E8DAEF] rounded-2xl p-3.5 flex flex-col justify-center items-center text-center shadow-xs">
          <span className="text-[10px] font-bold text-[#8E44AD] tracking-wider uppercase mb-1">
            OVERTIME
          </span>
          <span className="text-lg sm:text-xl font-extrabold text-[#8E44AD] whitespace-nowrap">
            {formatDurationHM(summaryStats.totalOvertimeHours)}
          </span>
        </div>

        {/* ATTENDANCE % */}
        <div className="bg-[#111827] border border-slate-800 rounded-2xl p-3.5 flex flex-col justify-center items-center text-center shadow-xs">
          <span className="text-[10px] font-bold text-slate-300 tracking-wider uppercase mb-1">
            ATTENDANCE %
          </span>
          <span className="text-2xl font-extrabold text-white">
            {summaryStats.attendancePercent.toFixed(1)}%
          </span>
        </div>
      </div>

      {isLoading && (
        <div className="p-6 text-center bg-white rounded-2xl border border-slate-200 shadow-xs flex items-center justify-center gap-2 text-slate-500 text-xs font-semibold">
          <div className="animate-spin rounded-full h-4 w-4 border-2 border-[#6E1D1D] border-t-transparent" />
          <span>Loading attendance data...</span>
        </div>
      )}

      {/* Render one monthly calendar after another vertically */}
      <div className="space-y-6">
        {monthList.map((monthItem, mIdx) => {
          const m = monthItem.month;
          const y = monthItem.year;
          const daysInMonth = new Date(y, m, 0).getDate();
          const firstDayDow = new Date(y, m - 1, 1).getDay(); // 0 is Sunday

          return (
            <Card key={`${y}-${m}`} className="p-4 sm:p-5 border border-slate-200 rounded-2xl shadow-xs bg-white">
              {/* Month Header */}
              <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
                <div className="flex items-center gap-2">
                  <CalendarIcon className="h-5 w-5 text-[#6E1D1D]" />
                  <h3 className="text-base font-bold text-slate-800 tracking-tight">
                    {MONTH_NAMES[m - 1]} {y}
                  </h3>
                </div>

                <div className="hidden sm:flex items-center gap-3 text-xs text-slate-500">
                  <span className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-emerald-500 inline-block" /> Present
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-amber-500 inline-block" /> Late
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-orange-500 inline-block" /> Half-Day
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-rose-500 inline-block" /> Absent
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-slate-400 inline-block" /> Weekend
                  </span>
                </div>
              </div>

              {/* Sunday -> Saturday 7 Column Headers */}
              <div className="grid grid-cols-7 gap-2 text-center mb-2">
                {DAY_NAMES.map((dayName, idx) => (
                  <div
                    key={dayName}
                    className={cx(
                      'py-1.5 text-center text-[11px] font-bold uppercase tracking-wider',
                      idx === 0 ? 'text-rose-500' : 'text-slate-600'
                    )}
                  >
                    {dayName}
                  </div>
                ))}
              </div>

              {/* Day Cells Grid */}
              <div className="grid grid-cols-7 gap-2">
                {/* Empty cells before the 1st */}
                {Array.from({ length: firstDayDow }).map((_, i) => (
                  <div
                    key={`empty-${mIdx}-${i}`}
                    className="min-h-[105px] sm:min-h-[115px] rounded-xl border border-slate-100 bg-slate-50/40 opacity-40"
                  />
                ))}

                {/* Day cells 1 to daysInMonth */}
                {Array.from({ length: daysInMonth }, (_, i) => {
                  const dayNum = i + 1;
                  const dateStr = `${y}-${String(m).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
                  const dow = (firstDayDow + i) % 7;
                  const isSunday = dow === 0;
                  const dowName = DAY_NAMES[dow];

                  // Check if this date is inside custom range bounds
                  const isBeforeStart = customStartDate ? dateStr < customStartDate : false;
                  const isAfterEnd = customEndDate ? dateStr > customEndDate : false;
                  const isOutOfRange = isBeforeStart || isAfterEnd;

                  const detail = effectiveData.detMap[dateStr];
                  const rawStatus = (detail?.status || effectiveData.attMap[dateStr] || '').trim();

                  let status = rawStatus;
                  if (!status) {
                    if (isSunday) status = 'Weekend';
                    else if (dateStr <= todayStr) status = 'Absent';
                  }

                  const isWeekend = isSunday || status === 'Weekend';
                  const isHoliday = status === 'Holiday';
                  const isPresent = status === 'Present';
                  const isLate = status === 'Late';
                  const isHalfDay = status === 'Half-Day';
                  const isLeave = status === 'Leave';
                  const isAbsent = status === 'Absent';
                  const isToday = dateStr === todayStr;

                  if (isOutOfRange) {
                    return (
                      <div
                        key={dateStr}
                        className="min-h-[105px] sm:min-h-[115px] rounded-xl border border-slate-200 bg-slate-50/60 p-2 flex flex-col justify-between opacity-30 cursor-not-allowed"
                      >
                        <span className="text-xs font-bold text-slate-400">{dayNum}</span>
                        <span className="text-[10px] text-slate-400 text-center">-</span>
                      </div>
                    );
                  }

                  // Determine container styles
                  let borderClass = 'border-slate-200 bg-white hover:bg-slate-50';
                  let statusBadgeClass = 'text-slate-600 bg-slate-100 border-slate-200';
                  let statusLabel = status || '—';

                  if (isPresent) {
                    borderClass = 'border-emerald-200 bg-emerald-50/20 hover:bg-emerald-50/40';
                    statusBadgeClass = 'text-emerald-700 bg-emerald-100/70 border-emerald-200';
                    statusLabel = 'Present';
                  } else if (isLate) {
                    borderClass = 'border-amber-200 bg-amber-50/20 hover:bg-amber-50/40';
                    statusBadgeClass = 'text-amber-700 bg-amber-100/70 border-amber-200';
                    statusLabel = 'Late';
                  } else if (isHalfDay) {
                    borderClass = 'border-orange-200 bg-orange-50/20 hover:bg-orange-50/40';
                    statusBadgeClass = 'text-orange-700 bg-orange-100/70 border-orange-200';
                    statusLabel = 'Half-Day';
                  } else if (isLeave) {
                    borderClass = 'border-blue-200 bg-blue-50/20 hover:bg-blue-50/40';
                    statusBadgeClass = 'text-blue-700 bg-blue-100/70 border-blue-200';
                    statusLabel = 'Leave';
                  } else if (isHoliday) {
                    borderClass = 'border-purple-200 bg-purple-50/20 hover:bg-purple-50/40';
                    statusBadgeClass = 'text-purple-700 bg-purple-100/70 border-purple-200';
                    statusLabel = 'Holiday';
                  } else if (isWeekend) {
                    borderClass = 'border-slate-200 bg-slate-50/60 hover:bg-slate-100/60';
                    statusBadgeClass = 'text-slate-500 bg-slate-100 border-slate-200';
                    statusLabel = 'Weekend';
                  } else if (isAbsent) {
                    borderClass = 'border-rose-200 bg-rose-50/20 hover:bg-rose-50/40';
                    statusBadgeClass = 'text-rose-700 bg-rose-100/70 border-rose-200';
                    statusLabel = 'Absent';
                  }

                  const checkIn = formatBusinessTime(detail?.checkInTime);
                  const checkOut = formatBusinessTime(detail?.checkOutTime);
                  const actualH = detail?.actualHours !== undefined ? detail.actualHours : detail?.totalHours;
                  const workDuration = formatDurationHM(actualH);
                  const otDuration = detail?.overtimeHours && detail.overtimeHours > 0
                    ? formatDurationHM(detail.overtimeHours)
                    : null;

                  return (
                    <button
                      key={dateStr}
                      type="button"
                      onClick={() =>
                        setSelectedDay({
                          dateStr,
                          dayNum,
                          dowName,
                          status,
                          detail,
                          isWeekend,
                          isHoliday,
                        })
                      }
                      className={cx(
                        'min-h-[105px] sm:min-h-[115px] rounded-xl border p-2 flex flex-col justify-between text-left transition-all cursor-pointer relative group overflow-hidden',
                        borderClass,
                        isToday && 'ring-2 ring-[#6E1D1D] ring-offset-1'
                      )}
                    >
                      {/* Top Header: Day Number + Status Badge */}
                      <div className="flex items-center justify-between gap-1 w-full">
                        <span
                          className={cx(
                            'text-xs font-bold rounded-md px-1.5 py-0.5 shrink-0',
                            isToday
                              ? 'bg-[#6E1D1D] text-white'
                              : isSunday
                                ? 'text-rose-500'
                                : 'text-slate-800'
                          )}
                        >
                          {dayNum}
                        </span>

                        <span
                          className={cx(
                            'text-[9px] font-bold px-1.5 py-0.5 rounded-md border truncate max-w-[70px] text-center leading-tight',
                            statusBadgeClass
                          )}
                          title={statusLabel}
                        >
                          {statusLabel}
                        </span>
                      </div>

                      {/* Middle Content */}
                      <div className="my-1 space-y-0.5 w-full">
                        {/* Working Day Info */}
                        {(isPresent || isLate || isHalfDay) && (
                          <>
                            <div className="flex items-center justify-between text-[10px] text-slate-600 font-medium">
                              <span className="text-slate-400">In:</span>
                              <span className="truncate">{checkIn !== '-' ? checkIn : '—'}</span>
                            </div>
                            <div className="flex items-center justify-between text-[10px] text-slate-600 font-medium">
                              <span className="text-slate-400">Out:</span>
                              <span className="truncate">{checkOut !== '-' ? checkOut : '—'}</span>
                            </div>
                            <div className="flex items-center justify-between text-[10px] pt-0.5 border-t border-slate-200/50">
                              <span className="font-bold text-slate-800">{workDuration}</span>
                              {otDuration && (
                                <span className="text-purple-700 font-bold text-[9px] truncate">
                                  +{otDuration}
                                </span>
                              )}
                            </div>
                          </>
                        )}

                        {/* Weekend Info */}
                        {isWeekend && !isPresent && (
                          <div className="text-[10px] text-slate-400 font-medium py-1">
                            Weekend Off
                          </div>
                        )}

                        {/* Holiday Info */}
                        {isHoliday && (
                          <div className="text-[10px] text-purple-600 font-medium truncate py-1">
                            {detail?.workType || 'Holiday'}
                          </div>
                        )}

                        {/* Leave Info */}
                        {isLeave && (
                          <div className="text-[10px] text-blue-600 font-medium py-1">
                            Approved Leave
                          </div>
                        )}

                        {/* Absent Info */}
                        {isAbsent && !isWeekend && (
                          <div className="text-[10px] text-rose-500 font-medium py-1">
                            No punch record
                          </div>
                        )}

                        {/* Future / Unrecorded */}
                        {!isWeekend && !isHoliday && !isPresent && !isLate && !isHalfDay && !isLeave && !isAbsent && (
                          <div className="text-[10px] text-slate-400 font-medium py-1">
                            —
                          </div>
                        )}
                      </div>

                      {/* Bottom Footer Line */}
                      <div className="text-[9px] text-slate-400 truncate w-full flex items-center justify-between">
                        <span className="truncate">
                          {detail?.workType || (isWeekend ? 'Off' : 'Office')}
                        </span>
                        <span className="text-[8px] text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity">
                          View
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </Card>
          );
        })}
      </div>

      {/* DAY DETAILS MODAL - Consistent with My Attendance */}
      {selectedDay && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-slate-50">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  {formatBusinessDateDMY(selectedDay.dateStr)}
                </h3>
                <p className="text-xs text-slate-500">
                  {selectedDay.dowName} · {employee?.fullName || employee?.name || 'Employee Attendance'}
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
                <span className="font-medium text-slate-500">Attendance Status</span>
                <span
                  className={cx(
                    'px-2.5 py-1 rounded-lg font-bold text-xs inline-flex items-center gap-1',
                    selectedDay.status === 'Present'
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                      : selectedDay.status === 'Late'
                        ? 'bg-amber-50 text-amber-700 border border-amber-200'
                        : selectedDay.status === 'Half-Day'
                          ? 'bg-orange-50 text-orange-700 border border-orange-200'
                          : selectedDay.status === 'Leave'
                            ? 'bg-blue-50 text-blue-700 border border-blue-200'
                            : selectedDay.status === 'Holiday'
                              ? 'bg-purple-50 text-purple-700 border border-purple-200'
                              : selectedDay.isWeekend
                                ? 'bg-slate-100 text-slate-600'
                                : 'bg-rose-50 text-rose-700 border border-rose-200'
                  )}
                >
                  {selectedDay.status || (selectedDay.isWeekend ? 'Weekend' : 'Absent')}
                </span>
              </div>

              <div className="flex items-center justify-between py-2 border-b border-slate-100">
                <span className="font-medium text-slate-500">Shift</span>
                <span className="font-semibold text-slate-800">
                  {selectedDay.detail?.shiftDetails?.name || 'General (8:00 AM - 5:00 PM)'}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-3 py-1">
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                  <p className="text-[11px] text-slate-500 font-medium">Check-In</p>
                  <p className="text-sm font-bold text-slate-800 mt-0.5">
                    {formatBusinessTime(selectedDay.detail?.checkInTime)}
                  </p>
                  <p className="text-[10px] text-slate-400 mt-1 flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    {selectedDay.detail?.location || selectedDay.detail?.workType || 'Office'}
                  </p>
                </div>

                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                  <p className="text-[11px] text-slate-500 font-medium">Check-Out</p>
                  <p className="text-sm font-bold text-slate-800 mt-0.5">
                    {formatBusinessTime(selectedDay.detail?.checkOutTime)}
                  </p>
                  <p className="text-[10px] text-slate-400 mt-1 flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    {selectedDay.detail?.location || selectedDay.detail?.workType || 'Office'}
                  </p>
                </div>
              </div>

              <div className="space-y-2 pt-1">
                <div className="flex items-center justify-between text-slate-600">
                  <span className="flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5 text-slate-400" />
                    Working Hours
                  </span>
                  <span className="font-bold text-slate-900">
                    {formatDurationHM(
                      selectedDay.detail?.actualHours !== undefined
                        ? selectedDay.detail.actualHours
                        : selectedDay.detail?.totalHours
                    )}
                  </span>
                </div>

                <div className="flex items-center justify-between text-slate-600">
                  <span>Regular Hours</span>
                  <span className="font-semibold text-slate-800">
                    {formatDurationHM(
                      Math.min(
                        8,
                        selectedDay.detail?.actualHours !== undefined
                          ? selectedDay.detail.actualHours
                          : selectedDay.detail?.totalHours || 0
                      )
                    )}
                  </span>
                </div>

                <div className="flex items-center justify-between text-slate-600">
                  <span>Overtime</span>
                  <span className="font-bold text-emerald-700">
                    {selectedDay.detail?.overtimeHours && selectedDay.detail.overtimeHours > 0
                      ? `+${formatDurationHM(selectedDay.detail.overtimeHours)}`
                      : 'None'}
                  </span>
                </div>

                <div className="flex items-center justify-between text-slate-600">
                  <span>Break Duration</span>
                  <span className="font-medium text-slate-700">
                    {selectedDay.detail?.totalBreakMinutes
                      ? `${Math.round(selectedDay.detail.totalBreakMinutes)} minutes`
                      : '0 minutes'}
                  </span>
                </div>

                <div className="flex items-center justify-between text-slate-600">
                  <span>Work Type / Notes</span>
                  <span className="text-slate-500 italic">
                    {selectedDay.detail?.workType || 'Standard'}
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
