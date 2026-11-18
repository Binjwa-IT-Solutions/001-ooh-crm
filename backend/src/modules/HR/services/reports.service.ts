import type { RequestContext } from '../../../core/context.js';
import { scopedFind } from '../../../core/scoping/index.js';
import Attendance from '../models/attendance.model.js';
import { LeaveRequest } from '../models/leave.model.js';
import Holiday from '../models/holiday.model.js';
import { employeeService } from '../../employees/employees.service.js';

/**
 * Canonical Business Date Helpers for Media Octus CRM (Operations centered in IST - Asia/Kolkata)
 */
export function toBusinessDateString(d: Date | string): string {
  if (!d) return '';
  if (typeof d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(d)) {
    return d;
  }
  const dateObj = typeof d === 'string' ? new Date(d) : d;
  if (isNaN(dateObj.getTime())) return '';
  return dateObj.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
}

export function formatBusinessDateDMY(d: Date | string): string {
  const bDate = toBusinessDateString(d);
  if (!bDate) return '';
  const [y, m, day] = bDate.split('-');
  return `${day}-${m}-${y}`;
}

export function formatBusinessTime(d?: Date | string | null): string {
  if (!d) return '--:--';
  const dt = typeof d === 'string' ? new Date(d) : d;
  if (isNaN(dt.getTime())) return '--:--';
  return dt.toLocaleTimeString('en-US', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

export function formatDurationHM(hours?: number | null): string {
  if (hours === undefined || hours === null || isNaN(hours) || hours <= 0) return '0h';
  const h = Math.floor(hours);
  const m = Math.round((hours - h) * 60);
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function formatLocalDate(d: Date | string): string {
  return toBusinessDateString(d);
}

export async function getDailySummary(date: string, ctx: RequestContext) {
  const targetDateStr = toBusinessDateString(date);
  const [y, m, d] = targetDateStr.split('-').map(Number);
  // Wide query buffer to ensure records stored as either IST midnight or UTC midnight are fetched
  const queryStart = new Date(Date.UTC(y, m - 1, d - 1, 12, 0, 0, 0));
  const queryEnd = new Date(Date.UTC(y, m - 1, d + 1, 12, 0, 0, 0));

  const records = await scopedFind(
    Attendance,
    {
      date: { $gte: queryStart, $lte: queryEnd },
    },
    ctx,
    { ownerField: 'employeeId' },
  ).populate('employeeId', 'fullName department employeeCode');

  return records.filter((r: any) => toBusinessDateString(r.date) === targetDateStr);
}

export async function getLateReport(fromDate: string, toDate: string, ctx: RequestContext) {
  const fromStr = toBusinessDateString(fromDate);
  const toStr = toBusinessDateString(toDate);
  const [fy, fm, fd] = fromStr.split('-').map(Number);
  const [ty, tm, td] = toStr.split('-').map(Number);

  const queryStart = new Date(Date.UTC(fy, fm - 1, fd - 1, 12, 0, 0, 0));
  const queryEnd = new Date(Date.UTC(ty, tm - 1, td + 1, 12, 0, 0, 0));

  const records = await scopedFind(
    Attendance,
    {
      date: { $gte: queryStart, $lte: queryEnd },
      status: 'Late',
    },
    ctx,
    { ownerField: 'employeeId' },
  ).populate('employeeId', 'fullName department employeeCode');

  return records.filter((r: any) => {
    const bDate = toBusinessDateString(r.date);
    return bDate >= fromStr && bDate <= toStr;
  });
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

  // Query buffer ensures records spanning UTC and IST midnights are completely included
  const queryStart = new Date(Date.UTC(fromYear, fromMonth - 1, 0, 0, 0, 0));
  const queryEnd = new Date(Date.UTC(actualToYear, actualToMonth, 2, 23, 59, 59, 999));

  const [records, approvedLeaves, holidays, allEmployees] = await Promise.all([
    scopedFind(Attendance, { date: { $gte: queryStart, $lte: queryEnd } }, actualCtx, { ownerField: 'employeeId' }),
    LeaveRequest.find({
      status: 'Approved',
      fromDate: { $lte: queryEnd },
      toDate: { $gte: queryStart },
    }),
    Holiday.find({
      date: { $gte: queryStart, $lte: queryEnd },
      deletedAt: null,
    }),
    employeeService.getAllActiveEmployees(actualCtx),
  ]);

  const holidayDateSet = new Set(
    holidays.map((h: any) => toBusinessDateString(h.date)),
  );

  const todayStr = toBusinessDateString(new Date());

  // Generate all calendar date keys purely via date arithmetic (independent of timezone shifts)
  const totalMonths = (actualToYear - fromYear) * 12 + (actualToMonth - fromMonth) + 1;
  const targetDateKeys: string[] = [];
  const targetDateKeySet = new Set<string>();

  for (let mOffset = 0; mOffset < totalMonths; mOffset++) {
    const totalM = (fromYear * 12 + (fromMonth - 1)) + mOffset;
    const curYear = Math.floor(totalM / 12);
    const curMonth = (totalM % 12) + 1;
    const daysInCurMonth = new Date(curYear, curMonth, 0).getDate();

    for (let dayNum = 1; dayNum <= daysInCurMonth; dayNum++) {
      const dKey = `${curYear}-${String(curMonth).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
      targetDateKeys.push(dKey);
      targetDateKeySet.add(dKey);
    }
  }

  const isSingleMonth = fromMonth === actualToMonth && fromYear === actualToYear;

  const report = allEmployees.map((emp: any) => {
    const empRecords = records.filter((r: any) => r.employeeId.toString() === emp.id);
    const empLeaves = approvedLeaves.filter((l: any) => l.employeeId.toString() === emp.id);

    const days: Record<string | number, string> = {};
    const details: Record<string | number, any> = {};

    // 1. Fill from explicit attendance records
    empRecords.forEach((r: any) => {
      const dateKey = toBusinessDateString(r.date);
      if (!targetDateKeySet.has(dateKey)) return;
      const day = parseInt(dateKey.split('-')[2], 10);

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
      details[dateKey] = detailItem;
      if (isSingleMonth) {
        days[day] = r.status;
        details[day] = detailItem;
      }
    });

    // 2. Fill comprehensive status for all calendar days in range
    for (const dateStr of targetDateKeys) {
      if (!days[dateStr]) {
        const [yNum, mNum, dayNum] = dateStr.split('-').map(Number);
        const dObj = new Date(Date.UTC(yNum, mNum - 1, dayNum, 12, 0, 0));
        const isWeekend = dObj.getUTCDay() === 0; // Sunday only
        const isHoliday = holidayDateSet.has(dateStr);
        const isOnLeave = empLeaves.some((l: any) => {
          const fStr = toBusinessDateString(l.fromDate);
          const tStr = toBusinessDateString(l.toDate);
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
          const derivedDetail = {
            status: derivedStatus,
            totalHours: 0,
            actualHours: 0,
            overtimeHours: 0,
            totalBreakMinutes: 0,
            workType: derivedStatus === 'Leave' ? 'Leave' : derivedStatus === 'Holiday' ? 'Holiday' : derivedStatus === 'Weekend' ? 'Weekend' : 'Office',
            location: derivedStatus === 'Weekend' ? 'Weekend Off' : derivedStatus === 'Holiday' ? 'Public Holiday' : derivedStatus === 'Leave' ? 'Approved Leave' : 'No Punch Recorded',
          };
          details[dateStr] = derivedDetail;
          if (isSingleMonth) {
            days[dayNum] = derivedStatus;
            details[dayNum] = derivedDetail;
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
  const fromStr = toBusinessDateString(fromDate);
  const toStr = toBusinessDateString(toDate);
  const [fy, fm, fd] = fromStr.split('-').map(Number);
  const [ty, tm, td] = toStr.split('-').map(Number);

  const queryStart = new Date(Date.UTC(fy, fm - 1, fd - 1, 12, 0, 0, 0));
  const queryEnd = new Date(Date.UTC(ty, tm - 1, td + 1, 12, 0, 0, 0));

  const todayStr = toBusinessDateString(new Date());

  const [records, approvedLeaves, holidays, allEmployees] = await Promise.all([
    scopedFind(Attendance, { date: { $gte: queryStart, $lte: queryEnd } }, ctx, { ownerField: 'employeeId' }),
    LeaveRequest.find({
      status: 'Approved',
      fromDate: { $lte: queryEnd },
      toDate: { $gte: queryStart },
    }),
    Holiday.find({
      date: { $gte: queryStart, $lte: queryEnd },
      deletedAt: null,
    }),
    employeeService.getAllActiveEmployees(ctx),
  ]);

  const holidayDateSet = new Set(
    holidays.map((h: any) => toBusinessDateString(h.date)),
  );

  const absences: Array<{ date: string; employee: any; status: string }> = [];

  const startDateObj = new Date(Date.UTC(fy, fm - 1, fd, 12, 0, 0));
  const endDateObj = new Date(Date.UTC(ty, tm - 1, td, 12, 0, 0));

  for (let cur = new Date(startDateObj); cur <= endDateObj; cur.setUTCDate(cur.getUTCDate() + 1)) {
    const dateStr = toBusinessDateString(cur);
    const isWeekend = cur.getUTCDay() === 0; // Sunday only
    const isHoliday = holidayDateSet.has(dateStr);

    if (dateStr > todayStr || isWeekend || isHoliday) {
      continue;
    }

    for (const emp of allEmployees) {
      const hasAttendance = records.some(
        (r: any) => r.employeeId.toString() === emp.id && toBusinessDateString(r.date) === dateStr,
      );

      const hasLeave = approvedLeaves.some((l: any) => {
        const fStr = toBusinessDateString(l.fromDate);
        const tStr = toBusinessDateString(l.toDate);
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

export async function getOvertimeReport(
  fromMonth: number,
  fromYear: number,
  toMonthOrCtx?: number | RequestContext,
  toYearOrCtx?: number | RequestContext,
  minHoursOrCtx?: number | RequestContext,
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
  const minHours = typeof minHoursOrCtx === 'number' ? minHoursOrCtx : 0;
  const actualCtx = (ctx || (isSingleMonthCall ? toMonthOrCtx : typeof toYearOrCtx === 'object' ? toYearOrCtx : typeof minHoursOrCtx === 'object' ? minHoursOrCtx : undefined)) as RequestContext;

  const queryStart = new Date(Date.UTC(fromYear, fromMonth - 1, 0, 0, 0, 0));
  const queryEnd = new Date(Date.UTC(actualToYear, actualToMonth, 2, 23, 59, 59, 999));

  const [records, allEmployees] = await Promise.all([
    scopedFind(Attendance, { date: { $gte: queryStart, $lte: queryEnd } }, actualCtx, { ownerField: 'employeeId' }).populate('employeeId', 'fullName name department employeeCode workEmail email avatar'),
    employeeService.getAllActiveEmployees(actualCtx),
  ]);

  const employeeOvertimeMap = new Map<string, { employee: any; days: any[]; totalOvertimeHours: number }>();

  for (const emp of allEmployees) {
    employeeOvertimeMap.set(emp.id, {
      employee: emp,
      days: [],
      totalOvertimeHours: 0,
    });
  }

  for (const r of records) {
    const empId = (r.employeeId as any)?._id?.toString() || (r.employeeId as any)?.id || r.employeeId?.toString();
    const effectiveWork = r.actualHours ?? r.totalHours ?? 0;
    const ot = r.overtimeHours && r.overtimeHours > 0 
      ? r.overtimeHours 
      : (effectiveWork > 8 ? Number((effectiveWork - 8).toFixed(2)) : 0);

    if (ot > minHours) {
      let entry = employeeOvertimeMap.get(empId);
      if (!entry) {
        entry = {
          employee: r.employeeId,
          days: [],
          totalOvertimeHours: 0,
        };
        employeeOvertimeMap.set(empId, entry);
      }
      entry.days.push({
        date: toBusinessDateString(r.date),
        actualHours: effectiveWork,
        overtimeHours: ot,
        checkInTime: r.checkInTime,
        checkOutTime: r.checkOutTime,
      });
      entry.totalOvertimeHours = Number((entry.totalOvertimeHours + ot).toFixed(2));
    }
  }

  const result = Array.from(employeeOvertimeMap.values())
    .filter((e) => e.days.length > 0)
    .map((e) => ({
      employee: e.employee,
      daysCount: e.days.length,
      totalOvertimeHours: e.totalOvertimeHours,
      avgMinutesPerDay: e.days.length > 0 ? Math.round((e.totalOvertimeHours / e.days.length) * 60) : 0,
      records: e.days,
    }));

  return result;
}

/**
 * Generates an Excel-friendly CSV export for attendance reports.
 */
export async function exportAttendanceCsv(
  query: {
    reportType: 'daily' | 'late' | 'monthly' | 'absence' | 'overtime';
    date?: string;
    fromDate?: string;
    toDate?: string;
    fromMonth?: number;
    fromYear?: number;
    toMonth?: number;
    toYear?: number;
    department?: string;
    employeeId?: string;
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

  const { reportType, department, employeeId } = query;
  const standardHeaders = ['Employee', 'Employee Code', 'Department', 'Date', 'Status', 'Check In', 'Check Out', 'Total Hours', 'Work Type', 'Overtime'];

  const matchesEmployee = (emp: any) => {
    if (!employeeId) return true;
    const id = emp?.id || emp?._id || emp?.employeeCode;
    return String(id) === String(employeeId);
  };

  if (reportType === 'daily') {
    const date = query.date || toBusinessDateString(new Date());
    const data = await getDailySummary(date, ctx);
    let filtered = department ? data.filter((r: any) => (r.employeeId?.department === department)) : data;
    if (employeeId) {
      filtered = filtered.filter((r: any) => matchesEmployee(r.employeeId));
    }

    const rows = filtered.map((r: any) => {
      const emp = r.employeeId || {};
      const actualH = r.actualHours ?? r.totalHours ?? 0;
      const ot = r.overtimeHours ?? (actualH > 8 ? actualH - 8 : 0);

      return [
        emp.fullName || emp.name || '',
        emp.employeeCode || '',
        emp.department || '',
        formatBusinessDateDMY(r.date),
        r.status || 'Present',
        formatBusinessTime(r.checkInTime),
        formatBusinessTime(r.checkOutTime),
        formatDurationHM(actualH),
        r.workType || 'Office',
        formatDurationHM(ot),
      ];
    });

    const csv = [standardHeaders.map(escapeCsv).join(','), ...rows.map((r) => r.map(escapeCsv).join(','))].join('\n');
    return { filename: `attendance-daily-${formatBusinessDateDMY(date)}.csv`, csv };
  }

  if (reportType === 'late') {
    const fromDate = query.fromDate || toBusinessDateString(new Date());
    const toDate = query.toDate || fromDate;
    const data = await getLateReport(fromDate, toDate, ctx);
    let filtered = department ? data.filter((r: any) => (r.employeeId?.department === department)) : data;
    if (employeeId) {
      filtered = filtered.filter((r: any) => matchesEmployee(r.employeeId));
    }

    const rows = filtered.map((r: any) => {
      const emp = r.employeeId || {};
      const actualH = r.actualHours ?? r.totalHours ?? 0;
      const ot = r.overtimeHours ?? (actualH > 8 ? actualH - 8 : 0);

      return [
        emp.fullName || emp.name || '',
        emp.employeeCode || '',
        emp.department || '',
        formatBusinessDateDMY(r.date),
        r.status || 'Late',
        formatBusinessTime(r.checkInTime),
        formatBusinessTime(r.checkOutTime),
        formatDurationHM(actualH),
        r.workType || 'Office',
        formatDurationHM(ot),
      ];
    });

    const csv = [standardHeaders.map(escapeCsv).join(','), ...rows.map((r) => r.map(escapeCsv).join(','))].join('\n');
    return { filename: `attendance-late-${formatBusinessDateDMY(fromDate)}_to_${formatBusinessDateDMY(toDate)}.csv`, csv };
  }

  if (reportType === 'absence') {
    const fromDate = query.fromDate || toBusinessDateString(new Date());
    const toDate = query.toDate || fromDate;
    const data = await getAbsenceReport(fromDate, toDate, ctx);
    let filtered = department ? data.filter((r: any) => r.employee?.department === department) : data;
    if (employeeId) {
      filtered = filtered.filter((r: any) => matchesEmployee(r.employee));
    }

    const rows = filtered.map((r: any) => {
      const emp = r.employee || {};
      return [
        emp.fullName || emp.name || '',
        emp.employeeCode || '',
        emp.department || '',
        formatBusinessDateDMY(r.date),
        r.status || 'Absent',
        '--:--',
        '--:--',
        '0h',
        'Unexcused',
        '0h',
      ];
    });

    const csv = [standardHeaders.map(escapeCsv).join(','), ...rows.map((r) => r.map(escapeCsv).join(','))].join('\n');
    return { filename: `attendance-absence-${formatBusinessDateDMY(fromDate)}_to_${formatBusinessDateDMY(toDate)}.csv`, csv };
  }

  if (reportType === 'overtime') {
    const fromMonth = Number(query.fromMonth || new Date().getMonth() + 1);
    const fromYear = Number(query.fromYear || new Date().getFullYear());
    const toMonth = Number(query.toMonth || fromMonth);
    const toYear = Number(query.toYear || fromYear);

    const report = await getOvertimeReport(fromMonth, fromYear, toMonth, toYear, 0, ctx);
    let filtered = department ? report.filter((r: any) => r.employee?.department === department) : report;
    if (employeeId) {
      filtered = filtered.filter((r: any) => matchesEmployee(r.employee));
    }

    const rows: string[][] = [];
    filtered.forEach((r: any) => {
      const emp = r.employee || {};
      (r.records || []).forEach((rec: any) => {
        rows.push([
          emp.fullName || emp.name || '',
          emp.employeeCode || '',
          emp.department || '',
          formatBusinessDateDMY(rec.date),
          'Present',
          formatBusinessTime(rec.checkInTime),
          formatBusinessTime(rec.checkOutTime),
          formatDurationHM(rec.actualHours),
          'Overtime',
          formatDurationHM(rec.overtimeHours),
        ]);
      });
    });

    const monthPadded = String(fromMonth).padStart(2, '0');
    const filename = fromMonth === toMonth && fromYear === toYear
      ? `attendance-overtime-${fromYear}-${monthPadded}.csv`
      : `attendance-overtime-${fromYear}-${monthPadded}_to_${toYear}-${String(toMonth).padStart(2, '0')}.csv`;

    const csv = [standardHeaders.map(escapeCsv).join(','), ...rows.map((r) => r.map(escapeCsv).join(','))].join('\n');
    return { filename, csv };
  }

  // Monthly Register
  const fromMonth = Number(query.fromMonth || new Date().getMonth() + 1);
  const fromYear = Number(query.fromYear || new Date().getFullYear());
  const toMonth = Number(query.toMonth || fromMonth);
  const toYear = Number(query.toYear || fromYear);

  const report = await getMonthlyRegister(fromMonth, fromYear, toMonth, toYear, ctx);
  let filtered = department ? report.filter((r: any) => r.employee?.department === department) : report;
  if (employeeId) {
    filtered = filtered.filter((r: any) => matchesEmployee(r.employee));
  }

  // Build calendar dates list purely using integer month arithmetic
  const totalMonths = (toYear - fromYear) * 12 + (toMonth - fromMonth) + 1;
  const dateKeys: string[] = [];

  for (let mOffset = 0; mOffset < totalMonths; mOffset++) {
    const totalM = (fromYear * 12 + (fromMonth - 1)) + mOffset;
    const curYear = Math.floor(totalM / 12);
    const curMonth = (totalM % 12) + 1;
    const daysInCurMonth = new Date(curYear, curMonth, 0).getDate();

    for (let dayNum = 1; dayNum <= daysInCurMonth; dayNum++) {
      dateKeys.push(`${curYear}-${String(curMonth).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`);
    }
  }

  const rows: string[][] = [];
  filtered.forEach((r: any) => {
    const emp = r.employee || {};
    const empName = emp.fullName || emp.name || '';
    const empCode = emp.employeeCode || '';
    const empDept = emp.department || '';

    dateKeys.forEach((dKey) => {
      const detail = r.details?.[dKey];
      const status = detail?.status || r.attendance?.[dKey] || 'Absent';
      const checkIn = formatBusinessTime(detail?.checkInTime);
      const checkOut = formatBusinessTime(detail?.checkOutTime);
      const actualH = detail?.actualHours !== undefined ? detail.actualHours : detail?.totalHours;
      const workHours = formatDurationHM(actualH);
      const workType = detail?.workType || (status === 'Weekend' ? 'Weekend' : status === 'Holiday' ? 'Holiday' : status === 'Leave' ? 'Leave' : 'Office');
      const overtime = formatDurationHM(detail?.overtimeHours);

      rows.push([
        empName,
        empCode,
        empDept,
        formatBusinessDateDMY(dKey),
        status,
        checkIn,
        checkOut,
        workHours,
        workType,
        overtime,
      ]);
    });
  });

  const monthPadded = String(fromMonth).padStart(2, '0');
  const empCodeSlug = employeeId && filtered[0]?.employee?.employeeCode ? `-${filtered[0].employee.employeeCode}` : '';
  const filename = fromMonth === toMonth && fromYear === toYear
    ? `attendance-report${empCodeSlug}-${fromYear}-${monthPadded}.csv`
    : `attendance-report${empCodeSlug}-${fromYear}-${monthPadded}_to_${toYear}-${String(toMonth).padStart(2, '0')}.csv`;

  const csv = [standardHeaders.map(escapeCsv).join(','), ...rows.map((r) => r.map(escapeCsv).join(','))].join('\n');
  return { filename, csv };
}
