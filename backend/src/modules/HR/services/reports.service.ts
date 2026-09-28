import type { RequestContext } from '../../../core/context.js';
import { scopedFind } from '../../../core/scoping/index.js';
import Attendance from '../models/attendance.model.js';
import LeaveRequest from '../models/leave-request.model.js';
import Holiday from '../models/holiday.model.js';
import { employeeService } from '../../employees/employees.service.js';

function formatLocalDate(d: Date | string): string {
  const dateObj = typeof d === 'string' ? new Date(d) : d;
  const y = dateObj.getFullYear();
  const m = String(dateObj.getMonth() + 1).padStart(2, '0');
  const day = String(dateObj.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export async function getDailySummary(date: string, ctx: RequestContext) {
  const targetDate = new Date(date);
  targetDate.setHours(0, 0, 0, 0);

  const nextDate = new Date(targetDate);
  nextDate.setDate(targetDate.getDate() + 1);

  const records = await scopedFind(
    Attendance,
    {
      date: { $gte: targetDate, $lt: nextDate },
    },
    ctx,
    { ownerField: 'employeeId' },
  ).populate('employeeId', 'fullName department employeeCode');

  return records;
}

export async function getLateReport(fromDate: string, toDate: string, ctx: RequestContext) {
  const start = new Date(fromDate);
  start.setHours(0, 0, 0, 0);

  const end = new Date(toDate);
  end.setHours(23, 59, 59, 999);

  const records = await scopedFind(
    Attendance,
    {
      date: { $gte: start, $lte: end },
      status: 'Late',
    },
    ctx,
    { ownerField: 'employeeId' },
  ).populate('employeeId', 'fullName department employeeCode');

  return records;
}

export async function getMonthlyRegister(
  fromMonth: number,
  fromYear: number,
  toMonthOrCtx?: number | RequestContext,
  toYearOrCtx?: number | RequestContext,
  ctx?: RequestContext,
) {
  const isSingleMonthCall = typeof toMonthOrCtx === 'object';
  const actualToMonth = isSingleMonthCall
    ? fromMonth
    : typeof toMonthOrCtx === 'number' && !isNaN(toMonthOrCtx)
      ? toMonthOrCtx
      : fromMonth;
  const actualToYear = isSingleMonthCall
    ? fromYear
    : typeof toYearOrCtx === 'number' && !isNaN(toYearOrCtx)
      ? toYearOrCtx
      : fromYear;
  const actualCtx = (ctx || (isSingleMonthCall ? toMonthOrCtx : typeof toYearOrCtx === 'object' ? toYearOrCtx : undefined)) as RequestContext;

  const start = new Date(fromYear, fromMonth - 1, 1);
  start.setHours(0, 0, 0, 0);
  const end = new Date(actualToYear, actualToMonth, 0, 23, 59, 59, 999);

  const [records, approvedLeaves, holidays, allEmployees] = await Promise.all([
    scopedFind(Attendance, { date: { $gte: start, $lte: end } }, actualCtx, { ownerField: 'employeeId' }),
    LeaveRequest.find({
      status: 'Approved',
      fromDate: { $lte: end },
      toDate: { $gte: start },
    }),
    Holiday.find({
      date: { $gte: start, $lte: end },
      deletedAt: null,
    }),
    employeeService.getAllActiveEmployees(actualCtx),
  ]);

  const holidayDateSet = new Set(
    holidays.map((h) => formatLocalDate(h.date)),
  );

  const todayStr = formatLocalDate(new Date());

  const report = allEmployees.map((emp) => {
    const empRecords = records.filter((r) => r.employeeId.toString() === emp.id);
    const empLeaves = approvedLeaves.filter((l) => l.employeeId.toString() === emp.id);

    const days: Record<string, string> = {};
    const details: Record<string, {
      status: string;
      checkInTime?: Date;
      checkOutTime?: Date;
      totalHours?: number;
      workType?: string;
      location?: string;
      autoClosed?: boolean;
    }> = {};

    // 1. Fill from explicit attendance records
    empRecords.forEach((r) => {
      const dObj = new Date(r.date);
      const day = dObj.getDate();
      const dateKey = formatLocalDate(dObj);

      const detailItem = {
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
        location: r.checkInGps ? `${r.checkInGps.lat.toFixed(4)}, ${r.checkInGps.lng.toFixed(4)}` : r.workType || 'Office',
        autoClosed: r.autoClosed,
      };

      days[dateKey] = r.status;
      days[day] = r.status;
      details[dateKey] = detailItem;
      details[day] = detailItem;
    });

    // 2. Fill comprehensive status for all calendar days in range
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const dateStr = formatLocalDate(d);
      const dayNum = d.getDate();

      if (!days[dateStr]) {
        const isWeekend = d.getDay() === 0; // Sunday only
        const isHoliday = holidayDateSet.has(dateStr);
        const isOnLeave = empLeaves.some((l) => {
          const fStr = formatLocalDate(l.fromDate);
          const tStr = formatLocalDate(l.toDate);
          return fStr <= dateStr && tStr >= dateStr;
        });

        let derivedStatus = '';
        if (isOnLeave) {
          derivedStatus = 'Leave';
        } else if (isHoliday) {
          derivedStatus = 'Holiday';
        } else if (isWeekend) {
          derivedStatus = 'Weekend';
        } else if (dateStr <= todayStr) {
          derivedStatus = 'Absent';
        }

        if (derivedStatus) {
          days[dateStr] = derivedStatus;
          if (fromMonth === actualToMonth && fromYear === actualToYear) {
            days[dayNum] = derivedStatus;
          }
        }
      }
    }

    return {
      employee: emp,
      attendance: days,
      details,
    };
  });

  return report;
}

export async function getAbsenceReport(fromDate: string, toDate: string, ctx: RequestContext) {
  const start = new Date(fromDate);
  start.setHours(0, 0, 0, 0);

  const end = new Date(toDate);
  end.setHours(23, 59, 59, 999);

  const todayStr = formatLocalDate(new Date());

  const [records, approvedLeaves, holidays, allEmployees] = await Promise.all([
    scopedFind(Attendance, { date: { $gte: start, $lte: end } }, ctx, { ownerField: 'employeeId' }),
    LeaveRequest.find({
      status: 'Approved',
      fromDate: { $lte: end },
      toDate: { $gte: start },
    }),
    Holiday.find({
      date: { $gte: start, $lte: end },
      deletedAt: null,
    }),
    employeeService.getAllActiveEmployees(ctx),
  ]);

  const holidayDateSet = new Set(
    holidays.map((h) => formatLocalDate(h.date)),
  );

  const absences = [];

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const dateStr = formatLocalDate(d);
    const isWeekend = d.getDay() === 0; // Sunday only
    const isHoliday = holidayDateSet.has(dateStr);

    // Only past or present work days can be flagged absent
    if (dateStr > todayStr || isWeekend || isHoliday) {
      continue;
    }

    for (const emp of allEmployees) {
      const hasAttendance = records.some(
        (r) => r.employeeId.toString() === emp.id && formatLocalDate(r.date) === dateStr,
      );

      const hasLeave = approvedLeaves.some((l) => {
        const fStr = formatLocalDate(l.fromDate);
        const tStr = formatLocalDate(l.toDate);
        return l.employeeId.toString() === emp.id && fStr <= dateStr && tStr >= dateStr;
      });

      if (!hasAttendance && !hasLeave) {
        absences.push({
          date: dateStr,
          employee: emp,
          status: 'Absent',
        });
      }
    }
  }

  return absences;
}

