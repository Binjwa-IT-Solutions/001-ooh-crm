'use client';

import { useState } from 'react';
import { useMyAttendanceSummary } from '@/modules/hr/hooks/use-attendance';
import { formatHoursToHM } from '@/shared/utils/formatters';
import { cx, Card } from '@/shared/ui';
import { Calendar, Clock, AlertCircle, FileText, Loader2 } from 'lucide-react';

const MONTHS = [
  { value: 1, label: 'January' },
  { value: 2, label: 'February' },
  { value: 3, label: 'March' },
  { value: 4, label: 'April' },
  { value: 5, label: 'May' },
  { value: 6, label: 'June' },
  { value: 7, label: 'July' },
  { value: 8, label: 'August' },
  { value: 9, label: 'September' },
  { value: 10, label: 'October' },
  { value: 11, label: 'November' },
  { value: 12, label: 'December' },
];

const YEARS = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);

export function MyAttendanceView() {
  const [month, setMonth] = useState(new Date().getMonth() + 1);
  const [year, setYear] = useState(new Date().getFullYear());

  const { data, isLoading, error } = useMyAttendanceSummary(month, year);

  // Generate an array of days for the selected month to render the table correctly
  const daysInMonth = new Date(year, month, 0).getDate();
  const allDays = Array.from({ length: daysInMonth }, (_, i) => {
    const d = new Date(year, month - 1, i + 1);
    const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(i + 1).padStart(2, '0')}`;
    const dayOfWeek = d.getDay();
    const isWeekend = dayOfWeek === 0;
    return { date: d, dateStr, isWeekend };
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-slate-800">My Attendance</h2>
          <p className="text-xs text-slate-500">Standard working requirement: 8 hours actual work per day (excluding breaks).</p>
        </div>

        <div className="flex items-center gap-3 bg-white p-2 rounded-xl border border-slate-200 shadow-sm">
          <select
            className="h-9 px-3 rounded-lg border-transparent hover:bg-slate-50 focus:bg-white focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 text-sm font-medium transition-colors"
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
          >
            {MONTHS.map((m) => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>
          <div className="w-px h-6 bg-slate-200"></div>
          <select
            className="h-9 px-3 rounded-lg border-transparent hover:bg-slate-50 focus:bg-white focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 text-sm font-medium transition-colors"
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
          >
            {YEARS.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
      </div>

      {error ? (
        <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-xl flex items-center gap-3">
          <AlertCircle className="h-5 w-5" />
          <p>Failed to load attendance data. Please try again.</p>
        </div>
      ) : (
        <>
          {/* Stat Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="p-4 flex items-center gap-4 border-l-4 border-l-emerald-500">
              <div className="p-3 bg-emerald-50 text-emerald-600 rounded-lg">
                <Calendar className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-500">Present</p>
                <p className="text-2xl font-semibold text-slate-800">
                  {isLoading ? '  ' : (data?.stats.presentCount ?? 0)}
                </p>
              </div>
            </Card>

            <Card className="p-4 flex items-center gap-4 border-l-4 border-l-rose-500">
              <div className="p-3 bg-rose-50 text-rose-600 rounded-lg">
                <AlertCircle className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-500">Absent</p>
                <p className="text-2xl font-semibold text-slate-800">
                  {isLoading ? ' ' : (data?.stats.absentCount ?? 0)}
                </p>
              </div>
            </Card>

            <Card className="p-4 flex items-center gap-4 border-l-4 border-l-amber-500">
              <div className="p-3 bg-amber-50 text-amber-600 rounded-lg">
                <FileText className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-500">Leave / Half-Day</p>
                <p className="text-2xl font-semibold text-slate-800">
                  {isLoading ? ' ' : (data?.stats.leaveHalfCount ?? 0)}
                </p>
              </div>
            </Card>

            <Card className="p-4 flex items-center gap-4 border-l-4 border-l-brand-500">
              <div className="p-3 bg-brand-50 text-brand-600 rounded-lg">
                <Clock className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-medium text-slate-500">Actual Work Hours</p>
                <p className="text-2xl font-semibold text-slate-800">
                  {isLoading ? ' ' : formatHoursToHM(data?.stats.totalWorkHours)}
                </p>
              </div>
            </Card>
          </div>

          {/* Daily Records Table */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col relative transition-all duration-300">
            <div className="p-4 border-b border-slate-200 bg-slate-50/50 flex justify-between items-center">
              <h2 className="font-semibold text-slate-800">Daily Records</h2>
            </div>

            <div className="overflow-x-auto w-full">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-medium">
                  <tr>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3">Shift</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Clock In</th>
                    <th className="px-4 py-3">Clock Out</th>
                    <th className="px-4 py-3">Break</th>
                    <th className="px-4 py-3 font-semibold text-slate-800">Working Hours</th>
                    {/* <th className="px-4 py-3">Required</th> */}
                    <th className="px-4 py-3 font-semibold text-emerald-700">Overtime</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {isLoading ? (
                    <tr>
                      <td colSpan={9} className="px-4 py-12 text-center text-slate-500">
                        <Loader2 className="h-6 w-6 animate-spin mx-auto text-brand-500 mb-2" />
                        <p>Loading attendance records...</p>
                      </td>
                    </tr>
                  ) : data?.records.length === 0 && data?.stats.absentCount === 0 ? (
                    <tr>
                      <td colSpan={9} className="px-4 py-12 text-center text-slate-500">
                        <Calendar className="h-8 w-8 mx-auto text-slate-300 mb-3" />
                        <p className="text-base font-medium text-slate-600">No records found</p>
                        <p className="text-sm mt-1">There is no attendance data for {MONTHS.find(m => m.value === month)?.label} {year}.</p>
                      </td>
                    </tr>
                  ) : (
                    allDays.map((day) => {
                      const record = data?.records.find((r) => {
                        const rd = new Date(r.date);
                        const rDateStr = `${rd.getFullYear()}-${String(rd.getMonth() + 1).padStart(2, '0')}-${String(rd.getDate()).padStart(2, '0')}`;
                        return rDateStr === day.dateStr;
                      });

                      if (!record) {
                        return (
                          <tr key={day.dateStr} className={cx("hover:bg-slate-50/50", day.isWeekend ? "bg-slate-50/50 text-slate-400" : "")}>
                            <td className="px-4 py-3 font-medium text-slate-600">{day.date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', weekday: 'short' })}</td>
                            <td className="px-4 py-3 text-slate-400 text-xs">General</td>
                            <td className="px-4 py-3">
                              {day.isWeekend ? (
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-600">
                                  Weekend
                                </span>
                              ) : (
                                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-50 text-red-600">
                                  Absent
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-center">-</td>
                            <td className="px-4 py-3 text-center">-</td>
                            <td className="px-4 py-3 text-center">-</td>
                            <td className="px-4 py-3 text-center">-</td>
                            {/* <td className="px-4 py-3 text-center text-slate-400">8h 00m</td> */}
                            <td className="px-4 py-3 text-center">-</td>
                          </tr>
                        );
                      }

                      const shiftLabel = record.shiftDetails?.name
                        ? `${record.shiftDetails.name} (${record.shiftDetails.startTime})`
                        : 'General';

                      const hasCheckedOut = !!record.checkOutTime;
                      const breakMinutes = record.totalBreakMinutes ?? (record.breaks?.reduce((acc: number, b: any) => acc + (b.durationMinutes || 0), 0) ?? 0);
                      const workHours = record.actualHours ?? record.totalHours;
                      const ovt = record.overtime ?? (workHours && workHours > 8 ? workHours - 8 : 0);

                      return (
                        <tr key={day.dateStr} className="hover:bg-slate-50">
                          <td className="px-4 py-3 font-medium text-slate-800">{day.date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', weekday: 'short' })}</td>
                          <td className="px-4 py-3 text-slate-600 text-xs">{shiftLabel}</td>
                          <td className="px-4 py-3">
                            <span className={cx(
                              "inline-flex items-center px-2 py-0.5 rounded text-xs font-medium",
                              record.status === 'Present' ? 'bg-emerald-50 text-emerald-700' :
                                record.status === 'Late' ? 'bg-amber-50 text-amber-700' :
                                  record.status === 'Half-Day' ? 'bg-orange-50 text-orange-700' :
                                    'bg-slate-100 text-slate-700'
                            )}>
                              {record.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-slate-600">
                            {record.checkInTime ? new Date(record.checkInTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-'}
                          </td>
                          <td className="px-4 py-3 text-slate-600">
                            {hasCheckedOut ? (
                              new Date(record.checkOutTime!).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                            ) : (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-50 text-blue-700">
                                In Progress
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-slate-600">
                            {breakMinutes > 0 ? `${Math.round(breakMinutes)}m` : '0m'}
                          </td>
                          <td className="px-4 py-3 font-semibold text-brand-800">
                            {hasCheckedOut ? formatHoursToHM(workHours) : '--'}
                          </td>
                          {/* <td className="px-4 py-3 text-slate-600 text-xs font-medium">
                            8h 00m
                          </td> */}
                          <td className="px-4 py-3">
                            {hasCheckedOut && ovt > 0 ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                +{formatHoursToHM(ovt)}
                              </span>
                            ) : (
                              <span className="text-slate-400">-</span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
