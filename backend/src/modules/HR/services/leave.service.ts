import mongoose, { type ClientSession } from 'mongoose';
import type { RequestContext } from '../../../core/context.js';
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from '../../../core/errors/index.js';
import { scopeFilter, scopedFind } from '../../../core/scoping/index.js';
import { employeeService } from '../../employees/employees.service.js';
import { LeaveType } from '../leaveTypes/leaveTypes.model.js';
import { leaveTypeService } from '../leaveTypes/leaveTypes.service.js';
import type { CreateLeaveTypeInput } from '../leaveTypes/leaveTypes.validator.js';
import Attendance from '../models/attendance.model.js';
import LeaveRequest, { type ILeaveRequest } from '../models/leave-request.model.js';
import Holiday from '../models/holiday.model.js';


export interface LeaveRequestDto {
  id: string;
  employeeId: string;
  leaveTypeId: string;
  fromDate: string;
  toDate: string;
  days: number;
  reason: string;
  documentUrl?: string;
  status: ILeaveRequest['status'];
  approverId?: string;
  approvedAt: string | null;
  rejectionReason?: string;
  createdAt: string;
  employeeName?: string;
  employeeCode?: string;
  department?: string;
  leaveTypeName?: string;
  allocated?: number;
  used?: number;
  remaining?: number;
  attendance?: AttendanceDto[];
}

interface AttendanceDto {
  id: string;
  date: string;
  checkInTime: string | null;
  checkOutTime: string | null;
  totalHours: number;
  status: string;
  workType: string;
}

function day(value: Date): Date {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
}

function datesBetween(from: Date, to: Date): Date[] {
  const dates: Date[] = [];
  for (let cursor = day(from); cursor <= day(to); cursor.setUTCDate(cursor.getUTCDate() + 1)) {
    if (cursor.getUTCDay() !== 0 && cursor.getUTCDay() !== 6) dates.push(new Date(cursor));
  }
  return dates;
}

function toDto(request: ILeaveRequest): LeaveRequestDto {
  return {
    id: String(request._id),
    employeeId: String(request.employeeId),
    leaveTypeId: String(request.leaveTypeId),
    fromDate: request.fromDate.toISOString(),
    toDate: request.toDate.toISOString(),
    days: request.days,
    reason: request.reason,
    documentUrl: request.documentUrl,
    status: request.status,
    approverId: request.approverId ? String(request.approverId) : undefined,
    approvedAt: request.approvedAt?.toISOString() ?? null,
    rejectionReason: request.rejectionReason,
    createdAt: (request as ILeaveRequest & { createdAt: Date }).createdAt.toISOString(),
  };
}

function toAttendanceDto(record: InstanceType<typeof Attendance>): AttendanceDto {
  return {
    id: String(record._id),
    date: record.date.toISOString(),
    checkInTime: record.checkInTime?.toISOString() ?? null,
    checkOutTime: record.checkOutTime?.toISOString() ?? null,
    totalHours: record.totalHours ?? 0,
    status: record.status,
    workType: record.workType,
  };
}

async function executeWithTransaction<T>(
  ctx: RequestContext,
  fn: (session?: mongoose.ClientSession) => Promise<T>
): Promise<T> {
  const session = await mongoose.startSession();
  try {
    let result: T;
    try {
      await session.withTransaction(async () => {
        result = await fn(session);
      });
      return result!;
    } catch (err: any) {
      if (err.message && err.message.includes('Transaction numbers are only allowed')) {
        return await fn(undefined);
      }
      throw err;
    }
  } finally {
    await session.endSession();
  }
}

