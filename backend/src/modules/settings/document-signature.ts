import { Router } from 'express';
import mongoose, { Schema } from 'mongoose';
import { z } from 'zod';

import { requireAuth } from '../../core/auth/auth-middleware.js';
import { auditService } from '../../core/audit/index.js';
import type { RequestContext } from '../../core/context.js';
import { asyncHandler } from '../../core/http/asyncHandler.js';
import { requireRole } from '../../core/rbac/index.js';

/**
 * DOCUMENT SIGNATURE — one company-wide setting.
 *
 *   GET /api/settings/document-signature   any signed-in user (documents need it to render)
 *   PUT /api/settings/document-signature   Admin only
 *
 * The signature (and optional company stamp) are printed above the signatory's
 * name on quotations, invoices and purchase orders.
 * Images are stored as data URLs (PNG/JPEG/WebP, max 300 KB each).
 */

interface IDocumentSignature {
  key: 'default';
  signatureImage: string | null;
  stampImage: string | null;
  signatoryName: string;
  signatoryDesignation: string;
  updatedByName?: string;
  updatedAt?: Date;
}

const schema = new Schema<IDocumentSignature>(
  {
    key: { type: String, enum: ['default'], default: 'default', unique: true },
    signatureImage: { type: String, default: null },
    stampImage: { type: String, default: null },
    signatoryName: { type: String, trim: true, default: '' },
    signatoryDesignation: { type: String, trim: true, default: 'Authorized Signatory' },
    updatedByName: { type: String, trim: true },
  },
  { timestamps: true },
);

export const DocumentSignature =
  (mongoose.models.DocumentSignature as mongoose.Model<IDocumentSignature>) ??
  mongoose.model<IDocumentSignature>('DocumentSignature', schema);

export interface DocumentSignatureDto {
  signatureImage: string | null;
  stampImage: string | null;
  signatoryName: string;
  signatoryDesignation: string;
  updatedByName: string | null;
  updatedAt: string | null;
}

const EMPTY: DocumentSignatureDto = {
  signatureImage: null,
  stampImage: null,
  signatoryName: '',
  signatoryDesignation: 'Authorized Signatory',
  updatedByName: null,
  updatedAt: null,
};

/** The company signature, or empty defaults when none has been set up. */
export async function getDocumentSignature(): Promise<DocumentSignatureDto> {
  // Documents must never fail over this setting: no DB connection or a read error → no signature.
  if (mongoose.connection.readyState !== 1) return EMPTY;
  let doc;
  try {
    doc = await DocumentSignature.findOne({ key: 'default' }).lean();
  } catch (err) {
    console.error('[document-signature] could not read signature, printing without it', err);
    return EMPTY;
  }
  if (!doc) return EMPTY;
  return {
    signatureImage: doc.signatureImage ?? null,
    stampImage: doc.stampImage ?? null,
    signatoryName: doc.signatoryName ?? '',
    signatoryDesignation: doc.signatoryDesignation || 'Authorized Signatory',
    updatedByName: doc.updatedByName ?? null,
    updatedAt: doc.updatedAt ? new Date(doc.updatedAt).toISOString() : null,
  };
}

const MAX_IMAGE_BYTES = 300 * 1024;

const imageDataUrl = z
  .string()
  .regex(/^data:image\/(png|jpeg|jpg|webp);base64,[A-Za-z0-9+/=]+$/, 'Upload a PNG, JPG or WebP image')
  .refine(
    (v) => Math.floor(((v.length - v.indexOf(',') - 1) * 3) / 4) <= MAX_IMAGE_BYTES,
    'Image must be 300 KB or smaller',
  );

const updateSchema = z.object({
  /** null removes the image; omit to leave it unchanged */
  signatureImage: imageDataUrl.nullable().optional(),
  stampImage: imageDataUrl.nullable().optional(),
  signatoryName: z.string().trim().max(80).optional(),
  signatoryDesignation: z.string().trim().max(80).optional(),
});

export async function updateDocumentSignature(input: unknown, ctx: RequestContext): Promise<DocumentSignatureDto> {
  const data = updateSchema.parse(input);
  const set: Record<string, unknown> = { updatedByName: ctx.user.name };
  for (const key of ['signatureImage', 'stampImage', 'signatoryName', 'signatoryDesignation'] as const) {
    if (data[key] !== undefined) set[key] = data[key];
  }
  if (set.signatoryDesignation === '') set.signatoryDesignation = 'Authorized Signatory';

  await DocumentSignature.updateOne({ key: 'default' }, { $set: set, $setOnInsert: { key: 'default' } }, { upsert: true });

  void auditService.record({
    action: 'update',
    entity: 'DocumentSignature',
    entityId: 'default',
    actorEmail: ctx.user.email,
    changes: Object.keys(set)
      .filter((k) => k !== 'updatedByName')
      .map((field) => ({
        field,
        from: null,
        to: field.endsWith('Image') ? (set[field] ? '[image uploaded]' : '[removed]') : set[field],
      })),
  });

  return getDocumentSignature();
}

export const documentSignatureRoutes = Router();
documentSignatureRoutes.use(requireAuth);
documentSignatureRoutes.get(
  '/',
  asyncHandler(async (_req, res) => {
    res.json({ signature: await getDocumentSignature() });
  }),
);
documentSignatureRoutes.put(
  '/',
  requireRole(['admin']),
  asyncHandler(async (req, res) => {
    res.json({ signature: await updateDocumentSignature(req.body, req.ctx!) });
  }),
);
