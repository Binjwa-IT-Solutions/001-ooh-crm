import { Request, Response } from 'express';

import { UnauthorizedError } from '../../../core/errors/index.js';

import { leaveRequestService } from './leaveRequest.service.js';

import {
  createLeaveRequestSchema,
  leaveRequestIdSchema,
  listLeaveRequestsSchema,
  rejectLeaveRequestSchema,
} from './leaveRequest.validator.js';

function context(req: Request) {
  if (!req.ctx) {
    throw new UnauthorizedError();
  }

  return req.ctx;
}

export class LeaveRequestController {
  /**
   * GET /api/leave-requests
   */
  static async list(
    req: Request,
    res: Response,
  ) {
    const query =
      listLeaveRequestsSchema.parse(req.query);

    const result =
      await leaveRequestService.list(
        query,
        context(req),
      );

    res.status(200).json(result);
  }

  /**
   * GET /api/leave-requests/:id
   */
  static async getById(
    req: Request,
    res: Response,
  ) {
    const { id } =
      leaveRequestIdSchema.parse(req.params);

    const leaveRequest =
      await leaveRequestService.getById(
        id,
        context(req),
      );

    res.status(200).json({
      leaveRequest,
    });
  }

  /**
   * POST /api/leave-requests
   */
  static async create(
    req: Request,
    res: Response,
  ) {
    const input =
      createLeaveRequestSchema.parse(req.body);

    const leaveRequest =
      await leaveRequestService.create(
        input,
        context(req),
      );

    res.status(201).json({
      message: 'Leave request created',
      leaveRequest,
    });
  }

  /**
   * POST /api/leave-requests/:id/approve
   */
  static async approve(
    req: Request,
    res: Response,
  ) {
    const { id } =
      leaveRequestIdSchema.parse(req.params);

    const leaveRequest =
      await leaveRequestService.approve(
        id,
        context(req),
      );

    res.status(200).json({
      message: 'Leave request approved',
      leaveRequest,
    });
  }

  /**
   * POST /api/leave-requests/:id/reject
   */
  static async reject(
    req: Request,
    res: Response,
  ) {
    const { id } =
      leaveRequestIdSchema.parse(req.params);

    const input =
      rejectLeaveRequestSchema.parse(req.body);

    const leaveRequest =
      await leaveRequestService.reject(
        id,
        input,
        context(req),
      );

    res.status(200).json({
      message: 'Leave request rejected',
      leaveRequest,
    });
  }
}