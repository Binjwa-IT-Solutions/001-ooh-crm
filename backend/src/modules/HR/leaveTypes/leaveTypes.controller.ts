import { Request, Response } from 'express';
import { UnauthorizedError } from '../../../core/errors/index.js';
import { leaveTypeService } from './leaveTypes.service.js';
import {
  allocateBalanceSchema,
  createLeaveTypeSchema,
  employeeIdParamSchema,
  getBalanceQuerySchema,
  leaveTypeIdSchema,
  listLeaveTypesSchema,
  updateLeaveTypeSchema,
} from './leaveTypes.validator.js';

function context(req: Request) {
  if (!req.ctx) throw new UnauthorizedError();
  return req.ctx;
}

export class LeaveTypesController {
  /** GET /api/leave-types */
  static async list(req: Request, res: Response) {
    const query = listLeaveTypesSchema.parse(req.query);
    const result = await leaveTypeService.list(query, context(req));
    res.status(200).json(result);
  }

  /** GET /api/leave-types/:id */
  static async getById(req: Request, res: Response) {
    const { id } = leaveTypeIdSchema.parse(req.params);
    const leaveType = await leaveTypeService.getById(id, context(req));
    res.status(200).json({ leaveType });
  }

  /** POST /api/leave-types */
  static async create(req: Request, res: Response) {
    const input = createLeaveTypeSchema.parse(req.body);
    const leaveType = await leaveTypeService.create(input, context(req));
    res.status(201).json({ message: 'Leave type created', leaveType });
  }

  /** PATCH /api/leave-types/:id */
  static async update(req: Request, res: Response) {
    const { id } = leaveTypeIdSchema.parse(req.params);
    const input = updateLeaveTypeSchema.parse(req.body);
    const leaveType = await leaveTypeService.update(id, input, context(req));
    res.status(200).json({ message: 'Leave type updated', leaveType });
  }

  /** DELETE /api/leave-types/:id */
  static async delete(req: Request, res: Response) {
    const { id } = leaveTypeIdSchema.parse(req.params);
    const leaveType = await leaveTypeService.delete(id, context(req));
    res.status(200).json({ message: 'Leave type deactivated', leaveType });
  }

  /** POST /api/leave-balances/allocate */
  static async allocate(req: Request, res: Response) {
    const input = allocateBalanceSchema.parse(req.body);
    const balance = await leaveTypeService.allocate(input, context(req));
    res.status(200).json({ message: 'Balance allocated', balance });
  }

  /** GET /api/employees/:id/leave-balance */
  static async getEmployeeBalance(req: Request, res: Response) {
    const { id } = employeeIdParamSchema.parse(req.params);
    const query = getBalanceQuerySchema.parse(req.query);
    const balances = await leaveTypeService.getBalanceForEmployee(id, query.year, context(req));
    res.status(200).json({ balances });
  }
}