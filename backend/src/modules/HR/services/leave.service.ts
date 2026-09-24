import mongoose, { type ClientSession, type HydratedDocument } from 'mongoose';
import type { RequestContext } from '../../../core/context.js';
import { toObjectId } from '../../../core/db/basePlugin.js';
import { withOptionalTransaction } from '../../../core/db/transaction.js';
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from '../../../core/errors/index.js';
import { scopeFilter, scopedCount, scopedFind } from '../../../core/scoping/index.js';
import { Employee } from '../../employees/employees.model.js';
import { employeeService } from '../../employees/employees.service.js';
import Attendance from '../models/attendance.model.js';
import Holiday from '../models/holiday.model.js';
import {
  LeaveBalance,
  LeaveRequest,
  LeaveType,
  type ILeaveBalance,
  type ILeaveRequest,
  type ILeaveType,
} from '../models/leave.model.js';
import type {
  AllocateBalanceInput,
  CreateLeaveRequestInput,
  CreateLeaveTypeInput,
  ListLeaveRequestsQuery,
  ListLeaveTypesQuery,
  UpdateLeaveRequestInput,
  UpdateLeaveTypeInput,
} from '../validators/leave.validator.js';

// ---------------------------------------------------------------------------
// DTOs & Interfaces
// ---------------------------------------------------------------------------

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
  updatedAt: string;
  employeeName?: string;
  employeeCode?: string;
  department?: string;
  leaveTypeName?: string;
  allocated?: number;
  used?: number;
  remaining?: number;
  attendance?: AttendanceDto[];
}

export interface LeaveTypeDto {
  id: string;
  name: string;
  code: string;
  annualQuota: number | null;
  carryForward: boolean;
  maxCarryForward: number;
  encashable: boolean;
  requiresDocument: boolean;
  status: string;
  createdAt: string;
  updatedAt: string;
}

export interface LeaveBalanceDto {
  id: string;
  employeeId: string;
  leaveTypeId: string;
  leaveTypeName: string;
  year: number;
  allocated: number;
  used: number;
  carriedForward: number;
  balance: number;
}

