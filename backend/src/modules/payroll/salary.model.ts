import mongoose, { Schema, Types } from 'mongoose';
import { basePlugin, type BaseDocument } from '../../core/db/basePlugin.js';

export interface ISalaryHistoryItem {
  effectiveFrom: Date;
  basicSalary: number;
  hra: number;
  conveyance: number;
  otherAllowances: number;
  bonus: number;
  grossSalary: number;
  deductions: number;
  netSalary: number;
  notes?: string;
  updatedBy?: Types.ObjectId | null;
  updatedByName?: string;
  createdAt: Date;
}

export interface ISalaryStructure extends BaseDocument {
  employeeId: Types.ObjectId;
  effectiveFrom: Date;
  basicSalary: number;
  hra: number;
  conveyance: number;
  otherAllowances: number;
  bonus: number;
  grossSalary: number;
  deductions: number;
  netSalary: number;
  notes?: string;
  updatedBy?: Types.ObjectId | null;
  history: ISalaryHistoryItem[];
}

const salaryHistorySchema = new Schema<ISalaryHistoryItem>(
  {
    effectiveFrom: { type: Date, required: true },
    basicSalary: { type: Number, required: true, min: 0 },
    hra: { type: Number, default: 0, min: 0 },
    conveyance: { type: Number, default: 0, min: 0 },
    otherAllowances: { type: Number, default: 0, min: 0 },
    bonus: { type: Number, default: 0, min: 0 },
    grossSalary: { type: Number, required: true, min: 0 },
    deductions: { type: Number, default: 0, min: 0 },
    netSalary: { type: Number, required: true, min: 0 },
    notes: { type: String, trim: true },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    updatedByName: { type: String, trim: true },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false },
);

const salaryStructureSchema = new Schema<ISalaryStructure>({
  employeeId: {
    type: Schema.Types.ObjectId,
    ref: 'Employee',
    required: true,
    unique: true,
    index: true,
  },
  effectiveFrom: { type: Date, default: Date.now, required: true },
  basicSalary: { type: Number, required: true, min: 0 },
  hra: { type: Number, default: 0, min: 0 },
  conveyance: { type: Number, default: 0, min: 0 },
  otherAllowances: { type: Number, default: 0, min: 0 },
  bonus: { type: Number, default: 0, min: 0 },
  grossSalary: { type: Number, required: true, min: 0 },
  deductions: { type: Number, default: 0, min: 0 },
  netSalary: { type: Number, required: true, min: 0 },
  notes: { type: String, trim: true },
  updatedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  history: { type: [salaryHistorySchema], default: [] },
});

salaryStructureSchema.plugin(basePlugin);

salaryStructureSchema.set('toJSON', {
  virtuals: true,
  transform: (_doc, ret: any) => {
    ret.id = String(ret._id);
    return ret;
  },
});

salaryStructureSchema.set('toObject', {
  virtuals: true,
  transform: (_doc, ret: any) => {
    ret.id = String(ret._id);
    return ret;
  },
});

export const SalaryStructure =
  (mongoose.models.SalaryStructure as mongoose.Model<ISalaryStructure>) ||
  mongoose.model<ISalaryStructure>('SalaryStructure', salaryStructureSchema);
