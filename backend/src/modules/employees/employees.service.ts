import { Types } from 'mongoose';

import type { RequestContext } from '../../core/context.js';
import { toObjectId } from '../../core/db/basePlugin.js';
import { formattedSequence } from '../../core/db/sequence.js';
import { ConflictError, ForbiddenError, NotFoundError, ValidationError } from '../../core/errors/index.js';
import { scopeFilter, scopedCount, scopedFind } from '../../core/scoping/index.js';
import { Employee, SENSITIVE_FIELDS, type IEmployee, type Department } from './employees.model.js';
import { Team, type ITeam } from './team.model.js';
import { AuthUser } from '../../core/auth/auth-model.js';
import { Lead } from '../leads/leads.model.js';
import { Task } from '../tasks/task.model.js';
import { Quotation } from '../quotations/quotations.model.js';
import Campaign from '../campaigns/campaign.model.js';
import Attendance from '../HR/models/attendance.model.js';
import { LeaveRequest, LeaveType } from '../HR/models/leave.model.js';
import { leaveTypeService } from '../HR/services/leave.service.js';
import type {
  CreateEmployeeInput,
  ListEmployeesQuery,
  UpdateEmployeeInput,
  CreateTeamInput,
  UpdateTeamInput,
} from './employees.validator.js';

/**
 * REFERENCE MODULE — the service layer.
 *
 * All business logic and every database read live here. Controllers call these
 * functions; nothing else touches `Employee` directly.
 *
 * Three patterns in this file are worth copying exactly:
 *   1. reads go through `scopedFind` / `scopedCount`, never `Employee.find()`
 *   2. sensitive fields are stripped here, in the service, not in the UI
 *   3. money is stored in integer paise and converted only at the boundary
 */

/** What the API returns. Sensitive fields are absent unless the caller may see them. */
export interface EmployeeDto {
  id: string;
  employeeCode: string;
  fullName: string;
  workEmail: string;
  personalEmail?: string;
  mobile: string;
  dateOfBirth: string | null;
  department: string;
  designation: string;
  employmentType: string;
  dateOfJoining: string | null;
  dateOfExit: string | null;
  reportingManager: { id: string; fullName: string; designation: string } | null;
  teamName?: string;
  workLocation: string;
  status: string;
  isProfileComplete?: boolean;
  emergencyContact?: { name?: string; relationship?: string; mobile?: string };
  address?: string;
  createdAt: string;
  updatedAt: string;

  // Present only when the caller holds `employees.sensitive`.
  panNumber?: string;
  aadhaarNumber?: string;
  bankAccountNumber?: string;
  ifsc?: string;
  /** Integer paise. Format as rupees in the UI, never calculate with floats. */
  annualCtc?: number;
}

export interface TeamMemberDto extends EmployeeDto {
  leadsCount?: { total: number; open: number; qualified: number; won: number };
  tasksCount?: { total: number; pending: number; completed: number; overdue: number };
  activeCampaignsCount?: number;
  attendanceToday?: string;
  leaveBalance?: { available: number; used: number };
}

export interface TeamGroupDto {
  manager: EmployeeDto;
  teamName: string;
  members: TeamMemberDto[];
  summary: {
    totalMembers: number;
    activeMembers: number;
    totalLeads: number;
    openLeads: number;
    qualifiedLeads: number;
    wonLeads: number;
    quotationsCount: number;
    activeCampaignsCount: number;
    pendingTasksCount: number;
  };
}

export interface NamedTeamDto {
  id: string;
  name: string;
  description?: string;
  managerId: string;
  members: TeamMemberDto[];
  createdAt: string;
  updatedAt: string;
}

export interface ManagerTeamsGroupDto {
  manager: EmployeeDto;
  teams: NamedTeamDto[];
  totalMembersCount: number;
}

export interface TeamHierarchyResponseDto {
  teams: TeamGroupDto[];
  managers?: ManagerTeamsGroupDto[];
  unassigned: EmployeeDto[];
}

