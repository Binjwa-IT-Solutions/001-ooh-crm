'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Calendar, Filter, Users, Clock, MapPin, AlertCircle, Loader2 } from 'lucide-react';
import { Card, cx } from '@/shared/ui';
import { useMonthlyRegister } from '@/modules/hr/hooks/use-reports';
import { MonthlyRegisterRow } from '@/modules/hr/types';
import { formatHoursToHM } from '@/shared/utils/formatters';
import { DEPARTMENTS } from '@/modules/employees/types';

/**
 * Company Design Tokens extracted from globals.css:
 * Media Octus Primary Brand: #6E1D1D (--color-primary)
 * Hover / Darker Tint: #882424 (--color-primary-600)
 * Soft Tint: #F8E6E6 (--color-primary-100)
 * Warning Tone: #F39C12 (--color-warning)
 * Error / Danger Tone: #E74C3C (--color-error)
 */
export const BRAND_TOKENS = {
  primary: '#6E1D1D',
  primaryHover: '#882424',
  primaryLight: '#F8E6E6',
  warning: '#F39C12',
  warningLight: '#FEF9E7',
  danger: '#E74C3C',
  dangerLight: '#FDEDEC',
  muted: '#E6E8EC',
} as const;

/**
 * Performance Tiers for Circular Progress Rings:
 * Tier 1: >= 90% -> Brand Maroon (#6E1D1D)
 * Tier 2: 70% - 89% -> Amber Warning (#F39C12)
 * Tier 3: < 70% -> Danger Red (#E74C3C)
 */
export const ATTENDANCE_TIERS = {
  HIGH: 90,
  MEDIUM: 70,
} as const;

export function getTierStyle(percentage: number) {
  if (percentage >= ATTENDANCE_TIERS.HIGH) {
    return {
      stroke: BRAND_TOKENS.primary,
      text: 'text-[#6E1D1D] dark:text-[#F8E6E6]',
      bg: 'bg-[#F8E6E6] text-[#6E1D1D] border-[#6E1D1D]/20',
      label: 'Good (≥90%)',
    };
  }
  if (percentage >= ATTENDANCE_TIERS.MEDIUM) {
    return {
      stroke: BRAND_TOKENS.warning,
      text: 'text-[#F39C12]',
      bg: 'bg-[#FEF9E7] text-[#B7791F] border-[#F39C12]/20',
      label: 'Average (70–89%)',
    };
  }
  return {
    stroke: BRAND_TOKENS.danger,
    text: 'text-[#E74C3C]',
    bg: 'bg-[#FDEDEC] text-[#C0392B] border-[#E74C3C]/20',
    label: 'Low (<70%)',
  };
}

export interface DayColumnInfo {
  dateStr: string;
  dayNumber: number;
  monthNumber: number;
  yearNumber: number;
  monthName: string;
  monthYearLabel: string;
  dayOfWeek: number;
  dayLetter: string;
  isSunday: boolean;
  isFirstDayOfMonth: boolean;
  isLastDayOfMonth: boolean;
}

interface CellTooltipData {
  dateStr: string;
  dayNumber: number;
  isSunday: boolean;
  status?: string;
  checkInTime?: string | Date;
  checkOutTime?: string | Date;
  location?: string;
  totalHours?: number;
  x: number;
  y: number;
  employeeName: string;
}

interface AttendanceOverviewWidgetProps {
  /** Optional pre-fetched data (e.g. from AttendanceReportsView) to avoid extra network requests */
  data?: MonthlyRegisterRow[] | null;
  fromMonth?: number;
  fromYear?: number;
  toMonth?: number;
  toYear?: number;
  year?: number;
  month?: number;
  showControls?: boolean;
}

