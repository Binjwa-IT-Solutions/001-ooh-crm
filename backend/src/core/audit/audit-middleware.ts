import { NextFunction, Request, Response } from 'express';

import { auditService } from './audit-service.js';
import type { AuditAction } from './audit-model.js';

/**
 * GLOBAL AUDIT LOG.
 *
 * Mounted once in `app.ts`. Every successful mutation is recorded without the
 * module author doing anything — that is the point. If audit depended on people
 * remembering to call it, half the modules would forget.
 *
 * It records automatically:  who · what action · which entity · when · outcome
 * It cannot record:          the before/after values
 *
 * For a real diff, call `auditService.record({ changes: diffFields(...) })`
 * from your service. Both entries can coexist.
 */

const METHOD_TO_ACTION: Record<string, AuditAction> = {
  POST: 'create',
  PUT: 'update',
  PATCH: 'update',
  DELETE: 'delete',
};

/** Paths that write on POST but are not entity mutations worth logging as such. */
const SKIP_PATHS = [
  '/api/auth/login',
  '/api/auth/verify-otp',
  '/api/auth/resend-otp',
  '/api/auth/email-fallback',
  '/api/auth/complete-mfa-enrollment',
  '/api/auth/refresh',
];

/**
 * `/api/employees/64ab.../reports` → entity "employees", id "64ab..."
 * `/api/leads`                      → entity "leads",     id null
 */
export function parseTarget(path: string): { entity: string; entityId: string | null } {
  const segments = path.split('?')[0].split('/').filter(Boolean);

  // Drop the leading "api".
  if (segments[0] === 'api') segments.shift();

  const entity = segments[0] ?? 'unknown';
  const looksLikeId = (value: string) => /^[0-9a-fA-F]{24}$/.test(value);
  const entityId = segments.slice(1).find(looksLikeId) ?? null;

  return { entity, entityId };
}

const OBJECT_ID = /^[0-9a-fA-F]{24}$/;

/**
 * Digs the new record's id out of a create response.
 *
 * A POST to /api/employees has no id in its URL, so without this every created
 * record is logged with `entityId: null` — and "show me everything that
 * happened to this record" silently omits the record being created, which is
 * the one entry an auditor most wants.
 *
 * Handles `{ id }`, `{ _id }`, and the usual `{ employee: { id } }` envelope.
 */
export function extractEntityId(body: unknown): string | null {
  if (!body || typeof body !== 'object') return null;

  const record = body as Record<string, unknown>;

  for (const key of ['id', '_id']) {
    const value = record[key];
    if (typeof value === 'string' && OBJECT_ID.test(value)) return value;
  }

  // One level down: { employee: { id: … } }
  for (const value of Object.values(record)) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) continue;

    const nested = value as Record<string, unknown>;
    for (const key of ['id', '_id']) {
      const candidate = nested[key];
      if (typeof candidate === 'string' && OBJECT_ID.test(candidate)) return candidate;
    }
  }

  return null;
}

export function auditMiddleware(req: Request, res: Response, next: NextFunction) {
  const action = METHOD_TO_ACTION[req.method];

  const isApprovalPoll =
    req.method === 'POST' &&
    /^\/api\/auth\/security\/login-approvals\/[0-9a-fA-F]{24}\/status$/.test(req.path);

  if (!action || SKIP_PATHS.includes(req.path) || isApprovalPoll) {
    next();
    return;
  }

  // Capture the body now — a controller may mutate req.body before the response.
  const payload = req.body;

  // Tap res.json so a create can be logged against the id it just generated.
  let responseBody: unknown = null;
  const originalJson = res.json.bind(res);
  res.json = (body: unknown) => {
    responseBody = body;
    return originalJson(body);
  };

  res.on('finish', () => {
    // Only successful mutations. Failures are noise, and a rejected request
    // changed nothing; log those deliberately from the service if they matter.
    if (res.statusCode >= 400) return;

    const { entity, entityId } = parseTarget(req.originalUrl);

    void auditService.record({
      action,
      entity,
      // URL id first (update/delete); fall back to the response (create).
      entityId: entityId ?? extractEntityId(responseBody),
      payload,
      method: req.method,
      path: req.originalUrl,
      statusCode: res.statusCode,
      ip: req.ip ?? null,
      userAgent: req.headers['user-agent'] ?? null,
      ctx: req.ctx ?? null,
    });
  });

  next();
}
