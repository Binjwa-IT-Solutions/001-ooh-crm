import Attendance, { type IAttendance } from '../models/attendance.model.js';
import ShiftConfig from '../models/shift-config.model.js';
import type { RequestContext } from '../../../core/context.js';
import { Types } from 'mongoose';
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from '../../../core/errors/index.js';
import { ROLE_LABELS } from '../../../core/rbac/permissions.js';
import { Employee } from '../../employees/employees.model.js';
import { employeeService } from '../../employees/employees.service.js';

import { scopedFind } from '../../../core/scoping/index.js';

// Din ki shuruaat (midnight) nikalne ke liye helper
function startOfDay(d: Date): Date {
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

/** Shift snapshot for a department and whether `checkInAt` is past the grace period. */
async function resolveShift(department: string | null | undefined, checkInAt: Date) {
  const shiftConfig = department ? await ShiftConfig.findOne({ department }) : null;

  let isLate = false;
  if (shiftConfig) {
    const [startHour, startMin] = shiftConfig.startTime.split(':').map(Number);
    const expectedStart = new Date(checkInAt);
    expectedStart.setHours(startHour, startMin, 0, 0);
    const graceEnd = new Date(expectedStart.getTime() + shiftConfig.graceMinutes * 60000);
    isLate = checkInAt > graceEnd;
  }

  return {
    isLate,
    halfDayThresholdHours: shiftConfig?.halfDayThresholdHours ?? 4,
    shiftSnapshot: {
      name: department ? `${department} Shift` : 'General Shift',
      startTime: shiftConfig?.startTime || '09:30',
      endTime: shiftConfig?.endTime || '18:30',
      requiredHours: 8,
    },
  };
}

/** Fills totalHours / actualHours / overtime / half-day from check-in, check-out and breaks. */
function applyCheckOutTotals(record: IAttendance, halfDayThresholdHours: number): void {
  if (!record.checkInTime || !record.checkOutTime) return;

  const totalBreakMinutes = (record.breaks || []).reduce(
    (acc, b) => acc + (Number(b.durationMinutes) || 0),
    0
  );
  record.totalBreakMinutes = Number(totalBreakMinutes.toFixed(2));

  const diffMs = record.checkOutTime.getTime() - record.checkInTime.getTime();
  record.totalHours = Number((diffMs / (1000 * 60 * 60)).toFixed(2));

  // Actual working hours = gross hours - breaks
  record.actualHours = Math.max(0, Number((record.totalHours - record.totalBreakMinutes / 60).toFixed(2)));

  // Overtime over a standard 8-hour day
  const REQUIRED_HOURS = 8.0;
  record.overtimeHours = Math.max(0, Number((record.actualHours - REQUIRED_HOURS).toFixed(2)));

  if (record.actualHours < halfDayThresholdHours) {
    record.status = 'Half-Day';
  }
}

export async function checkIn(
  data: { gps?: { lat: number; lng: number }; workType?: 'Office' | 'Remote' | 'Field Visit'; deviceInfo?: string },
  ctx: RequestContext
) {
  const today = startOfDay(new Date());

  // Get the Employee record linked to this AuthUser
  const employee = await employeeService.getMine(ctx);
  const employeeId = employee.id;

  const { isLate, shiftSnapshot } = await resolveShift(employee.department, new Date());

  // Pehle check karo aaj ka record already hai kya
  let record = await Attendance.findOne({ employeeId, date: today });

  if (record) {
    // Already check-in ho chuka hai — bas update kar do (dobara create mat karo)
    record.checkInTime = new Date();
    if (data.gps) record.checkInGps = data.gps;
    if (data.workType) record.workType = data.workType;
    if (!record.shiftDetails) record.shiftDetails = shiftSnapshot;
    record.status = isLate ? 'Late' : 'Present';
    await record.save();
    return record;
  }

  // Naya record banao
  record = await Attendance.create({
    employeeId,
    date: today,
    checkInTime: new Date(),
    checkInGps: data.gps ?? undefined,
    workType: data.workType ?? 'Office',
    deviceInfo: data.deviceInfo,
    shiftDetails: shiftSnapshot,
    status: isLate ? 'Late' : 'Present',
    createdBy: employeeId,
  });

  if (isLate && employee.reportingManager?.id) {
    const sevenDaysAgo = new Date(today);
    sevenDaysAgo.setDate(today.getDate() - 6);

    const lateCount = await Attendance.countDocuments({
      employeeId,
      status: 'Late',
      date: { $gte: sevenDaysAgo, $lte: today },
    });

    if (lateCount >= 3) {
      import('../../../core/notifications/index.js').then(({ notify }) => {
        notify({
          userId: employee.reportingManager!.id,
          type: 'attendance.habitual_late',
          title: 'Habitual Lateness Alert',
          body: `${employee.fullName} has been late ${lateCount} times in the last 7 days.`,
        }).catch(console.error);
      });
    }
  }

  return record;
}

export async function checkOut(
  data: {
    gps?: { lat: number; lng: number };
    breaks?: Array<{
      type: 'Lunch' | 'Tea' | 'Other';
      startTime: Date;
      endTime: Date;
      durationMinutes: number;
    }>;
  },
  ctx: RequestContext,
) {
  const today = startOfDay(new Date());

  // Get the Employee record linked to this AuthUser
  const employee = await employeeService.getMine(ctx);
  const employeeId = employee.id;

  const record = await Attendance.findOne({
    employeeId,
    date: today,
  });

  if (!record || !record.checkInTime) {
    throw new ValidationError('Please check in first before checking out.');
  }

  record.checkOutTime = new Date();
  if (data.gps) record.checkOutGps = data.gps;

  // Record breaks if provided
  if (data.breaks && Array.isArray(data.breaks) && data.breaks.length > 0) {
    record.breaks = data.breaks as any;
  }

  const { halfDayThresholdHours } = await resolveShift(employee.department, record.checkInTime);
  applyCheckOutTotals(record, halfDayThresholdHours);

  record.updatedBy = employeeId as any;
  await record.save();

  return record;
}

export async function getMyAttendance(ctx: RequestContext, filters: Record<string, any> = {}) {
  const employee = await employeeService.getMine(ctx);
  return Attendance.find({ employeeId: employee.id, deletedAt: null, ...filters })
    .sort({ date: -1 })
    .populate('employeeId', 'fullName name');
}

export async function getTeamAttendance(ctx: RequestContext, filters: Record<string, any> = {}) {
  const queryFilters: Record<string, any> = { ...filters };
  if (queryFilters.fromDate && queryFilters.toDate) {
    const start = new Date(queryFilters.fromDate);
    start.setHours(0, 0, 0, 0);
    const end = new Date(queryFilters.toDate);
    end.setHours(23, 59, 59, 999);
    queryFilters.date = { $gte: start, $lte: end };
    delete queryFilters.fromDate;
    delete queryFilters.toDate;
  } else if (queryFilters.date && typeof queryFilters.date === 'string') {
    const targetDate = new Date(queryFilters.date);
    targetDate.setHours(0, 0, 0, 0);
    const nextDate = new Date(targetDate);
    nextDate.setDate(targetDate.getDate() + 1);
    queryFilters.date = { $gte: targetDate, $lt: nextDate };
  }

  // Manager scoping: only direct reports + self are returned to a manager
  if (ctx.user.role === 'manager') {
    const { Employee } = await import('../../employees/employees.model.js');
    const myEmp = await Employee.findOne({ userId: ctx.user.id, deletedAt: null });
    if (myEmp) {
      const reports = await Employee.find({ reportingManagerId: myEmp._id, deletedAt: null }).select('_id');
      const allowedIds = [...reports.map((r) => r._id), myEmp._id];
      if (queryFilters.employeeId) {
        const targetIdStr = String(queryFilters.employeeId);
        const isAllowed = allowedIds.some((id) => String(id) === targetIdStr);
        if (!isAllowed) {
          return [];
        }
      } else {
        queryFilters.employeeId = { $in: allowedIds };
      }
    } else {
      return [];
    }
  }

  const records = await scopedFind(Attendance, queryFilters, ctx, { ownerField: 'employeeId' })
    .sort({ date: -1 })
    .populate('employeeId', 'fullName name department employeeCode workEmail email avatar');
  return records;
}

export async function getMyAttendanceSummary(ctx: RequestContext, month: number, year: number) {
  const employee = await employeeService.getMine(ctx);
  const employeeId = employee.id;

  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 0, 23, 59, 59, 999);

  // Fetch all attendance records for this month
  const records = await Attendance.find({
    employeeId,
    date: { $gte: start, $lte: end },
    deletedAt: null,
  }).sort({ date: 1 });

  const REQUIRED_HOURS = 8.0;

  let presentCount = 0;
  let leaveHalfCount = 0;
  let totalWorkHours = 0;
  const daysWithRecords = new Set<string>();

function formatLocalDate(d: Date | string): string {
  const dateObj = typeof d === 'string' ? new Date(d) : d;
  const y = dateObj.getFullYear();
  const m = String(dateObj.getMonth() + 1).padStart(2, '0');
  const day = String(dateObj.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

  const mappedRecords = records.map((r) => {
    const dateStr = formatLocalDate(r.date);
    daysWithRecords.add(dateStr);

    if (r.status === 'Present' || r.status === 'Late') {
      presentCount++;
    } else if (r.status === 'Half-Day' || r.status === 'Leave') {
      leaveHalfCount++;
    }

    // Effective actual work hours (fallback to totalHours for historical records)
    const effectiveWorkHours = r.actualHours ?? r.totalHours ?? 0;
    if (r.checkOutTime) {
      totalWorkHours += effectiveWorkHours;
    }

    const regHours = r.checkOutTime ? Math.min(effectiveWorkHours, REQUIRED_HOURS) : 0;
    const ovtHours = r.overtimeHours ?? (r.checkOutTime ? Math.max(0, effectiveWorkHours - REQUIRED_HOURS) : 0);

    return {
      ...r.toObject(),
      actualHours: r.actualHours ?? (r.checkOutTime ? r.totalHours : undefined),
      regularHours: Number(regHours.toFixed(2)),
      overtime: Number(ovtHours.toFixed(2)),
      totalBreakMinutes: r.totalBreakMinutes ?? 0,
      breaks: r.breaks ?? [],
    };
  });

  // Compute absent count
  let workingDays = 0;
  let absentCount = 0;
  const today = new Date();

  // Calculate up to today if it's the current month, else the whole month
  const limitDate = (year === today.getFullYear() && month === today.getMonth() + 1) ? today : end;

  for (let d = new Date(start); d <= limitDate; d.setDate(d.getDate() + 1)) {
    const dayOfWeek = d.getDay();
    const isWeekend = dayOfWeek === 0; // Sunday only
    const dateStr = formatLocalDate(d);

    if (!isWeekend) {
      workingDays++;
      if (!daysWithRecords.has(dateStr)) {
        absentCount++;
      }
    }
  }

  return {
    records: mappedRecords,
    stats: {
      presentCount,
      absentCount,
      leaveHalfCount,
      totalWorkHours: Number(totalWorkHours.toFixed(2)),
    },
  };
}
// ---------------------------------------------------------------------------
// HR / Admin corrections — punch in/out for someone whose device isn't working,
// or undo a check-out made by mistake. Today only, every change leaves a note.
// ---------------------------------------------------------------------------

export interface HrPunchInput {
  /** When it actually happened. Defaults to now. Must be today and not in the future. */
  time?: Date;
  reason?: string;
}

async function loadForHrCorrection(employeeId: string, ctx: RequestContext) {
  if (ctx.user.role !== 'hr' && ctx.user.role !== 'admin') {
    throw new ForbiddenError('Only HR or an administrator can correct attendance for someone else.');
  }
  if (!Types.ObjectId.isValid(employeeId)) throw new ValidationError('Invalid employee id');

  const employee = await Employee.findOne({ _id: employeeId, deletedAt: null });
  if (!employee) throw new NotFoundError('Employee not found');

  const today = startOfDay(new Date());
  const record = await Attendance.findOne({ employeeId: employee._id, date: today, deletedAt: null });
  return { employee, today, record };
}

function resolvePunchTime(time: Date | undefined, today: Date): Date {
  const at = time ? new Date(time) : new Date();
  if (Number.isNaN(at.getTime())) throw new ValidationError('Invalid time');
  if (startOfDay(at).getTime() !== today.getTime()) {
    throw new ValidationError('Corrections can only be made for today.');
  }
  if (at.getTime() > Date.now() + 60_000) {
    throw new ValidationError('Time cannot be in the future.');
  }
  return at;
}

function appendNote(record: IAttendance, action: string, ctx: RequestContext, reason?: string) {
  const when = new Date().toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });
  const line = `${action} by ${ctx.user.name} (${ROLE_LABELS[ctx.user.role] ?? ctx.user.role}) at ${when}${reason?.trim() ? ` — ${reason.trim()}` : ''}`;
  record.reviewNotes = record.reviewNotes ? `${record.reviewNotes}\n${line}` : line;
}

