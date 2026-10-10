import { z } from 'zod';
import { INVOICE_TYPES, INVOICE_STATUSES } from '../models/invoice.model.js';
import { PAYMENT_IN_METHODS } from '../models/paymentIn.model.js';

export const invoiceItemInputSchema = z.object({
  name: z.string().min(1, 'Item name is required'),
  description: z.string().optional().default(''),
  hsn: z.string().optional().default('998361'),
  quantity: z.number().min(0.001, 'Quantity must be greater than 0').default(1),
  unit: z.string().optional().default('Nos'),
  discount: z.number().min(0).optional().default(0), // in paise
  rate: z.number().min(0, 'Rate must be non-negative'), // in paise
  taxPercent: z.number().min(0).max(100).default(18),
});

export const bankDetailsInputSchema = z.object({
  bankName: z.string().optional(),
  accountNumber: z.string().optional(),
  ifsc: z.string().optional(),
  branch: z.string().optional(),
  accountHolderName: z.string().optional(),
});

export const createInvoiceSchema = z.object({
  type: z.enum(INVOICE_TYPES).default('sales_invoice'),
  invoicePrefix: z.string().optional(),
  invoiceNumber: z.string().optional(),
  partyId: z.string().optional().nullable(),
  partyName: z.string().min(1, 'Party name is required'),
  billingAddress: z.string().optional().default(''),
  shippingAddress: z.string().optional().default(''),
  gstin: z.string().optional().default(''),
  placeOfSupply: z.string().optional().default('Maharashtra (27)'),
  contactPerson: z.string().optional().default(''),
  contactMobile: z.string().optional().default(''),
  contactEmail: z.string().optional().default(''),
  campaignId: z.string().optional().nullable(),
  invoiceDate: z.string().or(z.date()),
  dueDate: z.string().or(z.date()),
  items: z.array(invoiceItemInputSchema).min(1, 'At least one item is required'),
  discount: z.number().min(0).optional().default(0), // in paise
  additionalCharges: z.number().min(0).optional().default(0), // in paise
  tcs: z.number().min(0).optional().default(0), // in paise
  roundOff: z.number().optional().default(0), // in paise
  bankDetails: bankDetailsInputSchema.optional(),
  termsAndConditions: z.string().optional(),
  notes: z.string().optional(),
  status: z.enum(INVOICE_STATUSES).optional().default('Draft'),
});

export const updateInvoiceSchema = createInvoiceSchema.partial().extend({
  editNote: z.string().optional(),
});

export const listInvoicesQuerySchema = z.object({
  type: z.enum(INVOICE_TYPES).optional(),
  status: z.string().optional(),
  partyId: z.string().optional(),
  campaignId: z.string().optional(),
  search: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  page: z.coerce.number().min(1).default(1),
  pageSize: z.coerce.number().min(1).max(100).default(20),
});

export const recordInvoicePaymentSchema = z.object({
  amount: z.number().min(1, 'Amount must be greater than 0'), // in paise
  receivedAt: z.string().or(z.date()),
  method: z.enum(PAYMENT_IN_METHODS),
  transactionId: z.string().optional(),
  notes: z.string().optional(),
  attachments: z.array(z.string()).optional().default([]),
});

export type CreateInvoiceInput = z.input<typeof createInvoiceSchema>;
export type UpdateInvoiceInput = z.input<typeof updateInvoiceSchema>;
export type ListInvoicesQuery = z.input<typeof listInvoicesQuerySchema>;
export type RecordInvoicePaymentInput = z.input<typeof recordInvoicePaymentSchema>;
