import { z } from 'zod';
import { AUDIT_ACTIONS } from '../../core/audit/audit-model.js';

export const listAuditQuerySchema = z.object({
  entity: z.string().trim().optional(),
  entityId: z.string().trim().optional(),
  actorId: z
    .string()
    .trim()
    .regex(/^[0-9a-fA-F]{24}$/, 'Invalid actor ID')
    .optional(),
  actorEmail: z.string().trim().optional(),
  action: z.enum(AUDIT_ACTIONS).optional(),
  from: z.preprocess(
    (val) => (val === '' || val === null || val === undefined ? undefined : val),
    z.coerce.date().optional(),
  ),
  to: z.preprocess(
    (val) => (val === '' || val === null || val === undefined ? undefined : val),
    z.coerce.date().optional(),
  ),
  search: z.string().trim().optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
});

export const entityAuditQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

export type ListAuditQuery = z.infer<typeof listAuditQuerySchema>;