export function AttendanceOverviewWidget({
  data: propData,
  fromMonth: propFromMonth,
  fromYear: propFromYear,
  toMonth: propToMonth,
  toYear: propToYear,
  year: propYear,
  month: propMonth,
  showControls = true,
}: AttendanceOverviewWidgetProps) {
  const today = new Date();

  // Normalize date range props with backward compatibility
  const initialFromMonth = propFromMonth ?? propMonth ?? today.getMonth() + 1;
  const initialFromYear = propFromYear ?? propYear ?? today.getFullYear();
  const initialToMonth = propToMonth ?? propMonth ?? today.getMonth() + 1;
  const initialToYear = propToYear ?? propYear ?? today.getFullYear();

  const [internalFromMonth, setInternalFromMonth] = useState(initialFromMonth);
  const [internalFromYear, setInternalFromYear] = useState(initialFromYear);
  const [internalToMonth, setInternalToMonth] = useState(initialToMonth);
  const [internalToYear, setInternalToYear] = useState(initialToYear);
  const [selectedDept, setSelectedDept] = useState<string>('');
  const [highlightedEmpId, setHighlightedEmpId] = useState<string | null>(null);
  const [tooltip, setTooltip] = useState<CellTooltipData | null>(null);

  const rowRefs = useRef<Record<string, HTMLTableRowElement | null>>({});

  const fromMonth = propFromMonth ?? propMonth ?? internalFromMonth;
  const fromYear = propFromYear ?? propYear ?? internalFromYear;
  const toMonth = propToMonth ?? propMonth ?? internalToMonth;
  const toYear = propToYear ?? propYear ?? internalToYear;

  // Self-fetch only when propData is not supplied
  const { data: fetchedData, isLoading, error, fetchReport } = useMonthlyRegister();

  useEffect(() => {
    if (propData === undefined) {
      fetchReport(fromMonth, fromYear, toMonth, toYear);
    }
  }, [propData, fromMonth, fromYear, toMonth, toYear, fetchReport]);

  const activeData = propData !== undefined ? propData : fetchedData;

  // Generate continuous list of day columns and month segments across the entire range
  const { daysList, monthSegments, workingDaysCount } = useMemo(() => {
    const list: DayColumnInfo[] = [];
    const segments: { label: string; count: number; month: number; year: number }[] = [];
    let working = 0;

    const start = new Date(fromYear, fromMonth - 1, 1);
    const end = new Date(toYear, toMonth, 0); // Last day of toMonth

    const dayLetters = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
    const monthShortNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    const curr = new Date(start);
    let currentSegment: { label: string; count: number; month: number; year: number } | null = null;

    while (curr <= end) {
      const y = curr.getFullYear();
      const m = curr.getMonth() + 1;
      const d = curr.getDate();
      const dow = curr.getDay();
      const isSunday = dow === 0;
      const dateStr = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

      const lastDayOfThisMonth = new Date(y, m, 0).getDate();
      const isFirst = d === 1;
      const isLast = d === lastDayOfThisMonth;

      const segLabel = `${monthShortNames[m - 1]} ${y}`;
      if (!currentSegment || currentSegment.label !== segLabel) {
        currentSegment = { label: segLabel, count: 1, month: m, year: y };
        segments.push(currentSegment);
      } else {
        currentSegment.count++;
      }

      if (!isSunday) {
        working++;
      }

      list.push({
        dateStr,
        dayNumber: d,
        monthNumber: m,
        yearNumber: y,
        monthName: monthShortNames[m - 1],
        monthYearLabel: segLabel,
        dayOfWeek: dow,
        dayLetter: dayLetters[dow],
        isSunday,
        isFirstDayOfMonth: isFirst,
        isLastDayOfMonth: isLast,
      });

      curr.setDate(curr.getDate() + 1);
    }

    return { daysList: list, monthSegments: segments, workingDaysCount: working };
  }, [fromYear, fromMonth, toYear, toMonth]);

  // Filter employees by department
  const filteredData = useMemo(() => {
    if (!activeData) return [];
    if (!selectedDept) return activeData;
    return activeData.filter((row) => row.employee?.department === selectedDept);
  }, [activeData, selectedDept]);

  // Per-employee stats: present days and percentage across the entire date range
  const employeeStats = useMemo(() => {
    const stats: Record<string, { presentDays: number; percentage: number }> = {};

    filteredData.forEach((row) => {
      let presentCount = 0;
      daysList.forEach((dayInfo) => {
        if (dayInfo.isSunday) return; // Exclude Sundays

        // Look up by ISO date "YYYY-MM-DD" or numeric day for single month
        const status =
          row.details?.[dayInfo.dateStr]?.status ||
          row.attendance?.[dayInfo.dateStr] ||
          row.details?.[dayInfo.dayNumber]?.status ||
          row.attendance?.[dayInfo.dayNumber];

        if (!status) return;

        if (status === 'Present' || status === 'Late' || status === 'Break') {
          presentCount += 1;
        } else if (status === 'Half-Day') {
          presentCount += 0.5;
        }
      });

      const percentage = workingDaysCount > 0 ? Math.min(100, Math.round((presentCount / workingDaysCount) * 100)) : 0;
      const empId = row.employee.id || row.employee.fullName || '';
      stats[empId] = { presentDays: presentCount, percentage };
    });

    return stats;
  }, [filteredData, daysList, workingDaysCount]);

  // Click on ring smoothly scrolls to employee row in heatmap
  const handleRingClick = (empId: string) => {
    setHighlightedEmpId(empId);
    const rowEl = rowRefs.current[empId];
    if (rowEl) {
      rowEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
    setTimeout(() => {
      setHighlightedEmpId((prev) => (prev === empId ? null : prev));
    }, 2500);
  };

  const handlePrevMonth = () => {
    if (internalFromMonth === 1) {
      setInternalFromMonth(12);
      setInternalFromYear(internalFromYear - 1);
      setInternalToMonth(12);
      setInternalToYear(internalToYear - 1);
    } else {
      setInternalFromMonth(internalFromMonth - 1);
      setInternalToMonth(internalToMonth - 1);
    }
  };

  const handleNextMonth = () => {
    if (internalFromMonth === 12) {
      setInternalFromMonth(1);
      setInternalFromYear(internalFromYear + 1);
      setInternalToMonth(1);
      setInternalToYear(internalToYear + 1);
    } else {
      setInternalFromMonth(internalFromMonth + 1);
      setInternalToMonth(internalToMonth + 1);
    }
  };

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const formatTime = (timeVal?: string | Date) => {
    if (!timeVal) return '-';
    try {
      const d = new Date(timeVal);
      if (isNaN(d.getTime())) return '-';
      return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
    } catch {
      return '-';
    }
  };

  const rangeTitle = useMemo(() => {
    if (fromMonth === toMonth && fromYear === toYear) {
      return `${monthNames[fromMonth - 1]} ${fromYear}`;
    }
    return `${monthNames[fromMonth - 1].slice(0, 3)} ${fromYear} – ${monthNames[toMonth - 1].slice(0, 3)} ${toYear}`;
  }, [fromMonth, fromYear, toMonth, toYear, monthNames]);

  return (
    <div className="space-y-6">
      {/* Header controls (if enabled and not controlled by parent) */}
      {showControls && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-[#F8E6E6] text-[#6E1D1D] rounded-lg">
              <Calendar className="h-5 w-5 text-[#6E1D1D]" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-800">Attendance Overview</h2>
              <p className="text-xs text-slate-500">
                {rangeTitle} · Sunday Weekly Off ({workingDaysCount} working days)
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Department filter */}
            <div className="flex items-center gap-1.5">
              <Filter className="h-4 w-4 text-slate-400" />
              <select
                value={selectedDept}
                onChange={(e) => setSelectedDept(e.target.value)}
                className="h-9 px-3 rounded-lg border border-slate-200 text-xs font-medium focus:ring-2 focus:ring-[#6E1D1D]/20 outline-none bg-white text-slate-700"
              >
                <option value="">All Departments</option>
                {DEPARTMENTS.map((dept) => (
                  <option key={dept} value={dept}>
                    {dept}
                  </option>
                ))}
              </select>
            </div>

            {/* Month/Year navigator when controlled internally */}
            {propFromMonth === undefined && propMonth === undefined && (
              <div className="flex items-center gap-1 bg-slate-50 p-1 rounded-lg border border-slate-200">
                <button
                  type="button"
                  onClick={handlePrevMonth}
                  className="p-1 text-slate-600 hover:text-slate-900 rounded hover:bg-white transition-colors"
                  title="Previous Month"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <span className="text-xs font-semibold text-slate-800 px-2 min-w-[120px] text-center">
                  {rangeTitle}
                </span>
                <button
                  type="button"
                  onClick={handleNextMonth}
                  className="p-1 text-slate-600 hover:text-slate-900 rounded hover:bg-white transition-colors"
                  title="Next Month"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {isLoading && propData === undefined ? (
        <Card className="p-12 flex flex-col items-center justify-center min-h-[360px]">
          <Loader2 className="h-8 w-8 text-[#6E1D1D] animate-spin mb-3" />
          <p className="text-sm font-medium text-slate-600">Loading attendance overview...</p>
        </Card>
      ) : error && propData === undefined ? (
        <Card className="p-8 text-center bg-rose-50/50 border-rose-200">
          <AlertCircle className="h-8 w-8 text-rose-500 mx-auto mb-2" />
          <p className="text-sm font-medium text-rose-800">Failed to load attendance report</p>
          <p className="text-xs text-rose-600 mt-1">{error.message}</p>
        </Card>
      ) : filteredData.length === 0 ? (
        <Card className="p-12 text-center text-slate-500">
          <Users className="h-8 w-8 text-slate-300 mx-auto mb-2" />
          <p className="text-sm font-medium">No employees found for this selection.</p>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* COMPONENT 1: Heatmap Calendar (Continuous Horizontal Scroll across Range) */}
          <Card className="overflow-hidden border border-slate-200 shadow-sm">
            <div className="p-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3 bg-white">
              <div>
                <h3 className="text-sm font-semibold text-slate-800">
                  Attendance Heatmap ({rangeTitle})
                </h3>
                <p className="text-xs text-slate-500">
                  {daysList.length} days total across {monthSegments.length} month{monthSegments.length > 1 ? 's' : ''}. Hover over any cell for punch & GPS details.
                </p>
              </div>

              {/* Legend with exact company tokens */}
              <div className="flex flex-wrap items-center gap-3 text-xs">
                <div className="flex items-center gap-1.5">
                  <span className="w-3.5 h-3.5 rounded-[4px] bg-[#A3D9A1] shadow-xs" />
                  <span className="text-slate-700 font-medium">Present (Full Day)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-3.5 h-3.5 rounded-[4px]  bg-[#F7DD72] shadow-xs" />
                  <span className="text-slate-700 font-medium">Half-Day / Late</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-3.5 h-3.5 rounded-[4px] bg-[#E74C3C] shadow-xs" />
                  <span className="text-slate-700 font-medium">Absent</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-3.5 h-3.5 rounded-[4px] bg-[#F5C177]  shadow-xs" />
                  <span className="text-slate-700 font-medium">Leave</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-3.5 h-3.5 rounded-[4px] bg-slate-100 border border-slate-200" />
                  <span className="text-slate-500 font-medium">Sunday (Off)</span>
                </div>
              </div>
            </div>

            <div className="overflow-x-auto w-full">
              <table className="w-full text-left text-sm whitespace-nowrap border-collapse">
                <thead className="bg-slate-50 border-b border-slate-200">
                  {/* Top Header Row: Month Segment Dividers */}
                  <tr>
                    <th
                      rowSpan={2}
                      className="px-4 py-2.5 font-semibold text-slate-700 sticky left-0 bg-slate-50 z-20 border-r border-slate-200 min-w-[180px] shadow-[2px_0_4px_-1px_rgba(0,0,0,0.05)] text-xs align-bottom"
                    >
                      Employee
                    </th>
                    {monthSegments.map((seg) => (
                      <th
                        key={seg.label}
                        colSpan={seg.count}
                        className="px-2 py-1.5 text-center text-xs font-bold text-slate-700 bg-slate-100/90 border-b border-r-2 border-slate-300 uppercase tracking-wider"
                      >
                        {seg.label}
                      </th>
                    ))}
                  </tr>

                  {/* Second Header Row: Days of Month & Day of Week */}
                  <tr>
                    {daysList.map((dayInfo) => (
                      <th
                        key={dayInfo.dateStr}
                        className={cx(
                          'px-0.5 py-1.5 text-center min-w-[28px] sm:min-w-[30px]',
                          dayInfo.isLastDayOfMonth ? 'border-r-2 border-slate-300' : 'border-r border-slate-100',
                          dayInfo.isSunday ? 'bg-slate-100/80 text-slate-400' : 'text-slate-600 font-medium'
                        )}
                      >
                        <div className="text-[9px] uppercase leading-tight font-semibold">{dayInfo.dayLetter}</div>
                        <div className="text-[11px] font-bold">{dayInfo.dayNumber}</div>
                      </th>
                    ))}
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100 bg-white">
                  {filteredData.map((row) => {
                    const empId = row.employee.id || row.employee.fullName || '';
                    const isHighlighted = highlightedEmpId === empId;

                    return (
                      <tr
                        key={empId}
                        ref={(el) => {
                          rowRefs.current[empId] = el;
                        }}
                        className={cx(
                          'transition-colors',
                          isHighlighted ? 'bg-[#F8E6E6]/60 ring-2 ring-[#6E1D1D]' : 'hover:bg-slate-50/70'
                        )}
                      >
                        {/* Employee Name Column (Sticky Left) */}
                        <td
                          className={cx(
                            'px-3.5 py-2 sticky left-0 z-10 border-r border-slate-200 shadow-[2px_0_4px_-1px_rgba(0,0,0,0.05)]',
                            isHighlighted ? 'bg-[#F8E6E6]' : 'bg-white'
                          )}
                        >
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-[#F8E6E6] text-[#6E1D1D] flex items-center justify-center font-bold text-[10px] shrink-0 border border-[#6E1D1D]/20">
                              {row.employee.fullName?.[0] || 'E'}
                            </div>
                            <div className="truncate">
                              <p className="font-semibold text-slate-800 text-xs truncate">
                                {row.employee.fullName}
                              </p>
                              <p className="text-[10px] text-slate-400 truncate">
                                {row.employee.department || 'Staff'}
                              </p>
                            </div>
                          </div>
                        </td>

                        {/* Days Cells across the multi-month range */}
                        {daysList.map((dayInfo) => {
                          const dayDetail =
                            row.details?.[dayInfo.dateStr] || row.details?.[dayInfo.dayNumber];
                          const status =
                            dayDetail?.status ||
                            row.attendance?.[dayInfo.dateStr] ||
                            row.attendance?.[dayInfo.dayNumber];

                          // Cell color matching brand tokens
                          let cellBg = 'bg-slate-100 text-slate-300';

                          if (dayInfo.isSunday) {
                            cellBg = 'bg-slate-100/90 text-slate-400';
                          } else if (status === 'Present') {
                            cellBg = 'bg-[#6E1D1D] hover:bg-[#882424] shadow-xs';
                          } else if (status === 'Half-Day') {
                            cellBg = 'bg-[#F39C12] hover:bg-[#D68910] shadow-xs';
                          } else if (status === 'Late' || status === 'Break') {
                            cellBg = 'bg-[#F5B041] hover:bg-[#EB984E] shadow-xs';
                          } else if (status === 'Absent') {
                            cellBg = 'bg-[#E74C3C] hover:bg-[#C0392B] shadow-xs';
                          } else if (status === 'Leave') {
                            cellBg = 'bg-sky-500 hover:bg-sky-600 shadow-xs';
                          } else if (status) {
                            cellBg = 'bg-[#6E1D1D]';
                          }

                          return (
                            <td
                              key={dayInfo.dateStr}
                              className={cx(
                                'p-0.5 text-center',
                                dayInfo.isLastDayOfMonth ? 'border-r-2 border-slate-300' : 'border-r border-slate-100',
                                dayInfo.isSunday && 'bg-slate-50/50'
                              )}
                              onMouseEnter={(e) => {
                                const rect = e.currentTarget.getBoundingClientRect();
                                const dateObj = new Date(dayInfo.yearNumber, dayInfo.monthNumber - 1, dayInfo.dayNumber);
                                const dateFormatted = dateObj.toLocaleDateString('en-GB', {
                                  weekday: 'short',
                                  day: '2-digit',
                                  month: 'short',
                                  year: 'numeric',
                                });

                                setTooltip({
                                  dateStr: dateFormatted,
                                  dayNumber: dayInfo.dayNumber,
                                  isSunday: dayInfo.isSunday,
                                  status: dayInfo.isSunday ? 'Sunday (Weekly Off)' : status || 'Unrecorded',
                                  checkInTime: dayDetail?.checkInTime,
                                  checkOutTime: dayDetail?.checkOutTime,
                                  location: dayDetail?.location,
                                  totalHours: dayDetail?.totalHours,
                                  employeeName: row.employee.fullName || '',
                                  x: rect.left + rect.width / 2,
                                  y: rect.top - 8,
                                });
                              }}
                              onMouseLeave={() => setTooltip(null)}
                            >
                              <div
                                className={cx(
                                  'w-5 h-5 sm:w-5.5 sm:h-5.5 mx-auto rounded-[3px] transition-all transform hover:scale-125 cursor-pointer flex items-center justify-center',
                                  cellBg
                                )}
                              >
                                {dayInfo.isSunday && <span className="text-[8px] font-bold text-slate-400">·</span>}
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>

          {/* COMPONENT 2: Circular Progress Rings (Recalculated over the full date range) */}
          <Card className="p-5 border border-slate-200 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-5 border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-semibold text-slate-800">
                  Range Attendance Performance Rings ({rangeTitle})
                </h3>
                <p className="text-xs text-slate-500">
                  Calculated against {workingDaysCount} working days across the selected range (Sundays excluded). Click any ring to jump to employee in heatmap.
                </p>
              </div>

              {/* Tiers indicator */}
              <div className="flex items-center gap-4 text-xs font-medium">
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#6E1D1D]" /> ≥90% (Brand Tier)
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#F39C12]" /> 70–89% (Average)
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#E74C3C]" /> &lt;70% (Attention)
                </span>
              </div>
            </div>

            {/* Responsive Grid of Rings */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {filteredData.map((row) => {
                const empId = row.employee.id || row.employee.fullName || '';
                const stats = employeeStats[empId] || { presentDays: 0, percentage: 0 };
                const tier = getTierStyle(stats.percentage);
                const isSelected = highlightedEmpId === empId;

                // SVG Circular Calculations
                const radius = 26;
                const circumference = 2 * Math.PI * radius;
                const offset = circumference - (stats.percentage / 100) * circumference;

                return (
                  <button
                    key={empId}
                    type="button"
                    onClick={() => handleRingClick(empId)}
                    className={cx(
                      'flex flex-col items-center justify-center p-3 rounded-xl border transition-all text-center group cursor-pointer focus:outline-none',
                      isSelected
                        ? 'bg-[#F8E6E6] border-[#6E1D1D] ring-2 ring-[#6E1D1D] shadow-md scale-102'
                        : 'bg-white border-slate-200 hover:border-slate-300 hover:bg-slate-50/80 hover:shadow-sm'
                    )}
                  >
                    {/* Circular SVG Ring */}
                    <div className="relative w-16 h-16 flex items-center justify-center">
                      <svg className="w-16 h-16 -rotate-90 transform" viewBox="0 0 64 64">
                        {/* Background circle track */}
                        <circle
                          cx="32"
                          cy="32"
                          r={radius}
                          stroke="currentColor"
                          strokeWidth="4.5"
                          className="text-slate-100"
                          fill="transparent"
                        />
                        {/* Colored progress circle */}
                        <circle
                          cx="32"
                          cy="32"
                          r={radius}
                          stroke={tier.stroke}
                          strokeWidth="5"
                          strokeDasharray={circumference}
                          strokeDashoffset={offset}
                          strokeLinecap="round"
                          className="transition-all duration-700 ease-out"
                          fill="transparent"
                        />
                      </svg>

                      {/* Percentage in center */}
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <span className={cx('text-xs font-bold tracking-tight', tier.text)}>
                          {stats.percentage}%
                        </span>
                      </div>
                    </div>

                    {/* Employee Info */}
                    <p className="text-xs font-semibold text-slate-800 mt-2 truncate w-full group-hover:text-[#6E1D1D]">
                      {row.employee.fullName}
                    </p>
                    <span className="text-[10px] text-slate-400 truncate w-full mt-0.5">
                      {row.employee.department || 'Staff'}
                    </span>
                    <span className="text-[10px] font-medium text-slate-500 mt-1 px-1.5 py-0.5 rounded bg-slate-100">
                      {stats.presentDays} / {workingDaysCount}d
                    </span>
                  </button>
                );
              })}
            </div>
          </Card>
        </div>
      )}

      {/* Floating Hover Tooltip with Timestamps & Location */}
      {tooltip && (
        <div
          className="fixed z-50 pointer-events-none transform -translate-x-1/2 -translate-y-full mb-2 bg-slate-900 text-white rounded-lg shadow-xl px-3 py-2.5 text-xs max-w-xs transition-opacity duration-150 animate-in fade-in zoom-in-95"
          style={{ left: tooltip.x, top: tooltip.y }}
        >
          <div className="font-semibold text-slate-100 border-b border-slate-700 pb-1 mb-1.5 flex items-center justify-between gap-3">
            <span>{tooltip.dateStr}</span>
            <span className="text-[10px] text-slate-400">{tooltip.employeeName}</span>
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-between gap-4">
              <span className="text-slate-400">Status:</span>
              <span
                className={cx(
                  'font-medium px-1.5 py-0.5 rounded text-[11px]',
                  tooltip.status === 'Present' && 'bg-[#6E1D1D]/30 text-[#F8E6E6] border border-[#6E1D1D]',
                  tooltip.status === 'Half-Day' && 'bg-amber-950 text-amber-300 border border-amber-800',
                  tooltip.status === 'Absent' && 'bg-rose-950 text-rose-300 border border-rose-800',
                  tooltip.status === 'Leave' && 'bg-sky-950 text-sky-300 border border-sky-800',
                  tooltip.isSunday && 'bg-slate-800 text-slate-400'
                )}
              >
                {tooltip.status}
              </span>
            </div>

            {!tooltip.isSunday && tooltip.status !== 'Absent' && tooltip.status !== 'Leave' && tooltip.status !== 'Unrecorded' && (
              <>
                <div className="flex items-center justify-between gap-4 text-slate-300">
                  <span className="text-slate-400">Check-in:</span>
                  <span className="font-mono">{formatTime(tooltip.checkInTime)}</span>
                </div>
                <div className="flex items-center justify-between gap-4 text-slate-300">
                  <span className="text-slate-400">Check-out:</span>
                  <span className="font-mono">{formatTime(tooltip.checkOutTime)}</span>
                </div>
                {tooltip.location && (
                  <div className="flex items-center justify-between gap-4 text-slate-300">
                    <span className="text-slate-400 flex items-center gap-1">
                      <MapPin className="h-3 w-3 text-slate-400" /> Location:
                    </span>
                    <span className="truncate max-w-[130px] font-mono text-[11px] text-slate-200">
                      {tooltip.location}
                    </span>
                  </div>
                )}
                <div className="flex items-center justify-between gap-4 text-slate-300 pt-0.5 border-t border-slate-800">
                  <span className="text-slate-400 flex items-center gap-1">
                    <Clock className="h-3 w-3" /> Total Hours:
                  </span>
                  <span className="font-bold text-[#F8E6E6]">
                    {formatHoursToHM(tooltip.totalHours)}
                  </span>
                </div>
              </>
            )}
          </div>

          {/* Tooltip triangle indicator */}
          <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-900" />
        </div>
      )}
    </div>
  );
}
