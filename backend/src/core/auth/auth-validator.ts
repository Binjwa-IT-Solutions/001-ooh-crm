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
  deviceId: z.string().uuid().optional(),
  location: z
    .object({
      latitude: z.number().finite().min(-90).max(90),
      longitude: z.number().finite().min(-180).max(180),
      // No upper bound: IP-based guesses can exceed 100 km. A vague fix must not block
      // sign-in — the risk check treats it as `location_accuracy_low`.
      accuracyMeters: z.number().finite().min(0),
    })
    .nullable()
    .optional(),
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

export const emailFallbackSchema = resendOtpSchema;

export const completeMfaEnrollmentSchema = z.object({
  enrollmentToken: z.string().trim().min(1, 'Enrollment challenge is required'),
  code: z
    .string()
    .trim()
    .regex(/^\d{6}$/, 'Enter the 6-digit code from your authenticator app'),
});

const adminReauthenticationSchema = z.object({
  email,
  password,
  totpCode: z
    .string()
    .trim()
    .regex(/^\d{6}$/, 'Enter the 6-digit authenticator code'),
});

export const resetUserMfaSchema = z.object({
  password,
  totpCode: z
    .string()
    .trim()
    .regex(/^\d{6}$/, 'Enter the 6-digit authenticator code'),
  reason: z.string().trim().min(10, 'Provide a reason of at least 10 characters').max(500),
  secondAdmin: adminReauthenticationSchema.optional(),
});

export const loginApprovalDecisionSchema = z.object({
  decision: z.enum(['approve', 'deny']),
  totpCode: z
    .string()
    .trim()
    .regex(/^\d{6}$/, 'Enter the 6-digit authenticator code'),
  note: z.string().trim().min(10, 'Provide a reason of at least 10 characters').max(500),
});

export const loginApprovalPollSchema = z.object({
  pollToken: z
    .string()
    .trim()
    .regex(/^[0-9a-f]{64}$/, 'Invalid approval polling token'),
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
