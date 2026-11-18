import { z } from 'zod';
import { CANDIDATE_STATUSES } from './candidates.model.js';

const objectId = z
  .string()
  .trim()
  .regex(/^[0-9a-fA-F]{24}$/, 'Not a valid id');

const isoDate = z.coerce.date();
const MOBILE = /^[6-9][0-9]{9}$/;

export const interviewRoundInputSchema = z.object({
  _id: objectId.optional(),
  roundNumber: z.coerce.number().int().min(1).optional(),
  roundName: z.string().trim().max(120).optional().default('Interview Round'),
  interviewDate: isoDate,
  interviewedBy: objectId,
  notes: z.string().trim().max(2000).optional().or(z.literal('')),
  status: z.string().trim().max(60).optional().default('Scheduled'),
});

export const createCandidateSchema = z.object({
  name: z.string().trim().min(2, 'Name is required').max(120),
  email: z.string().trim().toLowerCase().email('Enter a valid email'),
  mobile: z.string().trim().regex(MOBILE, 'Enter a valid 10-digit Indian mobile number'),
  position: z.string().trim().min(2, 'Position is required').max(120),
  interviewDate: isoDate,
  status: z.enum(CANDIDATE_STATUSES).default('Scheduled'),
  notes: z.string().trim().max(1000).optional().or(z.literal('')),
  interviewRounds: z.array(interviewRoundInputSchema).optional(),
});

export const updateCandidateSchema = z
  .object({
    name: z.string().trim().min(2, 'Name is required').max(120).optional(),
    email: z.string().trim().toLowerCase().email('Enter a valid email').optional(),
    mobile: z.string().trim().regex(MOBILE, 'Enter a valid 10-digit Indian mobile number').optional(),
    position: z.string().trim().min(2, 'Position is required').max(120).optional(),
    interviewDate: isoDate.optional(),
    interviewedBy: objectId.optional(),
    status: z.enum(CANDIDATE_STATUSES).optional(),
    notes: z.string().trim().max(1000).optional().or(z.literal('')),
    interviewRounds: z.array(interviewRoundInputSchema).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, { message: 'Nothing to update' });

export const listCandidatesSchema = z.object({
  search: z.string().trim().max(120).optional(),
  status: z.enum(CANDIDATE_STATUSES).optional(),
  position: z.string().trim().max(120).optional(),
  resume: z.enum(['all', 'available', 'none']).optional(),
  startDate: isoDate.optional(),
  endDate: isoDate.optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
  sortBy: z.enum(['name', 'interviewDate', 'position', 'createdAt']).default('interviewDate'),
  sortDir: z.enum(['asc', 'desc']).default('desc'),
});

export const candidateIdSchema = z.object({ id: objectId });

export type CreateCandidateInput = z.infer<typeof createCandidateSchema>;
export type UpdateCandidateInput = z.infer<typeof updateCandidateSchema>;
export type ListCandidatesQuery = z.infer<typeof listCandidatesSchema>;
export type InterviewRoundInput = z.infer<typeof interviewRoundInputSchema>;