export interface PaginatedLeaveTypes {
  leaveTypes: LeaveTypeDto[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface AttendanceDto {
  id: string;
  date: string;
  checkInTime: string | null;
  checkOutTime: string | null;
  totalHours: number;
  status: string;
  workType: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function day(value: Date): Date {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
}

function datesBetween(from: Date, to: Date): Date[] {
  const dates: Date[] = [];
  for (let cursor = day(from); cursor <= day(to); cursor.setUTCDate(cursor.getUTCDate() + 1)) {
    if (cursor.getUTCDay() !== 0 && cursor.getUTCDay() !== 6) {
      dates.push(new Date(cursor));
    }
  }
  return dates;
}

function iso(value: Date | null | undefined): string {
  return (value ?? new Date()).toISOString();
}

function toTypeDto(doc: HydratedDocument<ILeaveType>): LeaveTypeDto {
  return {
    id: String(doc._id),
    name: doc.name,
    code: doc.code,
    annualQuota: doc.annualQuota,
    carryForward: doc.carryForward,
    maxCarryForward: doc.maxCarryForward,
    encashable: doc.encashable,
    requiresDocument: doc.requiresDocument,
    status: doc.status,
    createdAt: iso(doc.createdAt),
    updatedAt: iso(doc.updatedAt),
  };
}

function toBalanceDto(
  doc: HydratedDocument<ILeaveBalance> | ILeaveBalance,
  leaveTypeName: string
): LeaveBalanceDto {
  return {
    id: String(doc._id || ''),
    employeeId: String(doc.employeeId),
    leaveTypeId: String(doc.leaveTypeId),
    leaveTypeName,
    year: doc.year,
    allocated: doc.allocated,
    used: doc.used,
    carriedForward: doc.carriedForward,
    balance: doc.allocated + doc.carriedForward - doc.used,
  };
}

function toRequestDto(request: ILeaveRequest): LeaveRequestDto {
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
    approvedAt: request.approvedAt ? request.approvedAt.toISOString() : null,
    rejectionReason: request.rejectionReason,
    createdAt: (request as ILeaveRequest & { createdAt?: Date }).createdAt?.toISOString() ?? new Date().toISOString(),
    updatedAt: (request as ILeaveRequest & { updatedAt?: Date }).updatedAt?.toISOString() ?? new Date().toISOString(),
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

async function approvalRoute(employeeId: string, ctx: RequestContext): Promise<string> {
  const userRole = ctx.user.role;

  if (userRole === 'admin') {
    throw new ValidationError('Administrators cannot apply for leave.');
  }

  const { AuthUser } = await import('../../../core/auth/auth-model.js');
  const employee = await Employee.findById(employeeId);
  if (!employee) throw new ValidationError('Employee profile not found.');

  if (userRole === 'hr') {
    // HR's leave approval goes to Admin.
    const adminUser = await AuthUser.findOne({ role: 'admin', status: 'Active' });
    if (adminUser) {
      const adminEmployee = await Employee.findOne({ userId: adminUser._id, status: 'Active' });
      if (adminEmployee) return String(adminEmployee._id);
    }
    const fallbackAdmin = await Employee.findOne({
      $or: [{ department: 'Management' }, { designation: /Admin/i }],
      status: 'Active',
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
    const fallbackHr = await Employee.findOne({ department: 'HR', status: 'Active' });
    if (fallbackHr) return String(fallbackHr._id);
    throw new ValidationError('No active HR profile found to approve leave.');
  } else {
    // Regular employee applies -> reporting manager first, fallback to HR
    if (employee.reportingManagerId) {
      const manager = await Employee.findOne({
        _id: employee.reportingManagerId,
        status: 'Active',
        deletedAt: null,
      });
      if (manager) return String(manager._id);
    }

    const hrUser = await AuthUser.findOne({ role: 'hr', status: 'Active' });
    if (hrUser) {
      const hrEmployee = await Employee.findOne({ userId: hrUser._id, status: 'Active' });
      if (hrEmployee) return String(hrEmployee._id);
    }
    const fallbackHr = await Employee.findOne({ department: 'HR', status: 'Active' });
    if (fallbackHr) return String(fallbackHr._id);
    throw new ValidationError('No active HR profile found to approve leave.');
  }
}

async function attendanceFor(
  employeeId: string,
  fromDate: Date,
  toDate: Date,
  ctx: RequestContext
): Promise<AttendanceDto[]> {
  const records = await scopedFind(
    Attendance,
    { employeeId, date: { $gte: day(fromDate), $lte: day(toDate) } },
    { ...ctx, user: { ...ctx.user, role: 'hr' } }
  ).sort({ date: 1 });
  return records.map(toAttendanceDto);
}

async function markLeaveDates(
  employeeId: string,
  dates: Date[],
  session: ClientSession | undefined,
  actorId: string
): Promise<void> {
  for (const date of dates) {
    await Attendance.updateOne(
      { employeeId, date },
      {
        $set: {
          checkInTime: null,
          checkOutTime: null,
          totalHours: 0,
          workType: 'Office',
          status: 'Leave',
          deviceInfo: 'Approved leave',
          updatedBy: new mongoose.Types.ObjectId(actorId),
        },
        $setOnInsert: { createdBy: new mongoose.Types.ObjectId(actorId) },
      },
      { upsert: true, session: session ?? undefined }
    );
  }
}

async function assertCanAccessEmployeeLeave(employeeId: string, ctx: RequestContext): Promise<void> {
  const role = ctx.user.role;
  if (role === 'admin' || role === 'hr') {
    return;
  }

  const me = await Employee.findOne({ userId: ctx.user.id, deletedAt: null });
  if (!me) {
    throw new NotFoundError('No employee record is linked to your account');
  }

  const myEmployeeId = String(me._id);
  if (myEmployeeId === employeeId) {
    return;
  }

  if (role === 'manager') {
    const employee = await Employee.findOne({ _id: employeeId, deletedAt: null });
    if (employee && String(employee.reportingManagerId) === myEmployeeId) {
      return;
    }
  }

  throw new ForbiddenError("You do not have permission to view this employee's leave balance");
}

// ---------------------------------------------------------------------------
// Leave Type Services
// ---------------------------------------------------------------------------

export async function listLeaveTypes(
  query: ListLeaveTypesQuery,
  ctx: RequestContext
): Promise<PaginatedLeaveTypes> {
  const filter: Record<string, unknown> = {};
  if (query.status) filter.status = query.status;

  const skip = (query.page - 1) * query.pageSize;
  const elevatedCtx = {
    ...ctx,
    user: { ...ctx.user, role: 'hr' as const },
  };

  const [documents, total] = await Promise.all([
    scopedFind(LeaveType, filter, elevatedCtx).sort({ name: 1 }).skip(skip).limit(query.pageSize),
    scopedCount(LeaveType, filter, elevatedCtx),
  ]);

  return {
    leaveTypes: documents.map(toTypeDto),
    page: query.page,
    pageSize: query.pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
  };
}

export async function getLeaveTypeById(id: string, ctx: RequestContext): Promise<LeaveTypeDto> {
  const elevatedCtx = {
    ...ctx,
    user: { ...ctx.user, role: 'hr' as const },
  };
  const doc = await LeaveType.findOne(scopeFilter({ _id: id }, elevatedCtx));
  if (!doc) throw new NotFoundError('Leave type not found');
  return toTypeDto(doc);
}

export async function createLeaveType(
  input: CreateLeaveTypeInput,
  ctx: RequestContext
): Promise<LeaveTypeDto> {
  if (ctx.user.role !== 'admin' && ctx.user.role !== 'hr') {
    throw new ForbiddenError('Only HR and Admin can configure leave types');
  }

  const existing = await LeaveType.findOne({ code: input.code.toUpperCase() });
  if (existing) throw new ConflictError('A leave type with this code already exists');

  const created = await LeaveType.create({
    ...input,
    code: input.code.toUpperCase(),
    createdBy: toObjectId(ctx.user.id),
    updatedBy: toObjectId(ctx.user.id),
  });

  return toTypeDto(created);
}

export async function updateLeaveType(
  id: string,
  input: UpdateLeaveTypeInput,
  ctx: RequestContext
): Promise<LeaveTypeDto> {
  if (ctx.user.role !== 'admin' && ctx.user.role !== 'hr') {
    throw new ForbiddenError('Only HR and Admin can configure leave types');
  }

  const doc = await LeaveType.findOne(scopeFilter({ _id: id }, ctx));
  if (!doc) throw new NotFoundError('Leave type not found');

  if (input.code && input.code.toUpperCase() !== doc.code) {
    const existing = await LeaveType.findOne({ code: input.code.toUpperCase() });
    if (existing) throw new ConflictError('A leave type with this code already exists');
  }

  Object.assign(doc, input, { updatedBy: toObjectId(ctx.user.id) });
  await doc.save();

  if (input.annualQuota !== undefined) {
    await LeaveBalance.updateMany(
      { leaveTypeId: id, year: new Date().getUTCFullYear() },
      { $set: { allocated: input.annualQuota ?? 0, updatedBy: toObjectId(ctx.user.id) } }
    );
  }

  return toTypeDto(doc);
}

export async function deleteLeaveType(id: string, ctx: RequestContext): Promise<LeaveTypeDto> {
  if (ctx.user.role !== 'admin' && ctx.user.role !== 'hr') {
    throw new ForbiddenError('Only HR and Admin can configure leave types');
  }

  const doc = await LeaveType.findOne(scopeFilter({ _id: id }, ctx));
  if (!doc) throw new NotFoundError('Leave type not found');

  doc.status = 'Inactive';
  doc.updatedBy = toObjectId(ctx.user.id);
  await doc.save();

  return toTypeDto(doc);
}

export async function getLeaveTypes(): Promise<ILeaveType[]> {
  return LeaveType.find({ status: 'Active' }).sort({ name: 1 });
}

// ---------------------------------------------------------------------------
// Balance Services
// ---------------------------------------------------------------------------

export async function getBalanceForEmployee(
  employeeId: string,
  year: number,
  ctx: RequestContext
): Promise<LeaveBalanceDto[]> {
  await assertCanAccessEmployeeLeave(employeeId, ctx);

  const elevatedCtx = {
    ...ctx,
    user: { ...ctx.user, role: 'hr' as const },
  };
  const leaveTypes = await scopedFind(LeaveType, { status: 'Active' }, elevatedCtx);
  const balances = await LeaveBalance.find({ employeeId, year });

  const balanceByType = new Map(balances.map((b: HydratedDocument<ILeaveBalance>) => [String(b.leaveTypeId), b]));

  return leaveTypes.map((lt) => {
    const existing = balanceByType.get(String(lt._id));
    const row =
      existing ??
      ({
        _id: undefined,
        employeeId: toObjectId(employeeId),
        leaveTypeId: lt._id,
        year,
        allocated: lt.annualQuota ?? 0,
        used: 0,
        carriedForward: 0,
      } as unknown as ILeaveBalance);

    return toBalanceDto(row, lt.name);
  });
}

export async function getBalance(
  employeeId: string,
  leaveTypeId: string,
  year: number
): Promise<{ allocated: number; used: number; carriedForward: number; balance: number }> {
  const leaveType = await LeaveType.findById(leaveTypeId);
  if (!leaveType) throw new NotFoundError('Leave type not found');

  const row = await LeaveBalance.findOne({ employeeId, leaveTypeId, year });
  const allocated = row?.allocated ?? leaveType.annualQuota ?? 0;
  const used = row?.used ?? 0;
  const carriedForward = row?.carriedForward ?? 0;

  return { allocated, used, carriedForward, balance: allocated + carriedForward - used };
}

export async function allocateBalance(
  input: AllocateBalanceInput,
  ctx: RequestContext
): Promise<LeaveBalanceDto> {
  if (ctx.user.role !== 'admin' && ctx.user.role !== 'hr') {
    throw new ForbiddenError('Only HR and Admin can allocate leave balances');
  }

  const leaveType = await LeaveType.findById(input.leaveTypeId);
  if (!leaveType) throw new NotFoundError('Leave type not found');

  if (leaveType.annualQuota === null) {
    throw new ValidationError(`${leaveType.name} has no fixed quota and cannot be allocated`);
  }

  const employee = await Employee.findById(input.employeeId);
  if (!employee) throw new NotFoundError('Employee not found');

  let allocatedDays = input.proratedDays;
  if (allocatedDays === undefined) {
    const joinDate = new Date(employee.dateOfJoining);
    const joinYear = joinDate.getFullYear();

    if (joinYear === input.year) {
      const endOfYear = new Date(input.year, 11, 31, 23, 59, 59, 999);
      const diffTime = endOfYear.getTime() - joinDate.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      const totalDaysInYear =
        input.year % 4 === 0 && (input.year % 100 !== 0 || input.year % 400 === 0) ? 366 : 365;
      const daysActive = Math.max(0, Math.min(totalDaysInYear, diffDays));
      allocatedDays = Math.round((leaveType.annualQuota || 0) * (daysActive / totalDaysInYear));
    } else if (joinYear > input.year) {
      allocatedDays = 0;
    } else {
      allocatedDays = leaveType.annualQuota || 0;
    }
  }

  let carriedForward = 0;
  if (leaveType.carryForward) {
    const prevYearRow = await LeaveBalance.findOne({
      employeeId: input.employeeId,
      leaveTypeId: input.leaveTypeId,
      year: input.year - 1,
    });
    if (prevYearRow) {
      const remaining = prevYearRow.allocated + prevYearRow.carriedForward - prevYearRow.used;
      carriedForward = Math.min(Math.max(0, remaining), leaveType.maxCarryForward);
    }
  }

  const row = await LeaveBalance.findOneAndUpdate(
    { employeeId: input.employeeId, leaveTypeId: input.leaveTypeId, year: input.year },
    {
      $setOnInsert: {
        createdBy: toObjectId(ctx.user.id),
      },
      $set: {
        allocated: allocatedDays,
        carriedForward,
        updatedBy: toObjectId(ctx.user.id),
      },
    },
    { returnDocument: 'after', upsert: true }
  );

  return toBalanceDto(row!, leaveType.name);
}

export async function deductBalance(
  employeeId: string,
  leaveTypeId: string,
  year: number,
  days: number,
  ctx: RequestContext,
  session?: ClientSession
): Promise<void> {
  const leaveType = await LeaveType.findById(leaveTypeId).session(session ?? null);
  if (!leaveType) throw new NotFoundError('Leave type not found');

  if (leaveType.annualQuota === null) return;

  const row = await LeaveBalance.findOneAndUpdate(
    { employeeId, leaveTypeId, year },
    {
      $setOnInsert: {
        allocated: leaveType.annualQuota ?? 0,
        used: 0,
        carriedForward: 0,
        createdBy: toObjectId(ctx.user.id),
      },
    },
    { returnDocument: 'after', upsert: true, session }
  );
  const available = (row?.allocated ?? 0) + (row?.carriedForward ?? 0) - (row?.used ?? 0);

  if (days > available) {
    throw new ValidationError(`Insufficient balance: requested ${days} day(s), ${available} available`);
  }

  await LeaveBalance.updateOne(
    { employeeId, leaveTypeId, year },
    { $inc: { used: days }, $set: { updatedBy: toObjectId(ctx.user.id) } },
    { session }
  );
}

export async function restoreBalance(
  employeeId: string,
  leaveTypeId: string,
  year: number,
  days: number,
  ctx: RequestContext,
  session?: ClientSession
): Promise<void> {
  const leaveType = await LeaveType.findById(leaveTypeId).session(session ?? null);
  if (!leaveType || leaveType.annualQuota === null) return;

  await LeaveBalance.updateOne(
    { employeeId, leaveTypeId, year },
    { $inc: { used: -days }, $set: { updatedBy: toObjectId(ctx.user.id) } },
    { session }
  );
}

export async function getLeaveBalance(ctx: RequestContext): Promise<LeaveBalanceDto[]> {
  const employee = await employeeService.getMine(ctx);
  return getBalanceForEmployee(employee.id, new Date().getUTCFullYear(), ctx);
}

// ---------------------------------------------------------------------------
// Leave Request Services
// ---------------------------------------------------------------------------

export async function applyLeave(
  data: {
    leaveTypeId: string;
    fromDate: Date;
    toDate: Date;
    days?: number;
    reason: string;
    documentUrl?: string;
  },
  ctx: RequestContext
): Promise<LeaveRequestDto> {
  if (ctx.user.role === 'admin') {
    throw new ValidationError('Administrators cannot apply for leave.');
  }

  const employee = await employeeService.getMine(ctx);
  const approverId = await approvalRoute(employee.id, ctx);
  if (!approverId) throw new ValidationError('No manager or HR approver is available');

  const fromDate = day(data.fromDate);
  const toDate = day(data.toDate);

  if (toDate < fromDate) {
    throw new ValidationError('To date cannot be before from date');
  }

  const holidays = await Holiday.find({ date: { $gte: fromDate, $lte: toDate }, deletedAt: null });
  const holidayDates = new Set(holidays.map((h) => day(h.date).getTime()));
  const dates = datesBetween(fromDate, toDate).filter((d) => !holidayDates.has(day(d).getTime()));

  if (!dates.length) {
    throw new ValidationError('The selected range contains no working days');
  }

  // Support half-day (0.5) if requested for a single working day
  const effectiveDays =
    data.days && data.days > 0 && data.days <= dates.length ? data.days : dates.length;

  const leaveType = await LeaveType.findOne({ _id: data.leaveTypeId, status: 'Active' });
  if (!leaveType) throw new NotFoundError('Active leave type not found');

  if (leaveType.requiresDocument && !data.documentUrl) {
    throw new ValidationError('A supporting document is required for this leave type');
  }

  const balance = await getBalance(employee.id, data.leaveTypeId, fromDate.getUTCFullYear());
  if (leaveType.annualQuota !== null && effectiveDays > balance.balance) {
    throw new ValidationError(
      `Insufficient balance: requested ${effectiveDays} day(s), ${balance.balance} available`
    );
  }

  const overlap = await LeaveRequest.findOne(
    scopeFilter(
      {
        employeeId: employee.id,
        status: { $in: ['Pending', 'Approved'] },
        fromDate: { $lte: toDate },
        toDate: { $gte: fromDate },
      },
      ctx
    )
  );
  if (overlap) throw new ConflictError('This leave range overlaps an existing request');

  const request = await LeaveRequest.create({
    employeeId: employee.id,
    leaveTypeId: data.leaveTypeId,
    fromDate,
    toDate,
    days: effectiveDays,
    reason: data.reason,
    documentUrl: data.documentUrl,
    approverId,
    createdBy: toObjectId(ctx.user.id),
    updatedBy: toObjectId(ctx.user.id),
  });

  return toRequestDto(request);
}

export async function getMyRequests(
  ctx: RequestContext,
  status?: string
): Promise<LeaveRequestDto[]> {
  const employee = await employeeService.getMine(ctx);
  const filter: Record<string, unknown> = { employeeId: employee.id };
  if (status && status !== 'All') {
    filter.status = status;
  }

  const requests = await scopedFind(LeaveRequest, filter, ctx).sort({ createdAt: -1 });
  const leaveTypes = await LeaveType.find({});
  const typeMap = new Map(leaveTypes.map((t) => [String(t._id), t.name]));

  return requests.map((req) => ({
    ...toRequestDto(req),
    leaveTypeName: typeMap.get(String(req.leaveTypeId)) || 'Unknown',
  }));
}

export async function getTeamRequests(
  ctx: RequestContext,
  status?: string
): Promise<LeaveRequestDto[]> {
  const isHrOrAdmin = ctx.user.role === 'hr' || ctx.user.role === 'admin';
  const employee = isHrOrAdmin ? null : await employeeService.getMine(ctx);

  const filter: Record<string, unknown> = {};
  if (status && status !== 'All') {
    filter.status = status;
  } else if (!status) {
    filter.status = 'Pending';
  }

  if (employee) {
    filter.approverId = employee.id;
  }

  const requests = await scopedFind(LeaveRequest, filter, ctx).sort({ createdAt: 1 });
  const leaveTypes = await LeaveType.find({});
  const typeMap = new Map(leaveTypes.map((t) => [String(t._id), t.name]));

  return Promise.all(
    requests.map(async (request) => {
      const employeeRecord = await employeeService
        .getById(String(request.employeeId), { ...ctx, user: { ...ctx.user, role: 'hr' } })
        .catch(() => null);
      const balance = await getBalance(
        String(request.employeeId),
        String(request.leaveTypeId),
        request.fromDate.getUTCFullYear()
      ).catch(() => ({ allocated: 0, used: 0, carriedForward: 0, balance: 0 }));
      const att = await attendanceFor(
        String(request.employeeId),
        request.fromDate,
        request.toDate,
        ctx
      ).catch(() => []);

      return {
        ...toRequestDto(request),
        employeeName: employeeRecord?.fullName || 'Unknown',
        employeeCode: employeeRecord?.employeeCode || '',
        department: employeeRecord?.department || '',
        leaveTypeName: typeMap.get(String(request.leaveTypeId)) || 'Leave',
        allocated: balance.allocated,
        used: balance.used,
        remaining: balance.balance,
        attendance: att,
      };
    })
  );
}

export async function getCalendarLeaves(
  year?: number,
  month?: number,
  ctx?: RequestContext
): Promise<Array<LeaveRequestDto & { employeeName?: string }>> {
  const currentYear = year ?? new Date().getUTCFullYear();
  let fromDate: Date;
  let toDate: Date;

  if (month !== undefined && month >= 0 && month <= 11) {
    fromDate = new Date(Date.UTC(currentYear, month, 1));
    toDate = new Date(Date.UTC(currentYear, month + 1, 0, 23, 59, 59, 999));
  } else {
    fromDate = new Date(Date.UTC(currentYear, 0, 1));
    toDate = new Date(Date.UTC(currentYear, 11, 31, 23, 59, 59, 999));
  }

  const isHrOrAdmin =
    ctx && (ctx.user.role === 'hr' || ctx.user.role === 'admin' || ctx.user.role === 'manager');
  const filter: Record<string, unknown> = {
    status: 'Approved',
    fromDate: { $lte: toDate },
    toDate: { $gte: fromDate },
  };

  if (!isHrOrAdmin && ctx) {
    const employee = await employeeService.getMine(ctx).catch(() => null);
    if (employee) {
      filter.employeeId = employee.id;
    } else {
      return [];
    }
  }

  const requests = await LeaveRequest.find(filter).sort({ fromDate: 1 });
  const leaveTypes = await LeaveType.find({});
  const typeMap = new Map(leaveTypes.map((t) => [String(t._id), t.name]));

  return Promise.all(
    requests.map(async (req) => {
      const emp = ctx
        ? await employeeService
            .getById(String(req.employeeId), { ...ctx, user: { ...ctx.user, role: 'hr' } })
            .catch(() => null)
        : null;
      return {
        ...toRequestDto(req),
        leaveTypeName: typeMap.get(String(req.leaveTypeId)) || 'Leave',
        employeeName: emp?.fullName || 'Employee',
        employeeCode: emp?.employeeCode || '',
        department: emp?.department || '',
      };
    })
  );
}

export async function getLeaveById(id: string, ctx: RequestContext): Promise<LeaveRequestDto> {
  const request = await LeaveRequest.findOne(scopeFilter({ _id: id }, ctx));
  if (!request) throw new NotFoundError('Leave request not found');

  const leaveType = await LeaveType.findById(request.leaveTypeId);
  const employeeRecord = await employeeService
    .getById(String(request.employeeId), { ...ctx, user: { ...ctx.user, role: 'hr' } })
    .catch(() => null);
  const balance = await getBalance(
    String(request.employeeId),
    String(request.leaveTypeId),
    request.fromDate.getUTCFullYear()
  ).catch(() => ({ allocated: 0, used: 0, carriedForward: 0, balance: 0 }));
  const att = await attendanceFor(
    String(request.employeeId),
    request.fromDate,
    request.toDate,
    ctx
  ).catch(() => []);

  return {
    ...toRequestDto(request),
    employeeName: employeeRecord?.fullName || 'Unknown',
    employeeCode: employeeRecord?.employeeCode || '',
    department: employeeRecord?.department || '',
    leaveTypeName: leaveType?.name || 'Leave',
    allocated: balance.allocated,
    used: balance.used,
    remaining: balance.balance,
    attendance: att,
  };
}

export async function updateLeave(
  id: string,
  data: UpdateLeaveRequestInput,
  ctx: RequestContext
): Promise<LeaveRequestDto> {
  const employee = await employeeService.getMine(ctx).catch(() => null);
  const isHrOrAdmin = ctx.user.role === 'hr' || ctx.user.role === 'admin';

  const filter = isHrOrAdmin ? { _id: id } : { _id: id, employeeId: employee ? employee.id : null };
  const request = await LeaveRequest.findOne(scopeFilter(filter, ctx));
  if (!request) throw new NotFoundError('Leave request not found');

  if (request.status !== 'Pending') {
    throw new ValidationError(`Cannot edit leave request with status ${request.status}`);
  }

  if (data.fromDate) request.fromDate = day(data.fromDate);
  if (data.toDate) request.toDate = day(data.toDate);
  if (data.leaveTypeId) request.leaveTypeId = toObjectId(data.leaveTypeId);
  if (data.reason !== undefined) request.reason = data.reason;
  if (data.documentUrl !== undefined) request.documentUrl = data.documentUrl;

  if (data.fromDate || data.toDate) {
    const holidays = await Holiday.find({
      date: { $gte: request.fromDate, $lte: request.toDate },
      deletedAt: null,
    });
    const holidayDates = new Set(holidays.map((h) => day(h.date).getTime()));
    const dates = datesBetween(request.fromDate, request.toDate).filter(
      (d) => !holidayDates.has(day(d).getTime())
    );

    if (!dates.length) {
      throw new ValidationError('The selected range contains no working days');
    }

    request.days =
      data.days && data.days > 0 && data.days <= dates.length ? data.days : dates.length;
  } else if (data.days !== undefined) {
    request.days = data.days;
  }

  request.updatedBy = toObjectId(ctx.user.id);
  await request.save();

  return toRequestDto(request);
}

export async function deleteLeave(id: string, ctx: RequestContext): Promise<LeaveRequestDto> {
  const employee = await employeeService.getMine(ctx).catch(() => null);
  const isHrOrAdmin = ctx.user.role === 'hr' || ctx.user.role === 'admin';

  const filter = isHrOrAdmin ? { _id: id } : { _id: id, employeeId: employee ? employee.id : null };
  const request = await LeaveRequest.findOne(scopeFilter(filter, ctx));
  if (!request) throw new NotFoundError('Leave request not found');

  if (request.status === 'Approved') {
    // Cancelling approved leave restores balance & cleans attendance
    return cancelLeave(id, ctx);
  }

  request.status = 'Cancelled';
  request.updatedBy = toObjectId(ctx.user.id);
  await request.save();

  return toRequestDto(request);
}

export async function approveLeave(id: string, ctx: RequestContext): Promise<LeaveRequestDto> {
  const approverEmployee = await employeeService.getMine(ctx).catch(() => null);
  const isHrOrAdmin = ctx.user.role === 'hr' || ctx.user.role === 'admin';

  return withOptionalTransaction(async (session) => {
    const request = await LeaveRequest.findOne(scopeFilter({ _id: id }, ctx)).session(session ?? null);
    if (!request) throw new NotFoundError('Leave request not found');

    if (request.status !== 'Pending') {
      throw new ValidationError(`Leave request is already ${request.status.toLowerCase()}`);
    }

    if (approverEmployee && String(request.employeeId) === approverEmployee.id) {
      throw new ForbiddenError('You cannot approve your own leave');
    }

    if (!isHrOrAdmin && approverEmployee && String(request.approverId) !== approverEmployee.id) {
      throw new ForbiddenError('You are not the designated approver for this leave request');
    }

    const holidays = await Holiday.find({
      date: { $gte: request.fromDate, $lte: request.toDate },
      deletedAt: null,
    }).session(session ?? null);
    const holidayDates = new Set(holidays.map((h) => day(h.date).getTime()));
    const dates = datesBetween(request.fromDate, request.toDate).filter(
      (d) => !holidayDates.has(day(d).getTime())
    );

    await deductBalance(
      String(request.employeeId),
      String(request.leaveTypeId),
      request.fromDate.getUTCFullYear(),
      request.days,
      ctx,
      session
    );

    await markLeaveDates(String(request.employeeId), dates, session, ctx.user.id);
    request.status = 'Approved';
    request.approverId = approverEmployee
      ? toObjectId(approverEmployee.id)
      : toObjectId(ctx.user.id);
    request.approvedAt = new Date();
    request.updatedBy = toObjectId(ctx.user.id);
    await request.save({ session: session ?? null });

    const approved = toRequestDto(request);

    // Notify the employee
    try {
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

export async function rejectLeave(
  id: string,
  reason: string,
  ctx: RequestContext
): Promise<LeaveRequestDto> {
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
  request.approverId = approverEmployee
    ? toObjectId(approverEmployee.id)
    : toObjectId(ctx.user.id);
  request.updatedBy = toObjectId(ctx.user.id);
  await request.save();

  const dto = toRequestDto(request);

  try {
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

  return withOptionalTransaction(async (session) => {
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
    request.updatedBy = toObjectId(ctx.user.id);
    await request.save({ session: session ?? null });

    if (originalStatus === 'Approved') {
      const holidays = await Holiday.find({
        date: { $gte: request.fromDate, $lte: request.toDate },
        deletedAt: null,
      }).session(session ?? null);
      const holidayDates = new Set(holidays.map((h) => day(h.date).getTime()));
      const dates = datesBetween(request.fromDate, request.toDate).filter(
        (d) => !holidayDates.has(day(d).getTime())
      );

      await restoreBalance(
        String(request.employeeId),
        String(request.leaveTypeId),
        request.fromDate.getUTCFullYear(),
        request.days,
        ctx,
        session
      );

      await Attendance.updateMany(
        { employeeId: request.employeeId, date: { $in: dates } },
        { $set: { deletedAt: new Date(), updatedBy: toObjectId(ctx.user.id) } },
        { session: session ?? undefined }
      );
    }

    const cancelled = toRequestDto(request);

    try {
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

// ---------------------------------------------------------------------------
// Unified Service Objects (Backwards Compatibility)
// ---------------------------------------------------------------------------

export const leaveService = {
  listLeaveTypes,
  getLeaveTypeById,
  createLeaveType,
  updateLeaveType,
  deleteLeaveType,
  getLeaveTypes,
  getBalanceForEmployee,
  getBalance,
  allocateBalance,
  deductBalance,
  getLeaveBalance,
  getMyLeaveBalance: getLeaveBalance,
  applyLeave,
  getMyRequests,
  getTeamRequests,
  getCalendarLeaves,
  getLeaveById,
  updateLeave,
  deleteLeave,
  approveLeave,
  rejectLeave,
  cancelLeave,
};

export const leaveTypeService = {
  list: listLeaveTypes,
  getById: getLeaveTypeById,
  create: createLeaveType,
  update: updateLeaveType,
  delete: deleteLeaveType,
  getBalanceForEmployee,
  getBalance,
  allocate: allocateBalance,
  deductBalance,
  restoreBalance,
};
