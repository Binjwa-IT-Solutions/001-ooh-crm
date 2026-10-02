import { z } from "zod";

const id = z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid ID");

const lineItem = z.object({
  siteId: id.optional(),
  city: z.string().trim().optional(),
  spaceType: z.string().trim().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  ratePerDay: z.number().min(0).optional(),
  days: z.number().min(1).optional(),
  amount: z.number().min(0).optional(),
  item: z.string().trim().optional(),
  service: z.string().trim().optional(),
  description: z.string().trim().optional(),
  hsn: z.string().trim().optional(),
  qty: z.number().min(0).optional(),
  unit: z.string().trim().optional(),
  rate: z.number().min(0).optional(),
  discount: z.number().min(0).optional(),
  tax: z.number().min(0).optional(),
});

const bankDetailsSchema = z.object({
  bankName: z.string().trim().optional(),
  personName: z.string().trim().optional(),
  accountNumber: z.string().trim().optional(),
  ifsc: z.string().trim().optional(),
  branch: z.string().trim().optional(),
}).optional().nullable();

export const createPurchaseOrderSchema = z.object({
  poNumber: z.string().trim().optional(),
  vendorId: id.optional().nullable(),
  vendorName: z.string().trim().optional(),
  campaignId: id.nullable().optional(),
  campaignName: z.string().trim().optional(),

  pricingId: z.string().trim().optional(),
  city: z.string().trim().optional(),
  spaceType: z.string().trim().optional(),

  cardRate: z.number().min(0).optional(),
  negotiatedRate: z.number().min(0).optional(),

  durationDays: z.number().min(1).optional(),
  validityFrom: z.string().optional(),
  validityTo: z.string().optional(),

  poDate: z.string().optional(),
  placeOfSupply: z.string().trim().optional(),
  vendorAddress: z.string().trim().optional(),
  vendorGstin: z.string().trim().optional(),
  subtotal: z.number().min(0).optional(),
  gstRate: z.number().min(0).optional(),
  gstAmount: z.number().min(0).optional(),
  companyName: z.string().trim().optional(),
  companyAddress: z.string().trim().optional(),
  companyGstin: z.string().trim().optional(),
  companyEmail: z.string().trim().optional(),
  companyPhone: z.string().trim().optional(),
  notes: z.string().trim().optional(),
  termsAndConditions: z.array(z.string()).optional(),
  bankDetails: bankDetailsSchema,

  paymentTerms: z.string().trim().optional(),
  dueDate: z.string().optional(),
  paymentMethod: z.string().trim().optional(),
  gstApplicable: z.boolean().optional(),
  accountsStatus: z.string().trim().optional(),
  accountsComments: z.string().trim().optional(),

  lineItems: z.array(lineItem).optional(),
  totalAmount: z.number().min(0).optional(),
  status: z.enum(["Draft", "Issued", "Accepted", "Cancelled"]).optional(),
});

export const updatePurchaseOrderSchema =
  createPurchaseOrderSchema.partial().extend({
    status: z
      .enum(["Draft", "Issued", "Accepted", "Cancelled"])
      .optional(),
  });

export const documentSchema = z.object({
  signatureUrl: z.string().url().optional(),
  documentUrl: z.string().url().optional(),
  pdfKey: z.string().optional(),
});

export const paymentSchema = z.object({
  invoiceNumber: z.string().trim().optional(),
  invoiceDate: z.string().optional(),
  paidAmount: z.number().min(0).optional(),
  paymentDate: z.string().optional(),
  paymentTerms: z.string().trim().optional(),
  dueDate: z.string().optional(),
  paymentMethod: z.string().trim().optional(),
  gstApplicable: z.boolean().optional(),
  accountsStatus: z.string().trim().optional(),
  accountsComments: z.string().trim().optional(),
});

export const purchaseOrderListQuerySchema = z.object({
  search: z.string().trim().optional(),
  status: z
    .enum(["Draft", "Issued", "Accepted", "Cancelled"])
    .optional(),
  campaignId: z.string().optional(),
  vendorId: z.string().optional(),
  city: z.string().optional(),
});

export type CreatePurchaseOrderInput =
  z.infer<typeof createPurchaseOrderSchema>;

export type UpdatePurchaseOrderInput =
  z.infer<typeof updatePurchaseOrderSchema>;

export type PurchaseOrderListQuery =
  z.infer<typeof purchaseOrderListQuerySchema>;

export type DocumentInput = z.infer<typeof documentSchema>;
export type PaymentInput = z.infer<typeof paymentSchema>;