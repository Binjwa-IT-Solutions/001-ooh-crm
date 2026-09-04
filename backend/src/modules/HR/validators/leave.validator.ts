import { z } from 'zod';
import mongoose from 'mongoose';

const objectIdValidator = z
  .string()
  .refine((val) => mongoose.Types.ObjectId.isValid(val), {
    message: 'Invalid ObjectId',
  });

export const leaveTypeSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  code: z.string().min(1, 'Code is required').toUpperCase(),
  annualQuota: z.number().min(0, 'Quota must be at least 0'),
  carryForward: z.boolean().optional(),
  maxCarryForward: z.number().min(0).optional(),
  encashable: z.boolean().optional(),
  requiresDocument: z.boolean().optional(),
  isActive: z.boolean().optional(),
});

export const leaveRequestSchema = z.object({
  leaveTypeId: objectIdValidator,
  fromDate: z.coerce.date(),
  toDate: z.coerce.date(),
  days: z.coerce.number().min(0.5, 'Minimum 0.5 days required'),
  reason: z.string().min(1, 'Reason is required'),
  documentUrl: z.string().optional(),
});

export const leaveApprovalSchema = z.object({
  status: z.enum(['Approved', 'Rejected']),
  rejectionReason: z.string().optional(),
}).refine((data) => {
  if (data.status === 'Rejected' && (!data.rejectionReason || data.rejectionReason.trim().length === 0)) {
    return false;
  }
  return true;
}, {
  message: 'Rejection reason is required when rejecting a leave',
  path: ['rejectionReason'],
});
