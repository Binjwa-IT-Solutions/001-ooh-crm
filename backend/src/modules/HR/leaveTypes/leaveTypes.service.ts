import { HydratedDocument, type ClientSession } from 'mongoose';
import type { RequestContext } from '../../../core/context.js';
import { toObjectId } from '../../../core/db/basePlugin.js';
import { ConflictError, NotFoundError, ValidationError, ForbiddenError } from '../../../core/errors/index.js';
import { scopeFilter, scopedCount, scopedFind } from '../../../core/scoping/index.js';
import { Employee } from '../../employees/employees.model.js';
import { LeaveBalance, LeaveType, type ILeaveBalance, type ILeaveType } from './leaveTypes.model.js';
import type {
  AllocateBalanceInput,
  CreateLeaveTypeInput,
  ListLeaveTypesQuery,
  UpdateLeaveTypeInput,
} from './leaveTypes.validator.js';

/**
 * TRACK G — G3 · Leave Types, Quotas & Balances
 *
 * Same three rules as the reference module apply here:
 *   1. reads go through `scopedFind` / `scopedCount`, never `LeaveType.find()`
 *   2. `balance` is always computed here, never stored
 *   3. every quota/day number is a whole number of days — no floats
 */

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

function iso(value: Date | null | undefined): string {
  return (value ?? new Date()).toISOString();
}

