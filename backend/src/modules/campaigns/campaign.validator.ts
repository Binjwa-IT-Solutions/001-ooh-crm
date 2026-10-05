import { z } from "zod";
import { CampaignStatus } from "./campaign.model.js";

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
  quotationNo: z.string().trim().optional(),
  quotationName: z.string().trim().optional(),
  piNo: z.string().trim().optional(),
  state: z.string().trim().optional(),

  city: z
    .string()
    .trim()
    .min(1, "City is required")
    .max(100),

  startDate: z.coerce.date(),

  endDate: z.coerce.date(),

  siteIds: z
    .array(objectId)
    .optional()
    .default([]),

  contractedValue: z
    .number()
    .int()
    .nonnegative(),

  status: z.nativeEnum(CampaignStatus).optional(),

  assignedManager: objectId.optional(),
});

export const updateCampaignStatusSchema = z.object({
  status: z.nativeEnum(CampaignStatus),
  reason: z.string().trim().max(500).optional(),
});

export const campaignListQuerySchema = z.object({
  search: z.string().trim().optional(),
  leadId: objectId.optional(),

  status: z.nativeEnum(CampaignStatus).optional(),

  state: z
    .string()
    .trim()
    .optional(),

  city: z
    .string()
    .trim()
    .optional(),

  manager: z.string().trim().optional(),

  startDate: z.coerce.date().optional(),

  endDate: z.coerce.date().optional(),

  myCampaigns: z
    .preprocess((val) => {
      if (typeof val === "string") return val.toLowerCase() === "true";
      return Boolean(val);
    }, z.boolean())
    .optional(),

  agentId: objectId.optional(),

  tab: z
    .enum(["all", "live", "closed", "renewals"])
    .optional(),

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