/** Tell the employee that HR/admin changed their attendance (in-app, best-effort). */
async function notifyEmployeeOfCorrection(
  employee: { userId?: unknown; fullName?: string },
  message: string,
  ctx: RequestContext,
  reason?: string,
) {
  if (!employee.userId || String(employee.userId) === ctx.user.id) return;
  try {
    const { notify } = await import('../../../core/notifications/index.js');
    await notify({
      userId: String(employee.userId),
      type: 'attendance.corrected',
      title: 'Your attendance was updated',
      body: `${ctx.user.name} (${ROLE_LABELS[ctx.user.role] ?? ctx.user.role}) ${message}.${reason?.trim() ? ` Reason: ${reason.trim()}` : ''}`,
      link: '/attendance?tab=my',
    });
  } catch (err) {
    console.error('[attendance] failed to notify employee of correction', err);
  }
}

const clock = (d: Date) => d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });

async function actorEmployeeId(ctx: RequestContext) {
  const me = await Employee.findOne({ userId: ctx.user.id, deletedAt: null }).select('_id');
  return me?._id;
}

export async function hrCheckIn(employeeId: string, input: HrPunchInput, ctx: RequestContext) {
  const { employee, today, record: existing } = await loadForHrCorrection(employeeId, ctx);
  const at = resolvePunchTime(input.time, today);

  if (existing?.checkInTime && !existing.checkOutTime) {
    throw new ConflictError(`${employee.fullName} is already checked in.`);
  }
  if (existing?.status === 'Leave') {
    throw new ConflictError(`${employee.fullName} is on approved leave today.`);
  }

  const { isLate, shiftSnapshot } = await resolveShift(employee.department, at);
  const record = existing ?? new Attendance({ employeeId: employee._id, date: today, workType: 'Office' });

  record.checkInTime = at;
  record.checkOutTime = undefined;
  record.totalHours = undefined;
  record.actualHours = undefined;
  record.overtimeHours = 0;
  record.status = isLate ? 'Late' : 'Present';
  if (!record.shiftDetails) record.shiftDetails = shiftSnapshot;
  appendNote(record, 'Checked in', ctx, input.reason);

  const actor = await actorEmployeeId(ctx);
  if (actor) {
    record.updatedBy = actor;
    if (!existing) record.createdBy = actor;
  }
  await record.save();
  await notifyEmployeeOfCorrection(employee, `checked you in for today at ${clock(at)}`, ctx, input.reason);
  return record.populate('employeeId', 'fullName name department employeeCode workEmail email');
}

