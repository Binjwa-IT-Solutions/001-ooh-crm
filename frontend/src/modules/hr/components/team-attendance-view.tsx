'use client';

import { useState, useMemo } from 'react';
import {
  Search,
  Filter,
  Download,
  Printer,
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Eye,
  X,
  MapPin,
  Clock,
  RotateCw,
  CheckCircle2,
  AlertTriangle,
  XCircle,
} from 'lucide-react';
import { Card, Spinner, DatePicker, Dropdown, cx } from '@/shared/ui';
import { useTeamAttendance } from '@/modules/hr/hooks/use-attendance';
import { useEmployeeList } from '@/modules/employees/hooks/use-employees';
import { DEPARTMENTS } from '@/modules/employees/types';
import { formatHoursToHM } from '@/shared/utils/formatters';
import { reportsApi } from '../api';

const SHIFT_OPTIONS = [
  { value: '', label: 'All Shifts' },
  { value: 'Morning', label: 'Morning (8:00 AM - 5:00 PM)' },
  { value: 'Evening', label: 'Evening (1:00 PM - 10:00 PM)' },
  { value: 'Night', label: 'Night (10:00 PM - 8:00 AM)' },
  { value: 'General', label: 'General Shift' },
];

const STATUS_OPTIONS = [
  { value: '', label: 'All Statuses' },
  { value: 'Present', label: 'Present' },
  { value: 'Late', label: 'Late (> 15 min)' },
  { value: 'Absent', label: 'Absent' },
  { value: 'Half-Day', label: 'Half-Day' },
  { value: 'Leave', label: 'Leave' },
  { value: 'On-duty', label: 'On-duty' },
];

