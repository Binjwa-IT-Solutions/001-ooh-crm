import mongoose, { Schema } from 'mongoose';

import { basePlugin, BaseDocument } from '../db/basePlugin.js';
import { ROLES, type Role } from '../rbac/permissions.js';

export interface IUser extends BaseDocument {
  name: string;
  email: string;
  passwordHash: string;
  role: Role;
  status: 'Active' | 'Inactive';
  lastLoginAt?: Date | null;
  /** Access tokens issued before this instant are rejected (admin "sign out everywhere"). */
  sessionsRevokedAt?: Date | null;
  totpSecretEncrypted?: string;
  totpEnabledAt?: Date | null;
  totpLastUsedStep?: number;
  mfaEnrollmentIdHash?: string;
  mfaEnrollmentAttempts?: number;
  phone?: string;
  designation?: string;
  gender?: 'Male' | 'Female' | null;
}

const userSchema = new Schema<IUser>({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
    index: true,
  },
  passwordHash: {
    type: String,
    required: true,
    // Never ships in a query result unless explicitly selected.
    select: false,
  },
  role: {
    type: String,
    enum: ROLES,
    required: true,
    default: 'employee',
  },
  status: {
    type: String,
    enum: ['Active', 'Inactive'],
    required: true,
    default: 'Active',
  },
  lastLoginAt: {
    type: Date,
    default: null,
  },
  sessionsRevokedAt: {
    type: Date,
    default: null,
  },
  totpSecretEncrypted: {
    type: String,
    select: false,
  },
  totpEnabledAt: {
    type: Date,
    default: null,
  },
  totpLastUsedStep: {
    type: Number,
    default: -1,
    select: false,
  },
  mfaEnrollmentIdHash: {
    type: String,
    select: false,
  },
  mfaEnrollmentAttempts: {
    type: Number,
    default: 0,
    select: false,
  },
  phone: {
    type: String,
    trim: true,
    default: '',
  },
  designation: {
    type: String,
    trim: true,
    default: '',
  },
  gender: {
    type: String,
    enum: ['Male', 'Female', null],
    default: null,
  },
});

// createdAt / updatedAt / createdBy / updatedBy / deletedAt
userSchema.plugin(basePlugin);

export const AuthUser =
  (mongoose.models.User as mongoose.Model<IUser>) ?? mongoose.model<IUser>('User', userSchema);
