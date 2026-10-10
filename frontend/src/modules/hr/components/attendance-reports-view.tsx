'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  CalendarDays,
  Calendar,
  AlertTriangle,
  UserX,
  TrendingUp,
  Download,
  Printer,
  ChevronLeft,
  ChevronRight,
  Search,
  Eye,
  ArrowLeft,
} from 'lucide-react';
import {
  useDailySummary,
  useLateReport,
  useMonthlyRegister,
  useAbsenceReport,
  useOvertimeReport,
} from '@/modules/hr/hooks/use-reports';
import { AttendanceCalendar } from '@/modules/hr/components/attendance-calendar';
import { DEPARTMENTS } from '@/modules/employees/types';
import { cx, Dropdown, DatePicker, Spinner, Card } from '@/shared/ui';
import { reportsApi } from '@/modules/hr/api';
import { api } from '@/shared/api/client';
import {
  toBusinessDateString,
  formatBusinessDateDMY,
  formatBusinessDateDisplay,
  formatBusinessTime,
  formatDurationHM,
  formatHoursToHM,
} from '@/shared/utils/formatters';
import { EmployeeRef, MonthlyRegisterRow } from '@/modules/hr/types';

type ReportNavType = 'monthly' | 'daily' | 'late' | 'absence' | 'overtime';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const REPORT_TABS = [
  { id: 'monthly', label: 'Monthly Register', icon: CalendarDays, desc: 'Detailed attendance calendar & employee monthly register' },
  { id: 'daily', label: 'Daily Summary', icon: Calendar, desc: 'Live day-wise attendance and punch performance' },
  { id: 'late', label: 'Late Arrival Report', icon: AlertTriangle, desc: 'Employees reporting after grace threshold' },
  { id: 'absence', label: 'Absence Report', icon: UserX, desc: 'Absence frequencies and unexcused leave records' },
  { id: 'overtime', label: 'Overtime Report', icon: TrendingUp, desc: 'Extra hours beyond standard 8-hour requirement' },
] as const;

function computeEndMonthYear(startMonth: number, startYear: number, count: number): { toMonth: number; toYear: number } {
  const totalMonths = (startYear * 12 + (startMonth - 1)) + (count - 1);
  const toYear = Math.floor(totalMonths / 12);
  const toMonth = (totalMonths % 12) + 1;
  return { toMonth, toYear };
}

interface PrintableRow {
  employeeName: string;
  employeeCode: string;
  department: string;
  dateStr: string;
  status: string;
  checkIn: string;
  checkOut: string;
  totalHours: string;
  workType: string;
  overtime: string;
}