async function approvalRoute(employeeId: string, ctx: RequestContext) {
  const userRole = ctx.user.role;

  if (userRole === 'admin') {
    throw new ValidationError('Administrators cannot apply for leave.');
  }

  const { AuthUser } = await import('../../../core/auth/auth-model.js');
  const { Employee } = await import('../../employees/employees.model.js');

  const employee = await Employee.findById(employeeId);
  if (!employee) throw new ValidationError('Employee profile not found.');

  if (userRole === 'hr') {
    // HR's leave approval goes to Admin.
    const adminUser = await AuthUser.findOne({ role: 'admin', status: 'Active' });
    if (adminUser) {
      const adminEmployee = await Employee.findOne({ userId: adminUser._id, status: 'Active' });
      if (adminEmployee) return String(adminEmployee._id);
    }
    // Fallback: search for any active Employee whose department is Management, designation contains Admin, or has role admin
    const fallbackAdmin = await Employee.findOne({
      $or: [{ department: 'Management' }, { designation: /Admin/i }],
      status: 'Active'
    });
    if (fallbackAdmin) return String(fallbackAdmin._id);
    throw new ValidationError('No active administrator profile found to approve leave.');
  } else if (userRole === 'manager') {
    // Manager's leave approval goes to HR.
    const hrUser = await AuthUser.findOne({ role: 'hr', status: 'Active' });
    if (hrUser) {
      const hrEmployee = await Employee.findOne({ userId: hrUser._id, status: 'Active' });
      if (hrEmployee) return String(hrEmployee._id);
    }
    // Fallback: search for employee in department 'HR'
    const fallbackHr = await Employee.findOne({ department: 'HR', status: 'Active' });
    if (fallbackHr) return String(fallbackHr._id);
    throw new ValidationError('No active HR profile found to approve leave.');
  } else {
    // Employee applies -> reporting manager first, fallback to HR
    if (employee.reportingManagerId) {
      const manager = await Employee.findOne({ _id: employee.reportingManagerId, status: 'Active', deletedAt: null });
      if (manager) return String(manager._id);
    }

    // Fallback: Employee's leave approval goes to HR.
    const hrUser = await AuthUser.findOne({ role: 'hr', status: 'Active' });
    if (hrUser) {
      const hrEmployee = await Employee.findOne({ userId: hrUser._id, status: 'Active' });
      if (hrEmployee) return String(hrEmployee._id);
    }
    // Fallback: search for employee in department 'HR'
    const fallbackHr = await Employee.findOne({ department: 'HR', status: 'Active' });
    if (fallbackHr) return String(fallbackHr._id);
    throw new ValidationError('No active HR profile found to approve leave.');
  }
}


async function attendanceFor(employeeId: string, fromDate: Date, toDate: Date, ctx: RequestContext): Promise<AttendanceDto[]> {
  const records = await scopedFind(
    Attendance,
    { employeeId, date: { $gte: day(fromDate), $lte: day(toDate) } },
    { ...ctx, user: { ...ctx.user, role: 'hr' } },
  ).sort({ date: 1 });
  return records.map(toAttendanceDto);
}

async function markLeaveDates(employeeId: string, dates: Date[], session: ClientSession | undefined, actorId: string) {
  for (const date of dates) {
    await Attendance.updateOne(
      { employeeId, date },
      { $set: { checkInTime: null, checkOutTime: null, totalHours: 0, workType: 'Office', status: 'Leave', deviceInfo: 'Approved leave', updatedBy: new mongoose.Types.ObjectId(actorId) }, $setOnInsert: { createdBy: new mongoose.Types.ObjectId(actorId) } },
      { upsert: true, session: session ?? undefined },
    );
  }
}

export async function createLeaveType(data: CreateLeaveTypeInput, ctx: RequestContext) {
  return leaveTypeService.create(data, ctx);
}

export async function getLeaveTypes() {
  const result = await LeaveType.find({ status: 'Active' }).sort({ name: 1 });
  return result;
}

export async function getLeaveBalance(ctx: RequestContext) {
  const employee = await employeeService.getMine(ctx);
  return leaveTypeService.getBalanceForEmployee(employee.id, new Date().getUTCFullYear(), ctx);
}

export async function applyLeave(data: { leaveTypeId: string; fromDate: Date; toDate: Date; reason: string; documentUrl?: string }, ctx: RequestContext): Promise<LeaveRequestDto> {
  if (ctx.user.role === 'admin') {
    throw new ValidationError('Administrators cannot apply for leave.');
  }
  const employee = await employeeService.getMine(ctx);
  const approverId = await approvalRoute(employee.id, ctx);
  if (!approverId) throw new ValidationError('No manager or HR approver is available');
  const fromDate = day(data.fromDate);
  const toDate = day(data.toDate);
  const holidays = await Holiday.find({ date: { $gte: fromDate, $lte: toDate }, deletedAt: null });
  const holidayDates = new Set(holidays.map(h => day(h.date).getTime()));
  const dates = datesBetween(fromDate, toDate).filter(d => !holidayDates.has(day(d).getTime()));
  if (!dates.length) throw new ValidationError('The selected range contains no working days');

  const leaveType = await LeaveType.findOne({ _id: data.leaveTypeId, status: 'Active' });
  if (!leaveType) throw new NotFoundError('Active leave type not found');
  if (leaveType.requiresDocument && !data.documentUrl) throw new ValidationError('A supporting document is required for this leave type');
  const balance = await leaveTypeService.getBalance(employee.id, data.leaveTypeId, fromDate.getUTCFullYear());
  if (leaveType.annualQuota !== null && dates.length > balance.balance) throw new ValidationError(`Insufficient balance: requested ${dates.length} day(s), ${balance.balance} available`);
  const overlap = await LeaveRequest.findOne(scopeFilter({ employeeId: employee.id, status: { $in: ['Pending', 'Approved'] }, fromDate: { $lte: toDate }, toDate: { $gte: fromDate } }, ctx));
  if (overlap) throw new ConflictError('This leave range overlaps an existing request');
  const request = await LeaveRequest.create({ employeeId: employee.id, leaveTypeId: data.leaveTypeId, fromDate, toDate, days: dates.length, reason: data.reason, documentUrl: data.documentUrl, approverId, createdBy: new mongoose.Types.ObjectId(ctx.user.id), updatedBy: new mongoose.Types.ObjectId(ctx.user.id) });
  return toDto(request);
}

