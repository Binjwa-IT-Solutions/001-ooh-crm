import { Request, Response } from 'express';

import { UnauthorizedError } from '../errors/index.js';
import { AuthService } from './auth-service.js';
import {
  loginApprovalDecisionSchema,
  loginApprovalPollSchema,
  userIdParamSchema,
} from './auth-validator.js';

export class SecurityController {
  static async listLoginEvents(req: Request, res: Response) {
    const limit = Number(req.query.limit) || 100;
    const events = await AuthService.listRecentLoginSecurityEvents(limit);
    res.status(200).json({ events });
  }

  static async listLoginApprovals(_req: Request, res: Response) {
    const approvals = await AuthService.listPendingLoginApprovals();
    res.status(200).json({ approvals });
  }

  static async loginApprovalStatus(req: Request, res: Response) {
    const { id } = userIdParamSchema.parse(req.params);
    const { pollToken } = loginApprovalPollSchema.parse(req.body);
    const result = await AuthService.getLoginApprovalStatus(id, pollToken);
    res.status(200).json(result);
  }

  static async userDeviceAndSessions(req: Request, res: Response) {
    const { id } = userIdParamSchema.parse(req.params);
    res.status(200).json(await AuthService.getUserDeviceAndSessions(id));
  }

  static async revokeUserSessions(req: Request, res: Response) {
    if (!req.ctx) throw new UnauthorizedError();
    const { id } = userIdParamSchema.parse(req.params);
    const result = await AuthService.revokeUserSessions(id, req.ctx.user);
    res.status(200).json({ message: 'All sessions ended.', ...result });
  }

  static async removeUserDevice(req: Request, res: Response) {
    if (!req.ctx) throw new UnauthorizedError();
    const { id } = userIdParamSchema.parse(req.params);
    const result = await AuthService.removeUserDevice(id, req.ctx.user);
    res.status(200).json({ message: 'Device removed and sessions ended.', ...result });
  }

  static async decideLoginApproval(req: Request, res: Response) {
    if (!req.ctx) throw new UnauthorizedError();
    const { id } = userIdParamSchema.parse(req.params);
    const input = loginApprovalDecisionSchema.parse(req.body);
    await AuthService.decideLoginApproval(
      id,
      req.ctx.user.id,
      input.decision,
      input.note,
      input.totpCode,
    );
    res.status(200).json({
      message: input.decision === 'approve' ? 'Login request approved.' : 'Login request denied.',
    });
  }
}
