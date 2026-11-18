import { z } from 'zod';
import { PAYMENT_IN_METHODS } from '../models/paymentIn.model.js';
import { PAYMENT_OUT_CATEGORIES, PAYMENT_OUT_METHODS } from '../models/paymentOut.model.js';

const objectIdRegex = /^[0-9a-fA-F]{24}$/;
const objectIdSchema = z
  .string()
  .trim()
  .refine((val) => objectIdRegex.test(val), {
    message: 'Invalid ObjectId',
  });

const optionalObjectIdSchema = z
  .string()
  .trim()
  .optional()
  .nullable()
  .transform((val) => (val && objectIdRegex.test(val) ? val : null));

/**
 * Coerces date string or Date object into a valid Date.
 */
const dateCoerceSchema = z.union([z.string(), z.date()]).transform((val) => {
  const d = new Date(val);
  if (isNaN(d.getTime())) {
    throw new Error('Invalid date');
  }
  return d;
});

// ============================================================================
// PaymentIn Validators
// ============================================================================

export const createPaymentInSchema = z.object({
  campaignId: objectIdSchema,
  clientId: optionalObjectIdSchema,
  /** Expecting amount in integer paise (e.g. 5000000) or number > 0 */
  amount: z.coerce.number().int().positive({ message: 'Amount must be a positive number' }),
  receivedAt: dateCoerceSchema,
  method: z.enum(PAYMENT_IN_METHODS, {
    errorMap: () => ({ message: 'Invalid payment method' }),
  }),
  transactionId: z.string().trim().optional(),
  notes: z.string().trim().optional(),
  attachments: z.array(z.string().trim()).optional().default([]),
});

export type CreatePaymentInInput = z.input<typeof createPaymentInSchema>;

export const updatePaymentInSchema = z.object({
  amount: z.coerce.number().int().positive().optional(),
  receivedAt: dateCoerceSchema.optional(),
  method: z.enum(PAYMENT_IN_METHODS).optional(),
  transactionId: z.string().trim().optional(),
  notes: z.string().trim().optional(),
  attachments: z.array(z.string().trim()).optional(),
});

export type UpdatePaymentInInput = z.input<typeof updatePaymentInSchema>;

export const listPaymentsInQuerySchema = z.object({
  campaignId: z.string().trim().optional(),
  clientId: z.string().trim().optional(),
  fromDate: z.string().trim().optional(),
  toDate: z.string().trim().optional(),
  method: z.enum(PAYMENT_IN_METHODS).optional(),
  reconciled: z
    .union([z.boolean(), z.enum(['true', 'false'])])
    .optional()
    .transform((v) => (v === undefined ? undefined : typeof v === 'boolean' ? v : v === 'true')),
  search: z.string().trim().optional(),
  page: z.coerce.number().int().positive().optional().default(1),
  pageSize: z.coerce.number().int().positive().max(100).optional().default(20),
});

export type ListPaymentsInQuery = z.infer<typeof listPaymentsInQuerySchema>;

// ============================================================================
// PaymentOut Validators
// ============================================================================

export const createPaymentOutSchema = z.object({
  campaignId: objectIdSchema,
  vendorId: objectIdSchema,
  poId: optionalObjectIdSchema,
  amount: z.coerce.number().int().positive({ message: 'Amount must be a positive number' }),
  paidAt: dateCoerceSchema,
  method: z.enum(PAYMENT_OUT_METHODS, {
    errorMap: () => ({ message: 'Invalid payment method' }),
  }),
  category: z.enum(PAYMENT_OUT_CATEGORIES, {
    errorMap: () => ({ message: 'Invalid expense category' }),
  }),
  vendorInvoice: z.string().trim().optional(),
  transactionId: z.string().trim().optional(),
  notes: z.string().trim().optional(),
  attachments: z.array(z.string().trim()).optional().default([]),
});

export type CreatePaymentOutInput = z.input<typeof createPaymentOutSchema>;

export const updatePaymentOutSchema = z.object({
  amount: z.coerce.number().int().positive().optional(),
  paidAt: dateCoerceSchema.optional(),
  method: z.enum(PAYMENT_OUT_METHODS).optional(),
  category: z.enum(PAYMENT_OUT_CATEGORIES).optional(),
  vendorInvoice: z.string().trim().optional(),
  transactionId: z.string().trim().optional(),
  notes: z.string().trim().optional(),
  attachments: z.array(z.string().trim()).optional(),
});

export type UpdatePaymentOutInput = z.input<typeof updatePaymentOutSchema>;

export const listPaymentsOutQuerySchema = z.object({
  campaignId: z.string().trim().optional(),
  vendorId: z.string().trim().optional(),
  category: z.enum(PAYMENT_OUT_CATEGORIES).optional(),
  fromDate: z.string().trim().optional(),
  toDate: z.string().trim().optional(),
  method: z.enum(PAYMENT_OUT_METHODS).optional(),
  reconciled: z
    .union([z.boolean(), z.enum(['true', 'false'])])
    .optional()
    .transform((v) => (v === undefined ? undefined : typeof v === 'boolean' ? v : v === 'true')),
  search: z.string().trim().optional(),
  page: z.coerce.number().int().positive().optional().default(1),
  pageSize: z.coerce.number().int().positive().max(100).optional().default(20),
});

export type ListPaymentsOutQuery = z.infer<typeof listPaymentsOutQuerySchema>;

// ============================================================================
// Report & Dashboard Query Validators
// ============================================================================

export const profitLeaderboardQuerySchema = z.object({
  limit: z.coerce.number().int().positive().max(100).optional().default(10),
  sortBy: z.enum(['profit', 'margin']).optional().default('profit'),
});

export const lowMarginQuerySchema = z.object({
  threshold: z.coerce.number().optional().default(10),
});

export const revenueByAgentQuerySchema = z.object({
  fromDate: z.string().trim().optional(),
  toDate: z.string().trim().optional(),
});

export const profitTrendsQuerySchema = z.object({
  campaignId: z.string().trim().optional(),
  days: z.coerce.number().int().positive().optional().default(30),
});

export const expenseBreakdownQuerySchema = z.object({
  campaignId: z.string().trim().optional(),
});