export async function getMyRequests(ctx: RequestContext): Promise<LeaveRequestDto[]> {
  const employee = await employeeService.getMine(ctx);
  const requests = await scopedFind(LeaveRequest, { employeeId: employee.id }, ctx).sort({ createdAt: -1 });
  const leaveTypes = await LeaveType.find({});
  const typeMap = new Map(leaveTypes.map((t) => [String(t._id), t.name]));
  return requests.map((req) => ({
    ...toDto(req),
    leaveTypeName: typeMap.get(String(req.leaveTypeId)) || 'Unknown',
  }));
}


export async function getTeamRequests(ctx: RequestContext): Promise<LeaveRequestDto[]> {
  const employee = ctx.user.role === 'hr' || ctx.user.role === 'admin' ? null : await employeeService.getMine(ctx);
  const filter: Record<string, unknown> = employee ? { approverId: employee.id, status: 'Pending' } : { status: 'Pending' };
  const requests = await scopedFind(LeaveRequest, filter, ctx).sort({ createdAt: 1 });
  return Promise.all(requests.map(async (request) => {
    const employeeRecord = await employeeService.getById(String(request.employeeId), { ...ctx, user: { ...ctx.user, role: 'hr' } });
    const type = await LeaveType.findById(request.leaveTypeId);
    const balance = await leaveTypeService.getBalance(String(request.employeeId), String(request.leaveTypeId), request.fromDate.getUTCFullYear());
    return { ...toDto(request), employeeName: employeeRecord.fullName, employeeCode: employeeRecord.employeeCode, department: employeeRecord.department, leaveTypeName: type?.name, allocated: balance.allocated, used: balance.used, remaining: balance.balance, attendance: await attendanceFor(String(request.employeeId), request.fromDate, request.toDate, ctx) };
  }));
}

export async function approveLeave(id: string, ctx: RequestContext): Promise<LeaveRequestDto> {
  const approverEmployee = await employeeService.getMine(ctx).catch(() => null);
  const isHrOrAdmin = ctx.user.role === 'hr' || ctx.user.role === 'admin';

  return executeWithTransaction(ctx, async (session) => {
    const request = await LeaveRequest.findOne(scopeFilter({ _id: id }, ctx)).session(session ?? null);
    if (!request) throw new NotFoundError('Leave request not found');

    if (request.status !== 'Pending') {
      throw new ValidationError(`Leave request is already ${request.status.toLowerCase()}`);
    }

    // Prevent approving own leave
    if (approverEmployee && String(request.employeeId) === approverEmployee.id) {
      throw new ForbiddenError('You cannot approve your own leave');
    }

    // Verify caller is designated approver if not HR/Admin
    if (!isHrOrAdmin && approverEmployee && String(request.approverId) !== approverEmployee.id) {
      throw new ForbiddenError('You are not the designated approver for this leave request');
    }

    const holidays = await Holiday.find({ date: { $gte: request.fromDate, $lte: request.toDate }, deletedAt: null }).session(session ?? null);
    const holidayDates = new Set(holidays.map(h => day(h.date).getTime()));
    const dates = datesBetween(request.fromDate, request.toDate).filter(d => !holidayDates.has(day(d).getTime()));
    
    // Deduct balance (increments 'used' days)
    await leaveTypeService.deductBalance(String(request.employeeId), String(request.leaveTypeId), request.fromDate.getUTCFullYear(), request.days, ctx, session);

    await markLeaveDates(String(request.employeeId), dates, session, ctx.user.id);
    request.status = 'Approved';
    
    // Save approverId and approvedAt as requested
    request.approverId = approverEmployee ? new mongoose.Types.ObjectId(approverEmployee.id) : new mongoose.Types.ObjectId(ctx.user.id);
    request.approvedAt = new Date();
    request.updatedBy = new mongoose.Types.ObjectId(ctx.user.id);
    await request.save({ session: session ?? null });
    const approved = toDto(request);

    // Notify the employee
    try {
      const { Employee } = await import('../../employees/employees.model.js');
      const employeeDoc = await Employee.findById(approved.employeeId);
      if (employeeDoc && employeeDoc.userId) {
        const { notify } = await import('../../../core/notifications/index.js');
        await notify({
          userId: employeeDoc.userId,
          type: 'leave.approved',
          title: 'Leave request approved',
          body: `Your leave request from ${new Date(approved.fromDate).toLocaleDateString()} to ${new Date(approved.toDate).toLocaleDateString()} has been approved.`,
          link: '/leave?tab=my',
        });
      }
    } catch (err) {
      console.error('[leave.service] failed to send approval notification', err);
    }

    return approved;
  });
}

