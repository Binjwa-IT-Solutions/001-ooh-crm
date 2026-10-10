import mongoose, { Schema, Types } from 'mongoose';

/**
 * One login attempt awaiting its OTP.
 *
 * The code itself is stored hashed — a leaked database dump should not hand
 * anyone a working second factor. Documents self-destruct via a TTL index.
 */
export interface IOtpChallenge {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  email: string;
  codeHash?: string;
  method: 'email' | 'totp' | 'approval';
  securityEventId?: Types.ObjectId | null;
  purpose: 'login';
  attempts: number;
  maxAttempts: number;
  expiresAt: Date;
  consumedAt: Date | null;
  lastSentAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const otpChallengeSchema = new Schema<IOtpChallenge>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    codeHash: { type: String, select: false },
    method: { type: String, enum: ['email', 'totp', 'approval'], required: true, default: 'email' },
    securityEventId: { type: Schema.Types.ObjectId, ref: 'LoginSecurityEvent', default: null },
    purpose: { type: String, enum: ['login'], required: true, default: 'login' },
    attempts: { type: Number, required: true, default: 0 },
    maxAttempts: { type: Number, required: true },
    expiresAt: { type: Date, required: true },
    consumedAt: { type: Date, default: null },
    lastSentAt: { type: Date, required: true, default: () => new Date() },
  },
  { timestamps: true },
);

// Mongo removes the document itself once it expires — no cleanup job needed.
otpChallengeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const OtpChallenge =
  (mongoose.models.OtpChallenge as mongoose.Model<IOtpChallenge>) ??
  mongoose.model<IOtpChallenge>('OtpChallenge', otpChallengeSchema);
