import { z } from 'zod';
import {
  LEAD_SOURCES,
  LEAD_STATUSES,
  LOCATION_PREFERENCES,
  FOLLOW_UP_TYPES,
} from './leads.model.js';

export const objectIdSchema = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid object ID');

export const STATUS_TRANSITIONS: Record<string, string[]> = {
  New: ['Contacted', 'Lost'],
  Contacted: ['Interested', 'Lost'],
  Interested: ['Qualified', 'Lost'],
  Qualified: ['Proposal Sent', 'Negotiation', 'Lost'],
  'Proposal Sent': ['Negotiation', 'Won', 'Lost'],
  Negotiation: ['Won', 'Lost'],
  Won: [],
  Lost: [],
  Duplicate: [],
  duplicate: [],
};

export const leadQualificationSchema = z.object({
  city: z.string().trim().optional(),
  locationPreference: z.enum(LOCATION_PREFERENCES).optional(),
  campaignDuration: z.string().trim().optional(),
  // User enters budget in Rupees -> convert to integer Paise
  budget: z.coerce
    .number()
    .min(0)
    .optional()
    .transform((val) => (val !== undefined && !Number.isNaN(val) ? Math.round(val * 100) : undefined)),
  targetAudience: z.string().trim().optional(),
  campaignObjective: z.string().trim().optional(),
  creativeRequirements: z.string().trim().optional(),
  notes: z.string().trim().optional(),
  lostReason: z.string().trim().optional(),
});

export const logFollowUpSchema = z.object({
  followUpType: z.enum(FOLLOW_UP_TYPES).default('Call'),
  reason: z.string().trim().optional(),
  remarks: z.string().trim().optional(),
  note: z.string().trim().optional(),
  nextActionDate: z.coerce.date().optional(),
  delayResponsibility: z.string().trim().optional(),
  durationSec: z.coerce.number().min(0).optional(),
});

export const managerApprovalSchema = z.object({
  approved: z.boolean().default(true),
  remarks: z.string().trim().optional(),
});

export const createLeadSchema = z.object({
  companyName: z.string().trim().min(1, 'Company Name is required'),
  contactPerson: z.string().trim().min(1, 'Contact Person is required'),
  mobile: z.string().trim().min(1, 'Mobile is required'),
  email: z.string().trim().email('Invalid email').optional().or(z.literal('')),
  city: z.string().trim().optional().default(''),
  source: z.enum(LEAD_SOURCES).default('Manual'),
  qualification: leadQualificationSchema.optional(),
  followUpType: z.enum(FOLLOW_UP_TYPES).optional(),
  reason: z.string().trim().optional(),
  remarks: z.string().trim().optional(),
  note: z.string().trim().optional(),
  nextActionDate: z.coerce.date().optional(),
  delayResponsibility: z.string().trim().optional(),
  durationSec: z.coerce.number().min(0).optional(),
});

// A1: Intake schema must never fail on unexpected fields
export const intakeLeadSchema = z
  .object({
    companyName: z.string().trim().optional(),
    contactPerson: z.string().trim().optional(),
    name: z.string().trim().optional(),
    firstName: z.string().trim().optional(),
    lastName: z.string().trim().optional(),
    first_name: z.string().trim().optional(),
    last_name: z.string().trim().optional(),
    comments: z.string().trim().optional(),
    mobile: z.string().trim().optional(),
    phone: z.string().trim().optional(),
    contactNumber: z.string().trim().optional(),
    email: z.string().trim().optional(),
    city: z.string().trim().optional(),
    area: z.string().trim().optional(),
    pincode: z.string().trim().optional(),
    category: z.string().trim().optional(),
    leadid: z.string().trim().optional(),
    lead_type: z.string().trim().optional(),
    // Inbound email fields
    from: z.string().trim().optional(),
    to: z.string().trim().optional(),
    subject: z.string().trim().optional(),
    text: z.string().trim().optional(),
    body: z.string().trim().optional(),
    message: z.string().trim().optional(),
    html: z.string().trim().optional(),
    source: z.enum(LEAD_SOURCES).optional(),
  })
  .passthrough()
  .refine(
    (data) => Boolean(
      data.mobile ||
      data.phone ||
      data.contactNumber ||
      data.from ||
      data.email ||
      data.text ||
      data.body ||
      data.message
    ),
    { message: 'Lead contact info (mobile, phone, or email/message) is required', path: ['mobile'] }
  );

export const changeStatusSchema = z.object({
  status: z.enum(LEAD_STATUSES),
  lostReason: z.string().trim().optional(),
  qualification: leadQualificationSchema.optional(),
});

export const updateLeadSchema = createLeadSchema.partial().extend({
  status: z.enum(LEAD_STATUSES).optional(),
  lostReason: z.string().trim().optional(),
  nextActionDate: z.coerce.date().optional(),
  assignedTo: z.string().nullable().optional(),
});

export const listLeadsSchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(25),
  search: z.string().trim().optional(),
  status: z.enum(LEAD_STATUSES).optional(),
  city: z.string().trim().optional(),
  source: z.enum(LEAD_SOURCES).optional(),
  assignedTo: objectIdSchema.optional(),
  assignedToMe: z.coerce.boolean().optional(),
  unassigned: z.coerce.boolean().optional(),
  fromDate: z.coerce.date().optional(),
  toDate: z.coerce.date().optional(),
});
