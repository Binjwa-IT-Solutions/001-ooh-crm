import { z } from "zod";

const objectId = z
  .string()
  .regex(/^[0-9a-fA-F]{24}$/, "Invalid ObjectId");

export const createCampaignSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Campaign name is required")
    .max(200),

  leadId: objectId,

  quotationId: objectId.optional(),

  city: z
    .string()
    .trim()
    .min(1, "City is required")
    .max(100),

  startDate: z.coerce.date(),

  endDate: z.coerce.date(),

  siteIds: z
    .array(objectId)
    .min(1, "At least one site is required"),

  contractedValue: z
    .number()
    .int()
    .nonnegative(),

  assignedManager: objectId.optional(),
});

export const updateCampaignStatusSchema = z.object({
  status: z.enum([
    "Draft",
    "Approved",
    "InProgress",
    "Completed",
    "Cancelled",
  ]),
});

export const campaignListQuerySchema = z.object({
  search: z.string().trim().optional(),

  status: z
    .enum([
      "Draft",
      "Approved",
      "InProgress",
      "Completed",
      "Cancelled",
    ])
    .optional(),

  city: z
    .string()
    .trim()
    .optional(),

  manager: z.string().trim().optional(),

  startDate: z.coerce.date().optional(),

  endDate: z.coerce.date().optional(),

  page: z.coerce
    .number()
    .int()
    .positive()
    .default(1),

  limit: z.coerce
    .number()
    .int()
    .positive()
    .max(100)
    .default(20),
});

export const updateCampaignSchema = createCampaignSchema.partial();