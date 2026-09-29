import crypto from 'node:crypto';

import bcrypt from 'bcryptjs';
import jwt, { type SignOptions } from 'jsonwebtoken';
import { Types } from 'mongoose';

import { config } from '../../config/index.js';
import {
  ConflictError,
  NotFoundError,
  TooManyRequestsError,
  UnauthorizedError,
  ValidationError,
} from '../errors/index.js';
import { auditService } from '../audit/index.js';
import { notifyMany, sendOtpEmail } from '../notifications/index.js';
import { permissionsForRole, type Role } from '../rbac/permissions.js';
import { AuthUser, type IUser } from './auth-model.js';
import { OtpChallenge } from './otp-model.js';
import { RefreshToken } from './refresh-token-model.js';
import { employeeService } from '../../modules/employees/employees.service.js';

/**
 * LOGIN IS TWO STEPS.
 *
 *   1. POST /api/auth/login       email + password    -> { challengeId }
 *   2. POST /api/auth/verify-otp  challengeId + code  -> { accessToken, refreshToken, user }
 *
 * The OTP is delivered by `core/notifications`. In development that means the
 * server log — and, because OTP_EXPOSE_IN_RESPONSE is on, the code also comes
 * back in the step-1 response so the login screen can display it. That flag is
 * force-disabled when NODE_ENV=production. Moving to real email MFA later is a
 * config change (OTP_DELIVERY=email) plus implementing the email transport;
 * nothing in this service has to change.
 */

export interface PublicUser {
  id: string;
  name: string;
  email: string;
  role: Role;
  status: 'Active' | 'Inactive';
  permissions: readonly string[];
  lastLoginAt: Date | null;
  createdAt?: Date | null;
  reportingManager?: { id: string; fullName: string; designation: string } | null;
  reportingManagerId?: string | null;
  phone?: string;
  designation?: string;
  gender?: 'Male' | 'Female' | null;
}

export interface LoginChallenge {
  challengeId: string;
  email: string;
  expiresAt: Date;
  delivery: 'console' | 'email';
  resendAvailableInSeconds: number;
  /** Development only — see OTP_EXPOSE_IN_RESPONSE in config. */
  devOtp?: string;
}

export interface AuthSession {
  user: PublicUser;
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresIn: string;
}

interface SessionMeta {
  userAgent?: string;
}

