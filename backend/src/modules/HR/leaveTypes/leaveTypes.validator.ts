
import { z } from 'zod';
 
/**
 * TRACK G — G3 · Leave Types, Quotas & Balances — input validation.
 *
 * Client-side validation is for UX only. Every value here is re-checked
 * server-side before it reaches the service layer — never trust the client.
 */
 
// ---------------------------------------------------------------------------
// Param schemas
// ---------------------------------------------------------------------------
 
export const leaveTypeIdSchema = z.object({
  id: z.string().min(1),
});
 
export const employeeIdParamSchema = z.object({
  id: z.string().min(1),
});
 
// ---------------------------------------------------------------------------
// Leave type CRUD
// ---------------------------------------------------------------------------
 
export const createLeaveTypeSchema = z.object({
  name: z.string().trim().min(2).max(100),
  code: z.string().trim().min(1).max(10),
  annualQuota: z.number().int().min(0).nullable(),
  carryForward: z.boolean().default(false),
  maxCarryForward: z.number().int().min(0).default(0),
  encashable: z.boolean().default(false),
  requiresDocument: z.boolean().default(false),
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
 
// ---------------------------------------------------------------------------
// Balance allocation
// ---------------------------------------------------------------------------
 
export const allocateBalanceSchema = z.object({
  employeeId: z.string().min(1),
  leaveTypeId: z.string().min(1),
  year: z.number().int().min(2000).max(2100),
  // Optional — when omitted, the service falls back to the leave type's
  // full annualQuota. Provide this only when pro-rating a mid-year joiner.
  proratedDays: z.number().min(0).optional(),
});
 
export type AllocateBalanceInput = z.infer<typeof allocateBalanceSchema>;
 
export const getBalanceQuerySchema = z.object({
  year: z.coerce.number().int().min(2000).max(2100),
});
 
export type GetBalanceQuery = z.infer<typeof getBalanceQuerySchema>;
 