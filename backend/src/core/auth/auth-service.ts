import crypto from 'node:crypto';

import bcrypt from 'bcryptjs';
import jwt, { type SignOptions } from 'jsonwebtoken';
import { Types } from 'mongoose';

import { config } from '../../config/index.js';
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  TooManyRequestsError,
  UnauthorizedError,
  ValidationError,
} from '../errors/index.js';
import { auditService } from '../audit/index.js';
import { notifyMany, sendEmail, sendOtpEmail } from '../notifications/index.js';
import { permissionsForRole, type Role } from '../rbac/permissions.js';
import { AuthUser, type IUser } from './auth-model.js';
import { createTotpSetup, verifyTotp } from './mfa.js';
import { OtpChallenge } from './otp-model.js';
import { RefreshToken } from './refresh-token-model.js';
import { employeeService } from '../../modules/employees/employees.service.js';
import { withOptionalTransaction } from '../db/transaction.js';
import { LoginApproval, LoginSecurityEvent, TrustedDevice } from './security-models.js';
import { assessLoginRisk, normalizeLoginLocation, type LoginLocation } from './security-risk.js';

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
  mfaEnabled: boolean;
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
  method: 'email' | 'totp';
  emailFallbackRequiresEnrollment?: boolean;
  delivery?: 'console' | 'email';
  resendAvailableInSeconds: number;
  /** Development only — see OTP_EXPOSE_IN_RESPONSE in config. */
  devOtp?: string;
}