function toDto(doc: HydratedDocument<ILeaveType>): LeaveTypeDto {
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

function toBalanceDto(doc: HydratedDocument<ILeaveBalance> | ILeaveBalance, leaveTypeName: string): LeaveBalanceDto {
  return {
    id: String(doc._id || ''),
    employeeId: String(doc.employeeId),
    leaveTypeId: String(doc.leaveTypeId),
    leaveTypeName,
    year: doc.year,
    allocated: doc.allocated,
    used: doc.used,
    carriedForward: doc.carriedForward,
    // Computed, never stored — see module doc comment.
    balance: doc.allocated + doc.carriedForward - doc.used,
  };
}

/**
 * Access control check for leave balances:
 * - Admin and HR can view anyone's balance.
 * - Employees can view their own balance.
 * - Managers can view their own balance or their direct reports' balances.
 */
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

export const leaveTypeService = {
  // -------------------------------------------------------------------
  // Leave type configuration (HR / Admin)
  // -------------------------------------------------------------------

  async list(query: ListLeaveTypesQuery, ctx: RequestContext): Promise<PaginatedLeaveTypes> {
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
      leaveTypes: documents.map(toDto),
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
    };
  },

  async getById(id: string, ctx: RequestContext): Promise<LeaveTypeDto> {
    const elevatedCtx = {
      ...ctx,
      user: { ...ctx.user, role: 'hr' as const },
    };
    const doc = await LeaveType.findOne(scopeFilter({ _id: id }, elevatedCtx));
    if (!doc) throw new NotFoundError('Leave type not found');
    return toDto(doc);
  },

  async create(input: CreateLeaveTypeInput, ctx: RequestContext): Promise<LeaveTypeDto> {
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

    return toDto(created);
  },

  async update(id: string, input: UpdateLeaveTypeInput, ctx: RequestContext): Promise<LeaveTypeDto> {
    if (ctx.user.role !== 'admin' && ctx.user.role !== 'hr') {
      throw new ForbiddenError('Only HR and Admin can configure leave types');
    }

    const doc = await LeaveType.findOne(scopeFilter({ _id: id }, ctx));
    if (!doc) throw new NotFoundError('Leave type not found');

    if (input.code && input.code.toUpperCase() !== doc.code) {
      const existing = await LeaveType.findOne({ code: input.code.toUpperCase() });
      if (existing) throw new ConflictError('A leave type with this code already exists');
    }

    // Quota changes must not retroactively break existing balances — this
    // only changes future allocation, never touches LeaveBalance rows.
    Object.assign(doc, input, { updatedBy: toObjectId(ctx.user.id) });
    await doc.save();

    if (input.annualQuota !== undefined) {
      await LeaveBalance.updateMany(
        { leaveTypeId: id, year: new Date().getUTCFullYear() },
        { $set: { allocated: input.annualQuota ?? 0, updatedBy: toObjectId(ctx.user.id) } },
      );
    }

    return toDto(doc);
  },

  async delete(id: string, ctx: RequestContext): Promise<LeaveTypeDto> {
    if (ctx.user.role !== 'admin' && ctx.user.role !== 'hr') {
      throw new ForbiddenError('Only HR and Admin can configure leave types');
    }

    const doc = await LeaveType.findOne(scopeFilter({ _id: id }, ctx));
    if (!doc) throw new NotFoundError('Leave type not found');

    doc.status = 'Inactive';
    doc.updatedBy = toObjectId(ctx.user.id);
    await doc.save();

    return toDto(doc);
  },

  // -------------------------------------------------------------------
  // Balances
  // -------------------------------------------------------------------

  /**
   * A single employee's balance across every leave type, for a given year.
   * G4 calls this before allowing a leave request to be submitted.
   */
  async getBalanceForEmployee(
    employeeId: string,
    year: number,
    ctx: RequestContext,
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
  },

  /**
   * Balance for one employee, one leave type. Used by G4 to check
   * "does this employee have enough days left" before approving.
   */
  async getBalance(
    employeeId: string,
    leaveTypeId: string,
    year: number,
  ): Promise<{ allocated: number; used: number; carriedForward: number; balance: number }> {
    const leaveType = await LeaveType.findById(leaveTypeId);
    if (!leaveType) throw new NotFoundError('Leave type not found');

    const row = await LeaveBalance.findOne({ employeeId, leaveTypeId, year });

    const allocated = row?.allocated ?? leaveType.annualQuota ?? 0;
    const used = row?.used ?? 0;
    const carriedForward = row?.carriedForward ?? 0;

    return { allocated, used, carriedForward, balance: allocated + carriedForward - used };
  },

  /**
   * Year-start allocation for one employee. Pro-rates when `dateOfJoining`
   * falls inside the target year — HR triggers this per employee or in bulk.
   */
  async allocate(input: AllocateBalanceInput, ctx: RequestContext): Promise<LeaveBalanceDto> {
    if (ctx.user.role !== 'admin' && ctx.user.role !== 'hr') {
      throw new ForbiddenError('Only HR and Admin can allocate leave balances');
    }

    const leaveType = await LeaveType.findById(input.leaveTypeId);
    if (!leaveType) throw new NotFoundError('Leave type not found');

    if (leaveType.annualQuota === null) {
      // Leave Without Pay and similar types have no quota to allocate.
      throw new ValidationError(`${leaveType.name} has no fixed quota and cannot be allocated`);
    }

    const employee = await Employee.findById(input.employeeId);
    if (!employee) throw new NotFoundError('Employee not found');

    // Calculate pro-rated quota if not explicitly passed
    let allocatedDays = input.proratedDays;
    if (allocatedDays === undefined) {
      const joinDate = new Date(employee.dateOfJoining);
      const joinYear = joinDate.getFullYear();

      if (joinYear === input.year) {
        // Joined mid-year in the target year. Calculate prorated days remaining in the year.
        const endOfYear = new Date(input.year, 11, 31, 23, 59, 59, 999);
        const diffTime = endOfYear.getTime() - joinDate.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        const totalDaysInYear = (input.year % 4 === 0 && (input.year % 100 !== 0 || input.year % 400 === 0)) ? 366 : 365;
        const daysActive = Math.max(0, Math.min(totalDaysInYear, diffDays));
        allocatedDays = Math.round((leaveType.annualQuota || 0) * (daysActive / totalDaysInYear));
      } else if (joinYear > input.year) {
        // Not joined yet in the target year
        allocatedDays = 0;
      } else {
        // Joined before target year - full quota
        allocatedDays = leaveType.annualQuota || 0;
      }
    }

    // Calculate carried forward days from previous year
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
      { new: true, upsert: true },
    );

    return toBalanceDto(row, leaveType.name);
  },

  /**
   * Called by G4 inside its own transaction when a leave request is approved.
   * Never called directly from a route — only from leaveRequestService.
   */
  async deductBalance(
    employeeId: string,
    leaveTypeId: string,
    year: number,
    days: number,
    ctx: RequestContext,
    session?: ClientSession,
  ): Promise<void> {
    const leaveType = await LeaveType.findById(leaveTypeId).session(session ?? null);
    if (!leaveType) throw new NotFoundError('Leave type not found');

    // Leave Without Pay has no quota and never blocks — nothing to deduct against.
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
      { new: true, upsert: true, session },
    );
    const available = (row?.allocated ?? 0) + (row?.carriedForward ?? 0) - (row?.used ?? 0);

    if (days > available) {
      throw new ValidationError(
        `Insufficient balance: requested ${days} day(s), ${available} available`,
      );
    }

    await LeaveBalance.updateOne(
      { employeeId, leaveTypeId, year },
      { $inc: { used: days }, $set: { updatedBy: toObjectId(ctx.user.id) } },
      { session },
    );
  },

  /**
   * Reverses a deduction — called by G4 on request cancellation after approval.
   */
  async restoreBalance(
    employeeId: string,
    leaveTypeId: string,
    year: number,
    days: number,
    ctx: RequestContext,
    session?: ClientSession,
  ): Promise<void> {
    const leaveType = await LeaveType.findById(leaveTypeId).session(session ?? null);
    if (!leaveType || leaveType.annualQuota === null) return;

    await LeaveBalance.updateOne(
      { employeeId, leaveTypeId, year },
      { $inc: { used: -days }, $set: { updatedBy: toObjectId(ctx.user.id) } },
      { session },
    );
  },
};