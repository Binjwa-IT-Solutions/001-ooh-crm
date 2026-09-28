import mongoose, { Schema, model, Types } from 'mongoose';
import { basePlugin, type BaseDocument } from '../../../core/db/basePlugin.js';

// ---------------------------------------------------------------------------
// 1. LeaveType
// ---------------------------------------------------------------------------

export interface ILeaveType extends BaseDocument {
  name: string;
  code: string;
  annualQuota: number | null; // null = unlimited (e.g. Leave Without Pay)
  carryForward: boolean;
  maxCarryForward: number;
  encashable: boolean;
  requiresDocument: boolean;
  status: 'Active' | 'Inactive';
}

const leaveTypeSchema = new Schema<ILeaveType>({
  name: { type: String, required: true, trim: true },
  code: { type: String, required: true, trim: true, uppercase: true, unique: true },
  annualQuota: { type: Number, default: null, min: 0 },
  carryForward: { type: Boolean, default: false },
  maxCarryForward: { type: Number, default: 0, min: 0 },
  encashable: { type: Boolean, default: false },
  requiresDocument: { type: Boolean, default: false },
  status: { type: String, enum: ['Active', 'Inactive'], default: 'Active' },
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
  },
  { timestamps: true }
);

leaveRequestSchema.index({ employeeId: 1, fromDate: 1, toDate: 1 });
leaveRequestSchema.plugin(basePlugin);

export const LeaveRequest =
  (mongoose.models.LeaveRequest as mongoose.Model<ILeaveRequest>) ??
  model<ILeaveRequest>('LeaveRequest', leaveRequestSchema);

export default LeaveRequest;