/**
 * Generates an Excel-friendly CSV export for attendance reports.
 */
export async function exportAttendanceCsv(
  query: {
    reportType: 'daily' | 'late' | 'monthly' | 'absence';
    date?: string;
    fromDate?: string;
    toDate?: string;
    fromMonth?: number;
    fromYear?: number;
    toMonth?: number;
    toYear?: number;
    department?: string;
  },
  ctx: RequestContext,
): Promise<{ filename: string; csv: string }> {
  function escapeCsv(val: any): string {
    if (val === null || val === undefined) return '';
    const str = String(val);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  }

  const { reportType, department } = query;

  if (reportType === 'daily') {
    const date = query.date || formatLocalDate(new Date());
    const data = await getDailySummary(date, ctx);
    const filtered = department ? data.filter((r: any) => (r.employeeId?.department === department)) : data;

    const headers = ['Date', 'Employee Code', 'Employee Name', 'Department', 'Status', 'Check In', 'Check Out', 'Total Hours', 'Work Type'];
    const rows = filtered.map((r: any) => [
      formatLocalDate(r.date),
      r.employeeId?.employeeCode || '',
      r.employeeId?.fullName || '',
      r.employeeId?.department || '',
      r.status || '',
      r.checkInTime ? new Date(r.checkInTime).toLocaleTimeString('en-IN') : '--:--',
      r.checkOutTime ? new Date(r.checkOutTime).toLocaleTimeString('en-IN') : '--:--',
      r.totalHours ? `${r.totalHours}h` : '0h',
      r.workType || 'Office',
    ]);

    const csv = [headers.map(escapeCsv).join(','), ...rows.map((r) => r.map(escapeCsv).join(','))].join('\n');
    return { filename: `daily-attendance-${date}.csv`, csv };
  }

  if (reportType === 'late') {
    const fromDate = query.fromDate || formatLocalDate(new Date());
    const toDate = query.toDate || fromDate;
    const data = await getLateReport(fromDate, toDate, ctx);
    const filtered = department ? data.filter((r: any) => (r.employeeId?.department === department)) : data;

    const headers = ['Date', 'Employee Code', 'Employee Name', 'Department', 'Status', 'Check In Time', 'Work Type'];
    const rows = filtered.map((r: any) => [
      formatLocalDate(r.date),
      r.employeeId?.employeeCode || '',
      r.employeeId?.fullName || '',
      r.employeeId?.department || '',
      r.status || 'Late',
      r.checkInTime ? new Date(r.checkInTime).toLocaleTimeString('en-IN') : '--:--',
      r.workType || 'Office',
    ]);

    const csv = [headers.map(escapeCsv).join(','), ...rows.map((r) => r.map(escapeCsv).join(','))].join('\n');
    return { filename: `late-attendance-${fromDate}_to_${toDate}.csv`, csv };
  }

  if (reportType === 'absence') {
    const fromDate = query.fromDate || formatLocalDate(new Date());
    const toDate = query.toDate || fromDate;
    const data = await getAbsenceReport(fromDate, toDate, ctx);
    const filtered = department ? data.filter((r: any) => r.employee.department === department) : data;

    const headers = ['Date', 'Employee Code', 'Employee Name', 'Department', 'Status'];
    const rows = filtered.map((r: any) => [
      r.date,
      r.employee.employeeCode || '',
      r.employee.fullName || '',
      r.employee.department || '',
      r.status || 'Absent',
    ]);

    const csv = [headers.map(escapeCsv).join(','), ...rows.map((r) => r.map(escapeCsv).join(','))].join('\n');
    return { filename: `absence-report-${fromDate}_to_${toDate}.csv`, csv };
  }

  // Monthly Register
  const fromMonth = Number(query.fromMonth || new Date().getMonth() + 1);
  const fromYear = Number(query.fromYear || new Date().getFullYear());
  const toMonth = Number(query.toMonth || fromMonth);
  const toYear = Number(query.toYear || fromYear);

  const report = await getMonthlyRegister(fromMonth, fromYear, toMonth, toYear, ctx);
  const filtered = department ? report.filter((r: any) => r.employee.department === department) : report;

  // Build calendar dates list
  const start = new Date(fromYear, fromMonth - 1, 1);
  const end = new Date(toYear, toMonth, 0);
  const dateKeys: string[] = [];
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    dateKeys.push(formatLocalDate(d));
  }

  const headers = ['Employee Code', 'Employee Name', 'Department', ...dateKeys, 'Present Count', 'Absent Count', 'Leave Count', 'Half-Day Count'];
  const rows = filtered.map((r: any) => {
    let pCount = 0;
    let aCount = 0;
    let lCount = 0;
    let hCount = 0;

    const dayValues = dateKeys.map((k) => {
      const status = r.attendance[k] || '-';
      if (status === 'Present' || status === 'Late') pCount++;
      else if (status === 'Absent') aCount++;
      else if (status === 'Leave') lCount++;
      else if (status === 'Half-Day') hCount++;
      return status;
    });

    return [
      r.employee.employeeCode || '',
      r.employee.fullName || '',
      r.employee.department || '',
      ...dayValues,
      pCount,
      aCount,
      lCount,
      hCount,
    ];
  });

  const csv = [headers.map(escapeCsv).join(','), ...rows.map((r) => r.map(escapeCsv).join(','))].join('\n');
  return { filename: `monthly-register-${fromYear}_${fromMonth}_to_${toYear}_${toMonth}.csv`, csv };
}
