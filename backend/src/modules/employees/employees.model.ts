import mongoose, { Schema, Types } from 'mongoose';

import { basePlugin, type BaseDocument } from '../../core/db/basePlugin.js';

/**
 * REFERENCE MODULE — Employee Master (G1).
 *
 * The model holds fields and indexes. No business logic, no queries, no
 * formatting — all of that belongs in the service.
 */

export const DEPARTMENTS = [
  'Sales',
  'Operations',
  'Finance',
  'HR',
  'Marketing',
  'Management',
] as const;

export const EMPLOYMENT_TYPES = ['Full-time', 'Part-time', 'Contract', 'Intern'] as const;

export const EMPLOYEE_STATUSES = ['Active', 'On Notice', 'Inactive', 'Resigned'] as const;

export type Department = (typeof DEPARTMENTS)[number];
export type EmploymentType = (typeof EMPLOYMENT_TYPES)[number];
export type EmployeeStatus = (typeof EMPLOYEE_STATUSES)[number];

/**
 * Fields that must never reach a client without `employees.sensitive`.
 * `employees.service.ts` strips these in the service layer — sending them and
 * hiding them in the browser is a data leak, not a UI decision.
 */
export const SENSITIVE_FIELDS = [
  'panNumber',
  'aadhaarNumber',
  'bankAccountNumber',
  'ifsc',
  'annualCtc',
] as const;

export interface IEmployee extends BaseDocument {
  employeeCode: string;
  userId?: Types.ObjectId | null;

  fullName: string;
  workEmail: string;
  personalEmail?: string;
  mobile?: string;
  dateOfBirth?: Date | null;

  department?: Department | null;
  designation?: string;
  employmentType?: EmploymentType | null;
  dateOfJoining?: Date | null;
  dateOfExit?: Date | null;
  reportingManagerId?: Types.ObjectId | null;
  teamName?: string;
  workLocation?: string;
  status: EmployeeStatus;
  isProfileComplete?: boolean;

  // --- Sensitive. Never returned without employees.sensitive. ---
  panNumber?: string;
  aadhaarNumber?: string;
  bankAccountNumber?: string;
  ifsc?: string;
  /** Annual CTC in **integer paise**. ₹12,50,000.00 is stored as 125000000. */
  annualCtc?: number;

  emergencyContact?: {
    name?: string;
    relationship?: string;
    mobile?: string;
  };
  address?: string;
}

const employeeSchema = new Schema<IEmployee>({
  // Server-generated (see the service). Never accepted from the client.
  employeeCode: { type: String, required: true, unique: true, trim: true },

  // Optional link to a login account. An employee record can exist before the
  // person has credentials, and not everyone in the master needs to log in.
  userId: { type: Schema.Types.ObjectId, ref: 'User', default: null },

  fullName: { type: String, required: true, trim: true },
  workEmail: { type: String, required: true, unique: true, lowercase: true, trim: true },
  personalEmail: { type: String, lowercase: true, trim: true },
  mobile: { type: String, trim: true, default: '', index: true },
  dateOfBirth: { type: Date, default: null },

  department: { type: String, enum: [...DEPARTMENTS, null], default: null, index: true },
  designation: { type: String, trim: true, default: '' },
  employmentType: { type: String, enum: [...EMPLOYMENT_TYPES, null], default: null },
  dateOfJoining: { type: Date, default: null },
  dateOfExit: { type: Date, default: null },

  // Self-reference. D4 escalation and G4 leave approval both walk this chain,
  // so it has to be a real reference rather than a name string.
  reportingManagerId: { type: Schema.Types.ObjectId, ref: 'Employee', default: null, index: true },
  teamName: { type: String, trim: true, default: '' },

  workLocation: { type: String, trim: true, default: '' },
  status: { type: String, enum: EMPLOYEE_STATUSES, required: true, default: 'Active', index: true },
  isProfileComplete: { type: Boolean, default: false, index: true },

  panNumber: { type: String, uppercase: true, trim: true },
  aadhaarNumber: { type: String, trim: true },
  bankAccountNumber: { type: String, trim: true },
  ifsc: { type: String, uppercase: true, trim: true },
  annualCtc: { type: Number, min: 0 },

  emergencyContact: {
    name: { type: String, trim: true },
    relationship: { type: String, trim: true },
    mobile: { type: String, trim: true },
  },
  address: { type: String, trim: true },
});

// createdAt / updatedAt / createdBy / updatedBy / deletedAt
employeeSchema.plugin(basePlugin);

// Backs the list screen's text search.
employeeSchema.index({ fullName: 'text', workEmail: 'text', employeeCode: 'text' });

export const Employee =
  (mongoose.models.Employee as mongoose.Model<IEmployee>) ??
  mongoose.model<IEmployee>('Employee', employeeSchema);
