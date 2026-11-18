import mongoose, { Schema, model, Types } from 'mongoose';
import { basePlugin, type BaseDocument } from '../../../core/db/basePlugin.js';

// ---------------------------------------------------------------------------
// 1. LeaveType
// ---------------------------------------------------------------------------

export const QUOTA_PERIODS = ['Monthly', 'Yearly', 'Unlimited'] as const;
export type QuotaPeriod = (typeof QUOTA_PERIODS)[number];

export interface ILeaveType extends BaseDocument {
  name: string;
  code: string;
  /**
   * How the quota is granted:
   *   Monthly   — `quotaDays` added at the start of every month (accrues through the year)
   *   Yearly    — `quotaDays` for the whole year (prorated from the joining date)
   *   Unlimited — no balance check (e.g. Leave Without Pay)
   */
  quotaPeriod: QuotaPeriod;
  quotaDays: number;
  /** Derived: days per full year (null = unlimited). Kept for older screens and reports. */
  annualQuota: number | null;
  carryForward: boolean;
  /** Most days that can be carried into next year. 0 = no limit. */
  maxCarryForward: number;
  /**
   * Carried-over days must be used within this many months of the new year
   * (3 → by 31 March). null = they last the whole year.
   */
  carryForwardExpiryMonths: number | null;
  encashable: boolean;
  requiresDocument: boolean;
  status: 'Active' | 'Inactive';
}

const leaveTypeSchema = new Schema<ILeaveType>({
  name: { type: String, required: true, trim: true },
  code: { type: String, required: true, trim: true, uppercase: true, unique: true },
  // No defaults: when missing (older data / older callers) they're derived from annualQuota below.
  quotaPeriod: { type: String, enum: QUOTA_PERIODS },
  quotaDays: { type: Number, min: 0 },
  annualQuota: { type: Number, default: null, min: 0 },
  carryForward: { type: Boolean, default: false },
  maxCarryForward: { type: Number, default: 0, min: 0 },
  carryForwardExpiryMonths: { type: Number, default: null, min: 1, max: 12 },
  encashable: { type: Boolean, default: false },
  requiresDocument: { type: Boolean, default: false },
  status: { type: String, enum: ['Active', 'Inactive'], default: 'Active' },
});

// Keep annualQuota in step with the period/quota HR picked.
leaveTypeSchema.pre('validate', function syncAnnualQuota() {
  if (!this.quotaPeriod) {
    // Created the old way (annualQuota only): null = unlimited, a number = per year.
    this.quotaPeriod = this.annualQuota == null ? 'Unlimited' : 'Yearly';
    this.quotaDays = this.annualQuota ?? 0;
  }
  if (this.quotaDays == null) this.quotaDays = 0;
  if (this.quotaPeriod === 'Unlimited') this.annualQuota = null;
  else if (this.quotaPeriod === 'Monthly') this.annualQuota = Math.round(this.quotaDays * 12 * 2) / 2;
  else this.annualQuota = this.quotaDays;
  if (!this.carryForward) {
    this.maxCarryForward = 0;
    this.carryForwardExpiryMonths = null;
  }
});

leaveTypeSchema.plugin(basePlugin);

export const LeaveType =
  (mongoose.models.LeaveType as mongoose.Model<ILeaveType>) ??
  model<ILeaveType>('LeaveType', leaveTypeSchema);

// ---------------------------------------------------------------------------
// 2. LeaveBalance
// ---------------------------------------------------------------------------

export interface ILeaveBalance extends BaseDocument {
  employeeId: Types.ObjectId;
  leaveTypeId: Types.ObjectId;
  year: number;
  allocated: number;
  used: number;
  carriedForward: number;
}

const leaveBalanceSchema = new Schema<ILeaveBalance>({
  employeeId: { type: Schema.Types.ObjectId, ref: 'Employee', required: true, index: true },
  leaveTypeId: { type: Schema.Types.ObjectId, ref: 'LeaveType', required: true },
  year: { type: Number, required: true },
  allocated: { type: Number, required: true, default: 0, min: 0 },
  used: { type: Number, required: true, default: 0, min: 0 },
  carriedForward: { type: Number, required: true, default: 0, min: 0 },
});

leaveBalanceSchema.index({ employeeId: 1, leaveTypeId: 1, year: 1 }, { unique: true });
leaveBalanceSchema.plugin(basePlugin);

export const LeaveBalance =
  (mongoose.models.LeaveBalance as mongoose.Model<ILeaveBalance>) ??
  model<ILeaveBalance>('LeaveBalance', leaveBalanceSchema);

// ---------------------------------------------------------------------------
// 3. LeaveRequest
// ---------------------------------------------------------------------------

export interface ILeaveRequest extends BaseDocument {
  employeeId: Types.ObjectId;
  leaveTypeId: Types.ObjectId;
  fromDate: Date;
  toDate: Date;
  days: number;
  reason: string;
  status: 'Pending' | 'Approved' | 'Rejected' | 'Cancelled';
  documentUrl?: string;
  approverId?: Types.ObjectId;
  approvedAt?: Date | null;
  rejectionReason?: string;
  /** Who approved / rejected it (HR or admin) — shown in the UI and the email. */
  decidedByUserId?: Types.ObjectId;
  decidedByName?: string;
  decidedByRole?: string;
  decidedAt?: Date | null;
}

const leaveRequestSchema = new Schema<ILeaveRequest>(
  {
    employeeId: { type: Schema.Types.ObjectId, ref: 'Employee', required: true, index: true },
    leaveTypeId: { type: Schema.Types.ObjectId, ref: 'LeaveType', required: true },
    fromDate: { type: Date, required: true },
    toDate: { type: Date, required: true },
    days: { type: Number, required: true, min: 0.5 },
    reason: { type: String, required: true, trim: true },
    status: {
      type: String,
      enum: ['Pending', 'Approved', 'Rejected', 'Cancelled'],
      default: 'Pending',
      index: true,
    },
    documentUrl: { type: String },
    approverId: { type: Schema.Types.ObjectId, ref: 'Employee' },
    approvedAt: { type: Date, default: null },
    rejectionReason: { type: String, trim: true },
    decidedByUserId: { type: Schema.Types.ObjectId, ref: 'AuthUser' },
    decidedByName: { type: String, trim: true },
    decidedByRole: { type: String, trim: true },
    decidedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

leaveRequestSchema.index({ employeeId: 1, fromDate: 1, toDate: 1 });
leaveRequestSchema.plugin(basePlugin);

export const LeaveRequest =
  (mongoose.models.LeaveRequest as mongoose.Model<ILeaveRequest>) ??
  model<ILeaveRequest>('LeaveRequest', leaveRequestSchema);

export default LeaveRequest;