export interface PaginatedEmployees {
  employees: EmployeeDto[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

function canSeeSensitive(ctx: RequestContext): boolean {
  return ctx.user.permissions.includes('employees.sensitive');
}

function iso(value: Date | null | undefined): string | null {
  return value ? value.toISOString() : null;
}

/**
 * Maps a document to the API shape. `includeSensitive` is a required argument
 * rather than an optional one on purpose — you cannot forget to pass it.
 */
function toDto(employee: IEmployee, includeSensitive: boolean): EmployeeDto {
  const manager = employee.reportingManagerId as unknown as IEmployee | Types.ObjectId | null;
  const managerIsPopulated =
    manager !== null &&
    manager !== undefined &&
    typeof manager === 'object' &&
    'fullName' in manager;

  const isProfileComplete = Boolean(
    employee.department &&
    employee.designation &&
    employee.dateOfJoining &&
    employee.mobile
  );

  const dto: EmployeeDto = {
    id: String(employee._id),
    employeeCode: employee.employeeCode,
    fullName: employee.fullName,
    workEmail: employee.workEmail,
    personalEmail: employee.personalEmail,
    mobile: employee.mobile || '',
    dateOfBirth: iso(employee.dateOfBirth),
    department: employee.department || '',
    designation: employee.designation || '',
    employmentType: employee.employmentType || '',
    dateOfJoining: employee.dateOfJoining ? (iso(employee.dateOfJoining) as string) : null,
    dateOfExit: iso(employee.dateOfExit),
    reportingManager: managerIsPopulated
      ? {
        id: String((manager as IEmployee)._id),
        fullName: (manager as IEmployee).fullName,
        designation: (manager as IEmployee).designation || 'Manager',
      }
      : null,
    teamName: employee.teamName || undefined,
    workLocation: employee.workLocation || '',
    status: employee.status,
    isProfileComplete,
    emergencyContact: employee.emergencyContact,
    address: employee.address,
    createdAt: iso(employee.createdAt) as string,
    updatedAt: iso(employee.updatedAt) as string,
  };

  if (includeSensitive) {
    dto.panNumber = employee.panNumber;
    dto.aadhaarNumber = employee.aadhaarNumber;
    dto.bankAccountNumber = employee.bankAccountNumber;
    dto.ifsc = employee.ifsc;
    dto.annualCtc = employee.annualCtc;
  }

  return dto;
}

/** Drops sensitive keys from an incoming payload when the caller may not set them. */
function stripSensitiveInput<T extends Record<string, unknown>>(input: T, ctx: RequestContext): T {
  if (canSeeSensitive(ctx)) return input;

  const cleaned = { ...input };
  for (const field of SENSITIVE_FIELDS) {
    delete cleaned[field];
  }
  return cleaned;
}

/** Empty strings from the form mean "not provided", not "set to empty". */
function dropBlanks<T extends Record<string, unknown>>(input: T): T {
  const cleaned = { ...input };
  for (const [key, value] of Object.entries(cleaned)) {
    if (value === '') delete cleaned[key];
  }
  return cleaned;
}

/**
 * Walks up the reporting chain to make sure `managerId` is not `employeeId`
 * itself or anyone who already reports to them. Without this, one bad edit
 * creates a cycle and every consumer that walks the hierarchy — leave approval,
 * escalation — loops forever.
 */
async function assertNoManagerCycle(
  employeeId: Types.ObjectId | string,
  managerId: Types.ObjectId | string,
): Promise<void> {
  if (String(employeeId) === String(managerId)) {
    throw new ValidationError('An employee cannot report to themselves');
  }

  const seen = new Set<string>([String(employeeId)]);
  let cursor: Types.ObjectId | string | null = managerId;

  while (cursor) {
    const cursorId = String(cursor);
    if (seen.has(cursorId)) {
      throw new ValidationError('That reporting manager would create a loop in the hierarchy');
    }
    seen.add(cursorId);

    const manager: Pick<IEmployee, 'reportingManagerId'> | null = await Employee.findById(cursor)
      .select('reportingManagerId')
      .lean<Pick<IEmployee, 'reportingManagerId'>>();

    cursor = manager?.reportingManagerId ?? null;
  }
}

export const employeeService = {
  /** Paginated, filtered list. Filtering and paging happen in the database. */
  async list(query: ListEmployeesQuery, ctx: RequestContext): Promise<PaginatedEmployees> {
    const filter: Record<string, unknown> = {};

    if (query.department) filter.department = query.department;
    if (query.status) filter.status = query.status;
    if (query.reportingManagerId) filter.reportingManagerId = query.reportingManagerId;

    if (query.search) {
      // Escaped so a user typing "a+b" cannot inject a pattern.
      const safe = query.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const pattern = new RegExp(safe, 'i');
      filter.$or = [
        { fullName: pattern },
        { workEmail: pattern },
        { employeeCode: pattern },
        { mobile: pattern },
      ];
    }

    const skip = (query.page - 1) * query.pageSize;

    const [documents, total] = await Promise.all([
      scopedFind(Employee, filter, ctx)
        .sort({ [query.sortBy]: query.sortDir === 'asc' ? 1 : -1 })
        .skip(skip)
        .limit(query.pageSize)
        .populate('reportingManagerId', 'fullName designation'),
      scopedCount(Employee, filter, ctx),
    ]);

    const includeSensitive = canSeeSensitive(ctx);

    return {
      employees: documents.map((doc) => toDto(doc, includeSensitive)),
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
    };
  },

  async getById(id: string, ctx: RequestContext): Promise<EmployeeDto> {
    const employee = await Employee.findOne(scopeFilter({ _id: id }, ctx)).populate(
      'reportingManagerId',
      'fullName designation',
    );

    if (!employee) throw new NotFoundError('Employee not found');

    return toDto(employee, canSeeSensitive(ctx));
  },

  async getMine(ctx: RequestContext): Promise<EmployeeDto> {
    let employee = await Employee.findOne({
      userId: ctx.user.id,
      deletedAt: null,
    }).populate('reportingManagerId', 'fullName designation');

    if (!employee && ctx.user.email) {
      employee = await Employee.findOne({
        workEmail: ctx.user.email.toLowerCase(),
        deletedAt: null,
      }).populate('reportingManagerId', 'fullName designation');

      if (employee) {
        employee.userId = toObjectId(ctx.user.id);
        await employee.save();
      }
    }

    // Auto-provision employee record if none exists for this active auth user
    if (!employee && ctx.user.id) {
      const user = await AuthUser.findById(ctx.user.id);
      if (user) {
        const provisioned = await employeeService.ensureEmployeeForUser({
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          status: user.status,
        });
        employee = await Employee.findById(provisioned._id).populate(
          'reportingManagerId',
          'fullName designation',
        );
      }
    }

    if (!employee) {
      throw new NotFoundError('No employee record is linked to your account yet');
    }

    // You may always see your own sensitive details.
    return toDto(employee, true);
  },

  /** Updates the authenticated user's own employee record (e.g. mandatory profile completion). */
  async updateMine(input: UpdateEmployeeInput, ctx: RequestContext): Promise<EmployeeDto> {
    let employee = await Employee.findOne({
      userId: ctx.user.id,
      deletedAt: null,
    });

    if (!employee && ctx.user.email) {
      employee = await Employee.findOne({
        workEmail: ctx.user.email.toLowerCase(),
        deletedAt: null,
      });

      if (employee) {
        employee.userId = toObjectId(ctx.user.id);
        await employee.save();
      }
    }

    // Auto-provision employee record if none exists for this active auth user
    if (!employee && ctx.user.id) {
      const user = await AuthUser.findById(ctx.user.id);
      if (user) {
        const provisioned = await employeeService.ensureEmployeeForUser({
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          status: user.status,
        });
        employee = await Employee.findById(provisioned._id);
      }
    }

    if (!employee) {
      throw new NotFoundError('No employee record is linked to your account yet');
    }

    const payload = dropBlanks(stripSensitiveInput({ ...input }, ctx));

    // Validate email uniqueness if changing
    if (payload.workEmail && payload.workEmail !== employee.workEmail) {
      const clash = await Employee.findOne({ workEmail: payload.workEmail, _id: { $ne: employee._id } });
      if (clash) throw new ConflictError('An employee with this work email already exists');
    }

    // Non-admin/HR users cannot change their status or reassign their own manager arbitrarily if already assigned
    if (!['admin', 'hr'].includes(ctx.user.role)) {
      delete payload.status;
      if (employee.reportingManagerId) {
        delete payload.reportingManagerId;
      }
    }

    if (payload.reportingManagerId) {
      const rawId = String(payload.reportingManagerId).trim();
      const objId = toObjectId(rawId);
      let targetManagerId: Types.ObjectId | null = null;
      const manager = await Employee.findOne({ _id: objId, deletedAt: null });
      if (manager) {
        targetManagerId = manager._id as Types.ObjectId;
      } else {
        const managerByUser = await Employee.findOne({ userId: objId, deletedAt: null });
        if (managerByUser) {
          targetManagerId = managerByUser._id as Types.ObjectId;
        } else {
          throw new ValidationError('The selected reporting manager does not exist');
        }
      }

      await assertNoManagerCycle(employee._id as Types.ObjectId, targetManagerId);
      employee.reportingManagerId = targetManagerId;
      delete payload.reportingManagerId;
    }

    Object.assign(employee, payload, { updatedBy: toObjectId(ctx.user.id) });
    employee.isProfileComplete = Boolean(
      employee.department &&
      employee.designation &&
      employee.dateOfJoining &&
      employee.mobile
    );
    await employee.save();
    await employee.populate('reportingManagerId', 'fullName designation');

    if (payload.fullName) {
      await AuthUser.updateOne(
        { _id: toObjectId(ctx.user.id) },
        { $set: { name: String(payload.fullName).trim() } },
      );
    }

    return toDto(employee, true);
  },

  /** Direct reports. Used by the org tree and, later, by leave approval routing. */
  async getDirectReports(managerId: string, ctx: RequestContext): Promise<EmployeeDto[]> {
    const documents = await scopedFind(Employee, { reportingManagerId: managerId }, ctx).sort({
      fullName: 1,
    });

    const includeSensitive = canSeeSensitive(ctx);
    return documents.map((doc) => toDto(doc, includeSensitive));
  },

  async create(input: CreateEmployeeInput, ctx: RequestContext): Promise<EmployeeDto> {
    const payload = dropBlanks(stripSensitiveInput({ ...input }, ctx));

    const existing = await Employee.findOne({ workEmail: payload.workEmail });
    if (existing) {
      throw new ConflictError('An employee with this work email already exists');
    }

    if (payload.reportingManagerId) {
      const manager = await Employee.findOne({
        _id: payload.reportingManagerId,
        deletedAt: null,
      });
      if (!manager) throw new ValidationError('The selected reporting manager does not exist');
    }

    // Atomic — two concurrent creates can never get the same code.
    let employeeCode = await formattedSequence('employee', 'MO-EMP');
    while (await Employee.exists({ employeeCode })) {
      employeeCode = await formattedSequence('employee', 'MO-EMP');
    }

    const created = await Employee.create({
      ...payload,
      employeeCode,
      createdBy: toObjectId(ctx.user.id),
      updatedBy: toObjectId(ctx.user.id),
    });

    await created.populate('reportingManagerId', 'fullName designation');

    return toDto(created, canSeeSensitive(ctx));
  },

  async update(id: string, input: UpdateEmployeeInput, ctx: RequestContext): Promise<EmployeeDto> {
    const employee = await Employee.findOne(scopeFilter({ _id: id }, ctx));
    if (!employee) throw new NotFoundError('Employee not found');

    const payload = dropBlanks(stripSensitiveInput({ ...input }, ctx));

    if (payload.workEmail && payload.workEmail !== employee.workEmail) {
      const clash = await Employee.findOne({ workEmail: payload.workEmail });
      if (clash) throw new ConflictError('An employee with this work email already exists');
    }

    // Role-based restrictions on teamName and reportingManagerId
    if (ctx.user.role === 'hr') {
      if (input.reportingManagerId !== undefined) {
        const currentReportingMgr = employee.reportingManagerId ? String(employee.reportingManagerId) : '';
        const targetReportingMgr = input.reportingManagerId ? String(input.reportingManagerId) : '';
        if (currentReportingMgr !== targetReportingMgr) {
          throw new ForbiddenError('HR cannot reassign reporting managers. Contact an administrator.');
        }
      }
    } else if (ctx.user.role === 'manager') {
      const myEmp = await employeeService.getManagerEmployee(ctx);
      if (!myEmp) {
        throw new ForbiddenError('Manager employee record not found');
      }

      if (payload.teamName !== undefined && payload.teamName !== employee.teamName) {
        if (String(employee._id) !== String(myEmp._id)) {
          throw new ForbiddenError('You can only edit your own team name');
        }
      }

      if (input.reportingManagerId !== undefined) {
        const currentReportingMgr = employee.reportingManagerId ? String(employee.reportingManagerId) : '';
        const isCurrentMember = currentReportingMgr === String(myEmp._id);
        const isUnassigned = !currentReportingMgr;

        if (!isCurrentMember && !isUnassigned) {
          throw new ForbiddenError('You cannot reassign an employee belonging to another manager');
        }

        if (input.reportingManagerId) {
          const rawId = String(input.reportingManagerId).trim();
          let targetEmpId = rawId;
          const targetDoc = await Employee.findOne({ $or: [{ _id: toObjectId(rawId) }, { userId: toObjectId(rawId) }], deletedAt: null });
          if (targetDoc) targetEmpId = String(targetDoc._id);

          if (targetEmpId !== String(myEmp._id)) {
            throw new ForbiddenError('Managers can only assign members to their own team');
          }
        }
      }
    }

    if (input.reportingManagerId === null || input.reportingManagerId === '') {
      employee.reportingManagerId = null;
      
      await Team.updateMany({ members: employee._id }, { $pull: { members: employee._id } });
    } else if (payload.reportingManagerId) {
      const rawId = String(payload.reportingManagerId).trim();
      const objId = toObjectId(rawId);
      let targetManagerId: Types.ObjectId | null = null;
      const manager = await Employee.findOne({ _id: objId, deletedAt: null });
      if (manager) {
        targetManagerId = manager._id as Types.ObjectId;
      } else {
        const managerByUser = await Employee.findOne({ userId: objId, deletedAt: null });
        if (managerByUser) {
          targetManagerId = managerByUser._id as Types.ObjectId;
        } else {
          throw new ValidationError('The selected reporting manager does not exist');
        }
      }

      await assertNoManagerCycle(employee._id as Types.ObjectId, targetManagerId);
      if (String(employee.reportingManagerId || '') !== String(targetManagerId)) {
        await Team.updateMany(
          { members: employee._id },
          { $pull: { members: employee._id } },
        );
      }
      employee.reportingManagerId = targetManagerId;
      delete payload.reportingManagerId;
    }

    Object.assign(employee, payload, { updatedBy: toObjectId(ctx.user.id) });
    employee.isProfileComplete = Boolean(
      employee.department &&
      employee.designation &&
      employee.dateOfJoining &&
      employee.mobile
    );
    await employee.save();
    await employee.populate('reportingManagerId', 'fullName designation');

    return toDto(employee, canSeeSensitive(ctx));
  },

  /**
   * Soft delete. The record stays in the database — payroll, attendance and the
   * audit log all reference it, and physically removing it corrupts their history.
   */
  async deactivate(id: string, ctx: RequestContext): Promise<{ id: string }> {
    const employee = await Employee.findOne(scopeFilter({ _id: id }, ctx));
    if (!employee) throw new NotFoundError('Employee not found');

    const reportCount = await Employee.countDocuments({
      reportingManagerId: employee._id,
      deletedAt: null,
    });

    if (reportCount > 0) {
      throw new ConflictError(
        `${reportCount} employee${reportCount === 1 ? '' : 's'} still ` +
        `${reportCount === 1 ? 'reports' : 'report'} to this person. Reassign them first.`,
      );
    }

    employee.status = 'Inactive';
    employee.deletedAt = new Date();
    employee.updatedBy = toObjectId(ctx.user.id);
    await employee.save();

    return { id: String(employee._id) };
  },

  /**
   * Lightweight list for the "reporting manager" dropdown. Exported so other
   * modules can resolve a manager without importing this module's model —
   * cross-module imports of models are banned; services are the interface.
   */
  async listManagerOptions(
    ctx: RequestContext,
  ): Promise<Array<{ id: string; fullName: string; designation: string; employeeCode: string }>> {
    const documents = await scopedFind(Employee, { status: 'Active' }, ctx)
      .sort({ fullName: 1 })
      .select('fullName designation employeeCode');

    return documents.map((doc) => ({
      id: String(doc._id),
      fullName: doc.fullName,
      designation: doc.designation || 'Manager',
      employeeCode: doc.employeeCode,
    }));
  },

  async getAllActiveEmployees(ctx: RequestContext): Promise<EmployeeDto[]> {
    const documents = await scopedFind(Employee, { status: 'Active' }, ctx).sort({ fullName: 1 });
    const includeSensitive = canSeeSensitive(ctx);
    return documents.map((doc) => toDto(doc, includeSensitive));
  },

  /**
   * Resolves the authenticated user's Employee record if they are a manager.
   */
  async getManagerEmployee(ctx: RequestContext): Promise<IEmployee | null> {
    let myEmployee = await Employee.findOne({
      userId: toObjectId(ctx.user.id),
      deletedAt: null,
    }).populate('reportingManagerId', 'fullName designation');

    if (!myEmployee && ctx.user.email) {
      myEmployee = await Employee.findOne({
        workEmail: ctx.user.email.toLowerCase(),
        deletedAt: null,
      }).populate('reportingManagerId', 'fullName designation');

      if (myEmployee && !myEmployee.userId) {
        myEmployee.userId = toObjectId(ctx.user.id);
        await myEmployee.save();
      }
    }

    if (!myEmployee && ctx.user.id && Types.ObjectId.isValid(ctx.user.id)) {
      try {
        const createdEmp = await employeeService.ensureEmployeeForUser({
          id: toObjectId(ctx.user.id),
          name: ctx.user.name || 'Manager',
          email: ctx.user.email || 'manager@mediaoctus.com',
          role: ctx.user.role,
          status: 'Active',
        });
        myEmployee = await Employee.findById(createdEmp._id).populate('reportingManagerId', 'fullName designation');
      } catch (err) {
        console.error('[getManagerEmployee] failed to ensure employee profile:', err);
      }
    }

    return myEmployee;
  },

  /**
   * Returns scoped user IDs (AuthUser ObjectIds) for CRM queries:
   * - Admin / Finance / Ops / HR: returns null (unscoped)
   * - Manager: returns [managerUserId, ...directReportsUserIds]
   * - Regular Sales Agent / Employee: returns [ctx.user.id]
   */
  async getScopedUserIds(ctx: RequestContext): Promise<Types.ObjectId[] | null> {
    if (['admin', 'finance', 'hr', 'ops'].includes(ctx.user.role)) {
      return null;
    }

    if (ctx.user.role === 'manager') {
      const myEmployee = await employeeService.getManagerEmployee(ctx);
      if (!myEmployee) {
        return [toObjectId(ctx.user.id)];
      }

      const reports = await Employee.find({
        reportingManagerId: myEmployee._id,
        deletedAt: null,
      }).select('userId');

      const userIds: Types.ObjectId[] = [toObjectId(ctx.user.id)];
      for (const r of reports) {
        if (r.userId) {
          userIds.push(r.userId as Types.ObjectId);
        }
      }
      return userIds;
    }

    return [toObjectId(ctx.user.id)];
  },

  /**
   * Returns scoped Employee IDs for Tasks / Attendance / Leave queries:
   * - Admin / Finance / Ops / HR: returns null (unscoped)
   * - Manager: returns [managerEmployeeId, ...directReportsEmployeeIds]
   * - Regular employee: returns [myEmployeeId]
   */
  async getScopedEmployeeIds(ctx: RequestContext): Promise<Types.ObjectId[] | null> {
    if (['admin', 'finance', 'hr', 'ops'].includes(ctx.user.role)) {
      return null;
    }

    if (ctx.user.role === 'manager') {
      const myEmployee = await employeeService.getManagerEmployee(ctx);
      if (!myEmployee) {
        return [];
      }

      const reports = await Employee.find({
        reportingManagerId: myEmployee._id,
        deletedAt: null,
      }).select('_id');

      return [myEmployee._id as Types.ObjectId, ...reports.map((r) => r._id as Types.ObjectId)];
    }

    const myEmployee = await employeeService.getManagerEmployee(ctx);
    return myEmployee ? [myEmployee._id as Types.ObjectId] : [];
  },

  /**
   * Updates team name.
   * Managers can only edit their own team name. Admins can edit any manager's team name.
   */
  async updateTeamName(
    managerIdOrSelf: string | undefined,
    teamName: string,
    ctx: RequestContext,
  ): Promise<{ managerId: string; teamName: string }> {
    const trimmed = teamName.trim();
    if (!trimmed) {
      throw new ValidationError('Team name cannot be empty');
    }

    let managerDoc: IEmployee | null = null;

    if (ctx.user.role === 'admin') {
      if (managerIdOrSelf && Types.ObjectId.isValid(managerIdOrSelf)) {
        managerDoc = await Employee.findOne({ _id: toObjectId(managerIdOrSelf), deletedAt: null });
      } else {
        managerDoc = await employeeService.getManagerEmployee(ctx);
      }
    } else if (ctx.user.role === 'manager') {
      managerDoc = await employeeService.getManagerEmployee(ctx);
      if (!managerDoc) {
        throw new NotFoundError('Manager employee profile not found');
      }
      if (managerIdOrSelf && Types.ObjectId.isValid(managerIdOrSelf)) {
        if (String(managerDoc._id) !== String(managerIdOrSelf)) {
          throw new ForbiddenError('You can only edit your own team name');
        }
      }
    } else {
      throw new ForbiddenError('Only managers or administrators can edit team names');
    }

    if (!managerDoc) {
      throw new NotFoundError('Manager record not found');
    }

    managerDoc.teamName = trimmed;
    managerDoc.updatedBy = toObjectId(ctx.user.id);
    await managerDoc.save();

    return {
      managerId: String(managerDoc._id),
      teamName: managerDoc.teamName,
    };
  },

  /**
   * Assigns or reassigns an employee to a reporting manager.
   * Enforces strict team boundary rules:
   * - Manager can assign unassigned staff to own team, or remove member from own team.
   * - Manager CANNOT steal another manager's employee (403 Forbidden).
   * - Manager CANNOT assign employee to another manager (403 Forbidden).
   * - HR CANNOT reassign reporting managers (403 Forbidden).
   * - Admin can reassign globally.
   */
  async assignTeamMember(
    employeeId: string,
    targetManagerId: string | null | undefined,
    ctx: RequestContext,
  ): Promise<EmployeeDto> {
    const employee = await Employee.findOne({ _id: toObjectId(employeeId), deletedAt: null });
    if (!employee) {
      throw new NotFoundError('Employee not found');
    }

    if (ctx.user.role === 'hr') {
      throw new ForbiddenError('HR cannot reassign reporting managers. Contact an administrator.');
    }

    let resolvedManagerObjId: Types.ObjectId | null = null;

    if (targetManagerId) {
      const rawId = String(targetManagerId).trim();
      if (rawId && Types.ObjectId.isValid(rawId)) {
        const mgrEmp = await Employee.findOne({ _id: toObjectId(rawId), deletedAt: null });
        if (mgrEmp) {
          resolvedManagerObjId = mgrEmp._id as Types.ObjectId;
        } else {
          const mgrByUser = await Employee.findOne({ userId: toObjectId(rawId), deletedAt: null });
          if (mgrByUser) {
            resolvedManagerObjId = mgrByUser._id as Types.ObjectId;
          } else {
            throw new ValidationError('The selected reporting manager does not exist');
          }
        }
      }
    }

    if (ctx.user.role === 'manager') {
      const myEmp = await employeeService.getManagerEmployee(ctx);
      if (!myEmp) {
        throw new ForbiddenError('Manager employee profile not found');
      }

      // If targetManagerId is undefined (e.g. manager clicking "+ Add to my team"), default to manager's own employee ID
      if (targetManagerId === undefined) {
        resolvedManagerObjId = myEmp._id as Types.ObjectId;
      }

      const isCurrentReport = employee.reportingManagerId && String(employee.reportingManagerId) === String(myEmp._id);
      const isUnassigned = !employee.reportingManagerId;

      if (!isCurrentReport && !isUnassigned) {
        throw new ForbiddenError('You cannot reassign an employee belonging to another manager');
      }

      if (resolvedManagerObjId && String(resolvedManagerObjId) !== String(myEmp._id)) {
        throw new ForbiddenError('Managers can only assign members to their own team');
      }
    }

    if (resolvedManagerObjId) {
      await assertNoManagerCycle(employee._id as Types.ObjectId, resolvedManagerObjId);
    }

    employee.reportingManagerId = resolvedManagerObjId;
    employee.updatedBy = toObjectId(ctx.user.id);
    await employee.save();
    await employee.populate('reportingManagerId', 'fullName designation');

    return toDto(employee, canSeeSensitive(ctx));
  },

  /**
   * Removes member from team (sets reportingManagerId to null).
   */
  async removeTeamMember(employeeId: string, ctx: RequestContext): Promise<EmployeeDto> {
    return employeeService.assignTeamMember(employeeId, null, ctx);
  },

  /**
   * Formats a Team document into a NamedTeamDto.
   */
  async formatNamedTeamDto(
    teamDoc: any,
    includeSensitive: boolean,
  ): Promise<NamedTeamDto> {
    const memberIds = (teamDoc.members || []).map((m: any) =>
      typeof m === 'object' && '_id' in m ? m._id : m,
    );
    const memberDocs = await Employee.find({
      _id: { $in: memberIds },
      deletedAt: null,
    }).populate('reportingManagerId', 'fullName designation');

    const memberDtos = memberDocs.map((m) => toDto(m, includeSensitive));
    return {
      id: String(teamDoc._id),
      name: teamDoc.name,
      description: teamDoc.description || '',
      managerId: String(teamDoc.managerId),
      members: memberDtos,
      createdAt: teamDoc.createdAt ? new Date(teamDoc.createdAt).toISOString() : new Date().toISOString(),
      updatedAt: teamDoc.updatedAt ? new Date(teamDoc.updatedAt).toISOString() : new Date().toISOString(),
    };
  },

  /**
   * Creates a named team under a manager.
   */
  async createTeam(input: CreateTeamInput, ctx: RequestContext): Promise<NamedTeamDto> {
    let managerEmployeeId: Types.ObjectId;

    if (ctx.user.role === 'manager') {
      const myEmp = await employeeService.getManagerEmployee(ctx);
      if (!myEmp) throw new ForbiddenError('Manager employee profile not found');
      managerEmployeeId = myEmp._id as Types.ObjectId;
    } else {
      if (!input.managerId) {
        throw new ValidationError('managerId is required for admin/hr team creation');
      }
      managerEmployeeId = toObjectId(input.managerId);
      const mgrEmp = await Employee.findOne({ _id: managerEmployeeId, deletedAt: null });
      if (!mgrEmp) throw new NotFoundError('Manager not found');
    }

    const existing = await Team.findOne({
      managerId: managerEmployeeId,
      name: { $regex: new RegExp(`^${input.name.trim()}$`, 'i') },
      deletedAt: null,
    });
    if (existing) {
      throw new ConflictError(`A team named "${input.name.trim()}" already exists under this manager`);
    }

    const team = await Team.create({
      name: input.name.trim(),
      description: input.description?.trim() || '',
      managerId: managerEmployeeId,
      members: [],
      createdBy: toObjectId(ctx.user.id),
      updatedBy: toObjectId(ctx.user.id),
    });

    return employeeService.formatNamedTeamDto(team, canSeeSensitive(ctx));
  },

  /**
   * Updates named team (e.g. rename or update description).
   */
  async updateTeam(teamId: string, input: UpdateTeamInput, ctx: RequestContext): Promise<NamedTeamDto> {
    const team = await Team.findOne({ _id: toObjectId(teamId), deletedAt: null });
    if (!team) throw new NotFoundError('Team not found');

    if (ctx.user.role === 'manager') {
      const myEmp = await employeeService.getManagerEmployee(ctx);
      if (!myEmp || String(team.managerId) !== String(myEmp._id)) {
        throw new ForbiddenError('You can only update teams under your own management');
      }
    }

    if (input.name && input.name.trim() !== team.name) {
      const duplicate = await Team.findOne({
        _id: { $ne: team._id },
        managerId: team.managerId,
        name: { $regex: new RegExp(`^${input.name.trim()}$`, 'i') },
        deletedAt: null,
      });
      if (duplicate) {
        throw new ConflictError(`A team named "${input.name.trim()}" already exists under this manager`);
      }
      team.name = input.name.trim();
    }

    if (input.description !== undefined) {
      team.description = input.description.trim();
    }

    team.updatedBy = toObjectId(ctx.user.id);
    await team.save();

    return employeeService.formatNamedTeamDto(team, canSeeSensitive(ctx));
  },

  /**
   * Deletes a named team (soft-delete).
   */
  async deleteTeam(teamId: string, ctx: RequestContext): Promise<{ message: string; id: string }> {
    const team = await Team.findOne({ _id: toObjectId(teamId), deletedAt: null });
    if (!team) throw new NotFoundError('Team not found');

    if (ctx.user.role === 'manager') {
      const myEmp = await employeeService.getManagerEmployee(ctx);
      if (!myEmp || String(team.managerId) !== String(myEmp._id)) {
        throw new ForbiddenError('You can only delete teams under your own management');
      }
    }

    team.deletedAt = new Date();
    team.updatedBy = toObjectId(ctx.user.id);
    await team.save();

    return { message: 'Team deleted successfully', id: String(team._id) };
  },

  /**
   * Adds an employee to a named team.
   */
  async addMemberToTeam(teamId: string, employeeId: string, ctx: RequestContext): Promise<NamedTeamDto> {
    const team = await Team.findOne({ _id: toObjectId(teamId), deletedAt: null });
    if (!team) throw new NotFoundError('Team not found');

    if (ctx.user.role === 'manager') {
      const myEmp = await employeeService.getManagerEmployee(ctx);
      if (!myEmp || String(team.managerId) !== String(myEmp._id)) {
        throw new ForbiddenError('You can only add members to your own teams');
      }
    }

    const employee = await Employee.findOne({ _id: toObjectId(employeeId), deletedAt: null });
    if (!employee) throw new NotFoundError('Employee not found');

    const empObjId = employee._id as Types.ObjectId;
    const isAlreadyMember = team.members.some((m) => String(m) === String(empObjId));
    if (isAlreadyMember) {
      throw new ConflictError('Employee is already a member of this team');
    }

    team.members.push(empObjId);
    team.updatedBy = toObjectId(ctx.user.id);
    await team.save();

    if (!employee.reportingManagerId) {
      employee.reportingManagerId = team.managerId;
      await employee.save();
    }

    return employeeService.formatNamedTeamDto(team, canSeeSensitive(ctx));
  },

  /**
   * Removes an employee from a named team.
   */
  async removeMemberFromTeam(teamId: string, employeeId: string, ctx: RequestContext): Promise<NamedTeamDto> {
    const team = await Team.findOne({ _id: toObjectId(teamId), deletedAt: null });
    if (!team) throw new NotFoundError('Team not found');

    if (ctx.user.role === 'manager') {
      const myEmp = await employeeService.getManagerEmployee(ctx);
      if (!myEmp || String(team.managerId) !== String(myEmp._id)) {
        throw new ForbiddenError('You can only remove members from your own teams');
      }
    }

    team.members = team.members.filter((m) => String(m) !== String(employeeId));
    team.updatedBy = toObjectId(ctx.user.id);
    await team.save();

    return employeeService.formatNamedTeamDto(team, canSeeSensitive(ctx));
  },

  /**
   * Moves/reassigns an employee from one team to another under the same manager.
   */
  async reassignTeamMember(
    sourceTeamId: string,
    targetTeamId: string,
    employeeId: string,
    ctx: RequestContext,
  ): Promise<{ sourceTeam: NamedTeamDto; targetTeam: NamedTeamDto; message: string }> {
    const [sourceTeam, targetTeam] = await Promise.all([
      Team.findOne({ _id: toObjectId(sourceTeamId), deletedAt: null }),
      Team.findOne({ _id: toObjectId(targetTeamId), deletedAt: null }),
    ]);

    if (!sourceTeam) throw new NotFoundError('Source team not found');
    if (!targetTeam) throw new NotFoundError('Target team not found');

    if (String(sourceTeam.managerId) !== String(targetTeam.managerId)) {
      throw new ValidationError('Can only reassign members between teams under the same manager');
    }

    if (ctx.user.role === 'manager') {
      const myEmp = await employeeService.getManagerEmployee(ctx);
      if (!myEmp || String(sourceTeam.managerId) !== String(myEmp._id)) {
        throw new ForbiddenError('You can only move members between your own teams');
      }
    }

    const employee = await Employee.findOne({ _id: toObjectId(employeeId), deletedAt: null });
    if (!employee) throw new NotFoundError('Employee not found');

    const empObjId = employee._id as Types.ObjectId;

    sourceTeam.members = sourceTeam.members.filter((m) => String(m) !== String(empObjId));
    sourceTeam.updatedBy = toObjectId(ctx.user.id);
    await sourceTeam.save();

    if (!targetTeam.members.some((m) => String(m) === String(empObjId))) {
      targetTeam.members.push(empObjId);
      targetTeam.updatedBy = toObjectId(ctx.user.id);
      await targetTeam.save();
    }

    const [formattedSource, formattedTarget] = await Promise.all([
      employeeService.formatNamedTeamDto(sourceTeam, canSeeSensitive(ctx)),
      employeeService.formatNamedTeamDto(targetTeam, canSeeSensitive(ctx)),
    ]);

    return {
      message: 'Team member reassigned successfully',
      sourceTeam: formattedSource,
      targetTeam: formattedTarget,
    };
  },

  /**
   * Returns manager-wise team groups with direct reports and unassigned members,
   * enriched with real live CRM summary metrics and multiple named teams per manager.
   * Enforces strict backend scoping: Managers see only their own teams.
   */
  async getTeamHierarchy(
    ctx: RequestContext,
    managerFilterId?: string,
  ): Promise<TeamHierarchyResponseDto> {
    const includeSensitive = canSeeSensitive(ctx);

    // 1. Identify relevant managers
    let managersToProcess: IEmployee[] = [];

    if (ctx.user.role === 'manager') {
      const myEmployee = await employeeService.getManagerEmployee(ctx);
      if (!myEmployee) {
        return { teams: [], managers: [], unassigned: [] };
      }
      managersToProcess = [myEmployee];
    } else {
      // Admin / HR
      const allEmployees = await Employee.find({ deletedAt: null })
        .sort({ fullName: 1 })
        .populate('reportingManagerId', 'fullName designation');

      const managerAuthUsers = await AuthUser.find({
        role: 'manager',
        status: 'Active',
        deletedAt: null,
      }).select('_id');
      const managerUserIds = new Set(managerAuthUsers.map((u) => String(u._id)));

      const managerMap = new Map<string, IEmployee>();
      for (const emp of allEmployees) {
        if (
          emp.department === 'Management' ||
          /manager|lead|director|head/i.test(emp.designation || '') ||
          (emp.userId && managerUserIds.has(String(emp.userId)))
        ) {
          managerMap.set(String(emp._id), emp);
        }
      }

      // Also include any manager from existing Team records or reportingManagerId
      const allTeams = await Team.find({ deletedAt: null });
      for (const t of allTeams) {
        const mgr = allEmployees.find((e) => String(e._id) === String(t.managerId));
        if (mgr) managerMap.set(String(mgr._id), mgr);
      }
      for (const emp of allEmployees) {
        if (emp.reportingManagerId) {
          const rId = String(
            typeof emp.reportingManagerId === 'object' && '_id' in emp.reportingManagerId
              ? (emp.reportingManagerId as any)._id
              : emp.reportingManagerId,
          );
          const mgr = allEmployees.find((e) => String(e._id) === rId);
          if (mgr) managerMap.set(String(mgr._id), mgr);
        }
      }

      managersToProcess = Array.from(managerMap.values());
      if (managerFilterId) {
        managersToProcess = managersToProcess.filter((m) => String(m._id) === managerFilterId);
      }
      managersToProcess.sort((a, b) => a.fullName.localeCompare(b.fullName));
    }

    // 2. For each manager, load or auto-initialize their named teams
    const allEmpIdsInTeams = new Set<string>();
    const managerGroups: ManagerTeamsGroupDto[] = [];
    const legacyTeamGroups: Array<{ managerDoc: IEmployee; memberDocs: IEmployee[] }> = [];

    for (const mgr of managersToProcess) {
      const mgrId = mgr._id as Types.ObjectId;
      let teams = await Team.find({ managerId: mgrId, deletedAt: null }).sort({ createdAt: 1 });

      const directReports = await Employee.find({ reportingManagerId: mgrId, deletedAt: null })
        .sort({ fullName: 1 })
        .populate('reportingManagerId', 'fullName designation');

      // Auto-migrate / initialize: if no Team entries exist but manager has direct reports, create default team
      if (teams.length === 0 && directReports.length > 0) {
        const defaultTeamName = mgr.teamName?.trim() || `${mgr.fullName}'s Team`;
        const initialTeam = await Team.create({
          name: defaultTeamName,
          managerId: mgrId,
          description: 'Primary Team',
          members: directReports.map((d) => d._id),
          createdBy: toObjectId(ctx.user.id),
          updatedBy: toObjectId(ctx.user.id),
        });
        teams = [initialTeam];
      }

      // Collect all member IDs in this manager's teams
      const allMemberIdsForMgr = new Set<string>();
      for (const t of teams) {
        for (const mId of t.members) {
          allMemberIdsForMgr.add(String(mId));
          allEmpIdsInTeams.add(String(mId));
        }
      }
      for (const dr of directReports) {
        allMemberIdsForMgr.add(String(dr._id));
      }

      // Fetch all member docs
      const memberDocs = await Employee.find({
        _id: { $in: Array.from(allMemberIdsForMgr).map((id) => toObjectId(id)) },
        deletedAt: null,
      }).populate('reportingManagerId', 'fullName designation');

      const memberMap = new Map<string, IEmployee>(memberDocs.map((m) => [String(m._id), m]));

      const namedTeamDtos: NamedTeamDto[] = [];
      for (const t of teams) {
        const tMemberDocs: IEmployee[] = [];
        for (const mId of t.members) {
          const doc = memberMap.get(String(mId));
          if (doc) tMemberDocs.push(doc);
        }
        namedTeamDtos.push({
          id: String(t._id),
          name: t.name,
          description: t.description || '',
          managerId: String(t.managerId),
          members: tMemberDocs.map((m) => toDto(m, includeSensitive)),
          createdAt: t.createdAt ? new Date(t.createdAt).toISOString() : new Date().toISOString(),
          updatedAt: t.updatedAt ? new Date(t.updatedAt).toISOString() : new Date().toISOString(),
        });
      }

      managerGroups.push({
        manager: toDto(mgr, includeSensitive),
        teams: namedTeamDtos,
        totalMembersCount: allMemberIdsForMgr.size,
      });

      legacyTeamGroups.push({
        managerDoc: mgr,
        memberDocs: Array.from(memberMap.values()),
      });
    }

    const legacyTeams = await employeeService.computeTeamMetrics(legacyTeamGroups, includeSensitive);

    // Unassigned members: Active employees not assigned to any manager/team and not managers
    const managerIdSet = new Set(managersToProcess.map((m) => String(m._id)));
    const unassignedDocs = await Employee.find({
      reportingManagerId: null,
      deletedAt: null,
      status: 'Active',
      _id: { $nin: Array.from(allEmpIdsInTeams).map((id) => toObjectId(id)) },
    })
      .sort({ fullName: 1 })
      .populate('reportingManagerId', 'fullName designation');

    const filteredUnassigned = unassignedDocs
      .filter((e) => !managerIdSet.has(String(e._id)))
      .map((e) => toDto(e, includeSensitive));

    return {
      teams: legacyTeams,
      managers: managerGroups,
      unassigned: managerFilterId || ctx.user.role === 'manager' ? [] : filteredUnassigned,
    };
  },

  /**
   * Batches queries to compute real live CRM summary metrics for teams and members.
   */
  async computeTeamMetrics(
    teams: Array<{ managerDoc: IEmployee; memberDocs: IEmployee[] }>,
    includeSensitive: boolean,
  ): Promise<TeamGroupDto[]> {
    if (teams.length === 0) return [];

    const allEmpIds: Types.ObjectId[] = [];
    const allUserIds: Types.ObjectId[] = [];

    for (const t of teams) {
      allEmpIds.push(t.managerDoc._id as Types.ObjectId);
      if (t.managerDoc.userId) allUserIds.push(t.managerDoc.userId as Types.ObjectId);
      for (const m of t.memberDocs) {
        allEmpIds.push(m._id as Types.ObjectId);
        if (m.userId) allUserIds.push(m.userId as Types.ObjectId);
      }
    }

    const todayMidnight = new Date();
    todayMidnight.setHours(0, 0, 0, 0);
    const nextMidnight = new Date(todayMidnight);
    nextMidnight.setDate(nextMidnight.getDate() + 1);

    const [leads, tasks, attendances] = await Promise.all([
      allUserIds.length > 0
        ? Lead.find({
          deletedAt: null,
          $or: [
            { assignedTo: { $in: allUserIds } },
            { claimedBy: { $in: allUserIds } },
            { createdBy: { $in: allUserIds } },
          ],
        }).select('_id assignedTo claimedBy createdBy status')
        : [],
      allEmpIds.length > 0
        ? Task.find({
          deletedAt: null,
          assignedTo: { $in: allEmpIds },
        }).select('_id assignedTo status deadline')
        : [],
      allEmpIds.length > 0
        ? Attendance.find({
          employeeId: { $in: allEmpIds },
          date: { $gte: todayMidnight, $lt: nextMidnight },
          deletedAt: null,
        }).select('employeeId status')
        : [],
    ]);

    const leadIds = leads.map((l) => l._id);

    const [quotations, campaigns] = await Promise.all([
      allUserIds.length > 0 || leadIds.length > 0
        ? Quotation.find({
          deletedAt: null,
          $or: [
            ...(allUserIds.length > 0 ? [{ createdBy: { $in: allUserIds } }] : []),
            ...(leadIds.length > 0 ? [{ leadId: { $in: leadIds } }] : []),
          ],
        }).select('_id createdBy leadId status total')
        : [],
      allUserIds.length > 0 || leadIds.length > 0
        ? Campaign.find({
          deletedAt: null,
          $or: [
            ...(allUserIds.length > 0 ? [{ assignedManager: { $in: allUserIds } }] : []),
            ...(leadIds.length > 0 ? [{ leadId: { $in: leadIds } }] : []),
          ],
        }).select('_id assignedManager leadId status')
        : [],
    ]);

    const attendanceMap = new Map<string, string>();
    for (const att of attendances) {
      attendanceMap.set(String(att.employeeId), att.status);
    }

    const now = new Date();
    const OPEN_LEAD_STATUSES = new Set(['New', 'Contacted', 'Interested', 'Proposal Sent', 'Negotiation']);

    return teams.map(({ managerDoc, memberDocs }) => {
      const teamUserIds = new Set<string>();
      if (managerDoc.userId) teamUserIds.add(String(managerDoc.userId));
      for (const m of memberDocs) {
        if (m.userId) teamUserIds.add(String(m.userId));
      }
      const teamEmpIds = new Set<string>([
        String(managerDoc._id),
        ...memberDocs.map((m) => String(m._id)),
      ]);

      const teamLeads = leads.filter((l) => {
        const a = l.assignedTo ? String(l.assignedTo) : null;
        const c = l.claimedBy ? String(l.claimedBy) : null;
        const cr = l.createdBy ? String(l.createdBy) : null;
        return (a && teamUserIds.has(a)) || (c && teamUserIds.has(c)) || (cr && teamUserIds.has(cr));
      });

      const teamLeadIdSet = new Set(teamLeads.map((l) => String(l._id)));

      const teamTasks = tasks.filter((t) => t.assignedTo && teamEmpIds.has(String(t.assignedTo)));

      const teamQuotes = quotations.filter((q) => {
        const cr = q.createdBy ? String(q.createdBy) : null;
        const l = q.leadId ? String(q.leadId) : null;
        return (cr && teamUserIds.has(cr)) || (l && teamLeadIdSet.has(l));
      });

      const teamCampaigns = campaigns.filter((c) => {
        const m = c.assignedManager ? String(c.assignedManager) : null;
        const l = c.leadId ? String(c.leadId) : null;
        return (m && teamUserIds.has(m)) || (l && teamLeadIdSet.has(l));
      });

      const members: TeamMemberDto[] = memberDocs.map((m) => {
        const memberDto = toDto(m, includeSensitive);
        const mUserId = m.userId ? String(m.userId) : null;
        const mEmpId = String(m._id);

        const mLeads = mUserId
          ? teamLeads.filter((l) => String(l.assignedTo) === mUserId || String(l.claimedBy) === mUserId)
          : [];
        const mTasks = teamTasks.filter((t) => String(t.assignedTo) === mEmpId);

        const openLeads = mLeads.filter((l) => OPEN_LEAD_STATUSES.has(l.status)).length;
        const qualifiedLeads = mLeads.filter((l) => l.status === 'Qualified').length;
        const wonLeads = mLeads.filter((l) => l.status === 'Won').length;

        const pendingTasks = mTasks.filter(
          (t) => (t.status === 'Pending' || t.status === 'InProgress') && new Date(t.deadline) >= now,
        ).length;
        const completedTasks = mTasks.filter((t) => t.status === 'Completed').length;
        const overdueTasks = mTasks.filter(
          (t) => t.status !== 'Completed' && new Date(t.deadline) < now,
        ).length;

        return {
          ...memberDto,
          leadsCount: {
            total: mLeads.length,
            open: openLeads,
            qualified: qualifiedLeads,
            won: wonLeads,
          },
          tasksCount: {
            total: mTasks.length,
            pending: pendingTasks,
            completed: completedTasks,
            overdue: overdueTasks,
          },
          activeCampaignsCount: teamCampaigns.length,
          attendanceToday: attendanceMap.get(mEmpId) || 'None',
        };
      });

      const openLeads = teamLeads.filter((l) => OPEN_LEAD_STATUSES.has(l.status)).length;
      const qualifiedLeads = teamLeads.filter((l) => l.status === 'Qualified').length;
      const wonLeads = teamLeads.filter((l) => l.status === 'Won').length;

      const pendingTasks = teamTasks.filter((t) => t.status !== 'Completed').length;
      const activeCampaigns = teamCampaigns.filter((c) =>
        ['Approved', 'In Progress', 'Active', 'In_Progress'].includes(c.status),
      ).length;

      const teamName =
        managerDoc.teamName?.trim() || `${managerDoc.fullName}'s Team`;

      return {
        manager: toDto(managerDoc, includeSensitive),
        teamName,
        members,
        summary: {
          totalMembers: members.length,
          activeMembers: members.filter((m) => m.status === 'Active').length,
          totalLeads: teamLeads.length,
          openLeads,
          qualifiedLeads,
          wonLeads,
          quotationsCount: teamQuotes.length,
          activeCampaignsCount: activeCampaigns,
          pendingTasksCount: pendingTasks,
        },
      };
    });
  },

  /**
   * Retrieves complete, live CRM summary for a single member:
   * Leads, tasks, quotations, attendance today and this month, and leave balance.
   */
  async getMemberCrmSummary(
    employeeId: string,
    ctx: RequestContext,
  ): Promise<{
    employee: EmployeeDto;
    leads: {
      total: number;
      byStatus: Record<string, number>;
      recent: Array<{
        id: string;
        companyName: string;
        contactPerson: string;
        mobile: string;
        status: string;
        city?: string;
        createdAt: string;
      }>;
    };
    tasks: {
      total: number;
      pending: number;
      completed: number;
      overdue: number;
      recent: Array<{
        id: string;
        title: string;
        type: string;
        status: string;
        deadline: string;
        campaignName?: string;
      }>;
    };
    attendance: {
      today: string;
      thisMonthPresent: number;
      thisMonthLate: number;
      thisMonthHalfDay: number;
    };
    leave: {
      allocated: number;
      used: number;
      balance: number;
    };
  }> {
    const employee = await Employee.findOne({
      _id: toObjectId(employeeId),
      deletedAt: null,
    }).populate('reportingManagerId', 'fullName designation');

    if (!employee) throw new NotFoundError('Employee not found');

    // Access control check
    if (ctx.user.role === 'manager') {
      const myEmp = await employeeService.getManagerEmployee(ctx);
      const isSelf =
        (myEmp && String(myEmp._id) === String(employee._id)) ||
        (employee.userId && String(employee.userId) === String(ctx.user.id));

      const rId = employee.reportingManagerId
        ? (typeof employee.reportingManagerId === 'object' && '_id' in (employee.reportingManagerId as any)
          ? String((employee.reportingManagerId as any)._id)
          : String(employee.reportingManagerId))
        : null;

      let isReport = false;
      if (myEmp && rId) {
        if (
          rId === String(myEmp._id) ||
          (myEmp.userId && rId === String(myEmp.userId)) ||
          rId === String(ctx.user.id)
        ) {
          isReport = true;
        } else if (Types.ObjectId.isValid(rId)) {
          const rMgrEmp = await Employee.findOne({
            $or: [{ _id: toObjectId(rId) }, { userId: toObjectId(rId) }],
            deletedAt: null,
          });
          if (
            rMgrEmp &&
            (String(rMgrEmp._id) === String(myEmp._id) ||
              (rMgrEmp.userId && String(rMgrEmp.userId) === String(ctx.user.id)) ||
              (myEmp.userId && rMgrEmp.userId && String(rMgrEmp.userId) === String(myEmp.userId)))
          ) {
            isReport = true;
          }
        }
      }

      let isTeamMember = false;
      if (myEmp) {
        isTeamMember = Boolean(
          await Team.exists({ managerId: myEmp._id, members: employee._id, deletedAt: null }),
        );
      }

      if (!isSelf && !isReport && !isTeamMember) {
        throw new ForbiddenError('You do not have permission to view CRM summary for this employee');
      }
    } else if (ctx.user.role !== 'admin' && ctx.user.role !== 'hr') {
      const isSelf = employee.userId && String(employee.userId) === String(ctx.user.id);
      if (!isSelf) {
        throw new ForbiddenError('You do not have permission to view CRM summary for this employee');
      }
    }

    const userId = employee.userId ? toObjectId(String(employee.userId)) : null;
    const empId = employee._id as Types.ObjectId;

    const now = new Date();
    const currentYear = now.getFullYear();
    const startOfMonth = new Date(currentYear, now.getMonth(), 1);
    const endOfMonth = new Date(currentYear, now.getMonth() + 1, 0, 23, 59, 59, 999);
    const todayMidnight = new Date();
    todayMidnight.setHours(0, 0, 0, 0);
    const nextMidnight = new Date(todayMidnight);
    nextMidnight.setDate(nextMidnight.getDate() + 1);

    const [rawLeads, rawTasks, todayAtt, monthAtt, leaveBalances] = await Promise.all([
      userId
        ? Lead.find({
          deletedAt: null,
          $or: [{ assignedTo: userId }, { claimedBy: userId }, { createdBy: userId }],
        })
          .sort({ createdAt: -1 })
          .lean()
        : [],
      Task.find({
        deletedAt: null,
        assignedTo: empId,
      })
        .populate('campaignId', 'name campaignCode')
        .sort({ deadline: 1 })
        .lean(),
      Attendance.findOne({
        employeeId: empId,
        date: { $gte: todayMidnight, $lt: nextMidnight },
        deletedAt: null,
      }).select('status'),
      Attendance.find({
        employeeId: empId,
        date: { $gte: startOfMonth, $lte: endOfMonth },
        deletedAt: null,
      }).select('status'),
      leaveTypeService.getBalanceForEmployee(String(empId), currentYear, ctx).catch(() => []),
    ]);

    const leadStatusMap: Record<string, number> = {};
    for (const l of rawLeads) {
      leadStatusMap[l.status] = (leadStatusMap[l.status] || 0) + 1;
    }

    let tasksPending = 0;
    let tasksCompleted = 0;
    let tasksOverdue = 0;

    for (const t of rawTasks) {
      if (t.status === 'Completed') {
        tasksCompleted++;
      } else if (new Date(t.deadline) < now) {
        tasksOverdue++;
      } else {
        tasksPending++;
      }
    }

    let monthPresent = 0;
    let monthLate = 0;
    let monthHalfDay = 0;

    for (const a of monthAtt) {
      if (a.status === 'Present') monthPresent++;
      else if (a.status === 'Late') monthLate++;
      else if (a.status === 'Half-Day') monthHalfDay++;
    }

    let totalAllocated = 0;
    let totalUsed = 0;
    let totalBalance = 0;

    for (const b of leaveBalances) {
      totalAllocated += b.allocated || 0;
      totalUsed += b.used || 0;
      totalBalance += b.balance || 0;
    }

    return {
      employee: toDto(employee, canSeeSensitive(ctx)),
      leads: {
        total: rawLeads.length,
        byStatus: leadStatusMap,
        recent: rawLeads.map((l: any) => {
          const budgetPaise = l.qualification?.budget ?? l.budget;
          const city = l.qualification?.city || l.city || '';
          const campaignDuration = l.qualification?.campaignDuration || l.campaignDuration || '';
          return {
            id: String(l._id),
            companyName: l.companyName || l.contactPerson || 'Unnamed Lead',
            contactPerson: l.contactPerson || '',
            mobile: l.mobile || '',
            email: l.email || '',
            status: l.status,
            city,
            budget: typeof budgetPaise === 'number' ? budgetPaise / 100 : undefined,
            campaignDuration,
            createdAt: l.createdAt ? new Date(l.createdAt).toISOString() : new Date().toISOString(),
          };
        }),
      },
      tasks: {
        total: rawTasks.length,
        pending: tasksPending,
        completed: tasksCompleted,
        overdue: tasksOverdue,
        recent: rawTasks.slice(0, 8).map((t: any) => ({
          id: String(t._id),
          title: t.title,
          type: t.type,
          status: t.status,
          deadline: t.deadline ? new Date(t.deadline).toISOString() : '',
          campaignName: (t.campaignId as any)?.name || '',
        })),
      },
      attendance: {
        today: todayAtt?.status || 'None',
        thisMonthPresent: monthPresent,
        thisMonthLate: monthLate,
        thisMonthHalfDay: monthHalfDay,
      },
      leave: {
        allocated: totalAllocated,
        used: totalUsed,
        balance: totalBalance,
      },
    };
  },

  /**
   * Ensures an Employee record exists and is linked to the given AuthUser.
   * Links to existing employee by userId/workEmail, or creates a minimal new one.
   * Does NOT auto-populate fake department, designation, or other business fields.
   */
  async ensureEmployeeForUser(user: {
    id: string | Types.ObjectId;
    name: string;
    email: string;
    role?: string;
    status?: string;
    department?: string;
    designation?: string;
    mobile?: string;
    workLocation?: string;
    reportingManagerId?: string | Types.ObjectId | null;
  }): Promise<IEmployee> {
    const email = user.email.toLowerCase().trim();
    const userId = toObjectId(String(user.id));
    let targetManagerId: Types.ObjectId | null | undefined = undefined;

    if (user.reportingManagerId !== undefined) {
      if (user.reportingManagerId === null || user.reportingManagerId === '') {
        targetManagerId = null;
      } else {
        const rawId = String(user.reportingManagerId).trim();
        if (rawId && Types.ObjectId.isValid(rawId)) {
          const objId = toObjectId(rawId);
          // 1. Check if rawId is already an Employee _id
          const managerEmployee = await Employee.findOne({ _id: objId, deletedAt: null });
          if (managerEmployee) {
            targetManagerId = managerEmployee._id as Types.ObjectId;
          } else {
            // 2. Check if rawId was an AuthUser _id
            const managerByUserId = await Employee.findOne({ userId: objId, deletedAt: null });
            if (managerByUserId) {
              targetManagerId = managerByUserId._id as Types.ObjectId;
            } else {
              targetManagerId = objId;
            }
          }
        } else {
          targetManagerId = null;
        }
      }
    }

    // 1. Try finding by userId
    let employee = await Employee.findOne({ userId, deletedAt: null });

    // 2. Try finding by workEmail
    if (!employee) {
      employee = await Employee.findOne({ workEmail: email, deletedAt: null });
      if (employee) {
        employee.userId = userId;
        if (user.name) employee.fullName = user.name;
        if (user.status) employee.status = user.status === 'Active' ? 'Active' : 'Inactive';
        if (targetManagerId !== undefined) {
          if (targetManagerId && String(employee._id) === String(targetManagerId)) {
            targetManagerId = null;
          }
          employee.reportingManagerId = targetManagerId;
        }
        await employee.save();
        await employee.populate('reportingManagerId', 'fullName designation');
        return employee;
      }
    }

    // 3. If found by userId, sync only name/status/reportingManagerId (DO NOT overwrite HR profile data)
    if (employee) {
      let changed = false;
      if (user.name && employee.fullName !== user.name) {
        employee.fullName = user.name;
        changed = true;
      }
      if (user.status) {
        const targetStatus = user.status === 'Active' ? 'Active' : 'Inactive';
        if (employee.status !== targetStatus) {
          employee.status = targetStatus;
          changed = true;
        }
      }
      if (targetManagerId !== undefined) {
        if (targetManagerId && String(employee._id) === String(targetManagerId)) {
          targetManagerId = null;
        }
        if (String(employee.reportingManagerId ?? '') !== String(targetManagerId ?? '')) {
          employee.reportingManagerId = targetManagerId;
          changed = true;
        }
      }
      if (changed) {
        await employee.save();
      }
      await employee.populate('reportingManagerId', 'fullName designation');
      return employee;
    }

    // 4. If neither exists, create a minimal Employee record WITHOUT fake business defaults
    let employeeCode = await formattedSequence('employee', 'MO-EMP');
    while (await Employee.exists({ employeeCode })) {
      employeeCode = await formattedSequence('employee', 'MO-EMP');
    }

    const newEmployee = await Employee.create({
      employeeCode,
      userId,
      fullName: user.name,
      workEmail: email,
      mobile: user.mobile || '',
      department: (user.department as Department) || null,
      designation: user.designation || '',
      employmentType: null,
      dateOfJoining: null,
      workLocation: user.workLocation || '',
      reportingManagerId: targetManagerId ?? null,
      status: user.status === 'Active' ? 'Active' : 'Inactive',
      isProfileComplete: false,
      createdBy: userId,
      updatedBy: userId,
    });

    await newEmployee.populate('reportingManagerId', 'fullName designation');
    return newEmployee;
  },
};

