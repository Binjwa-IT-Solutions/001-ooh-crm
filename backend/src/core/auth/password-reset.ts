import crypto from 'node:crypto';

import bcrypt from 'bcryptjs';
import mongoose, { Schema, Types } from 'mongoose';

import { config } from '../../config/index.js';
import { auditService } from '../audit/index.js';
import { ValidationError } from '../errors/index.js';
import { sendEmail } from '../notifications/index.js';
import { AuthUser } from './auth-model.js';
import { RefreshToken } from './refresh-token-model.js';

/**
 * SELF-SERVICE PASSWORD RESET
 *
 *   1. POST /api/auth/forgot-password { email }
 *        Always answers the same way (no "this email doesn't exist" leak).
 *        If an active account matches, emails a one-time link valid for 30 min.
 *   2. GET  /api/auth/reset-password/:token     → is the link still valid? (for the page)
 *   3. POST /api/auth/reset-password { token, password }
 *        Sets the new password, burns the link, signs the user out everywhere
 *        and sends a "your password was changed" email.
 *
 * Only a SHA-256 of the token is stored; a leaked DB cannot be used to reset anyone.
 */

interface IPasswordResetToken {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  tokenHash: string;
  expiresAt: Date;
  usedAt: Date | null;
  requestedIp?: string;
  createdAt: Date;
}

const passwordResetSchema = new Schema<IPasswordResetToken>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    tokenHash: { type: String, required: true, unique: true },
    expiresAt: { type: Date, required: true },
    usedAt: { type: Date, default: null },
    requestedIp: { type: String },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

// Mongo deletes expired tokens on its own.
passwordResetSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const PasswordResetToken =
  (mongoose.models.PasswordResetToken as mongoose.Model<IPasswordResetToken>) ??
  mongoose.model<IPasswordResetToken>('PasswordResetToken', passwordResetSchema);

const sha256 = (value: string) => crypto.createHash('sha256').update(value).digest('hex');

const INVALID_LINK = 'This reset link is invalid or has expired. Please request a new one.';

export interface ForgotPasswordResult {
  message: string;
  /** Development only (OTP_EXPOSE_IN_RESPONSE): the link, so you can test without an inbox. */
  devResetUrl?: string;
}

export async function requestPasswordReset(
  email: string,
  meta: { ip?: string } = {},
): Promise<ForgotPasswordResult> {
  const message =
    'If an account exists for that email, we have sent a link to reset your password. Please check your inbox (and spam folder).';

  const normalized = email.toLowerCase().trim();
  const user = await AuthUser.findOne({ email: normalized, deletedAt: null });
  // Server log only — the caller always gets the same answer.
  if (!user) {
    console.info(`[password-reset] no account for ${normalized} — nothing sent`);
    return { message };
  }
  if (user.status !== 'Active') {
    console.info(`[password-reset] account ${normalized} is ${user.status} — nothing sent`);
    return { message };
  }

  // Throttle: one email per cooldown window per account. Answer identically so it can't be probed.
  const recent = await PasswordResetToken.findOne({
    userId: user._id,
    createdAt: { $gt: new Date(Date.now() - config.passwordReset.cooldownSeconds * 1000) },
  });
  if (recent) {
    console.info(
      `[password-reset] ${normalized} asked again within ${config.passwordReset.cooldownSeconds}s — skipped (use the earlier email)`,
    );
    return { message };
  }

  // Only the newest link works.
  await PasswordResetToken.updateMany({ userId: user._id, usedAt: null }, { $set: { usedAt: new Date() } });

  const token = crypto.randomBytes(32).toString('hex');
  await PasswordResetToken.create({
    userId: user._id,
    tokenHash: sha256(token),
    expiresAt: new Date(Date.now() + config.passwordReset.ttlMinutes * 60 * 1000),
    requestedIp: meta.ip,
  });

  const resetUrl = `${config.appUrl}/reset-password?token=${token}`;

  try {
    const { transport } = await sendEmail({
      to: user.email,
      subject: 'Reset your Media Octus CRM password',
      text: [
        `Hi ${user.name},`,
        '',
        'We received a request to reset the password for your Media Octus CRM account.',
        '',
        'Open this link to choose a new password:',
        resetUrl,
        '',
        `The link works once and expires in ${config.passwordReset.ttlMinutes} minutes.`,
        "If you didn't ask for this, you can ignore this email — your password stays the same.",
        '',
        '— Media Octus CRM',
      ].join('\n'),
    });
    console.info(`[password-reset] reset link sent to ${user.email} via ${transport}`);
  } catch (err) {
    // Never reveal delivery problems to the caller; log for the admins.
    console.error('[password-reset] failed to send reset email', err);
  }

  void auditService.record({
    action: 'update',
    entity: 'Auth',
    entityId: String(user._id),
    actorEmail: user.email,
    changes: [{ field: 'passwordResetRequested', from: null, to: new Date().toISOString() }],
  });

  return config.otp.exposeInResponse ? { message, devResetUrl: resetUrl } : { message };
}

