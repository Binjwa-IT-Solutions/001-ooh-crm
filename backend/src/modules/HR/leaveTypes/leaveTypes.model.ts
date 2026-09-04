import mongoose, { Schema, model, Types } from 'mongoose';
import { basePlugin, type BaseDocument } from '../../../core/db/basePlugin.js';

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
// LeaveBalance
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

// One balance row per employee, per leave type, per year — the whole
// allocation mechanism depends on this being unique.
leaveBalanceSchema.index({ employeeId: 1, leaveTypeId: 1, year: 1 }, { unique: true });

leaveBalanceSchema.plugin(basePlugin);

export const LeaveBalance =
  (mongoose.models.LeaveBalance as mongoose.Model<ILeaveBalance>) ??
  model<ILeaveBalance>('LeaveBalance', leaveBalanceSchema);