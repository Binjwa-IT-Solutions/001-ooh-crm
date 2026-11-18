import mongoose, { Schema, Types } from 'mongoose';
import { basePlugin, type BaseDocument } from '../../core/db/basePlugin.js';

export const PAYROLL_STATUSES = [
  'Draft',
  'Pending',
  'Processed',
  'Paid',
  'Failed',
  'Cancelled',
] as const;

export type PayrollStatus = (typeof PAYROLL_STATUSES)[number];

export const SALARY_PAYMENT_METHODS = [
  'bank_transfer',
  'cheque',
  'cash',
  'upi',
] as const;

export type SalaryPaymentMethod = (typeof SALARY_PAYMENT_METHODS)[number];

export interface ISalaryStructureSnapshot {
  basicSalary: number;
  hra: number;
  conveyance: number;
  otherAllowances: number;
  bonus: number;
  grossSalary: number;
  deductions: number;
  netSalary: number;
}

export interface IPayroll extends BaseDocument {
  payslipNumber: string;
  employeeId: Types.ObjectId;
  salaryMonth: number; // 1-12
  salaryYear: number;
  periodLabel: string; // e.g. "October 2026"
  salaryStructureSnapshot: ISalaryStructureSnapshot;
  grossSalary: number;
  deductions: number;
  netPayable: number;
  status: PayrollStatus;
  paymentDate?: Date | null;
  paymentMethod?: SalaryPaymentMethod | null;
  transactionReference?: string;
  notes?: string;
  processedBy?: Types.ObjectId | null;
  paidAt?: Date | null;
}

const salaryStructureSnapshotSchema = new Schema<ISalaryStructureSnapshot>(
  {
    basicSalary: { type: Number, required: true },
    hra: { type: Number, default: 0 },
    conveyance: { type: Number, default: 0 },
    otherAllowances: { type: Number, default: 0 },
    bonus: { type: Number, default: 0 },
    grossSalary: { type: Number, required: true },
    deductions: { type: Number, default: 0 },
    netSalary: { type: Number, required: true },
  },
  { _id: false },
);

const payrollSchema = new Schema<IPayroll>({
  payslipNumber: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    index: true,
  },
  employeeId: {
    type: Schema.Types.ObjectId,
    ref: 'Employee',
    required: true,
    index: true,
  },
  salaryMonth: {
    type: Number,
    required: true,
    min: 1,
    max: 12,
  },
  salaryYear: {
    type: Number,
    required: true,
    min: 2000,
  },
  periodLabel: {
    type: String,
    required: true,
    trim: true,
  },
  salaryStructureSnapshot: {
    type: salaryStructureSnapshotSchema,
    required: true,
  },
  grossSalary: {
    type: Number,
    required: true,
    min: 0,
  },
  deductions: {
    type: Number,
    default: 0,
    min: 0,
  },
  netPayable: {
    type: Number,
    required: true,
    min: 0,
  },
  status: {
    type: String,
    enum: PAYROLL_STATUSES,
    default: 'Pending',
    index: true,
  },
  paymentDate: {
    type: Date,
    default: null,
  },
  paymentMethod: {
    type: String,
    enum: [...SALARY_PAYMENT_METHODS, null],
    default: null,
  },
  transactionReference: {
    type: String,
    trim: true,
    default: '',
  },
  notes: {
    type: String,
    trim: true,
    default: '',
  },
  processedBy: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
  paidAt: {
    type: Date,
    default: null,
  },
});

// Enforce single payroll record per employee per month/year
payrollSchema.index({ employeeId: 1, salaryMonth: 1, salaryYear: 1 }, { unique: true });

payrollSchema.plugin(basePlugin);

payrollSchema.set('toJSON', {
  virtuals: true,
  transform: (_doc, ret: any) => {
    ret.id = String(ret._id);
    return ret;
  },
});

payrollSchema.set('toObject', {
  virtuals: true,
  transform: (_doc, ret: any) => {
    ret.id = String(ret._id);
    return ret;
  },
});

export const Payroll =
  (mongoose.models.Payroll as mongoose.Model<IPayroll>) ||
  mongoose.model<IPayroll>('Payroll', payrollSchema);