function sha256(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function timingSafeEqualHex(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'hex');
  const bufB = Buffer.from(b, 'hex');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

export class AuthService {
  // ---------------------------------------------------------------- helpers

  /** Cryptographically random numeric OTP of `config.otp.length` digits. */
  static generateOtpCode(length: number = config.otp.length): string {
    let code = '';
    for (let i = 0; i < length; i += 1) {
      code += crypto.randomInt(0, 10).toString();
    }
    return code;
  }

  static toPublicUser(user: IUser, employeeDoc?: any): PublicUser {
    let reportingManager: { id: string; fullName: string; designation: string } | null = null;
    let reportingManagerId: string | null = null;

    if (employeeDoc) {
      if (employeeDoc.reportingManagerId) {
        if (typeof employeeDoc.reportingManagerId === 'object' && 'fullName' in employeeDoc.reportingManagerId) {
          reportingManager = {
            id: String(employeeDoc.reportingManagerId._id),
            fullName: employeeDoc.reportingManagerId.fullName,
            designation: employeeDoc.reportingManagerId.designation,
          };
          reportingManagerId = String(employeeDoc.reportingManagerId._id);
        } else {
          reportingManagerId = String(employeeDoc.reportingManagerId);
        }
      }
    }

    const phone = user.phone || employeeDoc?.mobile || '';
    const designation = user.designation || employeeDoc?.designation || '';
    const gender = user.gender ?? null;

    return {
      id: String(user._id),
      name: user.name,
      email: user.email,
      role: user.role,
      status: user.status,
      permissions: permissionsForRole(user.role),
      lastLoginAt: user.lastLoginAt ?? null,
      createdAt: user.createdAt ?? null,
      phone,
      designation,
      gender,
      reportingManager,
      reportingManagerId,
    };
  }

  private static signAccessToken(user: IUser): string {
    return jwt.sign(
      {
        sub: String(user._id),
        email: user.email,
        name: user.name,
        role: user.role,
      },
      config.jwt.secret,
      { expiresIn: config.jwt.accessTokenTtl } as SignOptions,
    );
  }

  private static async issueRefreshToken(user: IUser, meta: SessionMeta = {}): Promise<string> {
    const token = crypto.randomBytes(48).toString('hex');
    const expiresAt = new Date(Date.now() + config.jwt.refreshTokenTtlDays * 24 * 60 * 60 * 1000);

    await RefreshToken.create({
      userId: user._id,
      tokenHash: sha256(token),
      expiresAt,
      userAgent: meta.userAgent,
    });

    return token;
  }

  private static async createSession(user: IUser, meta: SessionMeta): Promise<AuthSession> {
    const accessToken = AuthService.signAccessToken(user);
    const refreshToken = await AuthService.issueRefreshToken(user, meta);

    return {
      user: AuthService.toPublicUser(user),
      accessToken,
      refreshToken,
      accessTokenExpiresIn: config.jwt.accessTokenTtl,
    };
  }

  /** Creates an OTP, stores only its hash, and hands the code to the transport. */
  private static async issueOtpChallenge(user: IUser): Promise<LoginChallenge> {
    const code = AuthService.generateOtpCode();
    const expiresAt = new Date(Date.now() + config.otp.ttlMinutes * 60 * 1000);

    const challenge = await OtpChallenge.create({
      userId: user._id,
      email: user.email,
      codeHash: sha256(code),
      purpose: 'login',
      attempts: 0,
      maxAttempts: config.otp.maxAttempts,
      expiresAt,
      lastSentAt: new Date(),
    });

    await sendOtpEmail({
      to: user.email,
      name: user.name,
      code,
      ttlMinutes: config.otp.ttlMinutes,
    });

    return {
      challengeId: String(challenge._id),
      email: user.email,
      expiresAt,
      delivery: config.otp.delivery,
      resendAvailableInSeconds: config.otp.resendCooldownSeconds,
      ...(config.otp.exposeInResponse ? { devOtp: code } : {}),
    };
  }

  // ------------------------------------------------------------- user admin

  /**
   * Creates a user. This is not self-service: the route is admin-only and the
   * seed script bootstraps the first accounts (`npm run seed`).
   */
  static async registerUser(userData: {
    name: string;
    email: string;
    passwordPlain: string;
    role?: Role;
    status?: 'Active' | 'Inactive';
    reportingManagerId?: string;
  }): Promise<PublicUser> {
    const email = userData.email.trim().toLowerCase();

    const existingUser = await AuthUser.findOne({ email });
    if (existingUser) {
      throw new ConflictError('A user with this email already exists');
    }

    const passwordHash = await bcrypt.hash(userData.passwordPlain, 10);

    const newUser = await AuthUser.create({
      name: userData.name.trim(),
      email,
      passwordHash,
      role: userData.role ?? 'employee',
      status: userData.status ?? 'Active',
    });

    // Ensure linked Employee record is created/synchronized
    const employee = await employeeService.ensureEmployeeForUser({
      id: newUser._id,
      name: newUser.name,
      email: newUser.email,
      role: newUser.role,
      status: newUser.status,
      reportingManagerId: userData.reportingManagerId,
    });

    // Notify HR and Admin users that employee profile requires completion
    try {
      const hrAdminUsers = await AuthUser.find({
        role: { $in: ['hr', 'admin'] },
        status: 'Active',
        deletedAt: null,
      }).select('_id');

      if (hrAdminUsers.length > 0) {
        await notifyMany(
          hrAdminUsers.map((u) => u._id),
          {
            type: 'employee.profile_incomplete',
            title: 'New User Added',
            body: `${newUser.name} (${newUser.email}) has been added to the CRM. Employee profile information is incomplete and requires HR review.`,
            link: `/employees/${employee._id}/edit`,
          },
        );
      }
    } catch (err) {
      console.error('[registerUser] failed to notify HR/Admin users', err);
    }

    return AuthService.toPublicUser(newUser, employee);
  }

  // ------------------------------------------------------------- login flow

  /** Step 1 — verify the password, then issue an OTP. No session token yet. */
  static async startLogin(email: string, passwordPlain: string): Promise<LoginChallenge> {
    const user = await AuthUser.findOne({ email: email.trim().toLowerCase() }).select(
      '+passwordHash',
    );

    const recordFailedLogin = () => {
      void auditService.record({
        action: 'login_failed',
        entity: 'Auth',
        actorEmail: email,
      });
    };

    // Identical message either way — never reveal whether an email is registered.
    if (!user) {
      recordFailedLogin();
      throw new UnauthorizedError('Invalid email or password');
    }

    const passwordMatches = await bcrypt.compare(passwordPlain, user.passwordHash);
    if (!passwordMatches) {
      recordFailedLogin();
      throw new UnauthorizedError('Invalid email or password');
    }

    if (user.status !== 'Active' || user.deletedAt) {
      recordFailedLogin();
      throw new UnauthorizedError('This account is inactive. Contact your administrator.');
    }

    return AuthService.issueOtpChallenge(user);
  }

  /** Step 1b — send a fresh code for an existing challenge. */
  static async resendOtp(challengeId: string): Promise<LoginChallenge> {
    if (!Types.ObjectId.isValid(challengeId)) {
      throw new ValidationError('Invalid challenge id');
    }

    const challenge = await OtpChallenge.findById(challengeId);
    if (!challenge || challenge.consumedAt) {
      throw new UnauthorizedError('This login attempt is no longer valid. Please sign in again.');
    }

    const secondsSinceLastSend = (Date.now() - challenge.lastSentAt.getTime()) / 1000;
    if (secondsSinceLastSend < config.otp.resendCooldownSeconds) {
      const wait = Math.ceil(config.otp.resendCooldownSeconds - secondsSinceLastSend);
      throw new TooManyRequestsError(`Please wait ${wait}s before requesting another code`);
    }

    const user = await AuthUser.findById(challenge.userId);
    if (!user || user.status !== 'Active' || user.deletedAt) {
      throw new UnauthorizedError('This account is inactive. Contact your administrator.');
    }

    // Retire the old challenge so only the newest code ever works.
    challenge.consumedAt = new Date();
    await challenge.save();

    return AuthService.issueOtpChallenge(user);
  }

  /** Step 2 — verify the code and open a session. */
  static async verifyOtp(
    challengeId: string,
    code: string,
    meta: SessionMeta = {},
  ): Promise<AuthSession> {
    if (!Types.ObjectId.isValid(challengeId)) {
      throw new ValidationError('Invalid challenge id');
    }

    const challenge = await OtpChallenge.findById(challengeId).select('+codeHash');
    if (!challenge) {
      throw new UnauthorizedError('This code has expired. Please sign in again.');
    }

    if (challenge.consumedAt) {
      throw new UnauthorizedError('This code has already been used. Please sign in again.');
    }

    if (challenge.expiresAt.getTime() <= Date.now()) {
      throw new UnauthorizedError('This code has expired. Please sign in again.');
    }

    if (challenge.attempts >= challenge.maxAttempts) {
      throw new TooManyRequestsError('Too many incorrect codes. Please sign in again.');
    }

    if (!timingSafeEqualHex(sha256(code.trim()), challenge.codeHash)) {
      challenge.attempts += 1;
      await challenge.save();

      const remaining = challenge.maxAttempts - challenge.attempts;
      throw new UnauthorizedError(
        remaining > 0
          ? `Incorrect code. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.`
          : 'Too many incorrect codes. Please sign in again.',
      );
    }

    // Single use.
    challenge.consumedAt = new Date();
    await challenge.save();

    const user = await AuthUser.findById(challenge.userId);
    if (!user || user.status !== 'Active' || user.deletedAt) {
      throw new UnauthorizedError('This account is inactive. Contact your administrator.');
    }

    user.lastLoginAt = new Date();
    await user.save();

    void auditService.record({
      action: 'login',
      entity: 'Auth',
      actorEmail: user.email,
    });

    return AuthService.createSession(user, meta);
  }

  // ---------------------------------------------------------------- session

  /** Rotates the refresh token and returns a fresh access token. */
  static async refreshSession(
    refreshTokenValue: string,
    meta: SessionMeta = {},
  ): Promise<AuthSession> {
    const tokenHash = sha256(refreshTokenValue);
    const stored = await RefreshToken.findOne({ tokenHash });

    if (!stored || stored.revokedAt || stored.expiresAt.getTime() <= Date.now()) {
      throw new UnauthorizedError('Session expired. Please sign in again.');
    }

    const user = await AuthUser.findById(stored.userId);
    if (!user || user.status !== 'Active' || user.deletedAt) {
      throw new UnauthorizedError('This account is inactive. Contact your administrator.');
    }

    const session = await AuthService.createSession(user, meta);

    stored.revokedAt = new Date();
    stored.replacedByTokenHash = sha256(session.refreshToken);
    await stored.save();

    return session;
  }

  /** Revokes one refresh token (this device), or every token for a user. */
  static async logout(refreshTokenValue?: string, userId?: string): Promise<void> {
    if (refreshTokenValue) {
      await RefreshToken.updateOne(
        { tokenHash: sha256(refreshTokenValue), revokedAt: null },
        { $set: { revokedAt: new Date() } },
      );
      return;
    }

    if (userId && Types.ObjectId.isValid(userId)) {
      await RefreshToken.updateMany(
        { userId: new Types.ObjectId(userId), revokedAt: null },
        { $set: { revokedAt: new Date() } },
      );
    }
  }

  static async listUsers(query: {
    search?: string;
    role?: Role;
    status?: 'Active' | 'Inactive';
    page?: number;
    pageSize?: number;
  }): Promise<{
    users: PublicUser[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  }> {
    const page = Math.max(1, query.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, query.pageSize ?? 10));
    const skip = (page - 1) * pageSize;

    const filter: Record<string, unknown> = { deletedAt: null };

    if (query.role) {
      filter.role = query.role;
    }

    if (query.status) {
      filter.status = query.status;
    }

    if (query.search?.trim()) {
      const searchRegex = new RegExp(
        query.search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
        'i',
      );
      filter.$or = [{ name: searchRegex }, { email: searchRegex }];
    }

    const [users, total] = await Promise.all([
      AuthUser.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(pageSize),
      AuthUser.countDocuments(filter),
    ]);

    const { Employee } = await import('../../modules/employees/employees.model.js');
    const userIds = users.map((u) => u._id);
    const employees = await Employee.find({ userId: { $in: userIds }, deletedAt: null }).populate(
      'reportingManagerId',
      'fullName designation',
    );
    const empByUser = new Map(employees.map((e) => [String(e.userId), e]));

    return {
      users: users.map((u) => AuthService.toPublicUser(u, empByUser.get(String(u._id)))),
      total,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    };
  }

  static async updateUser(
    userId: string,
    updates: {
      name?: string;
      role?: Role;
      status?: 'Active' | 'Inactive';
      passwordPlain?: string;
      reportingManagerId?: string | null;
    },
  ): Promise<PublicUser> {
    if (!Types.ObjectId.isValid(userId)) {
      throw new NotFoundError('User not found');
    }

    const user = await AuthUser.findOne({ _id: userId, deletedAt: null });
    if (!user) {
      throw new NotFoundError('User not found');
    }

    if (updates.name !== undefined) {
      user.name = updates.name.trim();
    }
    if (updates.role !== undefined) {
      user.role = updates.role;
    }
    if (updates.status !== undefined) {
      user.status = updates.status;
      if (updates.status === 'Inactive') {
        // Revoke active sessions for deactivated user
        await AuthService.logout(undefined, userId);
      }
    }
    if (updates.passwordPlain) {
      user.passwordHash = await bcrypt.hash(updates.passwordPlain, 10);
      // Revoke active sessions to enforce sign in with new password
      await AuthService.logout(undefined, userId);
    }

    await user.save();

    // Sync updates to linked Employee record
    const employee = await employeeService.ensureEmployeeForUser({
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      status: user.status,
      reportingManagerId: updates.reportingManagerId,
    });

    return AuthService.toPublicUser(user, employee);
  }

  static async deleteUser(userId: string): Promise<{ id: string }> {
    if (!Types.ObjectId.isValid(userId)) {
      throw new NotFoundError('User not found');
    }

    const user = await AuthUser.findOne({ _id: userId, deletedAt: null });
    if (!user) {
      throw new NotFoundError('User not found');
    }

    user.deletedAt = new Date();
    user.status = 'Inactive';
    await user.save();

    // Deactivate linked employee record
    await employeeService.ensureEmployeeForUser({
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      status: 'Inactive',
    });

    // Revoke all active sessions for this user
    await AuthService.logout(undefined, userId);

    return { id: userId };
  }

  static async getUserById(userId: string): Promise<PublicUser> {
    if (!Types.ObjectId.isValid(userId)) {
      throw new NotFoundError('User not found');
    }

    const user = await AuthUser.findOne({ _id: userId, deletedAt: null });
    if (!user) {
      throw new NotFoundError('User not found');
    }

    const { Employee } = await import('../../modules/employees/employees.model.js');
    const employee = await Employee.findOne({ userId: user._id, deletedAt: null }).populate(
      'reportingManagerId',
      'fullName designation',
    );

    return AuthService.toPublicUser(user, employee);
  }
}

