import mongoose, { HydratedDocument } from 'mongoose';

import type { RequestContext } from '../../../core/context.js';

import {
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from '../../../core/errors/index.js';

import { scopeFilter } from '../../../core/scoping/index.js';

import { Employee } from '../../employees/employees.model.js';

import LeaveRequest, {
  type ILeaveRequest,
} from '../models/leave-request.model.js';

import { LeaveType, LeaveBalance } from '../leaveTypes/leaveTypes.model.js';

import { leaveTypeService } from '../leaveTypes/leaveTypes.service.js';

import type {
  CreateLeaveRequestInput,
  ListLeaveRequestsQuery,
  RejectLeaveRequestInput,
} from './leaveRequest.validator.js';

function toDto(doc: HydratedDocument<ILeaveRequest>) {
  return {
    id: String(doc._id),
    employeeId: String(doc.employeeId),
    leaveTypeId: String(doc.leaveTypeId),
    fromDate: doc.fromDate.toISOString(),
    toDate: doc.toDate.toISOString(),
    days: doc.days,
    reason: doc.reason,
    status: doc.status,
    documentUrl: doc.documentUrl ?? null,
    approverId: doc.approverId
      ? String(doc.approverId)
      : null,
    approvedAt: doc.approvedAt
      ? doc.approvedAt.toISOString()
      : null,
    rejectionReason: doc.rejectionReason ?? null,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

async function getCurrentEmployeeId(
  ctx: RequestContext,
): Promise<string> {
  const employee = await Employee.findOne({
    userId: ctx.user.id,
    deletedAt: null,
  });

  if (!employee) {
    throw new NotFoundError(
      'No employee record is linked to your account',
    );
  }

  return String(employee._id);
}

function canManageLeave(ctx: RequestContext): boolean {
  return (
    ctx.user.role === 'admin' ||
    ctx.user.role === 'hr' ||
    ctx.user.role === 'manager'
  );
}

export const leaveRequestService = {
  // -------------------------------------------------------------------------
  // Create
  // -------------------------------------------------------------------------

  async create(
    input: CreateLeaveRequestInput,
    ctx: RequestContext,
  ) {
    const currentEmployeeId = await getCurrentEmployeeId(ctx);

    // Employee can only create leave for himself.
    if (
      ctx.user.role !== 'admin' &&
      ctx.user.role !== 'hr' &&
      input.employeeId !== currentEmployeeId
    ) {
      throw new ForbiddenError(
        'You can only create leave requests for yourself',
      );
    }

    if (
      !mongoose.Types.ObjectId.isValid(input.employeeId) ||
      !mongoose.Types.ObjectId.isValid(input.leaveTypeId)
    ) {
      throw new ValidationError(
        'Invalid employee or leave type ID',
      );
    }

    if (input.toDate < input.fromDate) {
      throw new ValidationError(
        'To date cannot be before from date',
      );
    }

    const leaveType = await LeaveType.findById(
      input.leaveTypeId,
    );

    if (!leaveType) {
      throw new NotFoundError('Leave type not found');
    }

    if (leaveType.status !== 'Active') {
      throw new ValidationError(
        'Selected leave type is inactive',
      );
    }

    const created = await LeaveRequest.create({
      employeeId: input.employeeId,
      leaveTypeId: input.leaveTypeId,
      fromDate: input.fromDate,
      toDate: input.toDate,
      days: input.days,
      reason: input.reason,
      documentUrl: input.documentUrl,
      status: 'Pending',
      createdBy: mongoose.Types.ObjectId.createFromHexString(
        ctx.user.id,
      ),
      updatedBy: mongoose.Types.ObjectId.createFromHexString(
        ctx.user.id,
      ),
    });

    return toDto(
      await LeaveRequest.findById(created._id) as HydratedDocument<ILeaveRequest>,
    );
  },

  // -------------------------------------------------------------------------
  // List
  // -------------------------------------------------------------------------

  async list(
    query: ListLeaveRequestsQuery,
    ctx: RequestContext,
  ) {
    const filter: Record<string, unknown> = {};

    if (query.status) {
      filter.status = query.status;
    }

    if (query.employeeId) {
      filter.employeeId = query.employeeId;
    }

    const skip =
      (query.page - 1) * query.pageSize;

    const documents = await LeaveRequest.find(
      scopeFilter(filter, ctx),
    )
      .populate('employeeId')
      .populate('leaveTypeId')
      .populate('approverId')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(query.pageSize);

    const total = await LeaveRequest.countDocuments(
      scopeFilter(filter, ctx),
    );

    return {
      leaveRequests: documents.map(
        (doc) =>
          toDto(
            doc as HydratedDocument<ILeaveRequest>,
          ),
      ),
      page: query.page,
      pageSize: query.pageSize,
      total,
      totalPages: Math.max(
        1,
        Math.ceil(total / query.pageSize),
      ),
    };
  },

  // -------------------------------------------------------------------------
  // Get single
  // -------------------------------------------------------------------------

  async getById(
    id: string,
    ctx: RequestContext,
  ) {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new ValidationError(
        'Invalid leave request ID',
      );
    }

    const doc = await LeaveRequest.findOne(
      scopeFilter({ _id: id }, ctx),
    )
      .populate('employeeId')
      .populate('leaveTypeId')
      .populate('approverId');

    if (!doc) {
      throw new NotFoundError(
        'Leave request not found',
      );
    }

    return toDto(
      doc as HydratedDocument<ILeaveRequest>,
    );
  },

  // -------------------------------------------------------------------------
  // Approve
  // -------------------------------------------------------------------------

  async approve(
    id: string,
    ctx: RequestContext,
  ) {
    if (!canManageLeave(ctx)) {
      throw new ForbiddenError(
        'You do not have permission to approve leave requests',
      );
    }

    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new ValidationError(
        'Invalid leave request ID',
      );
    }

    const leaveRequest =
      await LeaveRequest.findOne(
        scopeFilter({ _id: id }, ctx),
      );

    if (!leaveRequest) {
      throw new NotFoundError(
        'Leave request not found',
      );
    }

    if (leaveRequest.status !== 'Pending') {
      throw new ValidationError(
        `Leave request is already ${leaveRequest.status}`,
      );
    }

    const approverEmployeeId =
      await getCurrentEmployeeId(ctx);

    // Check balance before approval.
    const leaveYear =
      leaveRequest.fromDate.getUTCFullYear();

    const balance =
      await leaveTypeService.getBalance(
        String(leaveRequest.employeeId),
        String(leaveRequest.leaveTypeId),
        leaveYear,
      );

    if (leaveRequest.days > balance.balance) {
      throw new ValidationError(
        `Insufficient leave balance. Requested ${leaveRequest.days} day(s), ${balance.balance} available`,
      );
    }

    // Deduct leave balance.
    // No MongoDB transaction because local MongoDB is standalone.
    await leaveTypeService.deductBalance(
      String(leaveRequest.employeeId),
      String(leaveRequest.leaveTypeId),
      leaveYear,
      leaveRequest.days,
      ctx,
    );

    leaveRequest.status = 'Approved';

    leaveRequest.approverId =
      mongoose.Types.ObjectId.createFromHexString(
        approverEmployeeId,
      );

    leaveRequest.approvedAt = new Date();

    leaveRequest.updatedBy =
      mongoose.Types.ObjectId.createFromHexString(
        ctx.user.id,
      );

    await leaveRequest.save();

    return toDto(
      await LeaveRequest.findById(
        leaveRequest._id,
      ) as HydratedDocument<ILeaveRequest>,
    );
  },

  // -------------------------------------------------------------------------
  // Reject
  // -------------------------------------------------------------------------

  async reject(
    id: string,
    input: RejectLeaveRequestInput,
    ctx: RequestContext,
  ) {
    if (!canManageLeave(ctx)) {
      throw new ForbiddenError(
        'You do not have permission to reject leave requests',
      );
    }

    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new ValidationError(
        'Invalid leave request ID',
      );
    }

    const leaveRequest =
      await LeaveRequest.findOne(
        scopeFilter({ _id: id }, ctx),
      );

    if (!leaveRequest) {
      throw new NotFoundError(
        'Leave request not found',
      );
    }

    if (leaveRequest.status !== 'Pending') {
      throw new ValidationError(
        `Leave request is already ${leaveRequest.status}`,
      );
    }

    const approverEmployeeId =
      await getCurrentEmployeeId(ctx);

    leaveRequest.status = 'Rejected';

    leaveRequest.approverId =
      mongoose.Types.ObjectId.createFromHexString(
        approverEmployeeId,
      );

    leaveRequest.approvedAt = null;

    leaveRequest.rejectionReason =
      input.rejectionReason;

    leaveRequest.updatedBy =
      mongoose.Types.ObjectId.createFromHexString(
        ctx.user.id,
      );

    await leaveRequest.save();

    return toDto(
      await LeaveRequest.findById(
        leaveRequest._id,
      ) as HydratedDocument<ILeaveRequest>,
    );
  },
};