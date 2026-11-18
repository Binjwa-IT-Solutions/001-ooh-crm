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

const halfDays = (label: string) =>
  z
    .number()
    .min(0, `${label} can't be negative`)
    .max(366)
    .refine((n) => Number.isInteger(n * 2), `${label} must be in whole or half days`);

const leaveTypeFields = {
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(100),
  /** Optional — generated from the name when left out. */
  code: z.string().trim().min(1).max(10).toUpperCase().optional(),
  /** Monthly: days credited every month · Yearly: days for the year · Unlimited: no limit */
  quotaPeriod: z.enum(['Monthly', 'Yearly', 'Unlimited']),
  quotaDays: halfDays('Days'),
  carryForward: z.boolean().default(false),
  /** 0 = no limit */
  maxCarryForward: z.number().int().min(0).default(0),
  /** Carried days must be used within N months of the new year (null = whole year). */
  carryForwardExpiryMonths: z.number().int().min(1).max(12).nullable().default(null),
  encashable: z.boolean().default(false),
  requiresDocument: z.boolean().default(false),
  status: z.enum(['Active', 'Inactive']).default('Active'),
  /** Derived on save from quotaPeriod/quotaDays; accepted for older clients. */
  annualQuota: z.number().int().min(0).nullable().optional(),
};

/** Accepts the older `annualQuota` shape too (number = yearly, null = unlimited). */
function fromLegacy(input: unknown): unknown {
  if (input && typeof input === 'object' && !('quotaPeriod' in input) && 'annualQuota' in input) {
    const { annualQuota } = input as { annualQuota: number | null };
    return annualQuota == null
      ? { ...input, quotaPeriod: 'Unlimited', quotaDays: 0 }
      : { ...input, quotaPeriod: 'Yearly', quotaDays: annualQuota };
  }
  return input;
}

const quotaRule = (v: { quotaPeriod?: string; quotaDays?: number }) =>
  v.quotaPeriod === 'Unlimited' || v.quotaPeriod === undefined || (v.quotaDays ?? 0) > 0;
const quotaMessage = { message: 'Enter how many days this leave gives', path: ['quotaDays'] };

export const createLeaveTypeSchema = z.preprocess(
  fromLegacy,
  z.object(leaveTypeFields).refine(quotaRule, quotaMessage)
);

export type CreateLeaveTypeInput = z.infer<typeof createLeaveTypeSchema>;

export const updateLeaveTypeSchema = z.preprocess(
  fromLegacy,
  z
    .object({
      name: leaveTypeFields.name.optional(),
      code: leaveTypeFields.code,
      quotaPeriod: leaveTypeFields.quotaPeriod.optional(),
      quotaDays: halfDays('Days').optional(),
      carryForward: z.boolean().optional(),
      maxCarryForward: z.number().int().min(0).optional(),
      carryForwardExpiryMonths: z.number().int().min(1).max(12).nullable().optional(),
      encashable: z.boolean().optional(),
      requiresDocument: z.boolean().optional(),
      status: z.enum(['Active', 'Inactive']).optional(),
    })
    .refine(quotaRule, quotaMessage)
);

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

/** Same as above, but the year defaults to the current one. */
export const summaryQuerySchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100).default(() => new Date().getFullYear()),
});

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
