import { z } from "zod";

const objectIdSchema = z
  .string()
  .min(1, "ID is required")
  .refine(
    (value) => /^[0-9a-fA-F]{24}$/.test(value),
    "Invalid ID",
  );

const lineItemSchema = z.object({
  siteId: objectIdSchema.optional(),
  city: z.string().trim().optional(),
  spaceType: z.string().trim().optional(),
  from: z
    .string()
    .optional()
    .refine(
      (value) => !value || !Number.isNaN(Date.parse(value)),
      "Invalid from date",
    ),
  to: z
    .string()
    .optional()
    .refine(
      (value) => !value || !Number.isNaN(Date.parse(value)),
      "Invalid to date",
    ),
  negotiatedRatePerDay: z
    .number()
    .min(0, "Rate cannot be negative")
    .optional(),
  days: z.number().min(1).optional(),
  amount: z.number().min(0).optional(),
});

export const createPurchaseOrderSchema = z.object({
  pricingId: z.string().trim().optional(),
  vendorId: objectIdSchema,
  campaignId: objectIdSchema.optional().nullable(),

  city: z.string().trim().optional(),
  spaceType: z.string().trim().optional(),

  cardRate: z.number().min(0).optional(),
  negotiatedRate: z.number().min(0).optional(),
  discountGiven: z.number().optional(),
  discountPercent: z.number().optional(),

  companyCostPrice: z.number().min(0).optional(),
  companySellingPrice: z.number().min(0).optional(),
  profitPerUnit: z.number().optional(),
  profitMarginPercent: z.number().optional(),

  durationDays: z.number().min(1).optional(),
  validityFrom: z.string().optional(),
  validityTo: z.string().optional(),

  negotiationRounds: z.number().min(1).optional(),
  negotiationNotes: z.string().trim().optional(),
  approvedBy: z.string().trim().optional(),

  totalAmount: z.number().min(0).optional(),
  lineItems: z.array(lineItemSchema).optional(),
});

export const updatePurchaseOrderSchema = z.object({
  pricingId: z.string().trim().optional(),
  vendorId: objectIdSchema.optional(),
  campaignId: objectIdSchema.optional().nullable(),

  city: z.string().trim().optional(),
  spaceType: z.string().trim().optional(),

  cardRate: z.number().min(0).optional(),
  negotiatedRate: z.number().min(0).optional(),
  discountGiven: z.number().optional(),
  discountPercent: z.number().optional(),

  companyCostPrice: z.number().min(0).optional(),
  companySellingPrice: z.number().min(0).optional(),
  profitPerUnit: z.number().optional(),
  profitMarginPercent: z.number().optional(),

  durationDays: z.number().min(1).optional(),
  validityFrom: z.string().optional(),
  validityTo: z.string().optional(),

  negotiationRounds: z.number().min(1).optional(),
  negotiationNotes: z.string().trim().optional(),
  approvedBy: z.string().trim().optional(),

  totalAmount: z.number().min(0).optional(),
  status: z
    .enum(["Draft", "Issued", "Accepted", "Cancelled"])
    .optional(),
  lineItems: z.array(lineItemSchema).optional(),
});

export const purchaseOrderListQuerySchema = z.object({
  search: z.string().trim().optional(),
  status: z
    .enum(["Draft", "Issued", "Accepted", "Cancelled"])
    .optional(),
  campaignId: z.string().trim().optional(),
  vendorId: z.string().trim().optional(),
  city: z.string().trim().optional(),
});

export type CreatePurchaseOrderInput =
  z.infer<typeof createPurchaseOrderSchema>;

export type UpdatePurchaseOrderInput =
  z.infer<typeof updatePurchaseOrderSchema>;

export type PurchaseOrderListQuery =
  z.infer<typeof purchaseOrderListQuerySchema>;