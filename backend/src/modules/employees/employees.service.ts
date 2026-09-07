import { Types } from 'mongoose';

import type { RequestContext } from '../../core/context.js';
import { toObjectId } from '../../core/db/basePlugin.js';
import { formattedSequence } from '../../core/db/sequence.js';
import { ConflictError, NotFoundError, ValidationError } from '../../core/errors/index.js';
import { scopeFilter, scopedCount, scopedFind } from '../../core/scoping/index.js';
import { Employee, SENSITIVE_FIELDS, type IEmployee } from './employees.model.js';
import type {
  CreateEmployeeInput,
  ListEmployeesQuery,
  UpdateEmployeeInput,
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
  dateOfJoining: string;
  dateOfExit: string | null;
  reportingManager: { id: string; fullName: string; designation: string } | null;
  workLocation: string;
  status: string;
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
  const managerIsPopulated = manager !== null && manager !== undefined && 'fullName' in manager;

  const dto: EmployeeDto = {
    id: String(employee._id),
    employeeCode: employee.employeeCode,
    fullName: employee.fullName,
    workEmail: employee.workEmail,
    personalEmail: employee.personalEmail,
    mobile: employee.mobile,
    dateOfBirth: iso(employee.dateOfBirth),
    department: employee.department,
    designation: employee.designation,
    employmentType: employee.employmentType,
    dateOfJoining: iso(employee.dateOfJoining) as string,
    dateOfExit: iso(employee.dateOfExit),
    reportingManager: managerIsPopulated
      ? {
        id: String((manager as IEmployee)._id),
        fullName: (manager as IEmployee).fullName,
        designation: (manager as IEmployee).designation,
      }
      : null,
    workLocation: employee.workLocation,
    status: employee.status,
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

  /** The signed-in user's own record, looked up by their login account. */
  async getMine(ctx: RequestContext): Promise<EmployeeDto> {
    const employee = await Employee.findOne({
      userId: ctx.user.id,
      deletedAt: null,
    }).populate('reportingManagerId', 'fullName designation');

    if (!employee) {
      throw new NotFoundError('No employee record is linked to your account yet');
    }

    // You may always see your own sensitive details.
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
    const employeeCode = await formattedSequence('employee', 'MO-EMP');

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

    if (payload.reportingManagerId) {
      const manager = await Employee.findOne({
        _id: payload.reportingManagerId,
        deletedAt: null,
      });
      if (!manager) throw new ValidationError('The selected reporting manager does not exist');

      await assertNoManagerCycle(employee._id as Types.ObjectId, payload.reportingManagerId);
    }

    Object.assign(employee, payload, { updatedBy: toObjectId(ctx.user.id) });
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
      .select('fullName designation employeeCode')
      .sort({ fullName: 1 })
      .limit(500);

    return documents.map((doc) => ({
      id: String(doc._id),
      fullName: doc.fullName,
      designation: doc.designation,
      employeeCode: doc.employeeCode,
    }));
  },

  async getAllActiveEmployees(ctx: RequestContext): Promise<EmployeeDto[]> {
    const documents = await scopedFind(Employee, { status: 'Active' }, ctx).sort({ fullName: 1 });
    const includeSensitive = canSeeSensitive(ctx);
    return documents.map((doc) => toDto(doc, includeSensitive));
  },
};
