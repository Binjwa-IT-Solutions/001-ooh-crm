import crypto from 'node:crypto';
import { Types } from 'mongoose';
import { RequestContext } from '../../core/context.js';
import { NotFoundError, ValidationError } from '../../core/errors/index.js';
import { scopedFindOne } from '../../core/scoping/index.js';
import { Quotation, type IQuotation } from './quotations.model.js';
import { Lead } from '../leads/leads.model.js';
import { Site } from '../sites/site.model.js';
import { createFromQuotation } from '../campaigns/campaign.service.js';
import { toObjectId } from '../../core/db/basePlugin.js';
import { formattedSequence } from '../../core/db/sequence.js';
import { renderPdf, lineItemsTable, formatPaise } from '../../core/pdf/index.js';
import { fileService } from '../../core/files/index.js';
import { notify } from '../../core/notifications/index.js';
import type {
  CreateQuotationInput,
  ListQuotationsQuery,
  UpdateQuotationInput,
} from './quotations.validator.js';

const TAX_RATE = 0.18; // 18%

function daysInclusive(start: Date, end: Date): number {
  const startDay = new Date(Date.UTC(start.getFullYear(), start.getMonth(), start.getDate()));
  const endDay = new Date(Date.UTC(end.getFullYear(), end.getMonth(), end.getDate()));
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.floor((endDay.getTime() - startDay.getTime()) / msPerDay) + 1;
}

function rupeesToPaise(value: number): number {
  return Math.round(value * 100);
}

function generate32CharToken(): string {
  return crypto.randomBytes(16).toString('hex');
}

export class QuotationsService {
  static async list(
    query: ListQuotationsQuery,
    ctx: RequestContext,
  ): Promise<{ quotations: IQuotation[]; total: number }> {
    const filter: Record<string, unknown> = { deletedAt: null };

    if (query.search) {
      filter.quoteNumber = { $regex: query.search, $options: 'i' };
    }
    if (query.status) {
      filter.status = query.status;
    }
    if (query.leadId) {
      filter.leadId = toObjectId(query.leadId);
    }

    const page = query.page ?? 1;
    const limit = query.limit ?? 25;
    const skip = (page - 1) * limit;

    const [quotations, total] = await Promise.all([
      Quotation.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('leadId', 'companyName contactPerson mobile email')
        .populate('sites.siteId', 'siteCode city baseCostPerDay type')
        .exec(),
      Quotation.countDocuments(filter).exec(),
    ]);

    return { quotations, total };
  }

  static async get(id: string, ctx: RequestContext): Promise<IQuotation> {
    if (!Types.ObjectId.isValid(id)) throw new NotFoundError('Quotation not found');

    const quotation = await scopedFindOne(Quotation, { _id: toObjectId(id) }, ctx);
    if (!quotation) throw new NotFoundError('Quotation not found');

    await quotation.populate('leadId', 'companyName contactPerson mobile email');
    await quotation.populate('sites.siteId', 'siteCode city baseCostPerDay type');

    return quotation;
  }

  static async create(
    data: CreateQuotationInput,
    ctx: RequestContext,
  ): Promise<IQuotation> {
    if (!data.sites || data.sites.length === 0) {
      throw new ValidationError('At least one site is required');
    }

    const lead = await Lead.findOne({ _id: toObjectId(data.leadId), deletedAt: null });
    if (!lead) {
      throw new ValidationError('Selected lead does not exist');
    }

    const now = new Date();
    const year = now.getFullYear();
    const quoteNumber = await formattedSequence(`quote-${year}`, `MO-Q-${year}`);

    const defaultValidUntil = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000); // 30 days
    const validUntil = data.validUntil ? new Date(data.validUntil) : defaultValidUntil;

    const lines: Array<{
      siteId: Types.ObjectId;
      description?: string;
      ratePerDay: number;
      startDate: Date;
      endDate: Date;
      days: number;
      amount: number;
    }> = [];

    let subtotal = 0;

    for (const item of data.sites) {
      const start = new Date(item.startDate);
      const end = new Date(item.endDate);
      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        throw new ValidationError('Invalid dates in quotation site line');
      }
      if (end < start) {
        throw new ValidationError('endDate must be on or after startDate');
      }

      const days = daysInclusive(start, end);
      const ratePaise = rupeesToPaise(Number(item.ratePerDay));
      const amount = Math.round(days * ratePaise);

      lines.push({
        siteId: toObjectId(item.siteId),
        description: item.description,
        ratePerDay: ratePaise,
        startDate: start,
        endDate: end,
        days,
        amount,
      });

