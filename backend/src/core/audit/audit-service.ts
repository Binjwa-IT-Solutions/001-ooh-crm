import { Types } from 'mongoose';

import type { RequestContext } from '../context.js';
import { AuditLog, type AuditAction, type IAuditLog } from './audit-model.js';
import { isRedactedKey, redact } from './redact.js';

/**
 * Writing to the audit log must never break the operation being audited.
 * Every write here is best-effort: a failure is logged to the console and
 * swallowed. Losing one audit row is bad; failing a payroll write because the
 * audit insert timed out is worse.
 */

export interface AuditChange {
  field: string;
  from: unknown;
  to: unknown;
}

export interface RecordAuditInput {
  action: AuditAction;
  entity: string;
  entityId?: string | null;
  payload?: unknown;
  changes?: AuditChange[];
  method?: string | null;
  path?: string | null;
  statusCode?: number | null;
  ip?: string | null;
  userAgent?: string | null;
  /** Absent for unauthenticated events such as a failed login. */
  ctx?: RequestContext | null;
  /** Used when there is no ctx — e.g. recording who just failed to sign in. */
  actorId?: string | null;
  actorEmail?: string | null;
  actorRole?: string | null;
}

/**
 * Compares two objects and returns only the fields that actually changed.
 * Pass this to `record()` when you want a real before/after in the log.
 */
export function diffFields(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
  fields?: string[],
): AuditChange[] {
  const keys = fields ?? Array.from(new Set([...Object.keys(before), ...Object.keys(after)]));
  const changes: AuditChange[] = [];

  for (const field of keys) {
    const from = before[field];
    const to = after[field];

    // JSON comparison keeps dates and nested objects honest without a deep-equal dependency.
    if (JSON.stringify(from ?? null) === JSON.stringify(to ?? null)) continue;

    // Mask by FIELD NAME, not by walking the value. `from` is usually a bare
    // string here, and redact() only masks keys inside an object — so without
    // this check a PAN or account number lands in the log in clear text.
    if (isRedactedKey(field)) {
      changes.push({ field, from: '[redacted]', to: '[redacted]' });
      continue;
    }

    changes.push({
      field,
      from: redact(from),
      to: redact(to),
    });
  }

  return changes;
}

export const auditService = {
  /**
   * Records one event. Call this from a service when the automatic middleware
   * entry is not detailed enough — a status transition, a before/after diff,
   * an export, a failed login.
   */
  async record(input: RecordAuditInput): Promise<void> {
    try {
      const resolvedActorId = input.ctx?.user?.id ?? input.actorId ?? null;
      await AuditLog.create({
        actorId: resolvedActorId && Types.ObjectId.isValid(resolvedActorId)
          ? new Types.ObjectId(resolvedActorId)
          : null,
        actorEmail: input.ctx?.user.email ?? input.actorEmail ?? null,
        actorRole: input.ctx?.user.role ?? input.actorRole ?? null,

        action: input.action,
        entity: input.entity,
        entityId: input.entityId ? String(input.entityId) : null,

        payload: input.payload === undefined ? undefined : redact(input.payload),
        changes: input.changes,

        method: input.method ?? null,
        path: input.path ?? null,
        statusCode: input.statusCode ?? null,
        ip: input.ip ?? null,
        userAgent: input.userAgent ?? null,
      });
    } catch (err) {
      console.error('[audit] failed to write entry', err);
    }
  },

  /** Everything that has happened to one record — the detail page's timeline. */
  async listForEntity(entity: string, entityId: string, limit = 50): Promise<IAuditLog[]> {
    return AuditLog.find({ entity, entityId: String(entityId) })
      .sort({ createdAt: -1 })
      .limit(Math.min(limit, 200))
      .lean<IAuditLog[]>();
  },

  /**
   * The global log, for module H1. Deliberately not scoped — reading it
   * requires the `audit.view` permission, which only Admin and Finance hold.
   */
  async list(
    filter: {
      entity?: string;
      entityId?: string;
      actorId?: string;
      action?: AuditAction;
      from?: Date;
      to?: Date;
    },
    pagination: { page?: number; pageSize?: number } = {},
  ): Promise<{ entries: IAuditLog[]; total: number; page: number; pageSize: number }> {
    const page = Math.max(1, pagination.page ?? 1);
    const pageSize = Math.min(100, Math.max(1, pagination.pageSize ?? 25));

    const query: Record<string, unknown> = {};
    if (filter.entity) query.entity = filter.entity;
    if (filter.entityId) query.entityId = String(filter.entityId);
    if (filter.actorId) query.actorId = new Types.ObjectId(filter.actorId);
    if (filter.action) query.action = filter.action;

    if (filter.from || filter.to) {
      query.createdAt = {
        ...(filter.from ? { $gte: filter.from } : {}),
        ...(filter.to ? { $lte: filter.to } : {}),
      };
    }

    const [entries, total] = await Promise.all([
      AuditLog.find(query)
        .sort({ createdAt: -1 })
        .skip((page - 1) * pageSize)
        .limit(pageSize)
        .lean<IAuditLog[]>(),
      AuditLog.countDocuments(query),
    ]);

    return { entries, total, page, pageSize };
  },
};
