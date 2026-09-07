import { useMemo } from 'react';
import { MonthlyRegisterRow } from '../types';

interface MonthlyRegisterGridProps {
  data: MonthlyRegisterRow[];
  year?: number;
  month?: number;
  fromMonth?: number;
  fromYear?: number;
  toMonth?: number;
  toYear?: number;
}

export function MonthlyRegisterGrid({
  data,
  year: propYear,
  month: propMonth,
  fromMonth: propFromMonth,
  fromYear: propFromYear,
  toMonth: propToMonth,
  toYear: propToYear,
}: MonthlyRegisterGridProps) {
  const today = new Date();
  const fromMonth = propFromMonth ?? propMonth ?? today.getMonth() + 1;
  const fromYear = propFromYear ?? propYear ?? today.getFullYear();
  const toMonth = propToMonth ?? propMonth ?? today.getMonth() + 1;
  const toYear = propToYear ?? propYear ?? today.getFullYear();

  // Generate continuous list of day columns and month segments across the entire range
  const { daysList, monthSegments } = useMemo(() => {
    const list: {
      dateStr: string;
      dayNumber: number;
      dayLetter: string;
      isSunday: boolean;
      isLastDayOfMonth: boolean;
    }[] = [];
    const segments: { label: string; count: number }[] = [];

    const start = new Date(fromYear, fromMonth - 1, 1);
    const end = new Date(toYear, toMonth, 0); // Last day of toMonth

    const dayLetters = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
    const monthShortNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    const curr = new Date(start);
    let currentSegment: { label: string; count: number } | null = null;

    while (curr <= end) {
      const y = curr.getFullYear();
      const m = curr.getMonth() + 1;
      const d = curr.getDate();
      const dow = curr.getDay();
      const isSunday = dow === 0;
      const dateStr = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      
      const lastDayOfThisMonth = new Date(y, m, 0).getDate();
      const isLast = d === lastDayOfThisMonth;

      const segLabel = `${monthShortNames[m - 1]} ${y}`;
      if (!currentSegment || currentSegment.label !== segLabel) {
        currentSegment = { label: segLabel, count: 1 };
        segments.push(currentSegment);
      } else {
        currentSegment.count++;
      }

      list.push({
        dateStr,
        dayNumber: d,
        dayLetter: dayLetters[dow],
        isSunday,
        isLastDayOfMonth: isLast,
      });

      curr.setDate(curr.getDate() + 1);
    }

    return { daysList: list, monthSegments: segments };
  }, [fromYear, fromMonth, toYear, toMonth]);

  const getStatusInitial = (status: string | undefined) => {
    if (!status) return '-';
    switch (status) {
      case 'Present': return 'P';
      case 'Absent': return 'A';
      case 'Half-Day': return 'H';
      case 'Late': return 'L';
      case 'Leave': return 'LV';
      case 'Break': return 'B';
      default: return status.charAt(0).toUpperCase();
    }
  };

  const getStatusColor = (status: string | undefined, isSunday: boolean) => {
    if (isSunday) return 'text-slate-400 bg-slate-100';
    if (!status) return 'text-slate-300';
    switch (status) {
      case 'Present': return 'text-emerald-600 bg-emerald-50 font-bold';
      case 'Absent': return 'text-red-600 bg-red-50 font-bold';
      case 'Half-Day': return 'text-blue-600 bg-blue-50 font-bold';
      case 'Late': return 'text-amber-600 bg-amber-50 font-bold';
      case 'Leave': return 'text-purple-600 bg-purple-50 font-bold';
      default: return 'text-slate-600';
    }
  };

  return (
    <div className="overflow-x-auto w-full">
      <table className="w-full text-left text-sm whitespace-nowrap border-collapse">
        <thead className="bg-slate-50 border-b border-slate-200">
          {/* Top Header Row: Month Segment Dividers */}
          <tr>
            <th
              rowSpan={2}
              className="px-4 py-2.5 font-semibold text-slate-700 sticky left-0 bg-slate-50 z-20 border-r border-slate-200 min-w-[200px] shadow-[1px_0_0_0_#e2e8f0] text-xs align-bottom"
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
                className={`px-1 py-1.5 font-medium text-slate-600 text-center min-w-[34px] ${
                  dayInfo.isLastDayOfMonth ? 'border-r-2 border-slate-300' : 'border-r border-slate-100'
                } ${dayInfo.isSunday ? 'bg-slate-100/80 text-slate-400' : ''}`}
              >
                <div className="text-[9px] uppercase leading-tight font-semibold">{dayInfo.dayLetter}</div>
                <div className="text-[11px] font-bold">{dayInfo.dayNumber}</div>
              </th>
            ))}
          </tr>
        </thead>

        <tbody className="divide-y divide-slate-100">
          {data.map((row, idx) => (
            <tr key={row.employee.id || idx} className="hover:bg-slate-50">
              <td className="px-4 py-3 font-medium text-slate-800 sticky left-0 bg-white group-hover:bg-slate-50 z-10 border-r border-slate-200 shadow-[1px_0_0_0_#e2e8f0]">
                {row.employee.fullName}
                <div className="text-xs text-slate-500 font-normal">{row.employee.department}</div>
              </td>
              {daysList.map((dayInfo) => {
                const status = row.attendance[dayInfo.dateStr] || row.attendance[dayInfo.dayNumber];
                return (
                  <td
                    key={dayInfo.dateStr}
                    className={`px-0.5 py-1.5 text-center ${
                      dayInfo.isLastDayOfMonth ? 'border-r-2 border-slate-300' : 'border-r border-slate-100'
                    }`}
                  >
                    <div
                      className={`w-7 h-7 mx-auto flex items-center justify-center rounded text-xs ${getStatusColor(
                        status,
                        dayInfo.isSunday
                      )}`}
                    >
                      {dayInfo.isSunday && !status ? '-' : getStatusInitial(status)}
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
          {data.length === 0 && (
            <tr>
              <td colSpan={daysList.length + 1} className="px-4 py-8 text-center text-slate-500">
                No data available for this range.
              </td>
            </tr>
          )}
        </tbody>
      </table>
      
      <div className="mt-4 flex flex-wrap gap-4 text-xs">
        <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-emerald-50 border border-emerald-200 inline-block"></span> Present (P)</div>
        <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-red-50 border border-red-200 inline-block"></span> Absent (A)</div>
        <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-amber-50 border border-amber-200 inline-block"></span> Late (L)</div>
        <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-blue-50 border border-blue-200 inline-block"></span> Half-Day (H)</div>
        <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-purple-50 border border-purple-200 inline-block"></span> Leave (LV)</div>
        <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded bg-slate-100 border border-slate-200 inline-block"></span> Sunday Weekly Off (-)</div>
      </div>
    </div>
  );
}