      subtotal += amount;
    }

    const taxAmount = Math.round(subtotal * TAX_RATE);
    const total = subtotal + taxAmount;

    const doc = await Quotation.create({
      quoteNumber,
      leadId: lead._id,
      clientName: data.clientName || lead.companyName,
      clientEmail: data.clientEmail || lead.email,
      clientPhone: data.clientPhone || lead.mobile,
      sites: lines,
      subtotal,
      taxPercent: 18,
      taxAmount,
      total,
      validUntil,
      status: 'Draft',
      createdBy: toObjectId(ctx.user.id),
    });

    await doc.populate('leadId', 'companyName contactPerson mobile email');
    await doc.populate('sites.siteId', 'siteCode city baseCostPerDay type');

    return doc as IQuotation;
  }

  static async update(
    id: string,
    data: UpdateQuotationInput,
    ctx: RequestContext,
  ): Promise<IQuotation> {
    if (!Types.ObjectId.isValid(id)) throw new NotFoundError('Quotation not found');

    const quotation = await Quotation.findOne({ _id: toObjectId(id), deletedAt: null });
    if (!quotation) throw new NotFoundError('Quotation not found');

    if (quotation.status !== 'Draft') {
      throw new ValidationError('Only Draft quotations can be edited');
    }

    let subtotal = quotation.subtotal;
    let lines = quotation.sites;

    if (data.sites) {
      lines = [];
      subtotal = 0;

      for (const item of data.sites) {
        const start = new Date(item.startDate);
        const end = new Date(item.endDate);
        if (isNaN(start.getTime()) || isNaN(end.getTime())) {
          throw new ValidationError('Invalid dates in quotation site line');
        }
        if (end < start) {
          throw new ValidationError('endDate must be on or after startDate');
        }

        const days = daysInclusive(start, end);
        const ratePaise = rupeesToPaise(Number(item.ratePerDay));
        const amount = Math.round(days * ratePaise);

        lines.push({
          siteId: toObjectId(item.siteId),
          description: item.description,
          ratePerDay: ratePaise,
          startDate: start,
          endDate: end,
          days,
          amount,
        });

        subtotal += amount;
      }
    }

    const taxAmount = Math.round(subtotal * TAX_RATE);
    const total = subtotal + taxAmount;

    if (data.clientName !== undefined) quotation.clientName = data.clientName;
    if (data.clientEmail !== undefined) quotation.clientEmail = data.clientEmail;
    if (data.clientPhone !== undefined) quotation.clientPhone = data.clientPhone;
    if (data.validUntil) quotation.validUntil = new Date(data.validUntil);

    quotation.sites = lines;
    quotation.subtotal = subtotal;
    quotation.taxAmount = taxAmount;
    quotation.total = total;
    quotation.updatedBy = toObjectId(ctx.user.id);

    await quotation.save();
    await quotation.populate('leadId', 'companyName contactPerson mobile email');
    await quotation.populate('sites.siteId', 'siteCode city baseCostPerDay type');

    return quotation as IQuotation;
  }

  /**
   * B2 — Generate Proposal PDF.
   * Uses /core/pdf (renderPdf, lineItemsTable, formatPaise) and saves to object storage via fileService.
   */
  static async generatePdf(
    id: string,
    ctx: RequestContext,
  ): Promise<{ pdfKey: string; pdfUrl: string }> {
    const quotation = await Quotation.findOne({ _id: toObjectId(id), deletedAt: null })
      .populate('leadId', 'companyName contactPerson mobile email')
      .populate('sites.siteId', 'siteCode city type address')
      .exec();

    if (!quotation) throw new NotFoundError('Quotation not found');

    const leadName = quotation.clientName || (quotation.leadId as any)?.companyName || 'Valued Client';
    const rows: string[][] = [];

    for (const line of quotation.sites) {
      const site = line.siteId as any;
      const siteName = site?.siteCode ? `${site.siteCode} (${site.city || ''})` : 'Outdoor Site';
      const startStr = new Date(line.startDate).toLocaleDateString('en-IN');
      const endStr = new Date(line.endDate).toLocaleDateString('en-IN');
      const dates = `${startStr} - ${endStr}`;

      rows.push([
        siteName,
        dates,
        String(line.days),
        formatPaise(line.ratePerDay),
        formatPaise(line.amount),
      ]);
    }

    const pdfBuffer = await renderPdf({
      title: 'PROPOSAL / QUOTATION',
      reference: quotation.quoteNumber,
      meta: [
        ['Client', leadName],
        ['Date', new Date(quotation.createdAt).toLocaleDateString('en-IN')],
        ['Valid Until', new Date(quotation.validUntil).toLocaleDateString('en-IN')],
        ['Status', quotation.status],
      ],
      build: (doc) => {
        lineItemsTable(doc, {
          columns: [
            { header: 'Site / Location', width: 0.35, align: 'left' },
            { header: 'Duration', width: 0.25, align: 'left' },
            { header: 'Days', width: 0.1, align: 'right' },
            { header: 'Rate / Day', width: 0.15, align: 'right' },
            { header: 'Amount', width: 0.15, align: 'right' },
          ],
          rows,
          totals: [
            ['Subtotal', quotation.subtotal],
            ['GST (18%)', quotation.taxAmount],
            ['Total Amount', quotation.total],
          ],
        });
      },
    });

    const versionNum = Date.now();
    const stored = await fileService.saveBuffer({
      buffer: pdfBuffer,
      folder: 'quotations',
      filename: `${quotation.quoteNumber}-v${versionNum}.pdf`,
      contentType: 'application/pdf',
    });

    quotation.pdfKey = stored.key;
    quotation.updatedBy = toObjectId(ctx.user.id);
    await quotation.save();

    return {
      pdfKey: stored.key,
      pdfUrl: stored.url,
    };
  }

  static async getPdfUrl(id: string, ctx: RequestContext): Promise<{ pdfUrl: string; pdfKey?: string }> {
    const quotation = await Quotation.findOne({ _id: toObjectId(id), deletedAt: null });
    if (!quotation) throw new NotFoundError('Quotation not found');

    if (!quotation.pdfKey) {
      const generated = await QuotationsService.generatePdf(id, ctx);
      return { pdfUrl: generated.pdfUrl, pdfKey: generated.pdfKey };
    }

    const pdfUrl = await fileService.url(quotation.pdfKey);
    return { pdfUrl, pdfKey: quotation.pdfKey };
  }

  /**
   * Upload Custom Proposal PDF.
   * Allows agency/company to upload their own bespoke proposal PDF.
   */
  static async uploadCustomPdf(
    id: string,
    file: Express.Multer.File | undefined,
    ctx: RequestContext,
  ): Promise<{ pdfKey: string; pdfUrl: string }> {
    if (!file) throw new ValidationError('No PDF file provided');
    if (file.mimetype !== 'application/pdf') {
      throw new ValidationError('Only PDF documents are supported');
    }

    const quotation = await Quotation.findOne({ _id: toObjectId(id), deletedAt: null });
    if (!quotation) throw new NotFoundError('Quotation not found');

    const stored = await fileService.save(file, { folder: 'quotations', ctx });
    quotation.pdfKey = stored.key;
    quotation.updatedBy = toObjectId(ctx.user.id);
    await quotation.save();

    return {
      pdfKey: stored.key,
      pdfUrl: stored.url,
    };
  }

  /**
   * B3 — Send Proposal to Client.
   * Generates 32-char crypto random trackingToken and locks quotation to 'Sent'.
   */
  static async send(
    id: string,
    sentTo: string,
    message: string | undefined,
    ctx: RequestContext,
  ): Promise<{ quotation: IQuotation; trackingToken: string; publicUrl: string }> {
    const quotation = await Quotation.findOne({ _id: toObjectId(id), deletedAt: null });
    if (!quotation) throw new NotFoundError('Quotation not found');

    if (!quotation.trackingToken) {
      quotation.trackingToken = generate32CharToken();
    }

    quotation.status = 'Sent';
    quotation.sentAt = new Date();
    quotation.sentTo = sentTo;
    quotation.updatedBy = toObjectId(ctx.user.id);

    await quotation.save();

    const publicUrl = `/q/${quotation.trackingToken}`;

    return {
      quotation,
      trackingToken: quotation.trackingToken,
      publicUrl,
    };
  }

  /**
   * B3 — Public Proposal View (No Login Required!).
   * Returns ONLY client-facing details (no internal ObjectIds or agent info).
   * Records first view timestamp and notifies owning agent.
   */
  static async getPublicByToken(token: string): Promise<Record<string, unknown>> {
    const quotation = await Quotation.findOne({ trackingToken: token, deletedAt: null })
      .populate('leadId', 'companyName contactPerson email mobile')
      .populate('sites.siteId', 'siteCode city type address')
      .exec();

    if (!quotation) {
      throw new NotFoundError('Proposal not found');
    }

    const now = new Date();

    // Check expiration
    if (quotation.status !== 'Accepted' && quotation.status !== 'Rejected') {
      if (quotation.validUntil && quotation.validUntil < now && quotation.status !== 'Expired') {
        quotation.status = 'Expired';
        await quotation.save();
      }
    }

    // Record first view
    if (!quotation.viewedAt) {
      quotation.viewedAt = now;
      await quotation.save();

      // Notify owning agent / creator
      if (quotation.createdBy) {
        await notify({
          userId: quotation.createdBy,
          type: 'quotations.viewed',
          title: `Proposal Viewed: ${quotation.quoteNumber}`,
          body: `Client viewed quotation ${quotation.quoteNumber}`,
          link: `/quotations/${quotation._id}`,
        });
      }
    }

    const leadInfo = quotation.leadId as any;

    return {
      quoteNumber: quotation.quoteNumber,
      clientName: quotation.clientName || leadInfo?.companyName || 'Valued Client',
      clientEmail: quotation.clientEmail || leadInfo?.email || '',
      sites: quotation.sites.map((line) => {
        const s = line.siteId as any;
        return {
          siteCode: s?.siteCode || 'Outdoor Site',
          city: s?.city || '',
          type: s?.type || '',
          startDate: line.startDate,
          endDate: line.endDate,
          days: line.days,
          ratePerDayRupees: line.ratePerDay / 100,
          amountRupees: line.amount / 100,
        };
      }),
      subtotalRupees: quotation.subtotal / 100,
      taxPercent: quotation.taxPercent,
      taxAmountRupees: quotation.taxAmount / 100,
      totalRupees: quotation.total / 100,
      validUntil: quotation.validUntil,
      status: quotation.status,
      viewedAt: quotation.viewedAt,
      acceptedAt: quotation.acceptedAt,
      rejectedAt: quotation.rejectedAt,
      rejectionReason: quotation.rejectionReason,
    };
  }

  /**
   * B3 — Public Proposal Accept (No Login Required!).
   */
  static async acceptPublic(token: string): Promise<Record<string, unknown>> {
    const quotation = await Quotation.findOne({ trackingToken: token, deletedAt: null });
    if (!quotation) throw new NotFoundError('Proposal not found');

    const now = new Date();

    if (quotation.validUntil && quotation.validUntil < now) {
      quotation.status = 'Expired';
      await quotation.save();
      throw new ValidationError('This proposal has expired and cannot be accepted.');
    }

    if (quotation.status === 'Accepted') {
      return QuotationsService.getPublicByToken(token);
    }

    quotation.status = 'Accepted';
    quotation.acceptedAt = now;
    await quotation.save();

    // Update Lead to Won
    await Lead.updateOne({ _id: quotation.leadId }, { $set: { status: 'Won' } });

    // Call campaignService.createFromQuotation
    try {
      await createFromQuotation(String(quotation._id), {
        userId: quotation.createdBy ?? 'system',
      });
    } catch (err) {
      console.error('[acceptPublic] failed to create campaign from quotation', err);
    }

    // Notify agent
    if (quotation.createdBy) {
      await notify({
        userId: quotation.createdBy,
        type: 'quotations.accepted',
        title: `Proposal Accepted! ${quotation.quoteNumber}`,
        body: `Client accepted quotation ${quotation.quoteNumber} for ${formatPaise(quotation.total)}`,
        link: `/quotations/${quotation._id}`,
        email: true,
      });
    }

    return QuotationsService.getPublicByToken(token);
  }

  /**
   * B3 — Public Proposal Reject (No Login Required!).
   */
  static async rejectPublic(token: string, reason: string): Promise<Record<string, unknown>> {
    const quotation = await Quotation.findOne({ trackingToken: token, deletedAt: null });
    if (!quotation) throw new NotFoundError('Proposal not found');

    const now = new Date();

    quotation.status = 'Rejected';
    quotation.rejectedAt = now;
    quotation.rejectionReason = reason;
    await quotation.save();

    // Notify agent
    if (quotation.createdBy) {
      await notify({
        userId: quotation.createdBy,
        type: 'quotations.rejected',
        title: `Proposal Rejected: ${quotation.quoteNumber}`,
        body: `Client rejected quotation ${quotation.quoteNumber}. Reason: ${reason}`,
        link: `/quotations/${quotation._id}`,
        email: true,
      });
    }

    return QuotationsService.getPublicByToken(token);
  }
}
