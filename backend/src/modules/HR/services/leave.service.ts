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
import { ROLE_LABELS } from '../../../core/rbac/permissions.js';
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
import { computeBalance, policyOf, type ComputedBalance } from './leave-balance.js';
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
  decidedByName?: string;
  decidedByRole?: string;
  decidedAt: string | null;
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
  quotaPeriod: 'Monthly' | 'Yearly' | 'Unlimited';
  quotaDays: number;
  annualQuota: number | null;
  carryForward: boolean;
  maxCarryForward: number;
  carryForwardExpiryMonths: number | null;
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
  /** Credited so far + usable carried days (0 when unlimited). */
  allocated: number;
  used: number;
  carriedForward: number;
  /** Remaining (0 when unlimited — check `unlimited`). */
  balance: number;
  unlimited: boolean;
  quotaPeriod: 'Monthly' | 'Yearly' | 'Unlimited';
  quotaDays: number;
  /** What the full year adds up to (null when unlimited). */
  yearEntitlement: number | null;
  carriedExpiresOn: string | null;
  carriedExpired: boolean;
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
  const policy = policyOf(doc);
  return {
    id: String(doc._id),
    name: doc.name,
    code: doc.code,
    quotaPeriod: policy.quotaPeriod,
    quotaDays: policy.quotaDays,
    annualQuota: doc.annualQuota,
    carryForward: doc.carryForward,
    maxCarryForward: doc.maxCarryForward,
    carryForwardExpiryMonths: policy.carryForwardExpiryMonths,
    encashable: doc.encashable,
    requiresDocument: doc.requiresDocument,
    status: doc.status,
    createdAt: iso(doc.createdAt),
    updatedAt: iso(doc.updatedAt),
  };
}

function balanceDto(
  employeeId: string,
  type: HydratedDocument<ILeaveType> | ILeaveType,
  year: number,
  b: ComputedBalance,
  rowId?: unknown
): LeaveBalanceDto {
  const unlimited = b.balance == null;
  return {
    id: rowId ? String(rowId) : '',
    employeeId,
    leaveTypeId: String(type._id),
    leaveTypeName: type.name,
    year,
    allocated: b.allocated ?? 0,
    used: b.used,
    carriedForward: b.carriedForward,
    balance: b.balance ?? 0,
    unlimited,
    quotaPeriod: b.quotaPeriod,
    quotaDays: b.quotaDays,
    yearEntitlement: b.yearEntitlement,
    carriedExpiresOn: b.carriedExpiresOn,
    carriedExpired: b.carriedExpired,
  };
}

/** Used days per leave type for an employee in a year, from the LeaveBalance ledger. */
async function usedByType(employeeId: string, year: number, session?: ClientSession) {
  const rows = await LeaveBalance.find({ employeeId, year }).session(session ?? null);
  return new Map(rows.map((r) => [String(r.leaveTypeId), r]));
}

/**
 * Approved days of this type that started on/before the carry-forward expiry date —
 * only those can have used carried-over days. undefined when the type has no expiry.
 */
async function usedBeforeCarryExpiry(
  employeeId: string,
  type: ILeaveType,
  year: number,
  session?: ClientSession
): Promise<number | undefined> {
  const policy = policyOf(type);
  if (!policy.carryForward || !policy.carryForwardExpiryMonths) return undefined;
  const expiry = new Date(Date.UTC(year, policy.carryForwardExpiryMonths, 0, 23, 59, 59));
  const rows = await LeaveRequest.find({
    employeeId,
    leaveTypeId: type._id,
    status: 'Approved',
    fromDate: { $gte: new Date(Date.UTC(year, 0, 1)), $lte: expiry },
    deletedAt: null,
  })
    .select('days')
    .session(session ?? null);
  return rows.reduce((sum, r) => sum + r.days, 0);
}

