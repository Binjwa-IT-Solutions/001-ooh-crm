import mongoose, { Schema, Types } from 'mongoose';
import { basePlugin, BaseDocument } from '../../core/db/basePlugin.js';

export const LEAD_SOURCES = [
  'JustDial',
  'Website',
  'WhatsApp',
  'Facebook',
  'Instagram',
  'Email',
  'Referral',
  'Manual',
] as const;
export type LeadSource = (typeof LEAD_SOURCES)[number];

export const LEAD_STATUSES = [
  'New',
  'Contacted',
  'Interested',
  'Qualified',
  'Proposal Sent',
  'Negotiation',
  'Won',
  'Lost',
  'Duplicate',
  'duplicate',
] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];

export const LOCATION_PREFERENCES = ['Airport', 'Highway', 'Mall', 'Metro', 'Other'] as const;
export type LocationPreference = (typeof LOCATION_PREFERENCES)[number];

export const FOLLOW_UP_TYPES = ['Call', 'Meeting', 'WhatsApp', 'Email', 'Visit', 'Other'] as const;
export type FollowUpType = (typeof FOLLOW_UP_TYPES)[number];

export const FOLLOW_UP_REASONS = [
  'Requirement Gathering',
  'Quotation Review',
  'Rate Negotiation',
  'Payment Follow-up',
  'Design / Creative',
  'General Follow-up',
] as const;
export type FollowUpReason = (typeof FOLLOW_UP_REASONS)[number];

export interface ILeadStatusHistory {
  from?: string;
  to: string;
  changedBy?: Types.ObjectId | null;
  reason?: string;
  changedAt: Date;
  cycle?: number;
}

export interface IFollowUpLog {
  user?: Types.ObjectId | null;
  followUpType?: FollowUpType;
  reason?: string;
  remarks?: string;
  note?: string;
  nextActionDate?: Date | null;
  delayResponsibility?: string;
  durationSec?: number;
  createdAt: Date;
}

export interface IManagerApproval {
  approved: boolean;
  approvedBy?: Types.ObjectId | null;
  approvedAt?: Date | null;
  remarks?: string;
}

export interface ILeadQualification {
  city?: string;
  locationPreference?: LocationPreference;
  campaignDuration?: string;
  budget?: number; // Integer paise
  targetAudience?: string;
  campaignObjective?: string;
  creativeRequirements?: string;
  notes?: string;
  lostReason?: string;
}

export interface ILead extends BaseDocument {
  companyName: string;
  contactPerson: string;
  mobile: string;
  email?: string;
  city?: string;
  source: LeadSource;
  status: LeadStatus;
  rawPayload?: Record<string, any>;
  assignedTo?: Types.ObjectId | null;
  claimedBy?: Types.ObjectId | null;
  claimedAt?: Date | null;
  notifiedAt?: Date | null;
  qualifiedAt?: Date | null;
  slaTimerEnd?: Date | null;
  nextActionDate?: Date | null;
  receivedAt?: Date | null;
  firstCallAt?: Date | null;
  firstResponseAt?: Date | null;
  callLogs?: IFollowUpLog[];
  qualification?: ILeadQualification;
  managerApproval?: IManagerApproval;
  statusHistory?: ILeadStatusHistory[];
  cycle?: number;
}

const statusHistorySchema = new Schema<ILeadStatusHistory>(
  {
    from: { type: String, trim: true },
    to: { type: String, required: true, trim: true },
    changedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    reason: { type: String, trim: true },
    changedAt: { type: Date, default: Date.now },
    cycle: { type: Number, default: 1 },
  },
  { _id: false },
);

const followUpLogSchema = new Schema<IFollowUpLog>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    followUpType: { type: String, enum: FOLLOW_UP_TYPES, default: 'Call' },
    reason: { type: String, trim: true },
    remarks: { type: String, trim: true },
    note: { type: String, trim: true },
    nextActionDate: { type: Date, default: null },
    delayResponsibility: { type: String, trim: true },
    durationSec: { type: Number, min: 0 },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false },
);

const managerApprovalSchema = new Schema<IManagerApproval>(
  {
    approved: { type: Boolean, default: false },
    approvedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    approvedAt: { type: Date, default: null },
    remarks: { type: String, trim: true },
  },
  { _id: false },
);

const qualificationSchema = new Schema<ILeadQualification>(
  {
    city: { type: String, trim: true },
    locationPreference: { type: String, enum: LOCATION_PREFERENCES },
    campaignDuration: { type: String, trim: true },
    budget: { type: Number, min: 0 }, // Integer paise
    targetAudience: { type: String, trim: true },
    campaignObjective: { type: String, trim: true },
    creativeRequirements: { type: String, trim: true },
    notes: { type: String, trim: true },
    lostReason: { type: String, trim: true },
  },
  { _id: false },
);

const leadSchema = new Schema<ILead>({
  companyName: { type: String, required: true, trim: true },
  contactPerson: { type: String, required: true, trim: true },
  mobile: { type: String, required: true, trim: true, index: true },
  email: { type: String, trim: true, lowercase: true },
  city: { type: String, trim: true },
  source: { type: String, enum: LEAD_SOURCES, required: true },
  status: { type: String, enum: LEAD_STATUSES, default: 'New', index: true },
  rawPayload: { type: Schema.Types.Mixed, default: null },
  assignedTo: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  claimedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  claimedAt: { type: Date, default: null },
  notifiedAt: { type: Date, default: null },
  qualifiedAt: { type: Date, default: null },
  slaTimerEnd: { type: Date, default: null },
  nextActionDate: { type: Date, default: null, index: true },
  qualification: { type: qualificationSchema, default: {} },
  managerApproval: { type: managerApprovalSchema, default: null },
  receivedAt: { type: Date, default: Date.now },
  firstCallAt: { type: Date, default: null },
  firstResponseAt: { type: Date, default: null },
  statusHistory: { type: [statusHistorySchema], default: [] },
  callLogs: { type: [followUpLogSchema], default: [] },
  cycle: { type: Number, default: 1, min: 1 },
});

leadSchema.plugin(basePlugin);

export const Lead = mongoose.model<ILead>('Lead', leadSchema);
