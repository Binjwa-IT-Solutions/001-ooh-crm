import mongoose, { Schema, Types } from 'mongoose';

export interface ILoginSecurityEvent {
  _id: Types.ObjectId;
  userId: Types.ObjectId | null;
  email: string;
  deviceIdHash: string | null;
  userAgent: string;
  location: { latitude: number; longitude: number; accuracyMeters: number } | null;
  distanceFromBaselineMeters: number | null;
  riskLevel: 'low' | 'high';
  riskReasons: string[];
  outcome: 'pending' | 'approved' | 'denied' | 'verified' | 'failed';
  createdAt: Date;
}

const loginSecurityEventSchema = new Schema<ILoginSecurityEvent>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', default: null, index: true },
    email: { type: String, required: true, lowercase: true, trim: true, index: true },
    deviceIdHash: { type: String, default: null },
    userAgent: { type: String, default: '' },
    location: {
      latitude: { type: Number },
      longitude: { type: Number },
      accuracyMeters: { type: Number },
    },
    distanceFromBaselineMeters: { type: Number, default: null },
    riskLevel: { type: String, enum: ['low', 'high'], required: true },
    riskReasons: { type: [String], default: [] },
    outcome: {
      type: String,
      enum: ['pending', 'approved', 'denied', 'verified', 'failed'],
      required: true,
    },
    createdAt: { type: Date, default: () => new Date(), expires: 60 * 60 * 24 * 180 },
  },
  { versionKey: false },
);

loginSecurityEventSchema.index({ userId: 1, createdAt: -1 });

export const LoginSecurityEvent =
  (mongoose.models.LoginSecurityEvent as mongoose.Model<ILoginSecurityEvent>) ??
  mongoose.model<ILoginSecurityEvent>('LoginSecurityEvent', loginSecurityEventSchema);

export interface ITrustedDevice {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  deviceIdHash: string;
  label: string;
  userAgent: string;
  location: { latitude: number; longitude: number; accuracyMeters: number } | null;
  firstSeenAt: Date;
  lastSeenAt: Date;
  revokedAt: Date | null;
}

const trustedDeviceSchema = new Schema<ITrustedDevice>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    deviceIdHash: { type: String, required: true, select: false },
    label: { type: String, default: 'Browser' },
    userAgent: { type: String, default: '' },
    location: {
      latitude: { type: Number },
      longitude: { type: Number },
      accuracyMeters: { type: Number },
    },
    firstSeenAt: { type: Date, default: () => new Date() },
    lastSeenAt: { type: Date, default: () => new Date() },
    revokedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

trustedDeviceSchema.index({ userId: 1, deviceIdHash: 1 }, { unique: true });

export const TrustedDevice =
  (mongoose.models.TrustedDevice as mongoose.Model<ITrustedDevice>) ??
  mongoose.model<ITrustedDevice>('TrustedDevice', trustedDeviceSchema);

export interface ILoginApproval {
  _id: Types.ObjectId;
  challengeId: Types.ObjectId;
  eventId: Types.ObjectId;
  userId: Types.ObjectId;
  pollTokenHash: string;
  status: 'pending' | 'processing' | 'approved' | 'denied' | 'expired';
  expiresAt: Date;
  decidedAt: Date | null;
  decidedBy: Types.ObjectId | null;
  decisionNote: string;
  createdAt: Date;
  updatedAt: Date;
}

const loginApprovalSchema = new Schema<ILoginApproval>(
  {
    challengeId: { type: Schema.Types.ObjectId, ref: 'OtpChallenge', required: true, unique: true },
    eventId: { type: Schema.Types.ObjectId, ref: 'LoginSecurityEvent', required: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    pollTokenHash: { type: String, required: true, select: false },
    status: {
      type: String,
      enum: ['pending', 'processing', 'approved', 'denied', 'expired'],
      default: 'pending',
    },
    expiresAt: { type: Date, required: true },
    decidedAt: { type: Date, default: null },
    decidedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    decisionNote: { type: String, default: '' },
  },
  { timestamps: true },
);

loginApprovalSchema.index({ status: 1, expiresAt: 1 });

export const LoginApproval =
  (mongoose.models.LoginApproval as mongoose.Model<ILoginApproval>) ??
  mongoose.model<ILoginApproval>('LoginApproval', loginApprovalSchema);
