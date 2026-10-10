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
import { renderPdf, lineItemsTable, formatPaise, renderQuotationBillBookPdf, type QuotationLineItem } from '../../core/pdf/index.js';
import { fileService } from '../../core/files/index.js';
import { notify, sendEmail } from '../../core/notifications/index.js';
import { config } from '../../config/index.js';
import { employeeService } from '../employees/employees.service.js';
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

    if (query.status) {
      filter.status = query.status;
    }
    if (query.leadId) {
      filter.leadId = toObjectId(query.leadId);
    }

    // Role-based Scoping: Manager and sales agents only see quotations for their team/leads
    const scopedUserIds = await employeeService.getScopedUserIds(ctx);
    let scopeConditions: any = null;
    if (scopedUserIds) {
      const myLeads = await Lead.find({
        $or: [
          { assignedTo: { $in: scopedUserIds } },
          { claimedBy: { $in: scopedUserIds } },
          { createdBy: { $in: scopedUserIds } },
        ],
        deletedAt: null,
      }).select('_id').lean();
      const myLeadIds = myLeads.map((l) => l._id);

      scopeConditions = [
        { createdBy: { $in: scopedUserIds } },
        { leadId: { $in: myLeadIds } },
      ];
    }

    if (query.search && query.search.trim().length > 0) {
      const searchRegex = { $regex: query.search.trim(), $options: 'i' };
      const matchingLeads = await Lead.find({
        $or: [
          { companyName: searchRegex },
          { contactPerson: searchRegex },
          { mobile: searchRegex },
        ],
        deletedAt: null,
      }).select('_id').lean();
      const matchingLeadIds = matchingLeads.map((l) => l._id);

      const searchConditions: any[] = [
        { quoteNumber: searchRegex },
        { clientName: searchRegex },
        { clientEmail: searchRegex },
        { leadId: { $in: matchingLeadIds } },
      ];

      if (scopeConditions) {
        filter.$and = [
          { $or: scopeConditions },
          { $or: searchConditions },
        ];
      } else {
        filter.$or = searchConditions;
      }
    } else if (scopeConditions) {
      filter.$or = scopeConditions;
    }

    const targetAgentId = query.createdBy || query.agentId;
    if (targetAgentId) {
      filter.createdBy = toObjectId(targetAgentId);
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
        .populate('createdBy', 'name email role')
        .exec(),
      Quotation.countDocuments(filter).exec(),
    ]);

    return { quotations, total };
  }

  static async get(id: string, ctx: RequestContext): Promise<IQuotation> {
    if (!Types.ObjectId.isValid(id)) throw new NotFoundError('Quotation not found');

    const scopedUserIds = await employeeService.getScopedUserIds(ctx);
    let quotation: IQuotation | null = null;

    if (!scopedUserIds) {
      quotation = await Quotation.findOne({ _id: toObjectId(id), deletedAt: null });
    } else {
      // 1. Allow if created by user/team member
      quotation = await Quotation.findOne({
        _id: toObjectId(id),
        createdBy: { $in: scopedUserIds },
        deletedAt: null,
      });

      // 2. Or allow if team member is assigned to the lead (or created/claimed the lead)
      if (!quotation) {
        const candidate = await Quotation.findOne({ _id: toObjectId(id), deletedAt: null }).populate('leadId');
        if (candidate && candidate.leadId) {
          const lead = candidate.leadId as any;
          const isOwner =
            (lead.assignedTo && scopedUserIds.some((uid) => uid.equals(lead.assignedTo))) ||
            (lead.claimedBy && scopedUserIds.some((uid) => uid.equals(lead.claimedBy))) ||
            (lead.createdBy && scopedUserIds.some((uid) => uid.equals(lead.createdBy)));
          if (isOwner) {
            quotation = candidate;
          }
        }
      }
    }

    if (!quotation) throw new NotFoundError('Quotation not found');

    await quotation.populate('leadId', 'companyName contactPerson mobile email');
    await quotation.populate('sites.siteId', 'code siteCode city baseCostPerDay type address');

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
      startDate?: Date | null;
      endDate?: Date | null;
      days: number;
      discountPercent?: number;
      taxPercent?: number;
      amount: number;
    }> = [];

    let subtotal = 0;
    let totalTaxPaise = 0;

    for (const item of data.sites) {
      let start: Date | null = null;
      let end: Date | null = null;
      let days = Number(item.days || 30);

      if (item.startDate && item.endDate) {
        const s = new Date(item.startDate);
        const e = new Date(item.endDate);
        if (!isNaN(s.getTime()) && !isNaN(e.getTime())) {
          if (e < s) {
            throw new ValidationError('endDate must be on or after startDate');
          }
          start = s;
          end = e;
          days = daysInclusive(s, e);
        }
      }

      const ratePaise = rupeesToPaise(Number(item.ratePerDay));
      const baseAmount = Math.round(days * ratePaise);
      const discountPercent = Number(item.discountPercent || 0);
      const discountPaise = Math.round(baseAmount * (discountPercent / 100));
      const amount = baseAmount - discountPaise;
      const lineTaxPercent = item.taxPercent !== undefined ? Number(item.taxPercent) : 18;
      const lineTaxPaise = Math.round(amount * (lineTaxPercent / 100));

      lines.push({
        siteId: toObjectId(item.siteId),
        description: item.description,
        ratePerDay: ratePaise,
        startDate: start,
        endDate: end,
        days,
        discountPercent,
        taxPercent: lineTaxPercent,
        amount,
      });

      subtotal += amount;
      totalTaxPaise += lineTaxPaise;
    }

    const taxPercent = data.taxPercent !== undefined
      ? Number(data.taxPercent)
      : (subtotal > 0 ? Math.round((totalTaxPaise / subtotal) * 100) : 18);
    const taxAmount = data.taxAmount !== undefined
      ? rupeesToPaise(Number(data.taxAmount))
      : totalTaxPaise;
    const total = subtotal + taxAmount;

    const doc = await Quotation.create({
      quoteNumber,
      trackingToken: generate32CharToken(),
      leadId: lead._id,
      clientName: data.clientName || lead.companyName,
      clientContactPerson: data.clientContactPerson || lead.contactPerson,
      clientEmail: data.clientEmail || lead.email,
      clientPhone: data.clientPhone || lead.mobile,
      clientGstin: data.clientGstin,
      clientAddress: data.clientAddress || lead.companyAddress,
      clientCity: data.clientCity || lead.city,
      clientState: data.clientState,
      isInterState: data.isInterState ?? false,
      notes: data.notes,
      terms: data.terms || [],
      bankDetails: data.bankDetails,
      signatureImage: data.signatureImage,
      signatoryName: data.signatoryName,
      signatoryDesignation: data.signatoryDesignation,
      sites: lines,
      subtotal,
      taxPercent,
      taxAmount,
      total,
      validUntil,
      status: 'Draft',
      createdBy: toObjectId(ctx.user.id),
    });

    await doc.populate('leadId', 'companyName contactPerson mobile email');
    await doc.populate('sites.siteId', 'code siteCode city baseCostPerDay type address');

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
        let start: Date | null = null;
        let end: Date | null = null;
        let days = Number(item.days || 30);

        if (item.startDate && item.endDate) {
          const s = new Date(item.startDate);
          const e = new Date(item.endDate);
          if (!isNaN(s.getTime()) && !isNaN(e.getTime())) {
            if (e < s) {
              throw new ValidationError('endDate must be on or after startDate');
            }
            start = s;
            end = e;
            days = daysInclusive(s, e);
          }
        }

        const ratePaise = rupeesToPaise(Number(item.ratePerDay));
        const baseAmount = Math.round(days * ratePaise);
        const discountPercent = Number(item.discountPercent || 0);
        const discountPaise = Math.round(baseAmount * (discountPercent / 100));
        const amount = baseAmount - discountPaise;
        const lineTaxPercent = item.taxPercent !== undefined ? Number(item.taxPercent) : 18;
        const lineTaxPaise = Math.round(amount * (lineTaxPercent / 100));

        lines.push({
          siteId: toObjectId(item.siteId),
          description: item.description,
          ratePerDay: ratePaise,
          startDate: start,
          endDate: end,
          days,
          discountPercent,
          taxPercent: lineTaxPercent,
          amount,
        });

        subtotal += amount;
      }
    }

    const calculatedTaxPaise = lines.reduce(
      (sum, l) => sum + Math.round(l.amount * ((l.taxPercent ?? 18) / 100)),
      0,
    );
    const taxPercent = data.taxPercent !== undefined
      ? Number(data.taxPercent)
      : (subtotal > 0 ? Math.round((calculatedTaxPaise / subtotal) * 100) : 18);
    const taxAmount = data.taxAmount !== undefined
      ? rupeesToPaise(Number(data.taxAmount))
      : (data.sites || data.taxPercent !== undefined ? calculatedTaxPaise : quotation.taxAmount);
    const total = subtotal + taxAmount;

    if (data.taxPercent !== undefined) quotation.taxPercent = taxPercent;
    if (data.clientName !== undefined) quotation.clientName = data.clientName;
    if (data.clientContactPerson !== undefined) quotation.clientContactPerson = data.clientContactPerson;
    if (data.clientEmail !== undefined) quotation.clientEmail = data.clientEmail;
    if (data.clientPhone !== undefined) quotation.clientPhone = data.clientPhone;
    if (data.clientGstin !== undefined) quotation.clientGstin = data.clientGstin;
    if (data.clientAddress !== undefined) quotation.clientAddress = data.clientAddress;
    if (data.clientCity !== undefined) quotation.clientCity = data.clientCity;
    if (data.clientState !== undefined) quotation.clientState = data.clientState;
    if (data.isInterState !== undefined) quotation.isInterState = data.isInterState;
    if (data.notes !== undefined) quotation.notes = data.notes;
    if (data.terms !== undefined) quotation.terms = data.terms;
    if (data.bankDetails !== undefined) quotation.bankDetails = data.bankDetails;
    if (data.signatureImage !== undefined) quotation.signatureImage = data.signatureImage;
    if (data.signatoryName !== undefined) quotation.signatoryName = data.signatoryName;
    if (data.signatoryDesignation !== undefined) quotation.signatoryDesignation = data.signatoryDesignation;
    if (data.validUntil) quotation.validUntil = new Date(data.validUntil);

    quotation.sites = lines;
    quotation.subtotal = subtotal;
    quotation.taxAmount = taxAmount;
    quotation.total = total;
    quotation.updatedBy = toObjectId(ctx.user.id);

    await quotation.save();
    await quotation.populate('leadId', 'companyName contactPerson mobile email');
    await quotation.populate('sites.siteId', 'code siteCode city baseCostPerDay type address');

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
      .populate('leadId', 'companyName contactPerson mobile email city companyAddress')
      .populate('sites.siteId', 'code siteCode city type address sizeWidth sizeHeight baseCostPerDay')
      .exec();

    if (!quotation) throw new NotFoundError('Quotation not found');

    const lead = quotation.leadId as any;
    const clientCompanyName = quotation.clientName || lead?.companyName || 'Valued Client';
    const clientContact = quotation.clientContactPerson || lead?.contactPerson || '-';
    const clientPhone = quotation.clientPhone || lead?.mobile || '-';
    const clientEmail = quotation.clientEmail || lead?.email || '-';
    const clientCity = quotation.clientCity || lead?.city || '';
    const clientState = quotation.clientState || '';
    const clientAddress = quotation.clientAddress || lead?.companyAddress || '';
    const clientGstin = quotation.clientGstin || '';

    const items: QuotationLineItem[] = [];
    let grossTotalPaise = 0;
    let totalDiscountPaise = 0;

    for (const [index, line] of quotation.sites.entries()) {
      const site = line.siteId as any;
      const siteCode = site?.code || site?.siteCode || `SITE-${index + 1}`;
      const location = site?.address || site?.city ? `${site.address || ''} ${site.city ? `(${site.city})` : ''}`.trim() : (line.description || 'Outdoor Display Site');
      const mediaType = site?.type || 'Hoarding';
      const dimensions = (site?.sizeWidth && site?.sizeHeight)
        ? `${site.sizeWidth}ft x ${site.sizeHeight}ft (${site.sizeWidth * site.sizeHeight} sq.ft)`
        : (line.description || 'Standard Display');
      const startStr = line.startDate
        ? new Date(line.startDate).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' })
        : '';
      const endStr = line.endDate
        ? new Date(line.endDate).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' })
        : '';
      const displayDates = (startStr && endStr) ? `${startStr} - ${endStr}` : `${line.days} Days (TBD)`;

      const baseAmount = Math.round(line.days * line.ratePerDay);
      const discountPercent = Number(line.discountPercent || 0);
      const discountPaise = Math.round(baseAmount * (discountPercent / 100));
      grossTotalPaise += baseAmount;
      totalDiscountPaise += discountPaise;

      items.push({
        index: index + 1,
        siteCode,
        location,
        mediaType,
        dimensions,
        dates: displayDates,
        days: line.days,
        ratePerDay: line.ratePerDay,
        discountPercent,
        taxPercent: line.taxPercent !== undefined ? line.taxPercent : 18,
        amount: line.amount,
      });
    }

    let pdfBuffer: Buffer;
    try {
      pdfBuffer = await renderQuotationBillBookPdf({
        quotationNumber: quotation.quoteNumber,
        date: quotation.createdAt,
        validUntil: quotation.validUntil,
        status: quotation.status,
        client: {
          companyName: clientCompanyName,
          contactPerson: clientContact,
          phone: clientPhone,
          email: clientEmail,
          city: clientCity,
          state: clientState,
          address: clientAddress,
          gstin: clientGstin,
        },
        items,
        pricing: {
          grossTotal: grossTotalPaise,
          discountTotal: totalDiscountPaise,
          subtotal: quotation.subtotal,
          taxRate: quotation.taxPercent ? quotation.taxPercent / 100 : 0.18,
          taxAmount: quotation.taxAmount,
          grandTotal: quotation.total,
          isInterState: quotation.isInterState ?? false,
        },
        terms: (quotation.terms && quotation.terms.length > 0) ? quotation.terms : undefined,
        bankDetails: quotation.bankDetails ? {
          bankName: quotation.bankDetails.bankName,
          accountName: quotation.bankDetails.accountName,
          accountNumber: quotation.bankDetails.accountNumber,
          ifsc: quotation.bankDetails.ifscCode,
          branch: quotation.bankDetails.branch,
        } : undefined,
        signature: {
          image: quotation.signatureImage,
          signatoryName: quotation.signatoryName,
          signatoryDesignation: quotation.signatoryDesignation,
        },
      });
    } catch (renderErr) {
      console.warn('[QuotationPdf] renderQuotationBillBookPdf fallback to standard renderPdf:', renderErr);
      const rows: string[][] = items.map((it) => [
        it.siteCode ? `${it.siteCode} (${it.location})` : it.location || 'Outdoor Site',
        it.dates,
        String(it.days),
        formatPaise(it.ratePerDay),
        formatPaise(it.amount),
      ]);
      pdfBuffer = await renderPdf({
        title: 'PROPOSAL / QUOTATION',
        reference: quotation.quoteNumber,
        meta: [
          ['Client', clientCompanyName],
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
    }

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

    // 1. Update Lead to 'Proposal Sent' stage with audit trail
    if (quotation.leadId) {
      await Lead.updateOne(
        { _id: quotation.leadId },
        {
          $set: { status: 'Proposal Sent' },
          $push: {
            statusHistory: {
              to: 'Proposal Sent',
              reason: `Proposal #${quotation.quoteNumber} dispatched to ${sentTo}`,
              changedAt: new Date(),
            },
          },
        },
      );
    }

    // 2. Dispatch real email via system email service
    const publicUrl = `/q/${quotation.trackingToken}`;
    const clientBaseUrl = config.cors.origins[0] || 'http://localhost:3000';
    const fullPublicUrl = `${clientBaseUrl}${publicUrl}`;
    try {
      await sendEmail({
        to: sentTo,
        subject: `Media Proposal #${quotation.quoteNumber} - Media Octus Outdoor Advertising`,
        text: `Dear ${quotation.clientContactPerson || quotation.clientName || 'Valued Client'},\n\nPlease review your outdoor media proposal #${quotation.quoteNumber} here:\n${fullPublicUrl}\n\n${message || ''}\n\nBest Regards,\nMedia Octus Team`,
        html: `
          <div style="font-family: Arial, sans-serif; color: #1e293b; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background-color: #ffffff;">
            <div style="background-color: #8B2424; color: #ffffff; padding: 18px 24px; border-radius: 8px; text-align: left;">
              <h2 style="margin: 0; font-size: 20px; font-weight: bold; letter-spacing: 0.5px;">MEDIA OCTUS</h2>
              <p style="margin: 4px 0 0 0; font-size: 13px; opacity: 0.9;">Official Outdoor Media Proposal &bull; #${quotation.quoteNumber}</p>
            </div>
            <div style="padding: 24px 0;">
              <p style="font-size: 14px; margin-top: 0;">Dear <strong>${quotation.clientContactPerson || quotation.clientName || 'Valued Client'}</strong>,</p>
              <p style="font-size: 14px; line-height: 1.5; color: #334155;">
                We have prepared a customized outdoor media proposal for <strong>${quotation.clientName || 'your campaign'}</strong>.
              </p>
              ${message ? `<div style="background: #f8fafc; padding: 14px; border-left: 4px solid #8B2424; margin: 18px 0; font-size: 13px; color: #475569; border-radius: 4px;">${message}</div>` : ''}
              <div style="margin: 28px 0; text-align: center;">
                <a href="${fullPublicUrl}" style="background-color: #8B2424; color: #ffffff; padding: 13px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 14px; display: inline-block;">
                  View &amp; Accept Proposal &rarr;
                </a>
              </div>
              <p style="font-size: 12px; color: #64748b; line-height: 1.4;">
                Or access directly using this link:<br/>
                <a href="${fullPublicUrl}" style="color: #8B2424; word-break: break-all;">${fullPublicUrl}</a>
              </p>
            </div>
            <div style="border-top: 1px solid #e2e8f0; padding-top: 14px; font-size: 11px; color: #94a3b8; text-align: center;">
              &copy; ${new Date().getFullYear()} Media Octus Pvt. Ltd. Indore, MP. All rights reserved.
            </div>
          </div>
        `,
      });
    } catch (emailErr) {
      console.warn('[QuotationsService.send] Email dispatch notification caught:', emailErr);
    }

    return {
      quotation,
      trackingToken: quotation.trackingToken,
      publicUrl,
    };
  }

  /**
   * B3 — Public Proposal View (No Login Required!).
   * Returns ONLY client-facing details.
   * Supports lookup by 32-char token OR ObjectId fallback.
   */
  static async getPublicByToken(token: string): Promise<Record<string, unknown>> {
    let quotation = await Quotation.findOne({ trackingToken: token, deletedAt: null })
      .populate('leadId', 'companyName contactPerson email mobile companyAddress city state')
      .populate('sites.siteId', 'siteCode code name location city state type mediaType')
      .exec();

    if (!quotation && Types.ObjectId.isValid(token)) {
      quotation = await Quotation.findOne({ _id: toObjectId(token), deletedAt: null })
        .populate('leadId', 'companyName contactPerson email mobile companyAddress city state')
        .populate('sites.siteId', 'siteCode code name location city state type mediaType')
        .exec();
    }

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
      clientContactPerson: quotation.clientContactPerson || leadInfo?.contactPerson || '',
      clientEmail: quotation.clientEmail || leadInfo?.email || '',
      clientPhone: quotation.clientPhone || leadInfo?.mobile || '',
      clientAddress: quotation.clientAddress || leadInfo?.companyAddress || '',
      clientCity: quotation.clientCity || leadInfo?.city || '',
      clientState: quotation.clientState || leadInfo?.state || '',
      clientGstin: quotation.clientGstin || '',
      isInterState: quotation.isInterState ?? false,
      sites: quotation.sites.map((line) => {
        const s = line.siteId as any;
        const siteLabel = line.description || `${s?.siteCode || s?.atrNo || 'Media Site'} - ${s?.location || s?.name || 'Outdoor'}`;
        return {
          siteCode: s?.siteCode || s?.atrNo || s?.code || 'Media Site',
          description: siteLabel,
          city: s?.city || quotation.clientCity || 'Indore',
          type: s?.mediaType || s?.type || 'Hoarding',
          startDate: line.startDate,
          endDate: line.endDate,
          days: line.days,
          ratePerDayRupees: line.ratePerDay / 100,
          discountPercent: line.discountPercent || 0,
          taxPercent: line.taxPercent ?? 18,
          amountRupees: line.amount / 100,
        };
      }),
      subtotalRupees: quotation.subtotal / 100,
      taxPercent: quotation.taxPercent,
      taxAmountRupees: quotation.taxAmount / 100,
      totalRupees: quotation.total / 100,
      validUntil: quotation.validUntil,
      status: quotation.status,
      terms: quotation.terms || [],
      bankDetails: quotation.bankDetails,
      signatoryName: quotation.signatoryName,
      signatoryDesignation: quotation.signatoryDesignation,
      viewedAt: quotation.viewedAt,
      acceptedAt: quotation.acceptedAt,
      rejectedAt: quotation.rejectedAt,
      rejectionReason: quotation.rejectionReason,
      pdfUrl: quotation.pdfKey ? await fileService.url(quotation.pdfKey) : null,
    };
  }

  /**
   * B3 — Public Proposal Accept (No Login Required!).
   */
  static async acceptPublic(token: string): Promise<Record<string, unknown>> {
    let quotation = await Quotation.findOne({ trackingToken: token, deletedAt: null });
    if (!quotation && Types.ObjectId.isValid(token)) {
      quotation = await Quotation.findOne({ _id: toObjectId(token), deletedAt: null });
    }
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

    // Update Lead to Won with status history audit trail and clear next action
    if (quotation.leadId) {
      await Lead.updateOne(
        { _id: quotation.leadId },
        {
          $set: { status: 'Won', nextActionDate: null },
          $push: {
            statusHistory: {
              to: 'Won',
              reason: `Proposal #${quotation.quoteNumber} accepted by client`,
              changedAt: now,
            },
          },
        },
      );
    }

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
    let quotation = await Quotation.findOne({ trackingToken: token, deletedAt: null });
    if (!quotation && Types.ObjectId.isValid(token)) {
      quotation = await Quotation.findOne({ _id: toObjectId(token), deletedAt: null });
    }
    if (!quotation) throw new NotFoundError('Proposal not found');

    const now = new Date();

    quotation.status = 'Rejected';
    quotation.rejectedAt = now;
    quotation.rejectionReason = reason;
    await quotation.save();

    // Record in Lead status history
    if (quotation.leadId) {
      await Lead.updateOne(
        { _id: quotation.leadId },
        {
          $push: {
            statusHistory: {
              to: 'Negotiation',
              reason: `Proposal #${quotation.quoteNumber} declined by client: ${reason}`,
              changedAt: now,
            },
          },
        },
      );
    }

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

  /**
   * Internal Accept Action — When sales executive receives client confirmation offline (Phone/WhatsApp).
   */
  static async acceptInternal(id: string, ctx: RequestContext): Promise<IQuotation> {
    const quotation = await Quotation.findOne({ _id: toObjectId(id), deletedAt: null });
    if (!quotation) throw new NotFoundError('Quotation not found');

    const now = new Date();
    quotation.status = 'Accepted';
    quotation.acceptedAt = now;
    quotation.updatedBy = toObjectId(ctx.user.id);
    await quotation.save();

    // Update Lead to Won with status history audit trail
    if (quotation.leadId) {
      await Lead.updateOne(
        { _id: quotation.leadId },
        {
          $set: { status: 'Won', nextActionDate: null },
          $push: {
            statusHistory: {
              to: 'Won',
              reason: `Proposal #${quotation.quoteNumber} marked as Accepted (Client confirmed via executive)`,
              changedAt: now,
            },
          },
        },
      );
    }

    // Convert to campaign
    try {
      await createFromQuotation(String(quotation._id), {
        userId: ctx.user.id ?? quotation.createdBy ?? 'system',
      });
    } catch (err) {
      console.error('[acceptInternal] failed to create campaign from quotation', err);
    }

    return quotation as IQuotation;
  }

  static async getQuotationStats(ctx: RequestContext): Promise<{
    totalQuotedValue: number;
    totalCount: number;
    awaitingValue: number;
    awaitingCount: number;
    acceptedValue: number;
    acceptedCount: number;
    draftValue: number;
    draftCount: number;
  }> {
    const isUnscoped = ['admin', 'manager', 'finance', 'hr', 'ops'].includes(
      ctx.user?.role?.toLowerCase() || '',
    );

    const baseFilter: Record<string, any> = { deletedAt: null };

    if (!isUnscoped) {
      const myLeads = await Lead.find({
        $or: [
          { assignedTo: toObjectId(ctx.user.id) },
          { createdBy: toObjectId(ctx.user.id) },
        ],
        deletedAt: null,
      }).select('_id').lean();
      const myLeadIds = myLeads.map((l) => l._id);

      baseFilter.$or = [
        { createdBy: toObjectId(ctx.user.id) },
        { leadId: { $in: myLeadIds } },
      ];
    }

    const [statsAgg] = await Quotation.aggregate([
      { $match: baseFilter },
      {
        $group: {
          _id: null,
          totalQuotedValue: { $sum: '$total' },
          totalCount: { $sum: 1 },
          awaitingValue: {
            $sum: { $cond: [{ $eq: ['$status', 'Sent'] }, '$total', 0] },
          },
          awaitingCount: {
            $sum: { $cond: [{ $eq: ['$status', 'Sent'] }, 1, 0] },
          },
          acceptedValue: {
            $sum: { $cond: [{ $eq: ['$status', 'Accepted'] }, '$total', 0] },
          },
          acceptedCount: {
            $sum: { $cond: [{ $eq: ['$status', 'Accepted'] }, 1, 0] },
          },
          draftValue: {
            $sum: { $cond: [{ $eq: ['$status', 'Draft'] }, '$total', 0] },
          },
          draftCount: {
            $sum: { $cond: [{ $eq: ['$status', 'Draft'] }, 1, 0] },
          },
        },
      },
    ]);

    return {
      totalQuotedValue: statsAgg?.totalQuotedValue || 0,
      totalCount: statsAgg?.totalCount || 0,
      awaitingValue: statsAgg?.awaitingValue || 0,
      awaitingCount: statsAgg?.awaitingCount || 0,
      acceptedValue: statsAgg?.acceptedValue || 0,
      acceptedCount: statsAgg?.acceptedCount || 0,
      draftValue: statsAgg?.draftValue || 0,
      draftCount: statsAgg?.draftCount || 0,
    };
  }
}