export interface MfaEnrollmentRequired {
  requiresMfaEnrollment: true;
  enrollmentToken: string;
  email: string;
  secret: string;
  otpauthUrl: string;
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

interface LoginRequestMeta extends SessionMeta {
  deviceId?: string;
  location?: LoginLocation | null;
}

export interface AdminApprovalRequired {
  requiresAdminApproval: true;
  approvalRequestId: string;
  pollToken: string;
  expiresAt: Date;
}

export function adminNeedsAuthenticatorRecovery(user: Pick<IUser, 'role' | 'totpEnabledAt'>) {
  return user.role === 'admin' && Boolean(user.totpEnabledAt);
}

function sha256(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

/** Short, display-only label so admins can tell devices apart; never the raw id. */
function deviceTagFor(deviceIdHash: string | null | undefined): string | null {
  return deviceIdHash ? deviceIdHash.slice(0, 8).toUpperCase() : null;
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
        if (
          typeof employeeDoc.reportingManagerId === 'object' &&
          'fullName' in employeeDoc.reportingManagerId
        ) {
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
      mfaEnabled: Boolean(user.totpEnabledAt),
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

  static async verifyAdminReauthentication(
    lookup: { id: string } | { email: string },
    passwordPlain: string,
    totpCode: string,
  ): Promise<{ user: IUser; step: number }> {
    const user = await AuthUser.findOne({
      ...('id' in lookup ? { _id: lookup.id } : lookup),
      role: 'admin',
      status: 'Active',
      deletedAt: null,
    }).select('+passwordHash +totpSecretEncrypted +totpLastUsedStep');

    const passwordValid = user ? await bcrypt.compare(passwordPlain, user.passwordHash) : false;
    if (!user || !passwordValid || !user.totpEnabledAt || !user.totpSecretEncrypted) {
      throw new UnauthorizedError('Admin re-authentication failed.');
    }

    const step = verifyTotp(user.totpSecretEncrypted, totpCode);
    if (step === null) throw new UnauthorizedError('Admin re-authentication failed.');

    return { user, step };
  }

  /** Authenticator-only step-up for an admin who is already signed in. */
  static async verifyAdminTotp(
    adminId: string,
    totpCode: string,
  ): Promise<{ user: IUser; step: number }> {
    const user = await AuthUser.findOne({
      _id: adminId,
      role: 'admin',
      status: 'Active',
      deletedAt: null,
    }).select('+totpSecretEncrypted +totpLastUsedStep');

    if (!user || !user.totpEnabledAt || !user.totpSecretEncrypted) {
      throw new UnauthorizedError('Set up your authenticator before approving logins.');
    }

    const step = verifyTotp(user.totpSecretEncrypted, totpCode);
    if (step === null) throw new UnauthorizedError('Invalid authenticator code.');

    return { user, step };
  }

  static async consumeAdminTotpStep(userId: Types.ObjectId, step: number): Promise<void> {
    const result = await AuthUser.updateOne(
      {
        _id: userId,
        $or: [{ totpLastUsedStep: { $exists: false } }, { totpLastUsedStep: { $lt: step } }],
      },
      { $set: { totpLastUsedStep: step } },
    );

    if (result.modifiedCount === 0) {
      throw new UnauthorizedError('Admin authenticator code has already been used.');
    }
  }

  private static async clearAuthenticatorAndRevokeSessions(user: IUser): Promise<number> {
    const revocation = await withOptionalTransaction(async (session) => {
      await AuthUser.updateOne(
        { _id: user._id },
        {
          $set: { totpEnabledAt: null, totpLastUsedStep: -1 },
          $unset: {
            totpSecretEncrypted: 1,
            mfaEnrollmentIdHash: 1,
            mfaEnrollmentAttempts: 1,
          },
        },
      ).session(session ?? null);

      return RefreshToken.updateMany(
        { userId: user._id, revokedAt: null },
        { $set: { revokedAt: new Date() } },
      ).session(session ?? null);
    });

    user.totpEnabledAt = null;
    user.totpLastUsedStep = -1;
    user.totpSecretEncrypted = undefined;
    user.mfaEnrollmentIdHash = undefined;
    user.mfaEnrollmentAttempts = 0;

    return revocation.modifiedCount;
  }

  /** Creates an OTP, stores only its hash, and hands the code to the transport. */
  private static async issueLoginChallenge(
    user: IUser,
    method: 'email' | 'totp',
    securityEventId?: Types.ObjectId,
  ): Promise<LoginChallenge> {
    const code = method === 'email' ? AuthService.generateOtpCode() : undefined;
    const expiresAt = new Date(Date.now() + config.otp.ttlMinutes * 60 * 1000);

    const challenge = await OtpChallenge.create({
      userId: user._id,
      email: user.email,
      ...(code ? { codeHash: sha256(code) } : {}),
      method,
      securityEventId: securityEventId ?? null,
      purpose: 'login',
      attempts: 0,
      maxAttempts: config.otp.maxAttempts,
      expiresAt,
      lastSentAt: new Date(),
    });

    if (code) {
      await sendOtpEmail({
        to: user.email,
        name: user.name,
        code,
        ttlMinutes: config.otp.ttlMinutes,
      });
    }

    return {
      challengeId: String(challenge._id),
      email: user.email,
      expiresAt,
      method,
      ...(method === 'totp' && adminNeedsAuthenticatorRecovery(user)
        ? { emailFallbackRequiresEnrollment: true }
        : {}),
      ...(method === 'email' ? { delivery: config.otp.delivery } : {}),
      resendAvailableInSeconds: method === 'email' ? config.otp.resendCooldownSeconds : 0,
      ...(config.otp.exposeInResponse ? { devOtp: code } : {}),
    };
  }

  private static async beginMfaEnrollment(
    user: IUser,
    securityEventId?: Types.ObjectId | null,
  ): Promise<MfaEnrollmentRequired> {
    const setup = createTotpSetup(user.email);
    const enrollmentId = crypto.randomBytes(32).toString('hex');

    user.totpSecretEncrypted = setup.encryptedSecret;
    user.totpEnabledAt = null;
    user.mfaEnrollmentIdHash = sha256(enrollmentId);
    user.mfaEnrollmentAttempts = 0;
    await user.save();

    const enrollmentToken = jwt.sign(
      {
        sub: String(user._id),
        purpose: 'mfa-enrollment',
        jti: enrollmentId,
        ...(securityEventId ? { loginEventId: String(securityEventId) } : {}),
      },
      config.jwt.secret,
      { expiresIn: '10m' },
    );

    return {
      requiresMfaEnrollment: true,
      enrollmentToken,
      email: user.email,
      secret: setup.secret,
      otpauthUrl: setup.otpauthUrl,
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
  static async startLogin(
    email: string,
    passwordPlain: string,
    meta: LoginRequestMeta = {},
  ): Promise<LoginChallenge | AdminApprovalRequired> {
    const submittedDeviceIdHash = meta.deviceId ? sha256(meta.deviceId) : null;
    const submittedLocation = meta.location ? normalizeLoginLocation(meta.location) : null;
    const user = await AuthUser.findOne({ email: email.trim().toLowerCase() }).select(
      '+passwordHash',
    );

    const recordFailedLogin = () => {
      void auditService.record({
        action: 'login_failed',
        entity: 'Auth',
        actorEmail: email,
      });
      void LoginSecurityEvent.create({
        userId: user?._id ?? null,
        email: email.trim().toLowerCase(),
        deviceIdHash: null,
        userAgent: meta.userAgent?.slice(0, 500) ?? '',
        location: null,
        riskLevel: 'low',
        riskReasons: ['invalid_credentials'],
        outcome: 'failed',
      }).catch(() => console.error('[security] failed to record unsuccessful login metadata'));
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

    const deviceIdHash = submittedDeviceIdHash;
    const knownDevice = deviceIdHash
      ? await TrustedDevice.findOne({
          userId: user._id,
          deviceIdHash,
          revokedAt: null,
        }).select('+deviceIdHash')
      : null;
    const now = new Date();
    const knownDeviceLocation =
      knownDevice?.location?.latitude !== undefined &&
      knownDevice.location.longitude !== undefined &&
      knownDevice.location.accuracyMeters !== undefined
        ? {
            latitude: knownDevice.location.latitude,
            longitude: knownDevice.location.longitude,
            accuracyMeters: knownDevice.location.accuracyMeters,
          }
        : null;
    const risk = assessLoginRisk({
      location: submittedLocation,
      knownDeviceLocation,
      isKnownDevice: Boolean(knownDevice),
      changeRadiusMeters: config.security.locationChangeRadiusMeters,
      maxLocationAccuracyMeters: config.security.maxLocationAccuracyMeters,
      officeLocations: config.security.officeLocations,
      requireAccurateLocation: config.security.requireAccurateLocation,
    });
    const event = await LoginSecurityEvent.create({
      userId: user._id,
      email: user.email,
      deviceIdHash,
      userAgent: meta.userAgent?.slice(0, 500) ?? '',
      location: submittedLocation,
      distanceFromBaselineMeters: risk.distanceMeters,
      riskLevel: risk.riskLevel,
      riskReasons: risk.reasons,
      outcome: 'pending',
    });

    // Approval needs another active admin with an authenticator enrolled (see
    // decideLoginApproval). With none, the request could never be decided — the
    // first admin of a fresh install would be locked out — so fall through to the
    // normal OTP step instead, and leave an audit trail.
    const hasEligibleApprover =
      risk.riskLevel === 'high' &&
      (await AuthUser.exists({
        role: 'admin',
        status: 'Active',
        deletedAt: null,
        totpEnabledAt: { $ne: null },
        _id: { $ne: user._id },
      })) !== null;

    if (risk.riskLevel === 'high' && !hasEligibleApprover) {
      void auditService.record({
        action: 'other',
        entity: 'LoginApproval',
        entityId: String(event._id),
        actorEmail: user.email,
        changes: [{ field: 'approval', from: 'required', to: 'skipped_no_eligible_approver' }],
      });
    }

    if (risk.riskLevel === 'high' && hasEligibleApprover) {
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
      const challenge = await OtpChallenge.create({
        userId: user._id,
        email: user.email,
        method: 'approval',
        securityEventId: event._id,
        purpose: 'login',
        attempts: 0,
        maxAttempts: config.otp.maxAttempts,
        expiresAt,
        lastSentAt: now,
      });
      const pollToken = crypto.randomBytes(32).toString('hex');
      const approval = await LoginApproval.create({
        challengeId: challenge._id,
        eventId: event._id,
        userId: user._id,
        pollTokenHash: sha256(pollToken),
        status: 'pending',
        expiresAt,
      });
      const admins = await AuthUser.find({
        role: 'admin',
        status: 'Active',
        deletedAt: null,
        _id: { $ne: user._id },
      }).select('_id');

      if (admins.length) {
        void notifyMany(
          admins.map((admin) => admin._id),
          {
            type: 'security.login_approval',
            title: 'High-risk login needs approval',
            body: `${user.name} (${user.email}) has a login requiring review: ${risk.reasons.join(', ').replaceAll('_', ' ')}${risk.distanceMeters === null ? '' : `; about ${Math.round(risk.distanceMeters)} m from the saved location`}.`,
            link: '/security/approvals',
            email: true,
          },
        );
      }

      return {
        requiresAdminApproval: true,
        approvalRequestId: String(approval._id),
        pollToken,
        expiresAt,
      };
    }

    if (risk.reasons.length > 0) {
      const admins = await AuthUser.find({
        role: 'admin',
        status: 'Active',
        deletedAt: null,
        _id: { $ne: user._id },
      }).select('_id');
      if (admins.length) {
        void notifyMany(
          admins.map((admin) => admin._id),
          {
            type: 'security.login_signal',
            title: 'Low-risk login signal',
            body: `${user.name} (${user.email}) signed in with signal(s): ${risk.reasons.join(', ').replaceAll('_', ' ')}.`,
            link: '/security/approvals',
          },
        );
      }
    }

    return AuthService.issueLoginChallenge(user, user.totpEnabledAt ? 'totp' : 'email', event._id);
  }

  static async listPendingLoginApprovals() {
    const now = new Date();
    const approvals = await LoginApproval.find({ status: 'pending', expiresAt: { $gt: now } })
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();
    const userIds = approvals.map((approval) => approval.userId);
    const eventIds = approvals.map((approval) => approval.eventId);
    const [users, events] = await Promise.all([
      AuthUser.find({ _id: { $in: userIds } })
        .select('name email role')
        .lean(),
      LoginSecurityEvent.find({ _id: { $in: eventIds } })
        .select('location distanceFromBaselineMeters userAgent riskReasons createdAt deviceIdHash')
        .lean(),
    ]);
    const usersById = new Map(users.map((user) => [String(user._id), user]));
    const eventsById = new Map(
      events.map(({ deviceIdHash, ...event }) => [
        String(event._id),
        { ...event, deviceTag: deviceTagFor(deviceIdHash) },
      ]),
    );

    return approvals.map((approval) => ({
      id: String(approval._id),
      expiresAt: approval.expiresAt,
      requestedAt: approval.createdAt,
      user: usersById.get(String(approval.userId))
        ? {
            id: String(approval.userId),
            name: usersById.get(String(approval.userId))!.name,
            email: usersById.get(String(approval.userId))!.email,
            role: usersById.get(String(approval.userId))!.role,
          }
        : null,
      login: eventsById.get(String(approval.eventId)) ?? null,
    }));
  }

  static async listRecentLoginSecurityEvents(limit = 100) {
    const events = await LoginSecurityEvent.find()
      .sort({ createdAt: -1 })
      .limit(Math.min(200, Math.max(1, limit)))
      .lean();
    const userIds = events.flatMap((event) => (event.userId ? [event.userId] : []));
    const users = await AuthUser.find({ _id: { $in: userIds } })
      .select('name email role')
      .lean();
    const usersById = new Map(users.map((user) => [String(user._id), user]));

    return events.map((event) => {
      const user = event.userId ? usersById.get(String(event.userId)) : undefined;
      return {
        id: String(event._id),
        email: event.email,
        user: user ? { name: user.name, email: user.email, role: user.role } : null,
        location: event.location,
        distanceFromBaselineMeters: event.distanceFromBaselineMeters,
        userAgent: event.userAgent,
        hasDeviceId: Boolean(event.deviceIdHash),
        deviceTag: deviceTagFor(event.deviceIdHash),
        riskLevel: event.riskLevel,
        riskReasons: event.riskReasons,
        outcome: event.outcome,
        createdAt: event.createdAt,
      };
    });
  }

  static async getLoginApprovalStatus(approvalId: string, pollToken: string) {
    if (!Types.ObjectId.isValid(approvalId)) throw new ValidationError('Invalid approval id');
    const approval = await LoginApproval.findOne({
      _id: approvalId,
      pollTokenHash: sha256(pollToken),
    }).select('+pollTokenHash');
    if (!approval) throw new NotFoundError('Login approval not found');

    if (approval.status === 'pending' && approval.expiresAt.getTime() <= Date.now()) {
      approval.status = 'expired';
      approval.decidedAt = new Date();
      approval.decisionNote = 'Approval request expired';
      await approval.save();
      await OtpChallenge.updateOne(
        { _id: approval.challengeId, consumedAt: null },
        { $set: { consumedAt: new Date() } },
      );
      await LoginSecurityEvent.updateOne(
        { _id: approval.eventId },
        { $set: { outcome: 'denied' } },
      );
    }

    if (approval.status === 'processing' || approval.status === 'pending') {
      return { status: 'pending', expiresAt: approval.expiresAt } as const;
    }
    if (approval.status !== 'approved') {
      return { status: approval.status, expiresAt: approval.expiresAt } as const;
    }

    const challenge = await OtpChallenge.findById(approval.challengeId);
    if (!challenge || challenge.consumedAt || challenge.expiresAt.getTime() <= Date.now()) {
      return { status: 'expired' } as const;
    }

    return {
      status: 'approved' as const,
      challenge: {
        challengeId: String(challenge._id),
        email: challenge.email,
        expiresAt: challenge.expiresAt,
        method: challenge.method,
        delivery: challenge.method === 'email' ? config.otp.delivery : undefined,
        resendAvailableInSeconds:
          challenge.method === 'email' ? config.otp.resendCooldownSeconds : 0,
      },
    };
  }

  static async decideLoginApproval(
    approvalId: string,
    adminId: string,
    decision: 'approve' | 'deny',
    note: string,
    totpCode: string,
  ): Promise<void> {
    if (!Types.ObjectId.isValid(approvalId)) throw new ValidationError('Invalid approval id');
    const approval = await LoginApproval.findOne({
      _id: approvalId,
      status: 'pending',
      expiresAt: { $gt: new Date() },
    });
    if (!approval) throw new ConflictError('This login approval is no longer pending.');
    if (String(approval.userId) === adminId) {
      throw new ForbiddenError('An admin cannot approve their own login request.');
    }

    // The admin already has a live session; a fresh authenticator code is the step-up.
    const adminProof = await AuthService.verifyAdminTotp(adminId, totpCode);

    const target = await AuthUser.findOne({
      _id: approval.userId,
      status: 'Active',
      deletedAt: null,
    });
    if (!target) throw new UnauthorizedError('The account requesting access is no longer active.');

    const challenge = await OtpChallenge.findOne({
      _id: approval.challengeId,
      method: 'approval',
      consumedAt: null,
    });
    if (!challenge || challenge.expiresAt.getTime() <= Date.now()) {
      throw new ConflictError('The login request has expired.');
    }

    const claimed = await LoginApproval.findOneAndUpdate(
      { _id: approval._id, status: 'pending', expiresAt: { $gt: new Date() } },
      {
        $set: {
          status: 'processing',
          decidedAt: new Date(),
          decidedBy: adminProof.user._id,
          decisionNote: note.trim(),
        },
      },
      { new: true },
    );
    if (!claimed) throw new ConflictError('Another admin already handled this login request.');

    try {
      await AuthService.consumeAdminTotpStep(adminProof.user._id, adminProof.step);

      if (decision === 'approve' && !target.totpEnabledAt) {
        const code = AuthService.generateOtpCode();
        await sendOtpEmail({
          to: target.email,
          name: target.name,
          code,
          ttlMinutes: config.otp.ttlMinutes,
        });
        challenge.method = 'email';
        challenge.codeHash = sha256(code);
      } else if (decision === 'approve') {
        challenge.method = 'totp';
      } else {
        challenge.consumedAt = new Date();
      }

      if (decision === 'approve') {
        challenge.expiresAt = new Date(Date.now() + config.otp.ttlMinutes * 60 * 1000);
      }

      await challenge.save();
      await LoginApproval.updateOne(
        { _id: claimed._id, status: 'processing' },
        { $set: { status: decision === 'approve' ? 'approved' : 'denied' } },
      );
    } catch (error) {
      await LoginApproval.updateOne(
        { _id: claimed._id, status: 'processing' },
        { $set: { status: 'pending', decidedAt: null, decidedBy: null, decisionNote: '' } },
      );
      throw error;
    }

    await LoginSecurityEvent.updateOne(
      { _id: approval.eventId },
      { $set: { outcome: decision === 'approve' ? 'approved' : 'denied' } },
    );

    void auditService.record({
      action: 'update',
      entity: 'LoginApproval',
      entityId: approvalId,
      actorEmail: (await AuthUser.findById(adminId).select('email'))?.email,
      changes: [{ field: 'status', from: 'pending', to: decision }],
    });
  }

  private static async recordVerifiedLogin(
    user: IUser,
    challenge: { securityEventId?: Types.ObjectId | null },
  ) {
    if (!challenge.securityEventId) return;
    try {
      const event = await LoginSecurityEvent.findById(challenge.securityEventId);
      if (!event) return;

      event.outcome = 'verified';
      await event.save();

      if (!event.deviceIdHash) return;
      // Only an accurate fix becomes the device's baseline; a city-level guess would
      // widen every later distance check. `location` must not also appear in
      // $setOnInsert — Mongo rejects the same path in both operators.
      const accurateLocation =
        event.location?.accuracyMeters !== undefined &&
        event.location.accuracyMeters <= config.security.maxLocationAccuracyMeters
          ? event.location
          : null;
      await TrustedDevice.updateOne(
        { userId: user._id, deviceIdHash: event.deviceIdHash },
        {
          $set: {
            lastSeenAt: new Date(),
            ...(accurateLocation ? { location: accurateLocation } : {}),
            userAgent: event.userAgent,
            revokedAt: null,
          },
          $setOnInsert: {
            firstSeenAt: event.createdAt,
            label: 'Browser',
          },
        },
        { upsert: true },
      );

      // One trusted device per user: a newly verified device replaces the old one,
      // so the old device has to go through approval again if it comes back.
      const replaced = await TrustedDevice.updateMany(
        { userId: user._id, deviceIdHash: { $ne: event.deviceIdHash }, revokedAt: null },
        { $set: { revokedAt: new Date() } },
      );
      if (replaced.modifiedCount > 0) {
        void auditService.record({
          action: 'update',
          entity: 'TrustedDevice',
          entityId: String(user._id),
          actorEmail: user.email,
          changes: [
            { field: 'trustedDevice', from: 'previous device', to: deviceTagFor(event.deviceIdHash) },
          ],
        });
      }
    } catch (error) {
      console.error('[security] failed to record verified login device metadata', error);
    }
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
    if (challenge.method !== 'email') {
      throw new UnauthorizedError('Request an email code before trying to resend it.');
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

    return AuthService.issueLoginChallenge(user, 'email');
  }

  /** Convert an authenticator challenge to an explicit email-code fallback. */
  static async requestEmailFallback(challengeId: string): Promise<LoginChallenge> {
    if (!Types.ObjectId.isValid(challengeId)) {
      throw new ValidationError('Invalid challenge id');
    }

    const challenge = await OtpChallenge.findById(challengeId);
    if (!challenge || challenge.consumedAt || challenge.method !== 'totp') {
      throw new UnauthorizedError('This login attempt is no longer valid. Please sign in again.');
    }
    if (challenge.expiresAt.getTime() <= Date.now()) {
      throw new UnauthorizedError('This login attempt has expired. Please sign in again.');
    }

    const user = await AuthUser.findById(challenge.userId);
    if (!user || user.status !== 'Active' || user.deletedAt) {
      throw new UnauthorizedError('This account is inactive. Contact your administrator.');
    }

    const code = AuthService.generateOtpCode();
    challenge.method = 'email';
    challenge.codeHash = sha256(code);
    challenge.lastSentAt = new Date();
    await challenge.save();
    await sendOtpEmail({
      to: user.email,
      name: user.name,
      code,
      ttlMinutes: config.otp.ttlMinutes,
    });

    return {
      challengeId: String(challenge._id),
      email: user.email,
      expiresAt: challenge.expiresAt,
      method: 'email',
      delivery: config.otp.delivery,
      resendAvailableInSeconds: config.otp.resendCooldownSeconds,
      ...(config.otp.exposeInResponse ? { devOtp: code } : {}),
    };
  }

  /** Step 2 — verify the code and open a session. */
  static async verifyOtp(
    challengeId: string,
    code: string,
    meta: SessionMeta = {},
  ): Promise<AuthSession | MfaEnrollmentRequired> {
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

    if (challenge.method === 'approval') {
      throw new UnauthorizedError('This login is waiting for administrator approval.');
    }

    if (challenge.attempts >= challenge.maxAttempts) {
      throw new TooManyRequestsError('Too many incorrect codes. Please sign in again.');
    }

    const user = await AuthUser.findById(challenge.userId).select(
      '+totpSecretEncrypted +totpLastUsedStep',
    );
    if (!user || user.status !== 'Active' || user.deletedAt) {
      throw new UnauthorizedError('This account is inactive. Contact your administrator.');
    }

    let verifiedStep: number | null = null;
    const verified =
      challenge.method === 'email'
        ? Boolean(challenge.codeHash && timingSafeEqualHex(sha256(code.trim()), challenge.codeHash))
        : Boolean(
            user.totpEnabledAt &&
            user.totpSecretEncrypted &&
            (verifiedStep = verifyTotp(user.totpSecretEncrypted, code.trim())) !== null,
          );

    if (!verified) {
      challenge.attempts += 1;
      await challenge.save();
      if (challenge.securityEventId) {
        await LoginSecurityEvent.updateOne(
          { _id: challenge.securityEventId },
          { $set: { outcome: 'failed' } },
        );
      }

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

    if (challenge.method === 'totp' && verifiedStep !== null) {
      const updated = await AuthUser.updateOne(
        {
          _id: user._id,
          $or: [
            { totpLastUsedStep: { $exists: false } },
            { totpLastUsedStep: { $lt: verifiedStep } },
          ],
        },
        { $set: { totpLastUsedStep: verifiedStep } },
      );
      if (updated.modifiedCount === 0) {
        throw new UnauthorizedError('This authenticator code has already been used.');
      }
    }

    if (challenge.method === 'totp' && user.totpEnabledAt) {
      await AuthService.recordVerifiedLogin(user, challenge);
    }

    if (challenge.method === 'email' && adminNeedsAuthenticatorRecovery(user)) {
      const revokedSessions = await AuthService.clearAuthenticatorAndRevokeSessions(user);

      void auditService.record({
        action: 'update',
        entity: 'Auth',
        entityId: String(user._id),
        actorEmail: user.email,
        changes: [
          { field: 'authenticator', from: 'enabled', to: 're-enrollment required' },
          { field: 'refreshSessions', from: revokedSessions, to: 0 },
        ],
      });

      try {
        await sendEmail({
          to: user.email,
          subject: 'Admin authenticator recovery started',
          text: [
            `Hi ${user.name},`,
            '',
            'An email-verified recovery was used for your administrator account.',
            'All active sessions were revoked. Complete the authenticator setup now to regain access.',
            '',
            'If you did not request this, contact another administrator immediately.',
          ].join('\n'),
        });
      } catch {
        console.error('[mfa-recovery] failed to notify the administrator');
      }

      return AuthService.beginMfaEnrollment(user, challenge.securityEventId);
    }

    if (!user.totpEnabledAt) {
      return AuthService.beginMfaEnrollment(user, challenge.securityEventId);
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

  /** Verify first-login authenticator setup before issuing any session tokens. */
  static async completeMfaEnrollment(
    enrollmentToken: string,
    code: string,
    meta: SessionMeta = {},
  ): Promise<AuthSession> {
    let payload: jwt.JwtPayload;
    try {
      payload = jwt.verify(enrollmentToken, config.jwt.secret) as jwt.JwtPayload;
    } catch {
      throw new UnauthorizedError('Authenticator setup expired. Please sign in again.');
    }

    if (
      payload.purpose !== 'mfa-enrollment' ||
      typeof payload.sub !== 'string' ||
      typeof payload.jti !== 'string'
    ) {
      throw new UnauthorizedError('Invalid authenticator setup challenge.');
    }

    const user = await AuthUser.findById(payload.sub).select(
      '+totpSecretEncrypted +mfaEnrollmentIdHash +mfaEnrollmentAttempts +totpLastUsedStep',
    );
    if (
      !user ||
      user.status !== 'Active' ||
      user.deletedAt ||
      user.totpEnabledAt ||
      !user.totpSecretEncrypted ||
      user.mfaEnrollmentIdHash !== sha256(payload.jti)
    ) {
      throw new UnauthorizedError('Authenticator setup is no longer valid. Please sign in again.');
    }

    if ((user.mfaEnrollmentAttempts ?? 0) >= config.otp.maxAttempts) {
      throw new TooManyRequestsError('Too many incorrect codes. Please sign in again.');
    }

    const verifiedStep = verifyTotp(user.totpSecretEncrypted, code.trim());
    if (verifiedStep === null) {
      user.mfaEnrollmentAttempts = (user.mfaEnrollmentAttempts ?? 0) + 1;
      await user.save();
      throw new UnauthorizedError('Incorrect authenticator code. Check the app and try again.');
    }

    user.totpEnabledAt = new Date();
    user.totpLastUsedStep = verifiedStep;
    user.mfaEnrollmentIdHash = undefined;
    user.mfaEnrollmentAttempts = 0;
    user.lastLoginAt = new Date();
    await user.save();

    if (typeof payload.loginEventId === 'string' && Types.ObjectId.isValid(payload.loginEventId)) {
      await AuthService.recordVerifiedLogin(user, {
        securityEventId: new Types.ObjectId(payload.loginEventId),
      });
    }

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

  // ------------------------------------------------------ admin: device & sessions

  private static async findManagedUser(userId: string): Promise<IUser> {
    if (!Types.ObjectId.isValid(userId)) throw new ValidationError('Invalid user id');
    const user = await AuthUser.findOne({ _id: userId, deletedAt: null });
    if (!user) throw new NotFoundError('User not found');
    return user;
  }

  /** The user's trusted device and live sessions, for the admin profile view. */
  static async getUserDeviceAndSessions(userId: string) {
    const user = await AuthService.findManagedUser(userId);
    const now = new Date();

    const [device, sessions] = await Promise.all([
      TrustedDevice.findOne({ userId: user._id, revokedAt: null })
        .select('+deviceIdHash')
        .sort({ lastSeenAt: -1 })
        .lean(),
      RefreshToken.find({ userId: user._id, revokedAt: null, expiresAt: { $gt: now } })
        .sort({ createdAt: -1 })
        .lean(),
    ]);

    return {
      device: device
        ? {
            deviceTag: deviceTagFor(device.deviceIdHash),
            userAgent: device.userAgent,
            location: device.location?.latitude !== undefined ? device.location : null,
            firstSeenAt: device.firstSeenAt,
            lastSeenAt: device.lastSeenAt,
          }
        : null,
      sessions: sessions.map((session) => ({
        id: String(session._id),
        userAgent: session.userAgent ?? '',
        startedAt: session.createdAt,
        expiresAt: session.expiresAt,
      })),
      sessionsRevokedAt: user.sessionsRevokedAt ?? null,
    };
  }

  /**
   * Ends every session immediately: refresh tokens are revoked, and access tokens
   * issued before now are rejected by `requireAuth`.
   */
  static async revokeUserSessions(
    userId: string,
    actor: { id: string; email: string },
  ): Promise<{ revokedSessions: number }> {
    const user = await AuthService.findManagedUser(userId);
    const now = new Date();

    await AuthUser.updateOne({ _id: user._id }, { $set: { sessionsRevokedAt: now } });
    const revocation = await RefreshToken.updateMany(
      { userId: user._id, revokedAt: null },
      { $set: { revokedAt: now } },
    );

    void auditService.record({
      action: 'update',
      entity: 'Auth',
      entityId: String(user._id),
      actorEmail: actor.email,
      changes: [{ field: 'sessions', from: revocation.modifiedCount, to: 0 }],
    });

    return { revokedSessions: revocation.modifiedCount };
  }

  /**
   * Removes the trusted device and ends all sessions, so the next sign-in from any
   * device — including the old one — needs admin approval again.
   */
  static async removeUserDevice(
    userId: string,
    actor: { id: string; email: string },
  ): Promise<{ removedDevices: number; revokedSessions: number }> {
    const user = await AuthService.findManagedUser(userId);
    const removal = await TrustedDevice.updateMany(
      { userId: user._id, revokedAt: null },
      { $set: { revokedAt: new Date() } },
    );
    const { revokedSessions } = await AuthService.revokeUserSessions(userId, actor);

    void auditService.record({
      action: 'update',
      entity: 'TrustedDevice',
      entityId: String(user._id),
      actorEmail: actor.email,
      changes: [{ field: 'trustedDevice', from: 'trusted', to: 'removed' }],
    });

    return { removedDevices: removal.modifiedCount, revokedSessions };
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
      AuthUser.find(filter).sort({ createdAt: -1 }).skip(skip).limit(pageSize),
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

  static async resetUserMfa(
    targetUserId: string,
    actorId: string,
    input: {
      password: string;
      totpCode: string;
      reason: string;
      secondAdmin?: { email: string; password: string; totpCode: string };
    },
  ): Promise<{ user: PublicUser; revokedSessions: number }> {
    if (!Types.ObjectId.isValid(targetUserId)) throw new NotFoundError('User not found');
    if (targetUserId === actorId) {
      throw new ForbiddenError('You cannot reset your own authenticator.');
    }

    const target = await AuthUser.findOne({ _id: targetUserId, deletedAt: null }).select(
      '+totpSecretEncrypted +mfaEnrollmentIdHash',
    );
    if (!target) throw new NotFoundError('User not found');
    if (!target.totpEnabledAt && !target.totpSecretEncrypted) {
      throw new ConflictError('This user has no authenticator to reset.');
    }

    const actorProof = await AuthService.verifyAdminReauthentication(
      { id: actorId },
      input.password,
      input.totpCode,
    );

    let secondAdminProof: { user: IUser; step: number } | undefined;
    if (target.role === 'admin') {
      if (!input.secondAdmin) {
        throw new ForbiddenError(
          'A second enrolled admin must approve resetting an admin account.',
        );
      }

      secondAdminProof = await AuthService.verifyAdminReauthentication(
        { email: input.secondAdmin.email.trim().toLowerCase() },
        input.secondAdmin.password,
        input.secondAdmin.totpCode,
      );
      if (
        String(secondAdminProof.user._id) === actorId ||
        String(secondAdminProof.user._id) === targetUserId
      ) {
        throw new ForbiddenError('The approving admin must be distinct from the actor and target.');
      }
    } else if (input.secondAdmin) {
      throw new ValidationError('Second-admin approval is only required for admin accounts.');
    }

    await AuthService.consumeAdminTotpStep(actorProof.user._id, actorProof.step);
    if (secondAdminProof) {
      await AuthService.consumeAdminTotpStep(secondAdminProof.user._id, secondAdminProof.step);
    }

    const revokedSessions = await AuthService.clearAuthenticatorAndRevokeSessions(target);

    try {
      await sendEmail({
        to: target.email,
        subject: 'Your authenticator was reset',
        text: [
          `Hi ${target.name},`,
          '',
          'An administrator reset the authenticator connected to your Media Octus CRM account.',
          'Your active sessions were signed out. At your next sign-in, verify your email and set up a new authenticator before continuing.',
          '',
          `Reason: ${input.reason}`,
          '',
          'If you did not expect this change, contact your administrator immediately.',
        ].join('\n'),
      });
    } catch {
      console.error('[mfa-reset] failed to notify the affected user');
    }

    return {
      user: AuthService.toPublicUser(target),
      revokedSessions,
    };
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