export async function hrCheckOut(employeeId: string, input: HrPunchInput, ctx: RequestContext) {
  const { employee, today, record } = await loadForHrCorrection(employeeId, ctx);
  const at = resolvePunchTime(input.time, today);

  if (!record?.checkInTime) {
    throw new ValidationError(`${employee.fullName} hasn't checked in today.`);
  }
  if (record.checkOutTime) {
    throw new ConflictError(`${employee.fullName} is already checked out.`);
  }
  if (at <= record.checkInTime) {
    throw new ValidationError('Check-out time must be after the check-in time.');
  }

  record.checkOutTime = at;
  const { halfDayThresholdHours } = await resolveShift(employee.department, record.checkInTime);
  applyCheckOutTotals(record, halfDayThresholdHours);
  appendNote(record, 'Checked out', ctx, input.reason);

  const actor = await actorEmployeeId(ctx);
  if (actor) record.updatedBy = actor;
  await record.save();
  await notifyEmployeeOfCorrection(employee, `checked you out for today at ${clock(at)}`, ctx, input.reason);
  return record.populate('employeeId', 'fullName name department employeeCode workEmail email');
}

/** Undo a mistaken check-out: the person is still working, so clear the check-out. */
export async function hrResume(employeeId: string, input: HrPunchInput, ctx: RequestContext) {
  const { employee, record } = await loadForHrCorrection(employeeId, ctx);

  if (!record?.checkInTime || !record.checkOutTime) {
    throw new ValidationError(`${employee.fullName} isn't checked out today, so there is nothing to undo.`);
  }

  const { isLate } = await resolveShift(employee.department, record.checkInTime);
  record.checkOutTime = undefined;
  record.checkOutGps = undefined;
  record.totalHours = undefined;
  record.actualHours = undefined;
  record.overtimeHours = 0;
  record.autoClosed = false;
  record.status = isLate ? 'Late' : 'Present';
  appendNote(record, 'Check-out undone (still working)', ctx, input.reason);

  const actor = await actorEmployeeId(ctx);
  if (actor) record.updatedBy = actor;
  await record.save();
  await notifyEmployeeOfCorrection(
    employee,
    "undid today's check-out — you're marked as still working. Remember to check out when you leave",
    ctx,
    input.reason,
  );
  return record.populate('employeeId', 'fullName name department employeeCode workEmail email');
}
