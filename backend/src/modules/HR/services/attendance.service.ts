import Attendance from '../models/attendance.model.js';
import ShiftConfig from '../models/shift-config.model.js';
import type { RequestContext } from '../../../core/context.js';
import { employeeService } from '../../employees/employees.service.js';

import { scopedFind } from '../../../core/scoping/index.js';

// Din ki shuruaat (midnight) nikalne ke liye helper
function startOfDay(d: Date): Date {
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

export async function checkIn(
  data: { gps?: { lat: number; lng: number }; workType?: 'Office' | 'Remote' | 'Field Visit'; deviceInfo?: string },
  ctx: RequestContext
) {
  const today = startOfDay(new Date());

  // Get the Employee record linked to this AuthUser
  const employee = await employeeService.getMine(ctx);
  const employeeId = employee.id;

  // Check shift config for late detection
  const shiftConfig = await ShiftConfig.findOne({ department: employee.department });

  let isLate = false;
  if (shiftConfig) {
    const [startHour, startMin] = shiftConfig.startTime.split(':').map(Number);
    const expectedStart = new Date(today);
    expectedStart.setHours(startHour, startMin, 0, 0);
    const graceEnd = new Date(expectedStart.getTime() + shiftConfig.graceMinutes * 60000);
    if (new Date() > graceEnd) {
      isLate = true;
    }
  }

  // Pehle check karo aaj ka record already hai kya
  let record = await Attendance.findOne({ employeeId, date: today });

  if (record) {
    // Already check-in ho chuka hai — bas update kar do (dobara create mat karo)
    record.checkInTime = new Date();
    if (data.gps) record.checkInGps = data.gps;
    if (data.workType) record.workType = data.workType;
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
  data: { gps?: { lat: number; lng: number } },
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
    const err: any = new Error(
      "Cannot check out — no check-in found for today",
    );
    err.status = 400;
    err.publicMessage =
      "Please check in first before checking out.";
    throw err;
  }

  record.checkOutTime = new Date();
  if (data.gps) record.checkOutGps = data.gps;

  // totalHours calculate karo
  const diffMs =
    record.checkOutTime.getTime() -
    record.checkInTime.getTime();
  record.totalHours = Number(
    (diffMs / (1000 * 60 * 60)).toFixed(2),
  );

  // Half-day check karo shift config se
  const shiftConfig = await ShiftConfig.findOne({ department: employee.department });
  const threshold = shiftConfig?.halfDayThresholdHours ?? 4;

  if (record.totalHours < threshold) {
    record.status = "Half-Day";
  }

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
  const records = await scopedFind(Attendance, filters, ctx, { ownerField: 'employeeId' })
    .sort({ date: -1 })
    .populate('employeeId', 'fullName name');
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

  // Fetch shift config to compute regular vs overtime
  const shiftConfig = await ShiftConfig.findOne({ department: employee.department });
  let shiftDurationHours = 8;
  if (shiftConfig && shiftConfig.startTime && shiftConfig.endTime) {
    const [startH, startM] = shiftConfig.startTime.split(':').map(Number);
    const [endH, endM] = shiftConfig.endTime.split(':').map(Number);
    let diff = (endH + endM / 60) - (startH + startM / 60);
    if (diff < 0) diff += 24;
    shiftDurationHours = diff;
  }

  let presentCount = 0;
  let leaveHalfCount = 0;
  let totalWorkHours = 0;
  const daysWithRecords = new Set<string>();

  const mappedRecords = records.map((r) => {
    const dateStr = new Date(r.date).toISOString().split('T')[0];
    daysWithRecords.add(dateStr);

    if (r.status === 'Present' || r.status === 'Late') {
      presentCount++;
    } else if (r.status === 'Half-Day' || r.status === 'Leave') {
      leaveHalfCount++;
    }

    if (r.totalHours) {
      totalWorkHours += r.totalHours;
    }

    const regHours = r.totalHours ? Math.min(r.totalHours, shiftDurationHours) : 0;
    const ovtHours = r.totalHours ? Math.max(0, r.totalHours - shiftDurationHours) : 0;

    return {
      ...r.toObject(),
      regularHours: regHours,
      overtime: ovtHours,
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
    const isWeekend = dayOfWeek === 0; // Sunday
    const dateStr = d.toISOString().split('T')[0];

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