async function findUsableToken(token: string) {
  if (!/^[0-9a-f]{64}$/.test(token)) return null;
  const record = await PasswordResetToken.findOne({ tokenHash: sha256(token) });
  if (!record || record.usedAt || record.expiresAt.getTime() <= Date.now()) return null;
  return record;
}

/** Lets the reset page show "link expired" up front instead of after typing a password. */
export async function checkPasswordResetToken(token: string): Promise<{ valid: boolean; email?: string }> {
  const record = await findUsableToken(token);
  if (!record) return { valid: false };
  const user = await AuthUser.findById(record.userId).select('email status deletedAt');
  if (!user || user.status !== 'Active' || user.deletedAt) return { valid: false };
  // Mask the address: "ta***@gmail.com"
  const [local, domain] = user.email.split('@');
  return { valid: true, email: `${local.slice(0, 2)}${'*'.repeat(Math.max(1, local.length - 2))}@${domain}` };
}

export async function resetPassword(token: string, newPassword: string): Promise<{ message: string }> {
  const record = await findUsableToken(token);
  if (!record) throw new ValidationError(INVALID_LINK);

  const user = await AuthUser.findById(record.userId).select('+passwordHash');
  if (!user || user.status !== 'Active' || user.deletedAt) throw new ValidationError(INVALID_LINK);

  if (await bcrypt.compare(newPassword, user.passwordHash)) {
    throw new ValidationError('Your new password must be different from your current password.');
  }

  // Burn the token first (atomically) so a double-submit can't use it twice.
  const claimed = await PasswordResetToken.updateOne(
    { _id: record._id, usedAt: null },
    { $set: { usedAt: new Date() } },
  );
  if (claimed.modifiedCount === 0) throw new ValidationError(INVALID_LINK);

  const now = new Date();
  user.passwordHash = await bcrypt.hash(newPassword, 10);
  user.sessionsRevokedAt = now; // sign out everywhere
  await user.save();

  await RefreshToken.updateMany({ userId: user._id, revokedAt: null }, { $set: { revokedAt: now } });
  await PasswordResetToken.updateMany({ userId: user._id, usedAt: null }, { $set: { usedAt: now } });

  try {
    await sendEmail({
      to: user.email,
      subject: 'Your Media Octus CRM password was changed',
      text: [
        `Hi ${user.name},`,
        '',
        `Your password was changed on ${now.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}.`,
        'For your security, you have been signed out of all devices.',
        '',
        "If this wasn't you, contact your administrator immediately.",
        '',
        '— Media Octus CRM',
      ].join('\n'),
    });
  } catch (err) {
    console.error('[password-reset] failed to send confirmation email', err);
  }

  void auditService.record({
    action: 'update',
    entity: 'Auth',
    entityId: String(user._id),
    actorEmail: user.email,
    changes: [{ field: 'password', from: '[redacted]', to: '[reset via email link]' }],
  });

  return { message: 'Your password has been reset. You can now sign in with your new password.' };
}
