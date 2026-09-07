import type { RequestContext } from '../../../core/context.js';
import { scopedFind } from '../../../core/scoping/index.js';
import Attendance from '../models/attendance.model.js';
import { employeeService } from '../../employees/employees.service.js';
import { notify } from '../../../core/notifications/index.js';

// TODO: G5 needs the leave module to expose this function once ready.
// Currently returning an empty array to allow the Absence report to function without throwing.
async function getApprovedLeavesStub(fromDate: Date, toDate: Date, employeeId?: string): Promise<any[]> {
  console.warn('[reports.service.ts] Stub getApprovedLeavesStub called. Waiting for leave module implementation.');
  return [];
}

export async function getDailySummary(date: string, ctx: RequestContext) {
  const targetDate = new Date(date);
  targetDate.setHours(0, 0, 0, 0);

  const nextDate = new Date(targetDate);
  nextDate.setDate(targetDate.getDate() + 1);

  const records = await scopedFind(Attendance, {
    date: { $gte: targetDate, $lt: nextDate },
  }, ctx, { ownerField: 'employeeId' }).populate('employeeId', 'fullName department');

  return records;
}

export async function getLateReport(fromDate: string, toDate: string, ctx: RequestContext) {
  const start = new Date(fromDate);
  start.setHours(0, 0, 0, 0);

  const end = new Date(toDate);
  end.setHours(23, 59, 59, 999);

  const records = await scopedFind(Attendance, {
    date: { $gte: start, $lte: end },
    status: 'Late',
  }, ctx, { ownerField: 'employeeId' }).populate('employeeId', 'fullName department');

  return records;
}

export async function getMonthlyRegister(
  fromMonth: number,
  fromYear: number,
  toMonthOrCtx?: number | RequestContext,
  toYearOrCtx?: number | RequestContext,
  ctx?: RequestContext
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
  const end = new Date(actualToYear, actualToMonth, 0, 23, 59, 59, 999);

  const records = await scopedFind(Attendance, {
    date: { $gte: start, $lte: end },
  }, actualCtx, { ownerField: 'employeeId' });

  // Get all active employees to build the grid
  const allEmployees = await employeeService.getAllActiveEmployees(actualCtx);

  const report = allEmployees.map((emp) => {
    const empRecords = records.filter(r => r.employeeId.toString() === emp.id);
    const days: Record<string, string> = {};
    const details: Record<string, {
      status: string;
      checkInTime?: Date;
      checkOutTime?: Date;
      totalHours?: number;
      workType?: string;
      location?: string;
    }> = {};

    // Fill records keyed by YYYY-MM-DD as well as day number (for single month backward compatibility)
    empRecords.forEach(r => {
      const dObj = new Date(r.date);
      const day = dObj.getDate();
      const dateKey = `${dObj.getFullYear()}-${String(dObj.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      
      const detailItem = {
        status: r.status,
        checkInTime: r.checkInTime,
        checkOutTime: r.checkOutTime,
        totalHours: r.totalHours,
        workType: r.workType,
        location: r.checkInGps ? `${r.checkInGps.lat.toFixed(4)}, ${r.checkInGps.lng.toFixed(4)}` : r.workType || 'Office',
      };

      days[dateKey] = r.status;
      days[day] = r.status;
      details[dateKey] = detailItem;
      details[day] = detailItem;
    });

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

  const records = await scopedFind(Attendance, {
    date: { $gte: start, $lte: end },
  }, ctx, { ownerField: 'employeeId' });

  const allEmployees = await employeeService.getAllActiveEmployees(ctx);
  // TODO: Use the leave service once ready
  const approvedLeaves = await getApprovedLeavesStub(start, end);

  const absences = [];

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const dateStr = d.toISOString().split('T')[0];

    for (const emp of allEmployees) {
      const hasAttendance = records.some(
        r => r.employeeId.toString() === emp.id && new Date(r.date).toISOString().split('T')[0] === dateStr
      );

      const hasLeave = approvedLeaves.some(
        l => l.employeeId.toString() === emp.id &&
          new Date(l.fromDate) <= d && new Date(l.toDate) >= d
      );

      // Only flag as absent if no attendance AND no approved leave
      // Also maybe skip weekends depending on config, but for now we flag it if no record
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
