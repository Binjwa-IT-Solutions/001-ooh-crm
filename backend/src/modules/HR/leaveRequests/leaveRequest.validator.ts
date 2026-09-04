import { z } from 'zod';


export const leaveRequestIdSchema = z.object({
  id: z.string().min(1),
});


export const createLeaveRequestSchema = z.object({
  employeeId: z.string().min(1),
  leaveTypeId: z.string().min(1),

  fromDate: z.coerce.date(),
  toDate: z.coerce.date(),

  days: z.number().int().min(1),

  reason: z.string().trim().min(1).max(1000),

  documentUrl: z.string().optional(),
});

export type CreateLeaveRequestInput = z.infer<
  typeof createLeaveRequestSchema
>;


export const listLeaveRequestsSchema = z.object({
  status: z
    .enum(['Pending', 'Approved', 'Rejected', 'Cancelled'])
    .optional(),

  employeeId: z.string().optional(),

  page: z.coerce.number().int().min(1).default(1),

  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

export type ListLeaveRequestsQuery = z.infer<
  typeof listLeaveRequestsSchema
>;


export const rejectLeaveRequestSchema = z.object({
  rejectionReason: z.string().trim().min(1).max(1000),
});

export type RejectLeaveRequestInput = z.infer<
  typeof rejectLeaveRequestSchema
>;