import { z } from 'zod';

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid id');

export const quotationLineSchema = z.object({
  siteId: objectId,
  description: z.string().trim().optional(),
  ratePerDay: z.coerce.number().min(0, 'Rate per day is required'), // rupees from client; server converts to paise
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
});

export const createQuotationSchema = z.object({
  leadId: objectId,
  clientName: z.string().trim().min(1).optional(),
  clientEmail: z.string().trim().email('Invalid email').optional().or(z.literal('')),
  clientPhone: z.string().trim().optional().or(z.literal('')),
  validUntil: z.coerce.date().optional(),
  sites: z.array(quotationLineSchema).min(1, 'At least one site is required'),
});

export const updateQuotationSchema = createQuotationSchema.partial();

export const listQuotationsSchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(25),
  search: z.string().trim().optional(),
  status: z.string().trim().optional(),
  leadId: objectId.optional(),
  createdBy: objectId.optional(),
  agentId: objectId.optional(),
});

export const sendQuotationSchema = z.object({
  sentTo: z.string().trim().email('Enter a valid recipient email'),
  message: z.string().trim().optional(),
});

export const rejectQuotationSchema = z.object({
  rejectionReason: z
    .string()
    .trim()
    .min(10, 'Rejection reason must be at least 10 characters long'),
});

export type CreateQuotationInput = z.infer<typeof createQuotationSchema>;
export type UpdateQuotationInput = z.infer<typeof updateQuotationSchema>;
export type ListQuotationsQuery = z.infer<typeof listQuotationsSchema>;
export type SendQuotationInput = z.infer<typeof sendQuotationSchema>;
export type RejectQuotationInput = z.infer<typeof rejectQuotationSchema>;