async function computeFor(
  employeeId: string,
  type: ILeaveType,
  year: number,
  asOf?: Date,
  session?: ClientSession
): Promise<{ computed: ComputedBalance; rowId?: unknown }> {
  const [employee, thisYear, lastYear, beforeExpiry] = await Promise.all([
    Employee.findById(employeeId).select('dateOfJoining').session(session ?? null),
    LeaveBalance.findOne({ employeeId, leaveTypeId: type._id, year }).session(session ?? null),
    LeaveBalance.findOne({ employeeId, leaveTypeId: type._id, year: year - 1 }).session(session ?? null),
    usedBeforeCarryExpiry(employeeId, type, year, session),
  ]);
  const computed = computeBalance({
    policy: policyOf(type),
    year,
    asOf,
    joinedOn: employee?.dateOfJoining ?? null,
    usedThisYear: thisYear?.used ?? 0,
    usedLastYear: lastYear?.used ?? 0,
    usedBeforeCarryExpiry: beforeExpiry,
  });
  return { computed, rowId: thisYear?._id };
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
    decidedByName: request.decidedByName,
    decidedByRole: request.decidedByRole,
    decidedAt: request.decidedAt
      ? request.decidedAt.toISOString()
      : request.approvedAt
        ? request.approvedAt.toISOString()
        : null,
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

function stampDecision(request: ILeaveRequest, ctx: RequestContext): void {
  request.decidedByUserId = toObjectId(ctx.user.id);
  request.decidedByName = ctx.user.name;
  request.decidedByRole = ROLE_LABELS[ctx.user.role] ?? ctx.user.role;
  request.decidedAt = new Date();
}

function formatLeaveDate(value: string | Date): string {
  return new Date(value).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

function leaveRange(dto: LeaveRequestDto): string {
  const from = formatLeaveDate(dto.fromDate);
  const to = formatLeaveDate(dto.toDate);
  const days = `${dto.days} day${dto.days === 1 ? '' : 's'}`;
  return from === to ? `${from} (${days})` : `${from} to ${to} (${days})`;
}

/**
 * Everyone who reviews this leave: all active HR + admins, plus the designated
 * approver (e.g. the reporting manager). Never includes the actor or the employee.
 */
async function leaveReviewerUserIds(
  request: { approverId?: string; employeeId: string },
  exclude: Array<string | undefined>
): Promise<string[]> {
  const { AuthUser } = await import('../../../core/auth/auth-model.js');
  const ids = new Set<string>();

  const staff = await AuthUser.find({ role: { $in: ['hr', 'admin'] }, status: 'Active', deletedAt: null }).select('_id');
  staff.forEach((u) => ids.add(String(u._id)));

  if (request.approverId) {
    // approverId is usually an Employee id; for admins without a profile it can be the user id itself.
    const approverEmp = await Employee.findById(request.approverId).select('userId');
    if (approverEmp?.userId) ids.add(String(approverEmp.userId));
    else if (await AuthUser.exists({ _id: request.approverId })) ids.add(String(request.approverId));
  }

  const employee = await Employee.findById(request.employeeId).select('userId');
  const skip = new Set([...exclude, employee?.userId ? String(employee.userId) : undefined].filter(Boolean));
  return [...ids].filter((id) => !skip.has(id));
}

async function describeLeave(dto: LeaveRequestDto) {
  const [leaveType, employee] = await Promise.all([
    LeaveType.findById(dto.leaveTypeId).select('name'),
    Employee.findById(dto.employeeId).select('userId fullName'),
  ]);
  return {
    employee,
    employeeName: employee?.fullName ?? 'An employee',
    what: `${leaveType?.name ?? 'leave'} for ${leaveRange(dto)}`,
  };
}

function actorLabel(ctx: RequestContext): string {
  return `${ctx.user.name} (${ROLE_LABELS[ctx.user.role] ?? ctx.user.role})`;
}

/** Notifications are best-effort: a failure is logged, never fails the leave action. */
async function safely(label: string, fn: () => Promise<void>): Promise<void> {
  try {
    await fn();
  } catch (err) {
    console.error(`[leave.service] failed to send ${label} notification`, err);
  }
}

/** New request → designated approver (in-app + email) and HR/admins (in-app). */
async function notifyLeaveRequested(dto: LeaveRequestDto, ctx: RequestContext): Promise<void> {
  await safely('leave.requested', async () => {
    const { notify } = await import('../../../core/notifications/index.js');
    const { employeeName, what } = await describeLeave(dto);
    const reviewers = await leaveReviewerUserIds(dto, [ctx.user.id]);

    let approverUserId: string | undefined;
    if (dto.approverId) {
      const approverEmp = await Employee.findById(dto.approverId).select('userId');
      approverUserId = approverEmp?.userId ? String(approverEmp.userId) : undefined;
    }

    await Promise.all(
      reviewers.map((userId) =>
        notify({
          userId,
          type: 'leave.requested',
          title: `${employeeName} requested leave`,
          body: `${employeeName} has applied for ${what}.${dto.reason ? `\n\nReason: ${dto.reason}` : ''}`,
          link: '/leave?tab=approvals',
          email: userId === approverUserId, // the person expected to act gets an email too
        })
      )
    );
  });
}

/**
 * Approved / rejected →
 *   the employee: in-app + email ("approved by Priya (HR)")
 *   other reviewers: in-app FYI, so nobody acts on it twice
 */
async function notifyLeaveDecision(
  dto: LeaveRequestDto,
  decision: 'approved' | 'rejected',
  ctx: RequestContext,
  reason?: string
): Promise<void> {
  await safely(`leave.${decision}`, async () => {
    const { notify } = await import('../../../core/notifications/index.js');
    const { employee, employeeName, what } = await describeLeave(dto);
    const by = actorLabel(ctx);

    if (employee?.userId) {
      await notify({
        userId: employee.userId,
        type: `leave.${decision}`,
        title: decision === 'approved' ? 'Your leave has been approved' : 'Your leave request was not approved',
        body:
          decision === 'approved'
            ? `Your ${what} has been approved by ${by}. It now shows on the leave calendar.`
            : `Your ${what} has been rejected by ${by}.${reason ? `\n\nReason: ${reason}` : ''}`,
        link: '/leave?tab=my',
        email: true,
      });
    }

    const reviewers = await leaveReviewerUserIds(dto, [ctx.user.id]);
    await Promise.all(
      reviewers.map((userId) =>
        notify({
          userId,
          type: `leave.${decision}.fyi`,
          title: `${employeeName}'s leave was ${decision}`,
          body: `${by} ${decision} ${employeeName}'s ${what}.${reason ? ` Reason: ${reason}` : ''}`,
          link: '/leave?tab=approvals',
        })
      )
    );
  });
}

/**
 * Cancelled →
 *   by the employee themselves: tell the reviewers
 *   by HR/admin: tell the employee (in-app + email) and the other reviewers
 */
async function notifyLeaveCancelled(
  dto: LeaveRequestDto,
  previousStatus: string,
  ctx: RequestContext
): Promise<void> {
  await safely('leave.cancelled', async () => {
    const { notify } = await import('../../../core/notifications/index.js');
    const { employee, employeeName, what } = await describeLeave(dto);
    const cancelledBySelf = employee?.userId && String(employee.userId) === ctx.user.id;
    const wasApproved = previousStatus === 'Approved';

    if (!cancelledBySelf && employee?.userId) {
      await notify({
        userId: employee.userId,
        type: 'leave.cancelled',
        title: 'Your leave was cancelled',
        body: `Your ${wasApproved ? 'approved ' : ''}${what} was cancelled by ${actorLabel(ctx)}.${wasApproved ? ' The days have been returned to your balance.' : ''}`,
        link: '/leave?tab=my',
        email: true,
      });
    }

    const reviewers = await leaveReviewerUserIds(dto, [ctx.user.id]);
    await Promise.all(
      reviewers.map((userId) =>
        notify({
          userId,
          type: 'leave.cancelled.fyi',
          title: `${employeeName}'s leave was cancelled`,
          body: cancelledBySelf
            ? `${employeeName} cancelled their ${wasApproved ? 'approved ' : 'pending '}${what}.`
            : `${actorLabel(ctx)} cancelled ${employeeName}'s ${what}.`,
          link: '/leave?tab=approvals',
        })
      )
    );
  });
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

  const code = input.code ? input.code.toUpperCase() : await uniqueCodeFor(input.name);
  const existing = await LeaveType.findOne({ code });
  if (existing) throw new ConflictError('A leave type with this code already exists');
  const sameName = await LeaveType.findOne({ name: new RegExp(`^${escapeRegex(input.name.trim())}$`, 'i'), deletedAt: null });
  if (sameName) throw new ConflictError(`A leave type called "${sameName.name}" already exists`);

  const created = await LeaveType.create({
    ...input,
    code,
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

  // Balances are computed from the policy on the fly, so changing the quota applies to everyone immediately.
  Object.assign(doc, input, { updatedBy: toObjectId(ctx.user.id) });
  await doc.save();

  return toTypeDto(doc);
}

export async function deleteLeaveType(id: string, ctx: RequestContext): Promise<LeaveTypeDto> {
  if (ctx.user.role !== 'admin' && ctx.user.role !== 'hr') {
    throw new ForbiddenError('Only HR and Admin can configure leave types');
  }

  const doc = await LeaveType.findOne(scopeFilter({ _id: id }, ctx));
  if (!doc) throw new NotFoundError('Leave type not found');

  // Never used → remove it. Already used → keep it for history but stop offering it.
  const inUse = await LeaveRequest.exists({ leaveTypeId: doc._id });
  doc.status = 'Inactive';
  if (!inUse) doc.deletedAt = new Date();
  doc.updatedBy = toObjectId(ctx.user.id);
  await doc.save();

  return toTypeDto(doc);
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** "Casual Leave" → "CL", "Work From Home" → "WFH"; adds a number if taken. */
async function uniqueCodeFor(name: string): Promise<string> {
  const words = name.trim().split(/\s+/).filter(Boolean);
  let base = (words.length > 1 ? words.map((w) => w[0]).join('') : words[0]?.slice(0, 3) ?? 'LV')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .slice(0, 8);
  if (!base) base = 'LV';
  let code = base;
  for (let i = 2; await LeaveType.exists({ code }); i++) code = `${base}${i}`.slice(0, 10);
  return code;
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

  const [leaveTypes, employee, thisYear, lastYear] = await Promise.all([
    LeaveType.find({ status: 'Active', deletedAt: null }).sort({ name: 1 }),
    Employee.findById(employeeId).select('dateOfJoining'),
    usedByType(employeeId, year),
    usedByType(employeeId, year - 1),
  ]);

  return Promise.all(
    leaveTypes.map(async (lt) => {
      const row = thisYear.get(String(lt._id));
      const computed = computeBalance({
        policy: policyOf(lt),
        year,
        joinedOn: employee?.dateOfJoining ?? null,
        usedThisYear: row?.used ?? 0,
        usedLastYear: lastYear.get(String(lt._id))?.used ?? 0,
        usedBeforeCarryExpiry: await usedBeforeCarryExpiry(employeeId, lt, year),
      });
      return balanceDto(employeeId, lt, year, computed, row?._id);
    })
  );
}

/**
 * Balance of one leave type. `asOf` lets a monthly quota count the months up to
 * the leave date (applying in March for a day in June sees June's credit).
 */
export async function getBalance(
  employeeId: string,
  leaveTypeId: string,
  year: number,
  asOf?: Date
): Promise<{ allocated: number; used: number; carriedForward: number; balance: number; unlimited: boolean }> {
  const leaveType = await LeaveType.findById(leaveTypeId);
  if (!leaveType) throw new NotFoundError('Leave type not found');

  const { computed } = await computeFor(employeeId, leaveType, year, asOf);
  return {
    allocated: computed.allocated ?? 0,
    used: computed.used,
    carriedForward: computed.carriedForward,
    balance: computed.balance ?? 0,
    unlimited: computed.balance == null,
  };
}

/**
 * Balances are computed from the leave policy (see leave-balance.ts), so there is
 * nothing to allocate by hand any more. Kept for API compatibility: returns the
 * computed balance for that employee, type and year.
 */
export async function allocateBalance(
  input: AllocateBalanceInput,
  ctx: RequestContext
): Promise<LeaveBalanceDto> {
  if (ctx.user.role !== 'admin' && ctx.user.role !== 'hr') {
    throw new ForbiddenError('Only HR and Admin can view leave allocations');
  }
  const leaveType = await LeaveType.findById(input.leaveTypeId);
  if (!leaveType) throw new NotFoundError('Leave type not found');
  if (!(await Employee.exists({ _id: input.employeeId }))) throw new NotFoundError('Employee not found');

  const { computed, rowId } = await computeFor(input.employeeId, leaveType, input.year);
  return balanceDto(input.employeeId, leaveType, input.year, computed, rowId);
}

export async function deductBalance(
  employeeId: string,
  leaveTypeId: string,
  year: number,
  days: number,
  ctx: RequestContext,
  session?: ClientSession,
  asOf?: Date
): Promise<void> {
  const leaveType = await LeaveType.findById(leaveTypeId).session(session ?? null);
  if (!leaveType) throw new NotFoundError('Leave type not found');

  const { computed } = await computeFor(employeeId, leaveType, year, asOf, session);
  if (computed.balance != null && days > computed.balance) {
    throw new ValidationError(`Insufficient balance: requested ${days} day(s), ${computed.balance} available`);
  }

  // The ledger only tracks what was used; entitlement is always computed from the policy.
  await LeaveBalance.updateOne(
    { employeeId, leaveTypeId, year },
    {
      $inc: { used: days },
      $set: { updatedBy: toObjectId(ctx.user.id) },
      $setOnInsert: { allocated: 0, carriedForward: 0, createdBy: toObjectId(ctx.user.id) },
    },
    { upsert: true, session }
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
  await LeaveBalance.updateOne(
    { employeeId, leaveTypeId, year, used: { $gte: days } },
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

  const balance = await getBalance(employee.id, data.leaveTypeId, fromDate.getUTCFullYear(), fromDate);
  if (!balance.unlimited && effectiveDays > balance.balance) {
    throw new ValidationError(
      `Insufficient balance: you asked for ${effectiveDays} day(s) of ${leaveType.name} but only ${balance.balance} will be available on that date`
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

  const dto = toRequestDto(request);
  await notifyLeaveRequested(dto, ctx);
  return dto;
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

  const previousStatus = request.status;
  request.status = 'Cancelled';
  request.updatedBy = toObjectId(ctx.user.id);
  await request.save();

  const dto = toRequestDto(request);
  await notifyLeaveCancelled(dto, previousStatus, ctx);
  return dto;
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
      session,
      request.fromDate
    );

    await markLeaveDates(String(request.employeeId), dates, session, ctx.user.id);
    request.status = 'Approved';
    // approverId stays the designated approver (e.g. reporting manager); who actually decided is in decidedBy*.
    request.approvedAt = new Date();
    stampDecision(request, ctx);
    request.updatedBy = toObjectId(ctx.user.id);
    await request.save({ session: session ?? null });

    return toRequestDto(request);
  }).then(async (approved) => {
    await notifyLeaveDecision(approved, 'approved', ctx);
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
  stampDecision(request, ctx);
  request.updatedBy = toObjectId(ctx.user.id);
  await request.save();

  const dto = toRequestDto(request);
  await notifyLeaveDecision(dto, 'rejected', ctx, reason);
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
    await notifyLeaveCancelled(cancelled, originalStatus, ctx);

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

// ---------------------------------------------------------------------------
// Employee leave & attendance summary (employee profile → Attendance tab)
// ---------------------------------------------------------------------------

export interface EmployeeLeaveSummary {
  year: number;
  balances: LeaveBalanceDto[];
  stats: {
    presentDays: number;
    lateDays: number;
    halfDays: number;
    approvedLeaveDays: number;
    unapprovedAbsenceDays: number;
    workingDaysSoFar: number;
  };
  /** Approved leave this year — taken or coming up */
  approvedLeaves: Array<{
    id: string;
    type: string;
    fromDate: string;
    toDate: string;
    days: number;
    reason: string;
    decidedByName?: string;
    decidedByRole?: string;
    decidedAt: string | null;
    upcoming: boolean;
  }>;
  pendingLeaves: Array<{ id: string; type: string; fromDate: string; toDate: string; days: number }>;
  rejectedLeaves: number;
  /** Working days with no check-in and no approved leave (absent without telling) */
  unapprovedAbsences: Array<{ date: string; markedAbsent: boolean }>;
}

function localDayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export async function getEmployeeLeaveSummary(
  employeeId: string,
  year: number,
  ctx: RequestContext
): Promise<EmployeeLeaveSummary> {
  await assertCanAccessEmployeeLeave(employeeId, ctx);

  const employee = await Employee.findById(employeeId).select('dateOfJoining dateOfExit');
  if (!employee) throw new NotFoundError('Employee not found');

  const yearStart = new Date(year, 0, 1);
  const yearEnd = new Date(year, 11, 31, 23, 59, 59, 999);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const [balances, requests, attendance, holidays, leaveTypes, firstRecord] = await Promise.all([
    getBalanceForEmployee(employeeId, year, ctx),
    LeaveRequest.find({ employeeId, fromDate: { $lte: yearEnd }, toDate: { $gte: yearStart }, deletedAt: null }).sort({ fromDate: -1 }),
    Attendance.find({ employeeId, date: { $gte: yearStart, $lte: yearEnd }, deletedAt: null }),
    Holiday.find({ date: { $gte: yearStart, $lte: yearEnd }, deletedAt: null }),
    LeaveType.find({}).select('name'),
    Attendance.findOne({ employeeId, deletedAt: null }).sort({ date: 1 }).select('date'),
  ]);
  const typeName = new Map(leaveTypes.map((t) => [String(t._id), t.name]));

  // Days covered by approved leave (leave dates are stored as UTC midnight)
  const approved = requests.filter((r) => r.status === 'Approved');
  const leaveDays = new Set<string>();
  for (const r of approved) {
    for (let d = new Date(r.fromDate); d <= r.toDate; d.setUTCDate(d.getUTCDate() + 1)) {
      leaveDays.add(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`);
    }
  }
  const holidayDays = new Set(holidays.map((h) => {
    const d = new Date(h.date);
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
  }));
  const byDay = new Map(attendance.map((a) => [localDayKey(a.date), a]));

  let presentDays = 0;
  let lateDays = 0;
  let halfDays = 0;
  for (const a of attendance) {
    if (a.status === 'Half-Day') halfDays++;
    else if (a.checkInTime) presentDays++;
    if (a.status === 'Late') lateDays++;
  }

  // Walk past working days (Mon–Sat) from joining/1 Jan up to yesterday
  const unapprovedAbsences: EmployeeLeaveSummary['unapprovedAbsences'] = [];
  let workingDaysSoFar = 0;
  // Start from the latest of: 1 Jan, joining date, and the first day attendance was ever recorded
  // (days before the company started using attendance shouldn't count as absences).
  const starts = [yearStart, employee.dateOfJoining, firstRecord?.date].filter((d): d is Date => Boolean(d));
  const from = new Date(Math.max(...starts.map((d) => d.getTime())));
  from.setHours(0, 0, 0, 0);
  const lastDay = employee.dateOfExit && employee.dateOfExit < yearEnd ? employee.dateOfExit : yearEnd;
  for (let d = new Date(from); d < today && d <= lastDay; d.setDate(d.getDate() + 1)) {
    const key = localDayKey(d);
    if (d.getDay() === 0 || holidayDays.has(key)) continue;
    workingDaysSoFar++;
    if (leaveDays.has(key)) continue;
    const rec = byDay.get(key);
    if (rec?.checkInTime || rec?.status === 'Leave' || rec?.status === 'Half-Day') continue;
    unapprovedAbsences.push({ date: key, markedAbsent: rec?.status === 'Absent' });
  }
  unapprovedAbsences.reverse(); // most recent first

  return {
    year,
    balances,
    stats: {
      presentDays,
      lateDays,
      halfDays,
      approvedLeaveDays: approved.reduce((sum, r) => sum + r.days, 0),
      unapprovedAbsenceDays: unapprovedAbsences.length,
      workingDaysSoFar,
    },
    approvedLeaves: approved.map((r) => ({
      id: String(r._id),
      type: typeName.get(String(r.leaveTypeId)) ?? 'Leave',
      fromDate: r.fromDate.toISOString(),
      toDate: r.toDate.toISOString(),
      days: r.days,
      reason: r.reason,
      decidedByName: r.decidedByName,
      decidedByRole: r.decidedByRole,
      decidedAt: (r.decidedAt ?? r.approvedAt)?.toISOString() ?? null,
      upcoming: r.fromDate > today,
    })),
    pendingLeaves: requests
      .filter((r) => r.status === 'Pending')
      .map((r) => ({
        id: String(r._id),
        type: typeName.get(String(r.leaveTypeId)) ?? 'Leave',
        fromDate: r.fromDate.toISOString(),
        toDate: r.toDate.toISOString(),
        days: r.days,
      })),
    rejectedLeaves: requests.filter((r) => r.status === 'Rejected').length,
    unapprovedAbsences,
  };
}
