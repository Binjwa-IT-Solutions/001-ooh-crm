import { Request, Response, NextFunction } from 'express';
import * as service from '../services/leave.service.js';
import { leaveTypeSchema, leaveRequestSchema, leaveApprovalSchema } from '../validators/leave.validator.js';
import { fileService } from '../../../core/files/index.js';

export async function createLeaveType(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = leaveTypeSchema.parse(req.body);
    const result = await service.createLeaveType({
      name: parsed.name,
      code: parsed.code,
      annualQuota: parsed.annualQuota,
      carryForward: parsed.carryForward ?? false,
      maxCarryForward: parsed.maxCarryForward ?? 0,
      encashable: parsed.encashable ?? false,
      requiresDocument: parsed.requiresDocument ?? false,
    }, req.ctx!);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
}

export async function getLeaveTypes(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await service.getLeaveTypes();
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function getBalance(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await service.getLeaveBalance(req.ctx!);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function applyLeave(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = leaveRequestSchema.parse(req.body);
    let documentUrl = parsed.documentUrl;
    if (req.file) {
      const stored = await fileService.save(req.file, { folder: 'leaves', ctx: req.ctx! });
      documentUrl = stored.url;
    }
    const result = await service.applyLeave({
      ...parsed,
      documentUrl,
    }, req.ctx!);
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
}

export async function getMyRequests(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await service.getMyRequests(req.ctx!);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function getTeamRequests(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await service.getTeamRequests(req.ctx!);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function approveLeave(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await service.approveLeave(req.params.id as string, req.ctx!);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function rejectLeave(req: Request, res: Response, next: NextFunction) {
  try {
    const parsed = leaveApprovalSchema.parse(req.body);
    const result = await service.rejectLeave(req.params.id as string, parsed.rejectionReason!, req.ctx!);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

export async function cancelLeave(req: Request, res: Response, next: NextFunction) {
  try {
    const result = await service.cancelLeave(req.params.id as string, req.ctx!);
    res.json(result);
  } catch (err) {
    next(err);
  }
}