export async function rejectLeave(id: string, reason: string, ctx: RequestContext): Promise<LeaveRequestDto> {
  const approverEmployee = await employeeService.getMine(ctx).catch(() => null);
  const isHrOrAdmin = ctx.user.role === 'hr' || ctx.user.role === 'admin';

  const request = await LeaveRequest.findOne(scopeFilter({ _id: id }, ctx));
  if (!request) throw new NotFoundError('Leave request not found');

  if (request.status !== 'Pending') {
    throw new ValidationError(`Leave request is already ${request.status.toLowerCase()}`);
  }

  if (approverEmployee && String(request.employeeId) === approverEmployee.id) {
    throw new ForbiddenError('You cannot reject your own leave');
  }

  if (!isHrOrAdmin && approverEmployee && String(request.approverId) !== approverEmployee.id) {
    throw new ForbiddenError('You are not the designated approver for this leave request');
  }

  request.status = 'Rejected';
  request.rejectionReason = reason;
  request.approverId = approverEmployee ? new mongoose.Types.ObjectId(approverEmployee.id) : new mongoose.Types.ObjectId(ctx.user.id);
  request.updatedBy = new mongoose.Types.ObjectId(ctx.user.id);
  await request.save();
  const dto = toDto(request);

  // Notify the employee
  try {
    const { Employee } = await import('../../employees/employees.model.js');
    const employeeDoc = await Employee.findById(dto.employeeId);
    if (employeeDoc && employeeDoc.userId) {
      const { notify } = await import('../../../core/notifications/index.js');
      await notify({
        userId: employeeDoc.userId,
        type: 'leave.rejected',
        title: 'Leave request rejected',
        body: `Your leave request from ${new Date(dto.fromDate).toLocaleDateString()} to ${new Date(dto.toDate).toLocaleDateString()} has been rejected. Reason: ${reason}`,
        link: '/leave?tab=my',
      });
    }
  } catch (err) {
    console.error('[leave.service] failed to send rejection notification', err);
  }

  return dto;
}

export async function cancelLeave(id: string, ctx: RequestContext): Promise<LeaveRequestDto> {
  const employee = await employeeService.getMine(ctx).catch(() => null);
  const isHrOrAdmin = ctx.user.role === 'hr' || ctx.user.role === 'admin';

  return executeWithTransaction(ctx, async (session) => {
    const filter = isHrOrAdmin ? { _id: id } : { _id: id, employeeId: employee ? employee.id : null };
    const request = await LeaveRequest.findOne(scopeFilter(filter, ctx)).session(session ?? null);
    if (!request) throw new NotFoundError('Leave request not found');

    if (request.status === 'Cancelled') {
      throw new ValidationError('Leave request is already cancelled');
    }

    if (request.status === 'Rejected') {
      throw new ValidationError('Rejected leave request cannot be cancelled');
    }

    const originalStatus = request.status;

    request.status = 'Cancelled';
    request.updatedBy = new mongoose.Types.ObjectId(ctx.user.id);
    await request.save({ session: session ?? null });

    if (originalStatus === 'Approved') {
      const holidays = await Holiday.find({ date: { $gte: request.fromDate, $lte: request.toDate }, deletedAt: null }).session(session ?? null);
      const holidayDates = new Set(holidays.map(h => day(h.date).getTime()));
      const dates = datesBetween(request.fromDate, request.toDate).filter(d => !holidayDates.has(day(d).getTime()));

      await leaveTypeService.restoreBalance(String(request.employeeId), String(request.leaveTypeId), request.fromDate.getUTCFullYear(), request.days, ctx, session);

      await Attendance.updateMany(
        { employeeId: request.employeeId, date: { $in: dates } },
        { $set: { deletedAt: new Date(), updatedBy: new mongoose.Types.ObjectId(ctx.user.id) } },
        { session: session ?? undefined }
      );
    }

    const cancelled = toDto(request);

    // Notify the employee
    try {
      const { Employee } = await import('../../employees/employees.model.js');
      const employeeDoc = await Employee.findById(cancelled.employeeId);
      if (employeeDoc && employeeDoc.userId) {
        const { notify } = await import('../../../core/notifications/index.js');
        await notify({
          userId: employeeDoc.userId,
          type: 'leave.cancelled',
          title: 'Leave request cancelled',
          body: `Your leave request from ${new Date(cancelled.fromDate).toLocaleDateString()} to ${new Date(cancelled.toDate).toLocaleDateString()} has been cancelled.`,
          link: '/leave?tab=my',
        });
      }
    } catch (err) {
      console.error('[leave.service] failed to send cancellation notification', err);
    }

    return cancelled;
  });
}