export function AttendanceReportsView() {
  const [activeReport, setActiveReport] = useState<ReportNavType>('monthly');

  // Common Filters
  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();

  const [department, setDepartment] = useState<string>('');
  const [month, setMonth] = useState<number>(currentMonth);
  const [year, setYear] = useState<number>(currentYear);
  const [date, setDate] = useState<string>(() => toBusinessDateString(now) || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`);

  // Report Specific Filters
  const [minOtHours] = useState<string>('0.5');

  // Selected Employee & Multi-Month Range state
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);
  const [selectedEmployee, setSelectedEmployee] = useState<EmployeeRef | null>(null);
  const [calendarRange, setCalendarRange] = useState<number>(1);
  const [rangeData, setRangeData] = useState<MonthlyRegisterRow[] | null>(null);
  const [isRangeLoading, setIsRangeLoading] = useState<boolean>(false);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [searchEmployee, setSearchEmployee] = useState<string>('');

  // Report Hooks
  const daily = useDailySummary();
  const late = useLateReport();
  const monthly = useMonthlyRegister();
  const absence = useAbsenceReport();
  const overtime = useOvertimeReport();

  // Month navigation helpers
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

  // Month Range helpers for fromDate and toDate
  const monthDateRange = useMemo(() => {
    const start = `${year}-${String(month).padStart(2, '0')}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const end = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
    return { start, end };
  }, [month, year]);

  // Target multi-month end month and year
  const targetRange = useMemo(() => {
    return computeEndMonthYear(month, year, calendarRange);
  }, [month, year, calendarRange]);

  // Data fetching on filter change
  useEffect(() => {
    if (activeReport === 'monthly') {
      monthly.fetchReport(month, year, month, year);
    } else if (activeReport === 'daily') {
      daily.fetchReport(date);
    } else if (activeReport === 'late') {
      late.fetchReport(monthDateRange.start, monthDateRange.end);
    } else if (activeReport === 'absence') {
      absence.fetchReport(monthDateRange.start, monthDateRange.end);
    } else if (activeReport === 'overtime') {
      overtime.fetchReport(month, year, month, year, parseFloat(minOtHours));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeReport, month, year, date, monthDateRange, minOtHours]);

  // Multi-month data fetching for selected employee calendar view
  useEffect(() => {
    if (!selectedEmployeeId || calendarRange === 1) {
      return;
    }

    let isCurrent = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setIsRangeLoading(true);
    const { toMonth, toYear } = computeEndMonthYear(month, year, calendarRange);

    reportsApi
      .getMonthlyRegister(month, year, toMonth, toYear)
      .then((res: MonthlyRegisterRow[]) => {
        if (isCurrent) {
          setRangeData(Array.isArray(res) ? res : []);
        }
      })
      .catch((err) => {
        console.error('Failed to fetch multi-month attendance data:', err);
      })
      .finally(() => {
        if (isCurrent) {
          setIsRangeLoading(false);
        }
      });

    return () => {
      isCurrent = false;
    };
  }, [selectedEmployeeId, calendarRange, month, year]);

  // Filter by department
  const filterByDept = useCallback(
    (record: { employee?: EmployeeRef; employeeId?: EmployeeRef | string }) => {
      if (!department) return true;
      const emp = typeof record.employee === 'object' ? record.employee : typeof record.employeeId === 'object' ? (record.employeeId as EmployeeRef) : null;
      return emp?.department === department;
    },
    [department]
  );

  const filterBySearch = useCallback(
    (record: { employee?: EmployeeRef; employeeId?: EmployeeRef | string }) => {
      if (!searchEmployee.trim()) return true;
      const q = searchEmployee.toLowerCase().trim();
      const emp = typeof record.employee === 'object' ? record.employee : typeof record.employeeId === 'object' ? (record.employeeId as EmployeeRef) : null;
      const name = (emp?.fullName || emp?.name || '').toLowerCase();
      const code = (emp?.employeeCode || '').toLowerCase();
      return name.includes(q) || code.includes(q);
    },
    [searchEmployee]
  );

  // Filtered data sets
  const filteredDaily = useMemo(() => {
    return (daily.data || []).filter(filterByDept).filter(filterBySearch);
  }, [daily.data, filterByDept, filterBySearch]);

  const filteredLate = useMemo(() => {
    return (late.data || []).filter(filterByDept).filter(filterBySearch);
  }, [late.data, filterByDept, filterBySearch]);

  const filteredMonthly = useMemo(() => {
    return (monthly.data || []).filter(filterByDept).filter(filterBySearch);
  }, [monthly.data, filterByDept, filterBySearch]);

  const filteredAbsence = useMemo(() => {
    return (absence.data || []).filter(filterByDept).filter(filterBySearch);
  }, [absence.data, filterByDept, filterBySearch]);

  const filteredOvertime = useMemo(() => {
    return (overtime.data || []).filter(filterByDept).filter(filterBySearch);
  }, [overtime.data, filterByDept, filterBySearch]);

  // Selected employee detail record for individual calendar view
  const selectedMonthlyRecord = useMemo(() => {
    if (!selectedEmployeeId) return null;
    const sourceList = (calendarRange > 1 && rangeData) ? rangeData : (filteredMonthly || []);
    const found = sourceList.find((r: MonthlyRegisterRow) => {
      const id = r.employee?.id || r.employee?._id || r.employee?.employeeCode || r.employee?.fullName;
      return String(id) === String(selectedEmployeeId);
    });
    if (found) return found;
    if (selectedEmployee) {
      return {
        employee: selectedEmployee,
        attendance: {},
        details: {},
      };
    }
    return null;
  }, [selectedEmployeeId, calendarRange, rangeData, filteredMonthly, selectedEmployee]);

  // Export CSV Handler matching selected filters, employee, and date range
  const handleExport = async () => {
    try {
      setIsExporting(true);
      const exportParams: Record<string, string | number | undefined> = {
        reportType: activeReport,
        department: department || undefined,
      };

      if (selectedEmployeeId) {
        exportParams.employeeId = selectedEmployeeId;
      }

      if (activeReport === 'daily') {
        exportParams.date = date;
      } else if (activeReport === 'late' || activeReport === 'absence') {
        exportParams.fromDate = monthDateRange.start;
        exportParams.toDate = monthDateRange.end;
      } else if (activeReport === 'monthly') {
        exportParams.fromMonth = month;
        exportParams.fromYear = year;
        if (calendarRange > 1 && selectedEmployeeId) {
          exportParams.toMonth = targetRange.toMonth;
          exportParams.toYear = targetRange.toYear;
        } else {
          exportParams.toMonth = month;
          exportParams.toYear = year;
        }
      } else if (activeReport === 'overtime') {
        exportParams.fromMonth = month;
        exportParams.fromYear = year;
        exportParams.toMonth = month;
        exportParams.toYear = year;
      }

      const blob = await api.getBlob(reportsApi.exportReportUrl(exportParams));
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const monthPadded = String(month).padStart(2, '0');
      const empSlug = selectedMonthlyRecord?.employee?.employeeCode
        ? `-${selectedMonthlyRecord.employee.employeeCode}`
        : '';

      a.download = activeReport === 'monthly'
        ? `attendance-report${empSlug}-${year}-${monthPadded}.csv`
        : `attendance-${activeReport}-${year}-${monthPadded}.csv`;

      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error('Failed to export attendance CSV:', err);
    } finally {
      setIsExporting(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleViewCalendar = (emp: EmployeeRef) => {
    const id = emp?.id || emp?._id || emp?.employeeCode || emp?.fullName;
    setSelectedEmployee(emp);
    setSelectedEmployeeId(String(id));
    setCalendarRange(1);
    setRangeData(null);
  };

  const handleCalendarRangeChange = (range: number) => {
    setCalendarRange(range);
    if (range === 1) {
      setRangeData(null);
    }
  };

  const handleBackToList = () => {
    setSelectedEmployeeId(null);
    setSelectedEmployee(null);
    setCalendarRange(1);
    setRangeData(null);
  };

  const getInitials = (name?: string) => {
    if (!name) return 'EM';
    const p = name.trim().split(/\s+/);
    return (p[0][0] + (p[1] ? p[1][0] : '')).toUpperCase();
  };

  // Structured Printable Data & Title for Print / PDF Export
  const printableTitle = useMemo(() => {
    const monthName = MONTH_NAMES[month - 1];
    if (activeReport === 'monthly') {
      if (selectedMonthlyRecord) {
        const emp = selectedMonthlyRecord.employee;
        const empName = emp?.fullName || emp?.name || 'Employee';
        const empCode = emp?.employeeCode ? ` (${emp.employeeCode})` : '';
        const rangeText = calendarRange > 1
          ? `${monthName} ${year} — ${MONTH_NAMES[targetRange.toMonth - 1]} ${targetRange.toYear} (${calendarRange} Months)`
          : `${monthName} ${year}`;
        return `Employee Attendance Register — ${empName}${empCode} [${rangeText}]`;
      }
      return `Monthly Attendance Register — ${monthName} ${year}`;
    }
    if (activeReport === 'daily') {
      return `Daily Attendance Register — ${formatBusinessDateDisplay(date)}`;
    }
    if (activeReport === 'late') {
      return `Late Arrival Report — ${monthName} ${year}`;
    }
    if (activeReport === 'absence') {
      return `Absence Report — ${monthName} ${year}`;
    }
    if (activeReport === 'overtime') {
      return `Overtime Report — ${monthName} ${year}`;
    }
    return `Attendance Report — ${monthName} ${year}`;
  }, [activeReport, selectedMonthlyRecord, month, year, calendarRange, targetRange, date]);

  const printableRows = useMemo<PrintableRow[]>(() => {
    const rows: PrintableRow[] = [];

    if (activeReport === 'monthly') {
      if (selectedMonthlyRecord) {
        const emp = selectedMonthlyRecord.employee;
        const empName = emp?.fullName || emp?.name || 'Employee';
        const empCode = emp?.employeeCode || '—';
        const dept = emp?.department || 'General';

        const totalMonths = (targetRange.toYear - year) * 12 + (targetRange.toMonth - month) + 1;
        for (let mOffset = 0; mOffset < totalMonths; mOffset++) {
          const totalM = (year * 12 + (month - 1)) + mOffset;
          const curY = Math.floor(totalM / 12);
          const curM = (totalM % 12) + 1;
          const daysInMonth = new Date(curY, curM, 0).getDate();

          for (let dayNum = 1; dayNum <= daysInMonth; dayNum++) {
            const dateKey = `${curY}-${String(curM).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
            const dow = new Date(curY, curM - 1, dayNum).getDay();
            const isSunday = dow === 0;

            const detail = selectedMonthlyRecord.details?.[dateKey];
            const rawStatus = (detail?.status || selectedMonthlyRecord.attendance?.[dateKey] || '').trim();
            let status = rawStatus;
            if (!status) {
              status = isSunday ? 'Weekend' : 'Absent';
            }

            rows.push({
              employeeName: empName,
              employeeCode: empCode,
              department: dept,
              dateStr: formatBusinessDateDMY(dateKey),
              status,
              checkIn: formatBusinessTime(detail?.checkInTime),
              checkOut: formatBusinessTime(detail?.checkOutTime),
              totalHours: formatDurationHM(detail?.actualHours ?? detail?.totalHours),
              workType: detail?.workType || (status === 'Weekend' ? 'Weekend' : status === 'Holiday' ? 'Holiday' : status === 'Leave' ? 'Leave' : 'Office'),
              overtime: formatDurationHM(detail?.overtimeHours),
            });
          }
        }
        return rows;
      }

      // Main Monthly Register: All employees
      const daysInMonth = new Date(year, month, 0).getDate();
      filteredMonthly.forEach((r) => {
        const emp = r.employee;
        const empName = emp?.fullName || emp?.name || 'Employee';
        const empCode = emp?.employeeCode || '—';
        const dept = emp?.department || 'General';

        for (let dayNum = 1; dayNum <= daysInMonth; dayNum++) {
          const dateKey = `${year}-${String(month).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
          const dow = new Date(year, month - 1, dayNum).getDay();
          const isSunday = dow === 0;

          const detail = r.details?.[dateKey] || r.details?.[dayNum];
          const rawStatus = (detail?.status || r.attendance?.[dateKey] || r.attendance?.[dayNum] || '').trim();
          let status = rawStatus;
          if (!status) {
            status = isSunday ? 'Weekend' : 'Absent';
          }

          rows.push({
            employeeName: empName,
            employeeCode: empCode,
            department: dept,
            dateStr: formatBusinessDateDMY(dateKey),
            status,
            checkIn: formatBusinessTime(detail?.checkInTime),
            checkOut: formatBusinessTime(detail?.checkOutTime),
            totalHours: formatDurationHM(detail?.actualHours ?? detail?.totalHours),
            workType: detail?.workType || (status === 'Weekend' ? 'Weekend' : status === 'Holiday' ? 'Holiday' : status === 'Leave' ? 'Leave' : 'Office'),
            overtime: formatDurationHM(detail?.overtimeHours),
          });
        }
      });
      return rows;
    }

    if (activeReport === 'daily') {
      filteredDaily.forEach((r) => {
        const emp = typeof r.employeeId === 'object' ? (r.employeeId as EmployeeRef) : null;
        rows.push({
          employeeName: emp?.fullName || emp?.name || 'Employee',
          employeeCode: emp?.employeeCode || '—',
          department: emp?.department || 'General',
          dateStr: formatBusinessDateDMY(date),
          status: r.status || 'Present',
          checkIn: formatBusinessTime(r.checkInTime),
          checkOut: formatBusinessTime(r.checkOutTime),
          totalHours: formatDurationHM(r.actualHours ?? r.totalHours),
          workType: r.workType || 'Office',
          overtime: formatDurationHM(r.overtimeHours),
        });
      });
      return rows;
    }

    if (activeReport === 'late') {
      filteredLate.forEach((r) => {
        const emp = typeof r.employeeId === 'object' ? (r.employeeId as EmployeeRef) : null;
        rows.push({
          employeeName: emp?.fullName || emp?.name || 'Employee',
          employeeCode: emp?.employeeCode || '—',
          department: emp?.department || 'General',
          dateStr: formatBusinessDateDMY(r.date),
          status: 'Late',
          checkIn: formatBusinessTime(r.checkInTime),
          checkOut: formatBusinessTime(r.checkOutTime),
          totalHours: formatDurationHM(r.actualHours ?? r.totalHours),
          workType: r.workType || 'Office',
          overtime: formatDurationHM(r.overtimeHours),
        });
      });
      return rows;
    }

    if (activeReport === 'absence') {
      filteredAbsence.forEach((r) => {
        const emp = r.employee;
        rows.push({
          employeeName: emp?.fullName || emp?.name || 'Employee',
          employeeCode: emp?.employeeCode || '—',
          department: emp?.department || 'General',
          dateStr: formatBusinessDateDMY(r.date),
          status: r.status || 'Absent',
          checkIn: '—',
          checkOut: '—',
          totalHours: '0h',
          workType: 'Unexcused',
          overtime: '0h',
        });
      });
      return rows;
    }

    if (activeReport === 'overtime') {
      filteredOvertime.forEach((r) => {
        const emp = r.employee;
        (r.records || []).forEach((rec) => {
          rows.push({
            employeeName: emp?.fullName || emp?.name || 'Employee',
            employeeCode: emp?.employeeCode || '—',
            department: emp?.department || 'General',
            dateStr: formatBusinessDateDMY(rec.date),
            status: 'Present',
            checkIn: formatBusinessTime(rec.checkInTime),
            checkOut: formatBusinessTime(rec.checkOutTime),
            totalHours: formatDurationHM(rec.actualHours),
            workType: 'Overtime',
            overtime: formatDurationHM(rec.overtimeHours),
          });
        });
      });
      return rows;
    }

    return rows;
  }, [
    activeReport,
    selectedMonthlyRecord,
    filteredMonthly,
    filteredDaily,
    filteredLate,
    filteredAbsence,
    filteredOvertime,
    month,
    year,
    targetRange,
    date,
  ]);

  return (
    <div>
      {/* Dynamic Landscape Print Styling */}
      <style
        dangerouslySetInnerHTML={{
          __html: `
            @media print {
              @page {
                size: landscape;
                margin: 10mm 8mm;
              }
              body {
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
              }
            }
          `,
        }}
      />

      {/* ========================================================================= */}
      {/* PRINTABLE REGISTER DOCUMENT - Rendered ONLY during browser print / PDF    */}
      {/* ========================================================================= */}
      <div className="hidden print:block w-full">
        <div className="border-b-2 border-[#6E1D1D] pb-3 mb-4 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-black tracking-widest text-[#6E1D1D] uppercase">MEDIA OCTUS</span>
              <span className="text-slate-300">|</span>
              <span className="text-xs font-bold text-slate-700 tracking-wider uppercase">Corporate HR Management</span>
            </div>
            <h1 className="text-base font-extrabold text-slate-900 mt-1 tracking-tight">
              {printableTitle}
            </h1>
          </div>
          <div className="text-right text-[10px] text-slate-600 font-medium">
            <div>Department: <span className="font-bold text-slate-800">{department || 'All Departments'}</span></div>
            <div>Printed: <span className="font-bold text-slate-800">{formatBusinessDateDMY(new Date())}</span></div>
            <div>Total Records: <span className="font-bold text-slate-800">{printableRows.length}</span></div>
          </div>
        </div>

        <table className="w-full border-collapse border border-slate-300 text-[10px]">
          <thead className="table-header-group bg-slate-100 border-b-2 border-slate-300">
            <tr>
              <th className="border border-slate-300 px-2.5 py-1.5 text-left font-bold text-slate-800">Employee</th>
              <th className="border border-slate-300 px-2 py-1.5 text-left font-bold text-slate-800">Employee Code</th>
              <th className="border border-slate-300 px-2 py-1.5 text-left font-bold text-slate-800">Department</th>
              <th className="border border-slate-300 px-2 py-1.5 text-center font-bold text-slate-800">Date</th>
              <th className="border border-slate-300 px-2 py-1.5 text-center font-bold text-slate-800">Status</th>
              <th className="border border-slate-300 px-2 py-1.5 text-center font-bold text-slate-800">Check In</th>
              <th className="border border-slate-300 px-2 py-1.5 text-center font-bold text-slate-800">Check Out</th>
              <th className="border border-slate-300 px-2 py-1.5 text-center font-bold text-slate-800">Total Hours</th>
              <th className="border border-slate-300 px-2 py-1.5 text-center font-bold text-slate-800">Work Type</th>
              <th className="border border-slate-300 px-2 py-1.5 text-center font-bold text-slate-800">Overtime</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {printableRows.length === 0 ? (
              <tr>
                <td colSpan={10} className="border border-slate-300 p-6 text-center text-slate-400">
                  No attendance records matching the selected criteria.
                </td>
              </tr>
            ) : (
              printableRows.map((r, idx) => (
                <tr key={`print-row-${idx}`} className="border-b border-slate-200 break-inside-avoid">
                  <td className="border border-slate-200 px-2.5 py-1 font-semibold text-slate-900">{r.employeeName}</td>
                  <td className="border border-slate-200 px-2 py-1 font-mono text-slate-600">{r.employeeCode}</td>
                  <td className="border border-slate-200 px-2 py-1 text-slate-700">{r.department}</td>
                  <td className="border border-slate-200 px-2 py-1 text-center font-medium text-slate-800">{r.dateStr}</td>
                  <td className="border border-slate-200 px-2 py-1 text-center font-bold">
                    <span
                      className={cx(
                        'px-1.5 py-0.5 rounded text-[9px] font-bold inline-block',
                        r.status === 'Present'
                          ? 'bg-emerald-50 text-emerald-800'
                          : r.status === 'Late'
                            ? 'bg-amber-50 text-amber-800'
                            : r.status === 'Half-Day'
                              ? 'bg-orange-50 text-orange-800'
                              : r.status === 'Leave'
                                ? 'bg-blue-50 text-blue-800'
                                : r.status === 'Weekend'
                                  ? 'bg-slate-100 text-slate-600'
                                  : r.status === 'Holiday'
                                    ? 'bg-purple-50 text-purple-800'
                                    : 'bg-rose-50 text-rose-800'
                      )}
                    >
                      {r.status}
                    </span>
                  </td>
                  <td className="border border-slate-200 px-2 py-1 text-center text-slate-700">{r.checkIn}</td>
                  <td className="border border-slate-200 px-2 py-1 text-center text-slate-700">{r.checkOut}</td>
                  <td className="border border-slate-200 px-2 py-1 text-center font-bold text-slate-900">{r.totalHours}</td>
                  <td className="border border-slate-200 px-2 py-1 text-center text-slate-600">{r.workType}</td>
                  <td className="border border-slate-200 px-2 py-1 text-center font-semibold text-purple-800">{r.overtime}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        <div className="mt-4 pt-2 border-t border-slate-300 flex items-center justify-between text-[9px] text-slate-500">
          <span>CONFIDENTIAL · Generated via Media Octus CRM Attendance Subsystem</span>
          <span>HR Attendance Register Copy · Page 1</span>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* INTERACTIVE SCREEN DASHBOARD                                              */}
      {/* ========================================================================= */}
      <div className="space-y-6 print:hidden">
        {/* Top Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-slate-800 tracking-tight">Attendance Reports</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Comprehensive audit reports, registers, absence tracking, and overtime statements
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleExport}
              disabled={isExporting}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-xl shadow-xs transition-colors cursor-pointer disabled:opacity-50"
            >
              {isExporting ? (
                <Spinner className="h-3.5 w-3.5" />
              ) : (
                <Download className="h-3.5 w-3.5 text-[#6E1D1D]" />
              )}
              <span>Export CSV</span>
            </button>

            <button
              type="button"
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-xl shadow-xs transition-colors cursor-pointer"
            >
              <Printer className="h-3.5 w-3.5 text-[#6E1D1D]" />
              <span>Print / PDF</span>
            </button>
          </div>
        </div>

        {/* Report Tabs Navigation */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* TAB BUTTONS ON THE LEFT */}
          <div className="lg:col-span-3 space-y-2">
            {REPORT_TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeReport === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    setActiveReport(tab.id as ReportNavType);
                    setSelectedEmployeeId(null);
                    setSelectedEmployee(null);
                  }}
                  className={cx(
                    'w-full flex items-center gap-3 p-3 rounded-2xl text-left transition-all border cursor-pointer',
                    isActive
                      ? 'bg-white border-[#6E1D1D] shadow-xs text-[#6E1D1D]'
                      : 'bg-white/60 border-slate-200 text-slate-700 hover:bg-white hover:border-slate-300'
                  )}
                >
                  <div
                    className={cx(
                      'p-2 rounded-xl shrink-0',
                      isActive ? 'bg-[#F8E6E6] text-[#6E1D1D]' : 'bg-slate-100 text-slate-500'
                    )}
                  >
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold truncate leading-tight">{tab.label}</p>
                    <p className="text-[10px] text-slate-400 font-normal line-clamp-1 mt-0.5">
                      {tab.desc}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>

          {/* REPORT VIEW ON THE RIGHT */}
          <div className="lg:col-span-9 space-y-5">
            {/* ===================================================================== */}
            {/* REPORT 1: MONTHLY REGISTER */}
            {/* ===================================================================== */}
            {activeReport === 'monthly' && (
              <div className="space-y-4">
                {/* Header & Filter Bar for List Table */}
                {!selectedMonthlyRecord && (
                  <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                      <h3 className="text-base font-bold text-slate-800">
                        MONTHLY REGISTER — {MONTH_NAMES[month - 1]} {year}
                      </h3>
                      <p className="text-xs text-slate-500">
                        Detailed attendance calendar, employee working hours, and register overview
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                      {/* Department */}
                      <div className="w-40">
                        <Dropdown
                          showArrow={false}
                          value={department}
                          onChange={setDepartment}
                          options={[
                            { value: '', label: 'All Departments' },
                            ...DEPARTMENTS.map((dept) => ({ value: dept, label: dept })),
                          ]}
                          triggerClassName="h-9 px-3 text-xs font-semibold"
                        />
                      </div>

                      {/* Month Navigation */}
                      <div className="flex items-center gap-1 bg-slate-50 p-1 rounded-xl border border-slate-200">
                        <button
                          type="button"
                          onClick={handlePrevMonth}
                          className="p-1 text-slate-600 hover:text-[#6E1D1D] rounded-lg transition-colors cursor-pointer"
                          title="Previous Month"
                        >
                          <ChevronLeft className="h-4 w-4" />
                        </button>
                        <span className="text-xs font-bold text-slate-800 px-2 min-w-[95px] text-center">
                          {MONTH_NAMES[month - 1]} {year}
                        </span>
                        <button
                          type="button"
                          onClick={handleNextMonth}
                          className="p-1 text-slate-600 hover:text-[#6E1D1D] rounded-lg transition-colors cursor-pointer"
                          title="Next Month"
                        >
                          <ChevronRight className="h-4 w-4" />
                        </button>
                      </div>

                      {/* Employee Search */}
                      <div className="w-56 relative">
                        <Search className="h-4 w-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
                        <input
                          type="text"
                          placeholder="Search employee or code..."
                          value={searchEmployee}
                          onChange={(e) => setSearchEmployee(e.target.value)}
                          className="w-full h-9 pl-9 pr-3 rounded-xl border border-slate-200 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#6E1D1D]/20 focus:border-[#6E1D1D]"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* View 1: If an employee is selected, render their Detailed Calendar */}
                {selectedMonthlyRecord ? (
                  <div className="space-y-4 animate-in fade-in duration-200">
                    {/* Top Bar for Employee Calendar */}
                    <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={handleBackToList}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold cursor-pointer shadow-2xs"
                        >
                          <ArrowLeft className="h-3.5 w-3.5" />
                          Back to List
                        </button>
                        <div className="h-4 w-px bg-slate-200" />
                        <div className="flex items-center gap-2.5">
                          <div className="w-9 h-9 rounded-full bg-[#F8E6E6] text-[#6E1D1D] flex items-center justify-center font-bold text-xs border border-[#6E1D1D]/20 shrink-0">
                            {getInitials(selectedMonthlyRecord.employee?.fullName || selectedMonthlyRecord.employee?.name)}
                          </div>
                          <div>
                            <p className="text-sm font-bold text-slate-800">
                              {selectedMonthlyRecord.employee?.fullName || selectedMonthlyRecord.employee?.name}
                            </p>
                            <p className="text-xs text-slate-400">
                              {selectedMonthlyRecord.employee?.department || 'General'} ·{' '}
                              {selectedMonthlyRecord.employee?.employeeCode || ''}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-3">
                        {/* Calendar Range Filter */}
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-slate-600">Calendar Range:</span>
                          <div className="w-32">
                            <Dropdown
                              showArrow={false}
                              value={String(calendarRange)}
                              onChange={(val) => handleCalendarRangeChange(parseInt(val, 10))}
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

                        {/* Month Navigation */}
                        <div className="flex items-center gap-1 bg-slate-50 p-1 rounded-xl border border-slate-200">
                          <button
                            type="button"
                            onClick={handlePrevMonth}
                            className="p-1 text-slate-600 hover:text-[#6E1D1D] rounded-lg transition-colors cursor-pointer"
                            title="Previous Month"
                          >
                            <ChevronLeft className="h-4 w-4" />
                          </button>
                          <span className="text-xs font-bold text-slate-800 px-2 min-w-[95px] text-center">
                            {MONTH_NAMES[month - 1]} {year}
                          </span>
                          <button
                            type="button"
                            onClick={handleNextMonth}
                            className="p-1 text-slate-600 hover:text-[#6E1D1D] rounded-lg transition-colors cursor-pointer"
                            title="Next Month"
                          >
                            <ChevronRight className="h-4 w-4" />
                          </button>
                        </div>

                        {/* Export CSV Button for Single Employee */}
                        <button
                          type="button"
                          onClick={handleExport}
                          disabled={isExporting}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold cursor-pointer shadow-2xs disabled:opacity-50"
                        >
                          <Download className="h-3.5 w-3.5 text-[#6E1D1D]" />
                          <span>CSV</span>
                        </button>

                        {/* Print / PDF Button */}
                        <button
                          type="button"
                          onClick={handlePrint}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold cursor-pointer shadow-2xs"
                        >
                          <Printer className="h-3.5 w-3.5 text-[#6E1D1D]" />
                          <span>Print</span>
                        </button>
                      </div>
                    </div>

                    <AttendanceCalendar
                      employee={selectedMonthlyRecord.employee}
                      month={month}
                      year={year}
                      fromMonth={month}
                      fromYear={year}
                      toMonth={targetRange.toMonth}
                      toYear={targetRange.toYear}
                      calendarRange={calendarRange}
                      attendanceMap={selectedMonthlyRecord.attendance || {}}
                      detailsMap={selectedMonthlyRecord.details || {}}
                      onPrevMonth={handlePrevMonth}
                      onNextMonth={handleNextMonth}
                      onMonthChange={(m, y) => {
                        setMonth(m);
                        setYear(y);
                      }}
                      isLoading={isRangeLoading}
                    />
                  </div>
                ) : (
                  /* DEFAULT MONTHLY VIEW: Employee Register List Table */
                  <Card className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
                    <div className="p-4 border-b border-slate-100 flex items-center justify-between gap-3 bg-slate-50/50">
                      <span className="text-xs text-slate-600 font-semibold">
                        Showing {filteredMonthly.length} Employees
                      </span>
                      {searchEmployee && (
                        <button
                          type="button"
                          onClick={() => setSearchEmployee('')}
                          className="text-xs text-[#6E1D1D] hover:underline font-semibold cursor-pointer"
                        >
                          Clear search
                        </button>
                      )}
                    </div>

                    {monthly.isLoading ? (
                      <div className="flex h-64 items-center justify-center">
                        <Spinner />
                      </div>
                    ) : (
                      <div className="overflow-x-auto w-full">
                        <table className="w-full text-left text-sm whitespace-nowrap">
                          <thead className="bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-600 uppercase tracking-wider">
                            <tr>
                              <th className="px-5 py-3.5">Employee</th>
                              <th className="px-5 py-3.5">Employee Code</th>
                              <th className="px-5 py-3.5">Department</th>
                              <th className="px-5 py-3.5 text-center">Monthly Summary</th>
                              <th className="px-5 py-3.5 text-right">Action</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 text-xs">
                            {filteredMonthly.length === 0 ? (
                              <tr key="monthly-empty">
                                <td colSpan={5} className="px-6 py-12 text-center text-slate-400">
                                  No employee records found for this period.
                                </td>
                              </tr>
                            ) : (
                              filteredMonthly.map((row, index) => {
                                const emp = row.employee;
                                const employeeIdentifier = emp?.id || emp?._id || emp?.employeeCode || emp?.fullName || String(index);
                                const rowKey = `monthly-row-${employeeIdentifier}-${index}`;
                                const empName = emp?.fullName || emp?.name || 'Employee';
                                const empCode = emp?.employeeCode || '—';
                                const dept = emp?.department || 'General';

                                let p = 0;
                                let a = 0;
                                let l = 0;
                                let h = 0;
                                if (row.attendance) {
                                  Object.values(row.attendance).forEach((st) => {
                                    if (st === 'Present' || st === 'Late' || st === 'Break') p++;
                                    else if (st === 'Half-Day') { p += 0.5; h++; }
                                    else if (st === 'Absent') a++;
                                    else if (st === 'Leave') l++;
                                  });
                                }

                                return (
                                  <tr key={rowKey} className="hover:bg-slate-50/70 transition-colors group">
                                    <td className="px-5 py-3.5">
                                      <div className="flex items-center gap-2.5">
                                        <div className="w-8 h-8 rounded-full bg-[#F8E6E6] text-[#6E1D1D] flex items-center justify-center font-bold text-xs border border-[#6E1D1D]/20 shrink-0">
                                          {getInitials(empName)}
                                        </div>
                                        <div>
                                          <p className="font-semibold text-slate-900 group-hover:text-[#6E1D1D] transition-colors">
                                            {empName}
                                          </p>
                                          <p className="text-[10px] text-slate-400">
                                            {emp?.workEmail || ''}
                                          </p>
                                        </div>
                                      </div>
                                    </td>

                                    <td className="px-5 py-3.5 font-mono text-slate-600 font-medium">{empCode}</td>

                                    <td className="px-5 py-3.5">
                                      <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-slate-100 text-slate-700">
                                        {dept}
                                      </span>
                                    </td>

                                    <td className="px-5 py-3.5 text-center">
                                      <div className="flex items-center justify-center gap-2">
                                        <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-bold border border-emerald-200">
                                          {p} Present
                                        </span>
                                        <span className="px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 font-bold border border-rose-200">
                                          {a} Absent
                                        </span>
                                        {l > 0 && (
                                          <span className="px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 font-bold border border-blue-200">
                                            {l} Leave
                                          </span>
                                        )}
                                        {h > 0 && (
                                          <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 font-bold border border-amber-200">
                                            {h} Half-Day
                                          </span>
                                        )}
                                      </div>
                                    </td>

                                    <td className="px-5 py-3.5 text-right">
                                      <button
                                        type="button"
                                        onClick={() => handleViewCalendar(emp)}
                                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-[#6E1D1D]/30 bg-white text-[#6E1D1D] hover:bg-[#6E1D1D] hover:text-white transition-all text-xs font-semibold shadow-2xs cursor-pointer"
                                      >
                                        <Eye className="h-3.5 w-3.5" />
                                        VIEW CALENDAR
                                      </button>
                                    </td>
                                  </tr>
                                );
                              })
                            )}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </Card>
                )}
              </div>
            )}

            {/* ===================================================================== */}
            {/* REPORT 2: DAILY SUMMARY */}
            {/* ===================================================================== */}
            {activeReport === 'daily' && (
              <div className="space-y-4">
                {/* Header & Filter Bar */}
                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <h3 className="text-base font-bold text-slate-800">
                      DAILY SUMMARY — {formatBusinessDateDisplay(date)}
                    </h3>
                    <p className="text-xs text-slate-500">Live single-day snapshot of present, late, and absent employees</p>
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    <div className="w-40">
                      <Dropdown
                        showArrow={false}
                        value={department}
                        onChange={setDepartment}
                        options={[
                          { value: '', label: 'All Departments' },
                          ...DEPARTMENTS.map((dept) => ({ value: dept, label: dept })),
                        ]}
                        triggerClassName="h-9 px-3 text-xs font-semibold"
                      />
                    </div>

                    <div className="w-44">
                      <DatePicker
                        value={date}
                        onChange={setDate}
                        triggerClassName="h-9 px-3 text-xs font-medium"
                      />
                    </div>
                  </div>
                </div>

                {/* Summary Metrics */}
                {(() => {
                  const total = filteredDaily.length;
                  const present = filteredDaily.filter((r) => r.status === 'Present').length;
                  const lateCount = filteredDaily.filter((r) => r.status === 'Late').length;
                  const absent = filteredDaily.filter((r) => r.status === 'Absent').length;

                  return (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                      <Card className="p-4 bg-white border border-slate-200 rounded-xl shadow-xs">
                        <p className="text-xs font-medium text-slate-500">Total Employees</p>
                        <p className="text-xl font-bold text-slate-800 mt-1">{total}</p>
                      </Card>
                      <Card className="p-4 bg-emerald-50/50 border border-emerald-100 rounded-xl shadow-xs">
                        <p className="text-xs font-medium text-emerald-700">Present</p>
                        <p className="text-xl font-bold text-emerald-800 mt-1">
                          {present} {total > 0 ? `(${((present / total) * 100).toFixed(0)}%)` : ''}
                        </p>
                      </Card>
                      <Card className="p-4 bg-amber-50/50 border border-amber-100 rounded-xl shadow-xs">
                        <p className="text-xs font-medium text-amber-700">Late</p>
                        <p className="text-xl font-bold text-amber-800 mt-1">
                          {lateCount} {total > 0 ? `(${((lateCount / total) * 100).toFixed(0)}%)` : ''}
                        </p>
                      </Card>
                      <Card className="p-4 bg-rose-50/50 border border-rose-100 rounded-xl shadow-xs">
                        <p className="text-xs font-medium text-rose-700">Absent</p>
                        <p className="text-xl font-bold text-rose-800 mt-1">
                          {absent} {total > 0 ? `(${((absent / total) * 100).toFixed(0)}%)` : ''}
                        </p>
                      </Card>
                    </div>
                  );
                })()}

                {/* Daily Table */}
                <Card className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
                  {daily.isLoading ? (
                    <div className="flex h-64 items-center justify-center">
                      <Spinner />
                    </div>
                  ) : (
                    <div className="overflow-x-auto w-full">
                      <table className="w-full text-left text-sm whitespace-nowrap">
                        <thead className="bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-600 uppercase tracking-wider">
                          <tr>
                            <th className="px-5 py-3.5">Employee</th>
                            <th className="px-5 py-3.5">Code</th>
                            <th className="px-5 py-3.5">Department</th>
                            <th className="px-5 py-3.5">Status</th>
                            <th className="px-5 py-3.5">Check-in</th>
                            <th className="px-5 py-3.5">Check-out</th>
                            <th className="px-5 py-3.5">Hours</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-xs">
                          {filteredDaily.length === 0 ? (
                            <tr key="daily-empty">
                              <td colSpan={7} className="px-6 py-12 text-center text-slate-400">
                                No attendance recorded for this date.
                              </td>
                            </tr>
                          ) : (
                            filteredDaily.map((record, index) => {
                              const emp = typeof record.employeeId === 'object' ? (record.employeeId as EmployeeRef) : null;
                              const empName = emp?.fullName || emp?.name || 'Employee';
                              const empCode = emp?.employeeCode || '—';
                              const dept = emp?.department || 'General';
                              const workHours = record.actualHours ?? record.totalHours;
                              const recKey = `daily-row-${record.id || record._id || 'rec'}-${emp?.id || emp?._id || empCode || 'emp'}-${index}`;

                              return (
                                <tr key={recKey} className="hover:bg-slate-50/70 transition-colors">
                                  <td className="px-5 py-3.5 font-semibold text-slate-800">{empName}</td>
                                  <td className="px-5 py-3.5 font-mono text-slate-600">{empCode}</td>
                                  <td className="px-5 py-3.5 text-slate-600">{dept}</td>
                                  <td className="px-5 py-3.5">
                                    <span
                                      className={cx(
                                        'px-2.5 py-0.5 rounded-full text-[11px] font-bold',
                                        record.status === 'Present'
                                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                          : record.status === 'Late'
                                            ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                            : 'bg-rose-50 text-rose-700 border border-rose-200'
                                      )}
                                    >
                                      {record.status}
                                    </span>
                                  </td>
                                  <td className="px-5 py-3.5 font-mono text-slate-700">
                                    {formatBusinessTime(record.checkInTime)}
                                  </td>
                                  <td className="px-5 py-3.5 font-mono text-slate-700">
                                    {formatBusinessTime(record.checkOutTime)}
                                  </td>
                                  <td className="px-5 py-3.5 font-bold text-slate-800">
                                    {workHours ? formatDurationHM(workHours) : '—'}
                                  </td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>
                  )}
                </Card>
              </div>
            )}

            {/* ===================================================================== */}
            {/* REPORT 3: LATE ARRIVAL REPORT */}
            {/* ===================================================================== */}
            {activeReport === 'late' && (
              <div className="space-y-4">
                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <h3 className="text-base font-bold text-slate-800">
                      LATE ARRIVAL REPORT — {MONTH_NAMES[month - 1]} {year}
                    </h3>
                    <p className="text-xs text-slate-500">
                      Audit of employees arriving after grace period and arrival punctuality
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    <div className="w-36">
                      <Dropdown
                        showArrow={false}
                        value={department}
                        onChange={setDepartment}
                        options={[
                          { value: '', label: 'All Departments' },
                          ...DEPARTMENTS.map((dept) => ({ value: dept, label: dept })),
                        ]}
                        triggerClassName="h-9 px-3 text-xs font-semibold"
                      />
                    </div>

                    <div className="flex items-center gap-1 bg-slate-50 p-1 rounded-xl border border-slate-200">
                      <button
                        type="button"
                        onClick={handlePrevMonth}
                        className="p-1 text-slate-600 hover:text-[#6E1D1D] rounded-lg transition-colors cursor-pointer"
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </button>
                      <span className="text-xs font-bold text-slate-800 px-2 min-w-[95px] text-center">
                        {MONTH_NAMES[month - 1]} {year}
                      </span>
                      <button
                        type="button"
                        onClick={handleNextMonth}
                        className="p-1 text-slate-600 hover:text-[#6E1D1D] rounded-lg transition-colors cursor-pointer"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Late Summary Aggregation */}
                {(() => {
                  const lateByEmp = new Map<string, { employee: EmployeeRef; count: number; lastDate: string }>();
                  filteredLate.forEach((r) => {
                    const emp = typeof r.employeeId === 'object' ? (r.employeeId as EmployeeRef) : { id: String(r.employeeId) };
                    const id = emp?._id || emp?.id || emp?.fullName || 'unknown';
                    const existing = lateByEmp.get(id);
                    if (existing) {
                      existing.count++;
                      if (toBusinessDateString(r.date) > toBusinessDateString(existing.lastDate)) {
                        existing.lastDate = r.date;
                      }
                    } else {
                      lateByEmp.set(id, {
                        employee: emp,
                        count: 1,
                        lastDate: r.date,
                      });
                    }
                  });

                  const lateList = Array.from(lateByEmp.values());

                  return (
                    <>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                        <Card className="p-4 bg-white border border-slate-200 rounded-xl shadow-xs">
                          <p className="text-xs font-medium text-slate-500">Total Late Arrivals</p>
                          <p className="text-xl font-bold text-slate-800 mt-1">{filteredLate.length}</p>
                        </Card>
                        <Card className="p-4 bg-amber-50/50 border border-amber-100 rounded-xl shadow-xs">
                          <p className="text-xs font-medium text-amber-700">Employees Affected</p>
                          <p className="text-xl font-bold text-amber-800 mt-1">{lateList.length}</p>
                        </Card>
                        <Card className="p-4 bg-slate-50 border border-slate-200 rounded-xl shadow-xs">
                          <p className="text-xs font-medium text-slate-600">Threshold</p>
                          <p className="text-xl font-bold text-slate-800 mt-1">&gt; 15 min</p>
                        </Card>
                      </div>

                      <Card className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
                        {late.isLoading ? (
                          <div className="flex h-64 items-center justify-center">
                            <Spinner />
                          </div>
                        ) : (
                          <div className="overflow-x-auto w-full">
                            <table className="w-full text-left text-sm whitespace-nowrap">
                              <thead className="bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-600 uppercase tracking-wider">
                                <tr>
                                  <th className="px-5 py-3.5">Employee</th>
                                  <th className="px-5 py-3.5">Code</th>
                                  <th className="px-5 py-3.5">Department</th>
                                  <th className="px-5 py-3.5 text-center">Late Count</th>
                                  <th className="px-5 py-3.5">Last Late Incident</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100 text-xs">
                                {lateList.length === 0 ? (
                                  <tr key="late-empty">
                                    <td colSpan={5} className="px-6 py-12 text-center text-slate-400">
                                      No late arrival incidents recorded for this month.
                                    </td>
                                  </tr>
                                ) : (
                                  lateList.map((item, idx) => {
                                    const lateKey = `late-row-${item.employee?.id || item.employee?._id || item.employee?.employeeCode || 'emp'}-${idx}`;
                                    return (
                                      <tr key={lateKey} className="hover:bg-slate-50/70 transition-colors">
                                        <td className="px-5 py-3.5 font-semibold text-slate-800">
                                          {item.employee?.fullName || item.employee?.name || 'Employee'}
                                        </td>
                                        <td className="px-5 py-3.5 font-mono text-slate-600">
                                          {item.employee?.employeeCode || '—'}
                                        </td>
                                        <td className="px-5 py-3.5 text-slate-600">
                                          {item.employee?.department || 'General'}
                                        </td>
                                        <td className="px-5 py-3.5 text-center">
                                          <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-50 text-amber-700 border border-amber-200">
                                            {item.count} Late
                                          </span>
                                        </td>
                                        <td className="px-5 py-3.5 text-slate-700">
                                          {formatBusinessDateDMY(item.lastDate)}
                                        </td>
                                      </tr>
                                    );
                                  })
                                )}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </Card>
                    </>
                  );
                })()}
              </div>
            )}

            {/* ===================================================================== */}
            {/* REPORT 4: ABSENCE REPORT */}
            {/* ===================================================================== */}
            {activeReport === 'absence' && (
              <div className="space-y-4">
                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <h3 className="text-base font-bold text-slate-800">
                      ABSENCE REPORT — {MONTH_NAMES[month - 1]} {year}
                    </h3>
                    <p className="text-xs text-slate-500">Unexcused absence records and non-attendance tracking</p>
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    <div className="w-36">
                      <Dropdown
                        showArrow={false}
                        value={department}
                        onChange={setDepartment}
                        options={[
                          { value: '', label: 'All Departments' },
                          ...DEPARTMENTS.map((dept) => ({ value: dept, label: dept })),
                        ]}
                        triggerClassName="h-9 px-3 text-xs font-semibold"
                      />
                    </div>

                    <div className="flex items-center gap-1 bg-slate-50 p-1 rounded-xl border border-slate-200">
                      <button
                        type="button"
                        onClick={handlePrevMonth}
                        className="p-1 text-slate-600 hover:text-[#6E1D1D] rounded-lg transition-colors cursor-pointer"
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </button>
                      <span className="text-xs font-bold text-slate-800 px-2 min-w-[95px] text-center">
                        {MONTH_NAMES[month - 1]} {year}
                      </span>
                      <button
                        type="button"
                        onClick={handleNextMonth}
                        className="p-1 text-slate-600 hover:text-[#6E1D1D] rounded-lg transition-colors cursor-pointer"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Absence Summary Aggregation */}
                {(() => {
                  const absByEmp = new Map<string, { employee: EmployeeRef; count: number; lastDate: string }>();
                  filteredAbsence.forEach((r) => {
                    const emp = r.employee;
                    const id = emp?._id || emp?.id || emp?.fullName || 'unknown';
                    const existing = absByEmp.get(id);
                    if (existing) {
                      existing.count++;
                      if (toBusinessDateString(r.date) > toBusinessDateString(existing.lastDate)) {
                        existing.lastDate = r.date;
                      }
                    } else {
                      absByEmp.set(id, {
                        employee: emp,
                        count: 1,
                        lastDate: r.date,
                      });
                    }
                  });

                  const absList = Array.from(absByEmp.values());

                  return (
                    <>
                      <div className="grid grid-cols-2 gap-4">
                        <Card className="p-4 bg-white border border-slate-200 rounded-xl shadow-xs">
                          <p className="text-xs font-medium text-slate-500">Total Absences</p>
                          <p className="text-xl font-bold text-slate-800 mt-1">{filteredAbsence.length}</p>
                        </Card>
                        <Card className="p-4 bg-rose-50/50 border border-rose-100 rounded-xl shadow-xs">
                          <p className="text-xs font-medium text-rose-700">Employees Absent</p>
                          <p className="text-xl font-bold text-rose-800 mt-1">{absList.length}</p>
                        </Card>
                      </div>

                      <Card className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
                        {absence.isLoading ? (
                          <div className="flex h-64 items-center justify-center">
                            <Spinner />
                          </div>
                        ) : (
                          <div className="overflow-x-auto w-full">
                            <table className="w-full text-left text-sm whitespace-nowrap">
                              <thead className="bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-600 uppercase tracking-wider">
                                <tr>
                                  <th className="px-5 py-3.5">Employee</th>
                                  <th className="px-5 py-3.5">Code</th>
                                  <th className="px-5 py-3.5">Department</th>
                                  <th className="px-5 py-3.5 text-center">Absence Count</th>
                                  <th className="px-5 py-3.5">Last Absence Date</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100 text-xs">
                                {absList.length === 0 ? (
                                  <tr key="abs-empty">
                                    <td colSpan={5} className="px-6 py-12 text-center text-slate-400">
                                      No absences recorded for this month.
                                    </td>
                                  </tr>
                                ) : (
                                  absList.map((item, idx) => {
                                    const absKey = `abs-row-${item.employee?.id || item.employee?._id || item.employee?.employeeCode || 'emp'}-${idx}`;
                                    return (
                                      <tr key={absKey} className="hover:bg-slate-50/70 transition-colors">
                                        <td className="px-5 py-3.5 font-semibold text-slate-800">
                                          {item.employee?.fullName || item.employee?.name || 'Employee'}
                                        </td>
                                        <td className="px-5 py-3.5 font-mono text-slate-600">
                                          {item.employee?.employeeCode || '—'}
                                        </td>
                                        <td className="px-5 py-3.5 text-slate-600">
                                          {item.employee?.department || 'General'}
                                        </td>
                                        <td className="px-5 py-3.5 text-center">
                                          <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200">
                                            {item.count} Absent
                                          </span>
                                        </td>
                                        <td className="px-5 py-3.5 text-slate-700">
                                          {formatBusinessDateDMY(item.lastDate)}
                                        </td>
                                      </tr>
                                    );
                                  })
                                )}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </Card>
                    </>
                  );
                })()}
              </div>
            )}

            {/* ===================================================================== */}
            {/* REPORT 5: OVERTIME REPORT */}
            {/* ===================================================================== */}
            {activeReport === 'overtime' && (
              <div className="space-y-4">
                <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <h3 className="text-base font-bold text-slate-800">
                      OVERTIME REPORT — {MONTH_NAMES[month - 1]} {year}
                    </h3>
                    <p className="text-xs text-slate-500">
                      Audit of extra work hours beyond standard daily 8-hour requirement
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-3">
                    <div className="w-36">
                      <Dropdown
                        showArrow={false}
                        value={department}
                        onChange={setDepartment}
                        options={[
                          { value: '', label: 'All Departments' },
                          ...DEPARTMENTS.map((dept) => ({ value: dept, label: dept })),
                        ]}
                        triggerClassName="h-9 px-3 text-xs font-semibold"
                      />
                    </div>

                    <div className="flex items-center gap-1 bg-slate-50 p-1 rounded-xl border border-slate-200">
                      <button
                        type="button"
                        onClick={handlePrevMonth}
                        className="p-1 text-slate-600 hover:text-[#6E1D1D] rounded-lg transition-colors cursor-pointer"
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </button>
                      <span className="text-xs font-bold text-slate-800 px-2 min-w-[95px] text-center">
                        {MONTH_NAMES[month - 1]} {year}
                      </span>
                      <button
                        type="button"
                        onClick={handleNextMonth}
                        className="p-1 text-slate-600 hover:text-[#6E1D1D] rounded-lg transition-colors cursor-pointer"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Overtime Summary Cards */}
                {(() => {
                  const totalOtHours = filteredOvertime.reduce((acc, r) => acc + (r.totalOvertimeHours || 0), 0);
                  const employeesWithOt = filteredOvertime.length;

                  return (
                    <>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                        <Card className="p-4 bg-white border border-slate-200 rounded-xl shadow-xs">
                          <p className="text-xs font-medium text-slate-500">Total Overtime Hours</p>
                          <p className="text-xl font-bold text-emerald-700 mt-1">
                            +{formatHoursToHM(totalOtHours)}
                          </p>
                        </Card>
                        <Card className="p-4 bg-emerald-50/50 border border-emerald-100 rounded-xl shadow-xs">
                          <p className="text-xs font-medium text-emerald-700">Employees with OT</p>
                          <p className="text-xl font-bold text-slate-800 mt-1">{employeesWithOt}</p>
                        </Card>
                        <Card className="p-4 bg-slate-50 border border-slate-200 rounded-xl shadow-xs">
                          <p className="text-xs font-medium text-slate-600">Standard Daily Work</p>
                          <p className="text-xl font-bold text-slate-800 mt-1">8h 00m</p>
                        </Card>
                      </div>

                      <Card className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
                        {overtime.isLoading ? (
                          <div className="flex h-64 items-center justify-center">
                            <Spinner />
                          </div>
                        ) : (
                          <div className="overflow-x-auto w-full">
                            <table className="w-full text-left text-sm whitespace-nowrap">
                              <thead className="bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-600 uppercase tracking-wider">
                                <tr>
                                  <th className="px-5 py-3.5">Employee</th>
                                  <th className="px-5 py-3.5">Code</th>
                                  <th className="px-5 py-3.5">Department</th>
                                  <th className="px-5 py-3.5 text-center">Days with OT</th>
                                  <th className="px-5 py-3.5 text-center">Total OT Hours</th>
                                  <th className="px-5 py-3.5 text-right">Avg OT / Day</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100 text-xs">
                                {filteredOvertime.length === 0 ? (
                                  <tr key="ot-empty">
                                    <td colSpan={6} className="px-6 py-12 text-center text-slate-400">
                                      No overtime logged for this month.
                                    </td>
                                  </tr>
                                ) : (
                                  filteredOvertime.map((item, idx) => {
                                    const otKey = `ot-row-${item.employee?.id || item.employee?._id || item.employee?.employeeCode || 'emp'}-${idx}`;
                                    return (
                                      <tr key={otKey} className="hover:bg-slate-50/70 transition-colors">
                                        <td className="px-5 py-3.5 font-semibold text-slate-800">
                                          {item.employee?.fullName || item.employee?.name || 'Employee'}
                                        </td>
                                        <td className="px-5 py-3.5 font-mono text-slate-600">
                                          {item.employee?.employeeCode || '—'}
                                        </td>
                                        <td className="px-5 py-3.5 text-slate-600">
                                          {item.employee?.department || 'General'}
                                        </td>
                                        <td className="px-5 py-3.5 text-center font-bold text-slate-700">
                                          {item.daysCount} days
                                        </td>
                                        <td className="px-5 py-3.5 text-center">
                                          <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                            +{formatHoursToHM(item.totalOvertimeHours)}
                                          </span>
                                        </td>
                                        <td className="px-5 py-3.5 text-right font-semibold text-slate-700">
                                          {item.avgMinutesPerDay} min
                                        </td>
                                      </tr>
                                    );
                                  })
                                )}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </Card>
                    </>
                  );
                })()}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
