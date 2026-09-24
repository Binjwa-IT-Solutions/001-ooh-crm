import { z } from 'zod';
import mongoose from 'mongoose';

export const objectIdValidator = z
  .string()
  .refine((val) => mongoose.Types.ObjectId.isValid(val), {
    message: 'Invalid ObjectId',
  });

// ---------------------------------------------------------------------------
// Param schemas
// ---------------------------------------------------------------------------

export const leaveTypeIdSchema = z.object({
  id: objectIdValidator,
});

export const leaveRequestIdSchema = z.object({
  id: objectIdValidator,
});

export const employeeIdParamSchema = z.object({
  id: objectIdValidator,
});

// ---------------------------------------------------------------------------
// Leave Type CRUD
// ---------------------------------------------------------------------------

export const createLeaveTypeSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(100),
  code: z.string().trim().min(1, 'Code is required').max(10).toUpperCase(),
  annualQuota: z.number().int().min(0, 'Quota must be at least 0').nullable(),
  carryForward: z.boolean().default(false),
  maxCarryForward: z.number().int().min(0).default(0),
  encashable: z.boolean().default(false),
  requiresDocument: z.boolean().default(false),
  status: z.enum(['Active', 'Inactive']).default('Active'),
});

export type CreateLeaveTypeInput = z.infer<typeof createLeaveTypeSchema>;

export const updateLeaveTypeSchema = createLeaveTypeSchema.partial().extend({
  status: z.enum(['Active', 'Inactive']).optional(),
});

export type UpdateLeaveTypeInput = z.infer<typeof updateLeaveTypeSchema>;

export const listLeaveTypesSchema = z.object({
  status: z.enum(['Active', 'Inactive']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

export type ListLeaveTypesQuery = z.infer<typeof listLeaveTypesSchema>;

// Backwards compatibility alias
export const leaveTypeSchema = createLeaveTypeSchema;

// ---------------------------------------------------------------------------
// Balance Allocation & Query
// ---------------------------------------------------------------------------

export const allocateBalanceSchema = z.object({
  employeeId: objectIdValidator,
  leaveTypeId: objectIdValidator,
  year: z.number().int().min(2000).max(2100),
  proratedDays: z.number().min(0).optional(),
});

export type AllocateBalanceInput = z.infer<typeof allocateBalanceSchema>;

export const getBalanceQuerySchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100),
});

export type GetBalanceQuery = z.infer<typeof getBalanceQuerySchema>;

// ---------------------------------------------------------------------------
// Leave Request CRUD
// ---------------------------------------------------------------------------

export const createLeaveRequestSchema = z.object({
  employeeId: objectIdValidator.optional(),
  leaveTypeId: objectIdValidator,
  fromDate: z.coerce.date(),
  toDate: z.coerce.date(),
  days: z.coerce.number().min(0.5, 'Minimum 0.5 days required'),
  reason: z.string().trim().min(1, 'Reason is required').max(1000),
  documentUrl: z.string().optional(),
});

export type CreateLeaveRequestInput = z.infer<typeof createLeaveRequestSchema>;

// Backwards compatibility alias
export const leaveRequestSchema = createLeaveRequestSchema;

export const updateLeaveRequestSchema = z.object({
  leaveTypeId: objectIdValidator.optional(),
  fromDate: z.coerce.date().optional(),
  toDate: z.coerce.date().optional(),
  days: z.coerce.number().min(0.5).optional(),
  reason: z.string().trim().min(1).max(1000).optional(),
  documentUrl: z.string().optional(),
});

export type UpdateLeaveRequestInput = z.infer<typeof updateLeaveRequestSchema>;

export const listLeaveRequestsSchema = z.object({
  status: z.enum(['Pending', 'Approved', 'Rejected', 'Cancelled']).optional(),
  employeeId: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

export type ListLeaveRequestsQuery = z.infer<typeof listLeaveRequestsSchema>;

// ---------------------------------------------------------------------------
// Leave Approval / Rejection
// ---------------------------------------------------------------------------

export const leaveApprovalSchema = z.object({
  status: z.enum(['Approved', 'Rejected']).optional().default('Approved'),
  rejectionReason: z.string().optional(),
});

export type LeaveApprovalInput = z.infer<typeof leaveApprovalSchema>;

export const rejectLeaveRequestSchema = z.object({
  status: z.enum(['Approved', 'Rejected']).optional().default('Rejected'),
  rejectionReason: z.string().trim().min(1, 'Rejection reason is required').max(1000),
});

export type RejectLeaveRequestInput = z.infer<typeof rejectLeaveRequestSchema>;

// Backwards compatibility alias
export const leaveRejectionSchema = rejectLeaveRequestSchema;
