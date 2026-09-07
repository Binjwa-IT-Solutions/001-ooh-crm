import { z } from "zod";

const objectIdSchema = z
  .string()
  .min(1, "ID is required")
  .refine(
    (value) => /^[0-9a-fA-F]{24}$/.test(value),
    "Invalid ID",
  );

const lineItemSchema = z.object({
  siteId: objectIdSchema,

  from: z
    .string()
    .min(1, "From date is required")
    .refine(
      (value) => !Number.isNaN(Date.parse(value)),
      "Invalid from date",
    ),

  to: z
    .string()
    .min(1, "To date is required")
    .refine(
      (value) => !Number.isNaN(Date.parse(value)),
      "Invalid to date",
    ),

  negotiatedRatePerDay: z
    .number()
    .int()
    .min(0, "Rate cannot be negative"),
});

export const createPurchaseOrderSchema = z.object({
  campaignId: objectIdSchema,

  vendorId: objectIdSchema,

  lineItems: z
    .array(lineItemSchema)
    .min(
      1,
      "At least one site is required",
    ),
});

export const updatePurchaseOrderSchema = z.object({
  vendorId: objectIdSchema.optional(),

  lineItems: z
    .array(lineItemSchema)
    .min(
      1,
      "At least one site is required",
    )
    .optional(),
});

export const purchaseOrderListQuerySchema = z.object({
  search: z.string().trim().optional(),
  status: z
    .enum(["Draft", "Issued", "Accepted", "Cancelled"])
    .optional(),
  campaignId: z.string().trim().optional(),
  vendorId: z.string().trim().optional(),
});

export type CreatePurchaseOrderInput =
  z.infer<typeof createPurchaseOrderSchema>;

export type UpdatePurchaseOrderInput =
  z.infer<typeof updatePurchaseOrderSchema>;

export type PurchaseOrderListQuery =
  z.infer<typeof purchaseOrderListQuerySchema>;