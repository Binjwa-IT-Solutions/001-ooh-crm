import { z } from 'zod';

import { ROLES } from '../rbac/permissions.js';

/**
 * Server-side validation. Client-side validation is for UX only —
 * every endpoint validates here, always.
 */

const email = z.string().trim().toLowerCase().email('Enter a valid email address');

const password = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(128, 'Password is too long');

const objectId = z
  .string()
  .trim()
  .regex(/^[0-9a-fA-F]{24}$/, 'Not a valid id');

export const registerSchema = z.object({
  name: z.string().trim().min(2, 'Name is required').max(120),
  email,
  password,
  role: z.enum(ROLES).optional(),
  status: z.enum(['Active', 'Inactive']).optional(),
  reportingManagerId: objectId.optional().nullable().or(z.literal('')),
});

export const listUsersSchema = z.object({
  search: z.string().optional(),
  role: z.enum(ROLES).optional(),
  status: z.enum(['Active', 'Inactive']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(10),
});

export const updateUserSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(120).optional(),
  role: z.enum(ROLES).optional(),
  status: z.enum(['Active', 'Inactive']).optional(),
  password: password.optional(),
  reportingManagerId: objectId.optional().nullable().or(z.literal('')),
});

export const userIdParamSchema = z.object({
  id: z.string().trim().min(1, 'User id is required'),
});

export const loginSchema = z.object({
  email,
  password: z.string().min(1, 'Password is required'),
});

export const verifyOtpSchema = z.object({
  challengeId: z.string().trim().min(1, 'Challenge id is required'),
  code: z
    .string()
    .trim()
    .regex(/^\d{4,8}$/, 'Enter the numeric code from your email'),
});

export const resendOtpSchema = z.object({
  challengeId: z.string().trim().min(1, 'Challenge id is required'),
});

export const refreshSchema = z.object({
  refreshToken: z.string().trim().min(1, 'Refresh token is required'),
});

export const logoutSchema = z.object({
  refreshToken: z.string().trim().min(1).optional(),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type ListUsersInput = z.infer<typeof listUsersSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type VerifyOtpInput = z.infer<typeof verifyOtpSchema>;

