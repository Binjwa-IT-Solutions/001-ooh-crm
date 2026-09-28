import { Request, Response } from 'express';

import { config } from '../../config/index.js';
import { UnauthorizedError } from '../errors/index.js';
import { AuthService } from './auth-service.js';
import {
  listUsersSchema,
  loginSchema,
  logoutSchema,
  refreshSchema,
  registerSchema,
  resendOtpSchema,
  updateUserSchema,
  userIdParamSchema,
  verifyOtpSchema,
} from './auth-validator.js';
import { auditService } from '../audit/index.js';

/**
 * Controllers parse the request, call the service and shape the response.
 * No business logic lives here, and no try/catch — `asyncHandler` on the route
 * forwards rejections to the central error handler.
 */
export class AuthController {
  /** POST /api/auth/register (or /api/auth/users) — authorized roles with users.create. */
  static async register(req: Request, res: Response) {
    const input = registerSchema.parse(req.body);

    const user = await AuthService.registerUser({
      name: input.name,
      email: input.email,
      passwordPlain: input.password,
      role: input.role,
      status: input.status,
      reportingManagerId: input.reportingManagerId || undefined,
    });

    res.status(201).json({ message: 'User created', user });
  }

  /** GET /api/auth/users — list users with pagination, filters & search. */
  static async listUsers(req: Request, res: Response) {
    const query = listUsersSchema.parse(req.query);
    const result = await AuthService.listUsers(query);
    res.status(200).json(result);
  }

  /** GET /api/auth/users/:id — get user by id. */
  static async getUserById(req: Request, res: Response) {
    const { id } = userIdParamSchema.parse(req.params);
    const user = await AuthService.getUserById(id);
    res.status(200).json({ user });
  }

  /** PATCH /api/auth/users/:id — update user role/status/name/password. */
  static async updateUser(req: Request, res: Response) {
    const { id } = userIdParamSchema.parse(req.params);
    const input = updateUserSchema.parse(req.body);

    const user = await AuthService.updateUser(id, {
      name: input.name,
      role: input.role,
      status: input.status,
      passwordPlain: input.password,
      reportingManagerId: input.reportingManagerId !== undefined ? input.reportingManagerId : undefined,
    });

    res.status(200).json({ message: 'User updated', user });
  }

  /** DELETE /api/auth/users/:id — soft delete / deactivate user. */
  static async deleteUser(req: Request, res: Response) {
    const { id } = userIdParamSchema.parse(req.params);
    const result = await AuthService.deleteUser(id);
    res.status(200).json({ message: 'User deactivated', ...result });
  }

  /** POST /api/auth/login — step 1: password check, then OTP is issued. */
  static async login(req: Request, res: Response) {
    const input = loginSchema.parse(req.body);
    const challenge = await AuthService.startLogin(input.email, input.password);

    res.status(200).json({
      message: 'Verification code sent',
      // The client uses this to decide whether to show the dev-mode OTP hint.
      devMode: config.otp.exposeInResponse,
      challenge,
    });
  }

  /** POST /api/auth/resend-otp — step 1b. */
  static async resendOtp(req: Request, res: Response) {
    const input = resendOtpSchema.parse(req.body);
    const challenge = await AuthService.resendOtp(input.challengeId);

    res.status(200).json({
      message: 'A new verification code has been sent',
      devMode: config.otp.exposeInResponse,
      challenge,
    });
  }

  /** POST /api/auth/verify-otp — step 2: code check, session issued. */
  static async verifyOtp(req: Request, res: Response) {
    const input = verifyOtpSchema.parse(req.body);

    const session = await AuthService.verifyOtp(input.challengeId, input.code, {
      userAgent: req.headers['user-agent'],
    });

    res.status(200).json({ message: 'Signed in', ...session });
  }

  /** POST /api/auth/refresh — rotate the refresh token. */
  static async refresh(req: Request, res: Response) {
    const input = refreshSchema.parse(req.body);

    const session = await AuthService.refreshSession(input.refreshToken, {
      userAgent: req.headers['user-agent'],
    });

    res.status(200).json({ message: 'Session refreshed', ...session });
  }

  /** POST /api/auth/logout — revoke this device's refresh token. */
  static async logout(req: Request, res: Response) {
    const input = logoutSchema.parse(req.body ?? {});
    await AuthService.logout(input.refreshToken, req.ctx?.user.id);

    if (req.ctx) {
      void auditService.record({
        action: 'logout',
        entity: 'Auth',
        ctx: req.ctx,
        ip: req.ip,
        userAgent: req.headers['user-agent'],
      });
    }

    res.status(200).json({ message: 'Signed out' });
  }

  /** GET /api/auth/me — the signed-in user plus their permission list. */
  static async me(req: Request, res: Response) {
    if (!req.ctx) throw new UnauthorizedError();

    const user = await AuthService.getUserById(req.ctx.user.id);
    res.status(200).json({ user });
  }
}

