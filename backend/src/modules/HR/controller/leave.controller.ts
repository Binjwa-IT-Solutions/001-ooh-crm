import { Request, Response, NextFunction } from 'express';
import { fileService } from '../../../core/files/index.js';
import { UnauthorizedError } from '../../../core/errors/index.js';
import * as service from '../services/leave.service.js';
import {
  allocateBalanceSchema,
  createLeaveRequestSchema,
  createLeaveTypeSchema,
  employeeIdParamSchema,
  getBalanceQuerySchema,
  leaveApprovalSchema,
  leaveRequestIdSchema,
  leaveTypeIdSchema,
  listLeaveRequestsSchema,
  listLeaveTypesSchema,
  rejectLeaveRequestSchema,
  updateLeaveRequestSchema,
  updateLeaveTypeSchema,
} from '../validators/leave.validator.js';

function getContext(req: Request) {
  if (!req.ctx) throw new UnauthorizedError();
  return req.ctx;
}

// ---------------------------------------------------------------------------
// Leave Types Controllers
// ---------------------------------------------------------------------------

export async function listLeaveTypes(req: Request, res: Response, next: NextFunction) {
  try {
    const query = listLeaveTypesSchema.parse(req.query);
    const result = await service.listLeaveTypes(query, getContext(req));
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function getLeaveTypes(req: Request, res: Response, next: NextFunction) {
  try {
    // If pageSize or page query params exist, treat as paginated list
    if (req.query.pageSize || req.query.page) {
      const query = listLeaveTypesSchema.parse(req.query);
      const result = await service.listLeaveTypes(query, getContext(req));
      res.json(result);
      return;
    }
    const result = await service.getLeaveTypes();
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function getLeaveTypeById(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = leaveTypeIdSchema.parse(req.params);
    const leaveType = await service.getLeaveTypeById(id, getContext(req));
    res.json({ leaveType });
  } catch (err) {
    next(err);
  }
}

export async function createLeaveType(req: Request, res: Response, next: NextFunction) {
  try {
    const input = createLeaveTypeSchema.parse(req.body);
    const leaveType = await service.createLeaveType(input, getContext(req));
    res.status(201).json({ message: 'Leave type created', leaveType });
  } catch (err) {
    next(err);
  }
}

export async function updateLeaveType(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = leaveTypeIdSchema.parse(req.params);
    const input = updateLeaveTypeSchema.parse(req.body);
    const leaveType = await service.updateLeaveType(id, input, getContext(req));
    res.json({ message: 'Leave type updated', leaveType });
  } catch (err) {
    next(err);
  }
}

export async function deleteLeaveType(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = leaveTypeIdSchema.parse(req.params);
    const leaveType = await service.deleteLeaveType(id, getContext(req));
    res.json({ message: 'Leave type deactivated', leaveType });
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// Leave Balances Controllers
// ---------------------------------------------------------------------------

export async function allocateBalance(req: Request, res: Response, next: NextFunction) {
  try {
    const input = allocateBalanceSchema.parse(req.body);
    const balance = await service.allocateBalance(input, getContext(req));
    res.json({ message: 'Balance allocated', balance });
  } catch (err) {
    next(err);
  }
}

export async function getEmployeeBalance(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = employeeIdParamSchema.parse(req.params);
    const query = getBalanceQuerySchema.parse(req.query);
    const balances = await service.getBalanceForEmployee(id, query.year, getContext(req));
    res.json({ balances });
  } catch (err) {
    next(err);
  }
}

export async function getBalance(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await service.getLeaveBalance(getContext(req));
    res.json(result);
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// Leave Requests Controllers
// ---------------------------------------------------------------------------

export async function applyLeave(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = createLeaveRequestSchema.parse(req.body);
    let documentUrl = parsed.documentUrl;
    if (req.file) {
      const stored = await fileService.save(req.file, { folder: 'leaves', ctx: getContext(req) });
      documentUrl = stored.url;
    }
    const result = await service.applyLeave(
      {
        ...parsed,
        documentUrl,
      },
      getContext(req)
    );
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
}

export async function getMyRequests(req: Request, res: Response, next: NextFunction) {
  try {
    const status = req.query.status as string | undefined;
    const result = await service.getMyRequests(getContext(req), status);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function getTeamRequests(req: Request, res: Response, next: NextFunction) {
  try {
    const status = req.query.status as string | undefined;
    const result = await service.getTeamRequests(getContext(req), status);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function getCalendarLeaves(req: Request, res: Response, next: NextFunction) {
  try {
    const year = req.query.year ? Number(req.query.year) : undefined;
    const month = req.query.month !== undefined ? Number(req.query.month) : undefined;
    const result = await service.getCalendarLeaves(year, month, getContext(req));
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function listLeaveRequests(req: Request, res: Response, next: NextFunction) {
  try {
    const query = listLeaveRequestsSchema.parse(req.query);
    const ctx = getContext(req);
    // If employee, return own requests
    if (ctx.user.role === 'employee') {
      const result = await service.getMyRequests(ctx, query.status);
      res.json({ leaveRequests: result, total: result.length });
      return;
    }
    const result = await service.getTeamRequests(ctx, query.status);
    res.json({ leaveRequests: result, total: result.length });
  } catch (err) {
    next(err);
  }
}

export async function getLeaveById(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = leaveRequestIdSchema.parse(req.params);
    const leaveRequest = await service.getLeaveById(id, getContext(req));
    res.json({ leaveRequest });
  } catch (err) {
    next(err);
  }
}

export async function updateLeave(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = leaveRequestIdSchema.parse(req.params);
    const input = updateLeaveRequestSchema.parse(req.body);
    let documentUrl = input.documentUrl;
    if (req.file) {
      const stored = await fileService.save(req.file, { folder: 'leaves', ctx: getContext(req) });
      documentUrl = stored.url;
    }
    const result = await service.updateLeave(
      id,
      {
        ...input,
        documentUrl,
      },
      getContext(req)
    );
    res.json({ message: 'Leave request updated', leaveRequest: result });
  } catch (err) {
    next(err);
  }
}

export async function deleteLeave(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = leaveRequestIdSchema.parse(req.params);
    const result = await service.deleteLeave(id, getContext(req));
    res.json({ message: 'Leave request cancelled', leaveRequest: result });
  } catch (err) {
    next(err);
  }
}

export async function approveLeave(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = leaveRequestIdSchema.parse(req.params);
    const result = await service.approveLeave(id, getContext(req));
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function rejectLeave(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = leaveRequestIdSchema.parse(req.params);
    const parsed = rejectLeaveRequestSchema.parse(req.body);
    const result = await service.rejectLeave(id, parsed.rejectionReason, getContext(req));
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function cancelLeave(req: Request, res: Response, next: NextFunction) {
  try {
    const { id } = leaveRequestIdSchema.parse(req.params);
    const result = await service.cancelLeave(id, getContext(req));
    res.json(result);
  } catch (err) {
    next(err);
  }
}

// ---------------------------------------------------------------------------
// Static Classes for Backwards Compatibility
// ---------------------------------------------------------------------------

export class LeaveTypesController {
  static list = listLeaveTypes;
  static getById = getLeaveTypeById;
  static create = createLeaveType;
  static update = updateLeaveType;
  static delete = deleteLeaveType;
  static allocate = allocateBalance;
  static getEmployeeBalance = getEmployeeBalance;
}

export class LeaveRequestController {
  static list = listLeaveRequests;
  static getById = getLeaveById;
  static create = applyLeave;
  static approve = approveLeave;
  static reject = rejectLeave;
}
