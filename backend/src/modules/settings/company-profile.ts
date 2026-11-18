import { Router } from 'express';
import mongoose, { Schema, Types } from 'mongoose';
import { z } from 'zod';

import { COMPANY } from '../../config/company.js';
import { auditService } from '../../core/audit/index.js';
import { requireAuth } from '../../core/auth/auth-middleware.js';
import type { RequestContext } from '../../core/context.js';
import { asyncHandler } from '../../core/http/asyncHandler.js';
import type { PdfBrand } from '../../core/pdf/index.js';
import { requireRole } from '../../core/rbac/index.js';

/**
 * COMPANY OFFICES — the address printed on documents.
 *
 *   GET /api/settings/company   any signed-in user (documents need it to render)
 *   PUT /api/settings/company   Admin only — replaces the whole office list
 *
 * Several offices can be stored; the one marked default is printed on
 * quotations, invoices, purchase orders and payslips. Until an admin saves
 * something, the address in config/company.ts is used.
 */

interface IOffice {
  _id: Types.ObjectId;
  label: string;
  /** Multi-line; each line is printed on its own row. */
  address: string;
  isDefault: boolean;
}

interface ICompanyProfile {
  key: 'default';
  offices: IOffice[];
  updatedByName?: string;
  updatedAt?: Date;
}

const officeSchema = new Schema<IOffice>({
  label: { type: String, required: true, trim: true },
  address: { type: String, required: true, trim: true },
  isDefault: { type: Boolean, default: false },
});

const schema = new Schema<ICompanyProfile>(
  {
    key: { type: String, enum: ['default'], default: 'default', unique: true },
    offices: { type: [officeSchema], default: [] },
    updatedByName: { type: String, trim: true },
  },
  { timestamps: true },
);

export const CompanyProfile =
  (mongoose.models.CompanyProfile as mongoose.Model<ICompanyProfile>) ??
  mongoose.model<ICompanyProfile>('CompanyProfile', schema);

export interface OfficeDto {
  id: string;
  label: string;
  address: string;
  addressLines: string[];
  isDefault: boolean;
}

export interface CompanyProfileDto {
  name: string;
  offices: OfficeDto[];
  /** The office printed on documents. */
  defaultOffice: OfficeDto;
  /** false until an admin has saved offices (built-in address in use). */
  configured: boolean;
  updatedByName: string | null;
  updatedAt: string | null;
}

const toLines = (address: string) =>
  address
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

const BUILT_IN: OfficeDto = {
  id: 'built-in',
  label: 'Head Office',
  address: COMPANY.addressLines.join('\n'),
  addressLines: [...COMPANY.addressLines],
  isDefault: true,
};

async function loadProfileDoc() {
  // Documents must never fail over this setting: no DB connection or a read error → built-in address.
  if (mongoose.connection.readyState !== 1) return null;
  try {
    return await CompanyProfile.findOne({ key: 'default' }).lean();
  } catch (err) {
    console.error('[company-profile] could not read offices, using built-in address', err);
    return null;
  }
}

export async function getCompanyProfile(): Promise<CompanyProfileDto> {
  const doc = await loadProfileDoc();
  const offices: OfficeDto[] = (doc?.offices ?? []).map((o) => ({
    id: String(o._id),
    label: o.label,
    address: o.address,
    addressLines: toLines(o.address),
    isDefault: o.isDefault,
  }));
  const defaultOffice = offices.find((o) => o.isDefault) ?? offices[0] ?? BUILT_IN;
  return {
    name: COMPANY.name,
    offices: offices.length ? offices : [BUILT_IN],
    defaultOffice,
    configured: offices.length > 0,
    updatedByName: doc?.updatedByName ?? null,
    updatedAt: doc?.updatedAt ? new Date(doc.updatedAt).toISOString() : null,
  };
}

/** Letterhead for server-generated PDFs, using the default office. */
export async function getCompanyBrand(): Promise<PdfBrand> {
  const { defaultOffice } = await getCompanyProfile();
  return {
    companyName: COMPANY.name,
    addressLines: defaultOffice.addressLines,
    email: 'hello@mediaoctus.com',
  };
}

const updateSchema = z.object({
  offices: z
    .array(
      z.object({
        label: z.string().trim().min(2, 'Give each office a name, e.g. "Head Office – Indore"').max(60),
        address: z.string().trim().min(10, 'Enter the full address').max(400),
        isDefault: z.boolean().default(false),
      }),
    )
    .min(1, 'Keep at least one office')
    .max(10, 'Up to 10 offices'),
});

export async function updateCompanyProfile(input: unknown, ctx: RequestContext): Promise<CompanyProfileDto> {
  const { offices } = updateSchema.parse(input);

  // Exactly one default: the first one marked, or the first office.
  const firstDefault = offices.findIndex((o) => o.isDefault);
  const normalized = offices.map((o, i) => ({ ...o, isDefault: i === (firstDefault === -1 ? 0 : firstDefault) }));

  const before = await getCompanyProfile();
  await CompanyProfile.updateOne(
    { key: 'default' },
    { $set: { offices: normalized, updatedByName: ctx.user.name }, $setOnInsert: { key: 'default' } },
    { upsert: true },
  );
  const after = await getCompanyProfile();

  void auditService.record({
    action: 'update',
    entity: 'CompanyProfile',
    entityId: 'default',
    actorEmail: ctx.user.email,
    changes: [
      { field: 'defaultOffice', from: before.defaultOffice.address, to: after.defaultOffice.address },
      { field: 'offices', from: before.offices.length, to: after.offices.length },
    ],
  });

  return after;
}

export const companyProfileRoutes = Router();
companyProfileRoutes.use(requireAuth);
companyProfileRoutes.get(
  '/',
  asyncHandler(async (_req, res) => {
    res.json({ company: await getCompanyProfile() });
  }),
);
companyProfileRoutes.put(
  '/',
  requireRole(['admin']),
  asyncHandler(async (req, res) => {
    res.json({ company: await updateCompanyProfile(req.body, req.ctx!) });
  }),
);