export function TeamAttendanceView() {
  // Step 1: Department filter
  const [department, setDepartment] = useState<string>('');

  // Step 2: Date / Month Filter
  const todayIso = useMemo(() => new Date().toISOString().split('T')[0], []);
  const [dateMode, setDateMode] = useState<'single' | 'range'>('single');
  const [singleDate, setSingleDate] = useState<string>(todayIso);
  const [fromDate, setFromDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(1); // 1st of current month
    return d.toISOString().split('T')[0];
  });
  const [toDate, setToDate] = useState<string>(todayIso);

  // Step 3: Search query
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Step 4: Additional filters
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [shiftFilter, setShiftFilter] = useState<string>('');

  // Pagination & Sorting
  const [page, setPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);
  const [sortField, setSortField] = useState<'name' | 'date' | 'status' | 'checkIn'>('name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  // Modal State
  const [detailModalItem, setDetailModalItem] = useState<any | null>(null);

  // Fetch all employees to get accurate counts and complement single-day view
  const { data: employeeData } = useEmployeeList({ pageSize: 1000 });
  const allEmployees: any[] = employeeData?.employees || [];

  // Build query for team attendance hook
  const attendanceQuery = useMemo(() => {
    if (dateMode === 'single') {
      return { date: singleDate };
    }
    return { fromDate, toDate };
  }, [dateMode, singleDate, fromDate, toDate]);

  const { data: attendanceRecords, isLoading } = useTeamAttendance(attendanceQuery);

  // Calculate department employee counts
  const departmentCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    allEmployees.forEach((emp: any) => {
      const dept = emp.department || 'Other';
      counts[dept] = (counts[dept] || 0) + 1;
    });
    return counts;
  }, [allEmployees]);

  // Combine attendance with all active employees if single day mode
  const unifiedRecords = useMemo(() => {
    if (!attendanceRecords && isLoading) return [];

    // Map existing punch records
    const punchMap = new Map<string, any>();
    (attendanceRecords || []).forEach((r: any) => {
      const emp = r.employeeId as any;
      const empId = emp?._id || emp?.id || r.employeeId?.toString();
      if (empId) {
        punchMap.set(String(empId), r);
      }
    });

    if (dateMode === 'single') {
      // In single day mode, show every active employee with their record or Absent
      return allEmployees.map((emp: any) => {
        const punch = punchMap.get(String(emp.id || emp._id));
        if (punch) {
          return {
            id: punch.id || punch._id,
            employee: emp,
            date: punch.date,
            status: punch.status || 'Present',
            shift: punch.shiftDetails?.name || 'Morning',
            checkInTime: punch.checkInTime,
            checkOutTime: punch.checkOutTime,
            checkInGps: punch.checkInGps,
            checkOutGps: punch.checkOutGps,
            totalHours: punch.totalHours,
            actualHours: punch.actualHours,
            overtimeHours: punch.overtimeHours,
            totalBreakMinutes: punch.totalBreakMinutes,
            workType: punch.workType || 'Office',
            notes: punch.deviceInfo || 'None',
          };
        }

        const isSunday = new Date(singleDate).getDay() === 0;
        return {
          id: `absent-${emp.id || emp._id}`,
          employee: emp,
          date: singleDate,
          status: isSunday ? 'Off' : 'Absent',
          shift: 'Morning',
          checkInTime: null,
          checkOutTime: null,
          checkInGps: null,
          checkOutGps: null,
          totalHours: 0,
          actualHours: 0,
          overtimeHours: 0,
          totalBreakMinutes: 0,
          workType: 'Office',
          notes: 'No punch recorded',
        };
      });
    }

    // In date range mode, show all actual punch records
    return (attendanceRecords || []).map((r) => {
      const emp = (r.employeeId as any) || {};
      return {
        id: r.id || r._id,
        employee: emp,
        date: r.date,
        status: r.status,
        shift: r.shiftDetails?.name || 'Morning',
        checkInTime: r.checkInTime,
        checkOutTime: r.checkOutTime,
        checkInGps: r.checkInGps,
        checkOutGps: r.checkOutGps,
        totalHours: r.totalHours,
        actualHours: r.actualHours,
        overtimeHours: r.overtimeHours,
        totalBreakMinutes: r.totalBreakMinutes,
        workType: r.workType || 'Office',
        notes: r.deviceInfo || 'None',
      };
    });
  }, [attendanceRecords, allEmployees, dateMode, singleDate, isLoading]);

  // Apply Department, Status, Shift, and Search Filters
  const filteredRecords = useMemo(() => {
    return unifiedRecords.filter((item: any) => {
      // Department
      if (department) {
        const empDept = item.employee?.department || '';
        if (empDept !== department) return false;
      }

      // Status
      if (statusFilter) {
        if (item.status !== statusFilter) return false;
      }

      // Shift
      if (shiftFilter) {
        if (!item.shift?.toLowerCase().includes(shiftFilter.toLowerCase())) return false;
      }

      // Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const name = (item.employee?.fullName || item.employee?.name || '').toLowerCase();
        const code = (item.employee?.employeeCode || '').toLowerCase();
        const email = (
          item.employee?.workEmail ||
          item.employee?.email ||
          item.employee?.personalEmail ||
          ''
        ).toLowerCase();
        if (!name.includes(q) && !code.includes(q) && !email.includes(q)) return false;
      }

      return true;
    });
  }, [unifiedRecords, department, statusFilter, shiftFilter, searchQuery]);

  // Calculate Metrics Summary
  const summaryMetrics = useMemo(() => {
    const total = filteredRecords.length;
    let present = 0;
    let late = 0;
    let absent = 0;
    let halfDay = 0;
    let leave = 0;
    let onDuty = 0;

    filteredRecords.forEach((r: any) => {
      if (r.status === 'Present') present++;
      else if (r.status === 'Late') {
        present++;
        late++;
      } else if (r.status === 'Half-Day') halfDay++;
      else if (r.status === 'Leave') leave++;
      else if (r.status === 'On-duty') {
        present++;
        onDuty++;
      } else if (r.status === 'Absent') absent++;
    });

    const attendanceRate = total > 0 ? ((present + halfDay * 0.5) / total) * 100 : 0;
    const punctuality = present > 0 ? (((present - late) / present) * 100) : 100;

    return {
      total,
      present,
      late,
      absent,
      halfDay,
      leave,
      onDuty,
      attendanceRate: attendanceRate.toFixed(1),
      punctuality: Math.max(0, Math.min(100, Math.round(punctuality))),
    };
  }, [filteredRecords]);

  // Sort & Paginate records
  const sortedRecords = useMemo(() => {
    return [...filteredRecords].sort((a, b) => {
      let comparison = 0;
      if (sortField === 'name') {
        const nameA = a.employee?.fullName || a.employee?.name || '';
        const nameB = b.employee?.fullName || b.employee?.name || '';
        comparison = nameA.localeCompare(nameB);
      } else if (sortField === 'date') {
        comparison = new Date(b.date).getTime() - new Date(a.date).getTime();
      } else if (sortField === 'status') {
        comparison = a.status.localeCompare(b.status);
      } else if (sortField === 'checkIn') {
        const timeA = a.checkInTime ? new Date(a.checkInTime).getTime() : 0;
        const timeB = b.checkInTime ? new Date(b.checkInTime).getTime() : 0;
        comparison = timeA - timeB;
      }
      return sortDir === 'asc' ? comparison : -comparison;
    });
  }, [filteredRecords, sortField, sortDir]);

  const totalPages = Math.ceil(sortedRecords.length / pageSize) || 1;
  const paginatedRecords = useMemo(() => {
    const startIndex = (page - 1) * pageSize;
    return sortedRecords.slice(startIndex, startIndex + pageSize);
  }, [sortedRecords, page, pageSize]);

  // Export CSV handler
  const handleExportCsv = () => {
    const headers = [
      'Employee Code',
      'Employee Name',
      'Department',
      'Date',
      'Shift',
      'Check-in',
      'Check-out',
      'Working Hours',
      'Overtime',
      'Status',
    ];

    const rows = filteredRecords.map((r: any) => [
      r.employee?.employeeCode || '',
      r.employee?.fullName || r.employee?.name || '',
      r.employee?.department || '',
      new Date(r.date).toLocaleDateString(),
      r.shift || '',
      r.checkInTime ? new Date(r.checkInTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—',
      r.checkOutTime ? new Date(r.checkOutTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—',
      r.actualHours ? formatHoursToHM(r.actualHours) : r.totalHours ? formatHoursToHM(r.totalHours) : '0h',
      r.overtimeHours ? formatHoursToHM(r.overtimeHours) : '0h',
      r.status,
    ]);

    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((row: any[]) => row.map((cell: any) => `"${String(cell).replace(/"/g, '""')}"`).join(','))].join(
        '\n'
      );

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `attendance_metrics_${singleDate || todayIso}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Print/PDF Handler
  const handlePrint = () => {
    window.print();
  };

  const handleClearFilters = () => {
    setDepartment('');
    setStatusFilter('');
    setShiftFilter('');
    setSearchQuery('');
    setSingleDate(todayIso);
    setPage(1);
  };

  const getInitials = (name?: string) => {
    if (!name) return 'EM';
    const p = name.trim().split(/\s+/);
    return (p[0][0] + (p[1] ? p[1][0] : '')).toUpperCase();
  };

  return (
    <div className="space-y-6">
      {/* Page Title & Export Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800 tracking-tight">Attendance Metrics</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Daily Punches & Live Monitoring · Track active attendance, punch times, and shift performance
          </p>
        </div>

        <div className="flex items-center gap-2">
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
            onClick={handlePrint}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-xl shadow-xs transition-colors cursor-pointer"
          >
            <Printer className="h-3.5 w-3.5 text-[#6E1D1D]" />
            Print / PDF
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* STEP-BY-STEP FILTER PANEL */}
      {/* ========================================================================= */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
        {/* Row 1: Step 1 (Department) + Step 2 (Date / Range) */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
          {/* Step 1: Select Department (Shows Employee Count per Dept) */}
          <div className="md:col-span-4 space-y-1.5">
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <Filter className="h-3.5 w-3.5 text-[#6E1D1D]" />
              Step 1: Department
            </label>
            <Dropdown
              showArrow={false}
              value={department}
              onChange={(val) => {
                setDepartment(val);
                setPage(1);
              }}
              options={[
                { value: '', label: `All Departments (${allEmployees.length})` },
                ...DEPARTMENTS.map((dept) => ({
                  value: dept,
                  label: `${dept} (${departmentCounts[dept] || 0})`,
                })),
              ]}
              triggerClassName="h-10 px-3 text-xs font-medium w-full"
            />
          </div>

          {/* Step 2: Select Date/Month Calendar Widget */}
          <div className="md:col-span-5 space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <CalendarIcon className="h-3.5 w-3.5 text-[#6E1D1D]" />
                Step 2: Date / Month
              </label>

              {/* Mode Toggle: Single Day vs Date Range Mode */}
              <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg text-[10px] font-semibold">
                <button
                  type="button"
                  onClick={() => setDateMode('single')}
                  className={cx(
                    'px-2 py-0.5 rounded transition-all cursor-pointer',
                    dateMode === 'single' ? 'bg-white text-[#6E1D1D] shadow-xs' : 'text-slate-500'
                  )}
                >
                  Single Day
                </button>
                <button
                  type="button"
                  onClick={() => setDateMode('range')}
                  className={cx(
                    'px-2 py-0.5 rounded transition-all cursor-pointer',
                    dateMode === 'range' ? 'bg-white text-[#6E1D1D] shadow-xs' : 'text-slate-500'
                  )}
                >
                  Date Range Mode
                </button>
              </div>
            </div>

            {dateMode === 'single' ? (
              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <DatePicker
                    value={singleDate}
                    onChange={(val) => {
                      setSingleDate(val);
                      setPage(1);
                    }}
                    triggerClassName="h-10 px-3 text-xs font-medium w-full"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setSingleDate(todayIso)}
                  className="h-10 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl transition-colors cursor-pointer shrink-0"
                >
                  Today
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <div className="flex-1">
                  <DatePicker
                    value={fromDate}
                    onChange={(val) => {
                      setFromDate(val);
                      setPage(1);
                    }}
                    triggerClassName="h-10 px-2.5 text-xs font-medium w-full"
                  />
                </div>
                <span className="text-slate-400 text-xs">to</span>
                <div className="flex-1">
                  <DatePicker
                    value={toDate}
                    onChange={(val) => {
                      setToDate(val);
                      setPage(1);
                    }}
                    triggerClassName="h-10 px-2.5 text-xs font-medium w-full"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Step 3: Search Employee */}
          <div className="md:col-span-3 space-y-1.5">
            <label className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <Search className="h-3.5 w-3.5 text-[#6E1D1D]" />
              Step 3: Search
            </label>
            <div className="relative">
              <input
                type="text"
                placeholder="Search employee, email, or code..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setPage(1);
                }}
                className="w-full h-10 pl-3 pr-8 rounded-xl border border-slate-200 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#6E1D1D]/20 focus:border-[#6E1D1D]"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-3 text-slate-400 hover:text-slate-600"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Row 2: Step 4 (Additional Filters: Status & Shift & Clear) */}
        <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-medium text-slate-500">Status Filter:</span>
              <Dropdown
                showArrow={false}
                value={statusFilter}
                onChange={(val) => {
                  setStatusFilter(val);
                  setPage(1);
                }}
                options={STATUS_OPTIONS}
                triggerClassName="h-8 px-2.5 text-xs font-semibold min-w-[120px]"
              />
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-xs font-medium text-slate-500">Shift Filter:</span>
              <Dropdown
                showArrow={false}
                value={shiftFilter}
                onChange={(val) => {
                  setShiftFilter(val);
                  setPage(1);
                }}
                options={SHIFT_OPTIONS}
                triggerClassName="h-8 px-2.5 text-xs font-semibold min-w-[150px]"
              />
            </div>
          </div>

          {(department || statusFilter || shiftFilter || searchQuery) && (
            <button
              type="button"
              onClick={handleClearFilters}
              className="flex items-center gap-1.5 text-xs text-rose-600 hover:text-rose-800 font-semibold cursor-pointer"
            >
              <RotateCw className="h-3.5 w-3.5" />
              Clear Filters
            </button>
          )}
        </div>
      </div>

      {/* ========================================================================= */}
      {/* ATTENDANCE SUMMARY BANNER (OCTOBER 2026 ATTENDANCE SUMMARY) */}
      {/* ========================================================================= */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 rounded-2xl p-5 text-white shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-white/10 pb-3">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
            <h3 className="text-xs font-bold uppercase tracking-widest text-slate-300">
              {dateMode === 'single'
                ? `${new Date(singleDate).toLocaleDateString('default', { month: 'long', year: 'numeric', day: 'numeric' })} Attendance Summary`
                : `${fromDate} to ${toDate} Attendance Summary`}
            </h3>
          </div>
          <div className="flex items-center gap-4 text-xs font-semibold">
            <span className="text-emerald-400">
              Attendance Rate: <span className="font-bold text-white">{summaryMetrics.attendanceRate}%</span>
            </span>
            <span className="text-blue-400">
              Punctuality: <span className="font-bold text-white">{summaryMetrics.punctuality}%</span>
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3 text-center">
          <div className="bg-white/5 p-3 rounded-xl border border-white/5">
            <p className="text-[11px] text-slate-400 font-medium">Total Employees</p>
            <p className="text-lg font-bold text-white mt-0.5">{summaryMetrics.total}</p>
          </div>

          <div className="bg-emerald-500/10 p-3 rounded-xl border border-emerald-500/20">
            <p className="text-[11px] text-emerald-400 font-medium">Present</p>
            <p className="text-lg font-bold text-emerald-300 mt-0.5">{summaryMetrics.present}</p>
          </div>

          <div className="bg-rose-500/10 p-3 rounded-xl border border-rose-500/20">
            <p className="text-[11px] text-rose-400 font-medium">Absent</p>
            <p className="text-lg font-bold text-rose-300 mt-0.5">{summaryMetrics.absent}</p>
          </div>

          <div className="bg-amber-500/10 p-3 rounded-xl border border-amber-500/20">
            <p className="text-[11px] text-amber-400 font-medium">Late</p>
            <p className="text-lg font-bold text-amber-300 mt-0.5">{summaryMetrics.late}</p>
          </div>

          <div className="bg-orange-500/10 p-3 rounded-xl border border-orange-500/20">
            <p className="text-[11px] text-orange-400 font-medium">Half-day</p>
            <p className="text-lg font-bold text-orange-300 mt-0.5">{summaryMetrics.halfDay}</p>
          </div>

          <div className="bg-blue-500/10 p-3 rounded-xl border border-blue-500/20">
            <p className="text-[11px] text-blue-400 font-medium">Leave</p>
            <p className="text-lg font-bold text-blue-300 mt-0.5">{summaryMetrics.leave}</p>
          </div>

          <div className="bg-indigo-500/10 p-3 rounded-xl border border-indigo-500/20">
            <p className="text-[11px] text-indigo-400 font-medium">On-duty</p>
            <p className="text-lg font-bold text-indigo-300 mt-0.5">{summaryMetrics.onDuty}</p>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* ATTENDANCE DATA TABLE */}
      {/* ========================================================================= */}
      <Card className="overflow-hidden border border-slate-200 rounded-2xl shadow-xs bg-white">
        <div className="p-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-slate-800">Attendance Data</h3>
            <span className="px-2 py-0.5 text-[11px] font-bold bg-[#F8E6E6] text-[#6E1D1D] rounded-full">
              {filteredRecords.length} records
            </span>
          </div>

          {/* Page size dropdown */}
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span>Page size:</span>
            <Dropdown
              showArrow={false}
              value={String(pageSize)}
              onChange={(val) => {
                setPageSize(Number(val));
                setPage(1);
              }}
              options={[
                { value: '10', label: '10' },
                { value: '25', label: '25' },
                { value: '50', label: '50' },
                { value: '100', label: '100' },
              ]}
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
              <thead className="bg-slate-50 border-b border-slate-200 text-xs font-bold text-slate-600 uppercase tracking-wider">
                <tr>
                  <th
                    className="px-5 py-3.5 cursor-pointer hover:text-slate-900"
                    onClick={() => {
                      if (sortField === 'name') setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
                      else {
                        setSortField('name');
                        setSortDir('asc');
                      }
                    }}
                  >
                    Employee {sortField === 'name' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
                  </th>
                  <th className="px-5 py-3.5">Code</th>
                  <th className="px-5 py-3.5">Dept</th>
                  <th
                    className="px-5 py-3.5 cursor-pointer hover:text-slate-900"
                    onClick={() => {
                      if (sortField === 'date') setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
                      else {
                        setSortField('date');
                        setSortDir('asc');
                      }
                    }}
                  >
                    Date {sortField === 'date' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
                  </th>
                  <th className="px-5 py-3.5">Shift</th>
                  <th
                    className="px-5 py-3.5 cursor-pointer hover:text-slate-900"
                    onClick={() => {
                      if (sortField === 'checkIn') setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
                      else {
                        setSortField('checkIn');
                        setSortDir('asc');
                      }
                    }}
                  >
                    Check-in {sortField === 'checkIn' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
                  </th>
                  <th className="px-5 py-3.5">Check-out</th>
                  <th className="px-5 py-3.5">Hours</th>
                  <th
                    className="px-5 py-3.5 cursor-pointer hover:text-slate-900"
                    onClick={() => {
                      if (sortField === 'status') setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
                      else {
                        setSortField('status');
                        setSortDir('asc');
                      }
                    }}
                  >
                    Status {sortField === 'status' ? (sortDir === 'asc' ? '↑' : '↓') : ''}
                  </th>
                  <th className="px-5 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {paginatedRecords.map((record, index) => {
                  const empName = record.employee?.fullName || record.employee?.name || 'Employee';
                  const empCode = record.employee?.employeeCode || '—';
                  const dept = record.employee?.department || 'General';
                  const workHours = record.actualHours ?? record.totalHours;
                  const rowKey = `team-rec-${record.id || (record as any)?._id || 'rec'}-${record.employee?.id || (record.employee as any)?._id || empCode}-${index}`;

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
                            <p className="text-[10px] text-slate-400 font-normal">
                              {record.employee?.workEmail || record.employee?.email || ''}
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

                      <td className="px-5 py-3.5 text-slate-700">
                        {new Date(record.date).toLocaleDateString('en-GB', {
                          day: '2-digit',
                          month: 'short',
                        })}
                      </td>

                      <td className="px-5 py-3.5 text-slate-600 font-medium">{record.shift}</td>

                      <td className="px-5 py-3.5 font-mono text-slate-700">
                        {record.checkInTime ? (
                          new Date(record.checkInTime).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>

                      <td className="px-5 py-3.5 font-mono text-slate-700">
                        {record.checkOutTime ? (
                          new Date(record.checkOutTime).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>

                      <td className="px-5 py-3.5 font-bold text-slate-800">
                        {workHours ? formatHoursToHM(workHours) : '—'}
                      </td>

                      <td className="px-5 py-3.5">
                        <span
                          className={cx(
                            'inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold',
                            record.status === 'Present'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : record.status === 'Late'
                              ? 'bg-amber-50 text-amber-700 border border-amber-200'
                              : record.status === 'Half-Day'
                              ? 'bg-orange-50 text-orange-700 border border-orange-200'
                              : record.status === 'Leave'
                              ? 'bg-blue-50 text-blue-700 border border-blue-200'
                              : record.status === 'On-duty'
                              ? 'bg-indigo-50 text-indigo-700 border border-indigo-200'
                              : record.status === 'Off'
                              ? 'bg-slate-100 text-slate-500'
                              : 'bg-rose-50 text-rose-700 border border-rose-200'
                          )}
                        >
                          {record.status === 'Present' && '✓'}
                          {record.status === 'Late' && '⚠'}
                          {record.status === 'Absent' && '✕'}
                          {record.status}
                        </span>
                      </td>

                      <td className="px-5 py-3.5 text-right">
                        <button
                          type="button"
                          onClick={() => setDetailModalItem(record)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-slate-200 hover:border-[#6E1D1D] hover:text-[#6E1D1D] bg-white text-slate-600 transition-colors font-semibold text-[11px] cursor-pointer shadow-2xs"
                        >
                          <Eye className="h-3 w-3" />
                          View Details
                        </button>
                      </td>
                    </tr>
                  );
                })}

                {paginatedRecords.length === 0 && (
                  <tr key="team-empty">
                    <td colSpan={10} className="px-6 py-12 text-center text-slate-400">
                      No attendance records found matching the selected filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Bar */}
        <div className="p-4 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-slate-500">
          <p>
            Showing {filteredRecords.length === 0 ? 0 : (page - 1) * pageSize + 1}–
            {Math.min(page * pageSize, filteredRecords.length)} of {filteredRecords.length} records
          </p>

          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:pointer-events-none font-semibold text-slate-700 cursor-pointer shadow-2xs"
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
              className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:pointer-events-none font-semibold text-slate-700 cursor-pointer shadow-2xs"
            >
              Next
            </button>
          </div>
        </div>
      </Card>

      {/* ========================================================================= */}
      {/* VIEW DETAILS MODAL */}
      {/* ========================================================================= */}
      {detailModalItem && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-xl border border-slate-200 w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-slate-50">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  {detailModalItem.employee?.fullName || detailModalItem.employee?.name || 'Employee Details'}
                </h3>
                <p className="text-xs text-slate-500">
                  {new Date(detailModalItem.date).toLocaleDateString('default', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  })}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDetailModalItem(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Content */}
            <div className="p-5 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3 py-1">
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Department</span>
                  <p className="font-semibold text-slate-800 mt-0.5">{detailModalItem.employee?.department || 'General'}</p>
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Employee Code</span>
                  <p className="font-mono font-semibold text-slate-800 mt-0.5">{detailModalItem.employee?.employeeCode || '—'}</p>
                </div>
              </div>

              <div className="flex items-center justify-between py-2 border-y border-slate-100">
                <span className="font-medium text-slate-600">Shift</span>
                <span className="font-semibold text-slate-800">{detailModalItem.shift}</span>
              </div>

              <div className="grid grid-cols-2 gap-3 py-1">
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Check-in</p>
                  <p className="text-sm font-bold text-slate-800 mt-0.5">
                    {detailModalItem.checkInTime
                      ? new Date(detailModalItem.checkInTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                      : '—'}
                  </p>
                  <p className="text-[10px] text-slate-500 mt-1 flex items-center gap-1">
                    <MapPin className="h-3 w-3 text-[#6E1D1D]" />
                    {detailModalItem.checkInGps
                      ? `${detailModalItem.checkInGps.lat.toFixed(4)}, ${detailModalItem.checkInGps.lng.toFixed(4)}`
                      : detailModalItem.workType || 'Office'}
                  </p>
                </div>

                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Check-out</p>
                  <p className="text-sm font-bold text-slate-800 mt-0.5">
                    {detailModalItem.checkOutTime
                      ? new Date(detailModalItem.checkOutTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                      : '—'}
                  </p>
                  <p className="text-[10px] text-slate-500 mt-1 flex items-center gap-1">
                    <MapPin className="h-3 w-3 text-[#6E1D1D]" />
                    {detailModalItem.checkOutGps
                      ? `${detailModalItem.checkOutGps.lat.toFixed(4)}, ${detailModalItem.checkOutGps.lng.toFixed(4)}`
                      : detailModalItem.workType || 'Office'}
                  </p>
                </div>
              </div>

              <div className="space-y-2 pt-1">
                <div className="flex items-center justify-between text-slate-600">
                  <span>Working Hours</span>
                  <span className="font-bold text-slate-900">
                    {detailModalItem.actualHours || detailModalItem.totalHours
                      ? formatHoursToHM(detailModalItem.actualHours || detailModalItem.totalHours)
                      : '0h 00m'}
                  </span>
                </div>

                <div className="flex items-center justify-between text-slate-600">
                  <span>Overtime</span>
                  <span className="font-bold text-emerald-700">
                    {detailModalItem.overtimeHours && detailModalItem.overtimeHours > 0
                      ? `+${formatHoursToHM(detailModalItem.overtimeHours)}`
                      : 'None'}
                  </span>
                </div>

                <div className="flex items-center justify-between text-slate-600">
                  <span>Break</span>
                  <span className="font-medium text-slate-700">
                    {detailModalItem.totalBreakMinutes ? `${Math.round(detailModalItem.totalBreakMinutes)} minutes` : '0 minutes'}
                  </span>
                </div>

                <div className="flex items-center justify-between text-slate-600">
                  <span>Status</span>
                  <span className="px-2 py-0.5 rounded font-bold text-xs bg-slate-100 text-slate-800">
                    {detailModalItem.status}
                  </span>
                </div>

                <div className="flex items-center justify-between text-slate-600">
                  <span>Notes</span>
                  <span className="text-slate-500 italic">{detailModalItem.notes || 'None'}</span>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-between items-center">
              <button
                type="button"
                onClick={() => window.print()}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:text-[#6E1D1D] cursor-pointer"
              >
                <Printer className="h-3.5 w-3.5" />
                Print
              </button>

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
