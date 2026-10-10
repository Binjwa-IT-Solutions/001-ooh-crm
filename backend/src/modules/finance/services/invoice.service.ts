import crypto from 'crypto';
import { Types } from 'mongoose';
import { Invoice, type IInvoice, type IInvoiceItem, type InvoiceType, type InvoiceStatus } from '../models/invoice.model.js';
import { PaymentIn } from '../models/paymentIn.model.js';
import { paymentInService } from './paymentIn.service.js';
import Campaign from '../../campaigns/campaign.model.js';
import { Lead } from '../../leads/leads.model.js';
import { Employee } from '../../employees/employees.model.js';
import { NotFoundError, ValidationError, ForbiddenError } from '../../../core/errors/index.js';
import { toObjectId } from '../../../core/db/basePlugin.js';
import type { RequestContext } from '../../../core/context.js';
import { renderPdf, formatPaise, lineItemsTable, horizontalRule, type TableColumn } from '../../../core/pdf/index.js';
import type {
  CreateInvoiceInput,
  UpdateInvoiceInput,
  ListInvoicesQuery,
  RecordInvoicePaymentInput,
} from '../validators/invoice.validator.js';

export interface InvoiceDto {
  id: string;
  _id: string;
  type: InvoiceType;
  invoicePrefix: string;
  invoiceNumber: string;
  shareToken?: string;
  partyId?: string | null;
  partyName: string;
  billingAddress: string;
  shippingAddress: string;
  gstin: string;
  placeOfSupply: string;
  contactPerson: string;
  contactMobile: string;
  contactEmail: string;
  campaignId?: string | null;
  campaignCode?: string;
  campaignName?: string;
  invoiceDate: string;
  dueDate: string;
  items: Array<{
    name: string;
    description: string;
    hsn: string;
    quantity: number;
    unit: string;
    discount?: number; // in paise
    rate: number; // in paise
    taxPercent: number;
    taxAmount: number; // in paise
    amount: number; // in paise
  }>;
  subtotal: number;
  discount: number;
  additionalCharges: number;
  taxableAmount: number;
  taxAmount: number;
  tcs: number;
  roundOff: number;
  totalAmount: number;
  amountReceived: number;
  balanceAmount: number;
  status: InvoiceStatus;
  bankDetails?: {
    bankName?: string;
    accountNumber?: string;
    ifsc?: string;
    branch?: string;
    accountHolderName?: string;
  };
  termsAndConditions?: string;
  notes?: string;
  editHistory: Array<{
    modifiedBy: { id: string; name: string } | null;
    modifiedAt: string;
    changesSummary: string;
    note?: string;
  }>;
  createdBy: {
    id: string;
    name: string;
    email?: string;
  } | null;
  payments?: Array<{
    id: string;
    amount: number;
    receivedAt: string;
    method: string;
    transactionId?: string;
    notes?: string;
    reconciled: boolean;
  }>;
  createdAt: string;
  updatedAt: string;
}

export interface PaginatedInvoices {
  invoices: InvoiceDto[];
  total: number;
  count: number;
  totalAmount: number;
  totalReceived: number;
  totalBalance: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface RecentPricePoint {
  invoiceNumber: string;
  invoiceDate: string;
  itemName: string;
  rate: number; // in paise
  quantity: number;
  unit: string;
  taxPercent: number;
}

function iso(date?: Date | null): string {
  return date ? date.toISOString() : new Date().toISOString();
}

function calculateTotals(
  items: Array<{
    name: string;
    description?: string;
    hsn?: string;
    quantity?: number;
    unit?: string;
    discount?: number;
    rate: number;
    taxPercent?: number;
  }>,
  discount: number = 0,
  additionalCharges: number = 0,
  tcs: number = 0,
  roundOff: number = 0,
  amountReceived: number = 0
) {
  let subtotal = 0;
  let totalItemDiscount = 0;
  let totalTax = 0;

  const processedItems: IInvoiceItem[] = items.map((item) => {
    const qty = Math.max(0.001, item.quantity || 1);
    const rate = Math.max(0, Math.round(item.rate || 0));
    const lineDiscount = Math.max(0, Math.round(item.discount || 0));
    const baseAmount = Math.round(qty * rate);
    const taxableLineAmount = Math.max(0, baseAmount - lineDiscount);
    const taxPercent = Math.max(0, Math.min(100, item.taxPercent !== undefined ? item.taxPercent : 18));
    const taxAmount = Math.round((taxableLineAmount * taxPercent) / 100);
    const lineTotal = taxableLineAmount + taxAmount;

    subtotal += baseAmount;
    totalItemDiscount += lineDiscount;
    totalTax += taxAmount;

    return {
      name: item.name.trim(),
      description: item.description?.trim() || '',
      hsn: item.hsn?.trim() || '998361',
      quantity: qty,
      unit: item.unit?.trim() || 'Nos',
      discount: lineDiscount,
      rate,
      taxPercent,
      taxAmount,
      amount: lineTotal,
    };
  });

  const cleanDiscount = Math.max(0, Math.round(discount || 0));
  const cleanCharges = Math.max(0, Math.round(additionalCharges || 0));
  const taxableAmount = Math.max(0, subtotal - totalItemDiscount - cleanDiscount + cleanCharges);
  const cleanTcs = Math.max(0, Math.round(tcs || 0));
  const cleanRoundOff = Math.round(roundOff || 0);

  const totalAmount = Math.max(0, taxableAmount + totalTax + cleanTcs + cleanRoundOff);
  const cleanReceived = Math.max(0, Math.min(totalAmount, Math.round(amountReceived || 0)));
  const balanceAmount = Math.max(0, totalAmount - cleanReceived);

  return {
    items: processedItems,
    subtotal,
    discount: cleanDiscount,
    additionalCharges: cleanCharges,
    taxableAmount,
    taxAmount: totalTax,
    tcs: cleanTcs,
    roundOff: cleanRoundOff,
    totalAmount,
    amountReceived: cleanReceived,
    balanceAmount,
  };
}

async function generateNextInvoiceNumber(type: InvoiceType, requestedPrefix?: string): Promise<string> {
  const isPI = type === 'proforma';
  let basePrefix: string;

  if (requestedPrefix && requestedPrefix.trim()) {
    const raw = requestedPrefix.trim();
    if (raw.includes('-')) {
      basePrefix = raw;
    } else {
      basePrefix = `${raw}-TEST`;
    }
  } else {
    basePrefix = isPI ? 'PI-TEST' : 'INV-TEST';
  }

  // Escape special regex characters in basePrefix
  const escapedPrefix = basePrefix.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
  const pattern = new RegExp(`^${escapedPrefix}-(\\d+)$`, 'i');

  // Query ALL invoices matching this prefix (including soft-deleted)
  const existingInvoices = await Invoice.find({ invoiceNumber: pattern })
    .select('invoiceNumber')
    .lean();

  let maxSeq = 0;
  for (const inv of existingInvoices) {
    if (inv.invoiceNumber) {
      const match = inv.invoiceNumber.match(pattern);
      if (match && match[1]) {
        const seq = parseInt(match[1], 10);
        if (!isNaN(seq) && seq > maxSeq) {
          maxSeq = seq;
        }
      }
    }
  }

  let nextSeq = maxSeq + 1;
  let candidate = `${basePrefix}-${String(nextSeq).padStart(3, '0')}`;

  // Extra guard: loop to ensure candidate does not collide with any existing record
  while (await Invoice.exists({ invoiceNumber: candidate })) {
    nextSeq++;
    candidate = `${basePrefix}-${String(nextSeq).padStart(3, '0')}`;
  }

  return candidate;
}

function toInvoiceDto(doc: any, linkedPayments: any[] = []): InvoiceDto {
  const creator = doc.createdBy as any;
  const campaign = doc.campaignId as any;

  return {
    id: String(doc._id),
    _id: String(doc._id),
    type: doc.type,
    invoicePrefix: doc.invoicePrefix || (doc.type === 'proforma' ? 'PI' : 'INV'),
    invoiceNumber: doc.invoiceNumber,
    shareToken: doc.shareToken || String(doc._id),
    partyId: doc.partyId ? String(doc.partyId) : null,
    partyName: doc.partyName,
    billingAddress: doc.billingAddress || '',
    shippingAddress: doc.shippingAddress || '',
    gstin: doc.gstin || '',
    placeOfSupply: doc.placeOfSupply || 'Maharashtra (27)',
    contactPerson: doc.contactPerson || '',
    contactMobile: doc.contactMobile || '',
    contactEmail: doc.contactEmail || '',
    campaignId: doc.campaignId ? String(campaign?._id || doc.campaignId) : null,
    campaignCode: campaign?.campaignCode || '',
    campaignName: campaign?.name || '',
    invoiceDate: iso(doc.invoiceDate),
    dueDate: iso(doc.dueDate),
    items: (doc.items || []).map((i: any) => ({
      name: i.name,
      description: i.description || '',
      hsn: i.hsn || '998361',
      quantity: i.quantity,
      unit: i.unit || 'Nos',
      discount: i.discount || 0,
      rate: i.rate,
      taxPercent: i.taxPercent,
      taxAmount: i.taxAmount,
      amount: i.amount,
    })),
    subtotal: doc.subtotal || 0,
    discount: doc.discount || 0,
    additionalCharges: doc.additionalCharges || 0,
    taxableAmount: doc.taxableAmount || 0,
    taxAmount: doc.taxAmount || 0,
    tcs: doc.tcs || 0,
    roundOff: doc.roundOff || 0,
    totalAmount: doc.totalAmount || 0,
    amountReceived: doc.amountReceived || 0,
    balanceAmount: doc.balanceAmount || 0,
    status: doc.status || 'Draft',
    bankDetails: doc.bankDetails || {},
    termsAndConditions: doc.termsAndConditions || '',
    notes: doc.notes || '',
    editHistory: (doc.editHistory || []).map((h: any) => ({
      modifiedBy: h.modifiedBy
        ? { id: String(h.modifiedBy._id || h.modifiedBy), name: h.modifiedBy.fullName || h.modifiedBy.name || 'User' }
        : null,
      modifiedAt: iso(h.modifiedAt),
      changesSummary: h.changesSummary || '',
      note: h.note || '',
    })),
    createdBy: creator
      ? {
          id: String(creator._id || doc.createdBy),
          name: creator.fullName || creator.name || 'Staff',
          email: creator.workEmail || creator.email || '',
        }
      : null,
    payments: linkedPayments.map((p) => ({
      id: String(p._id),
      amount: p.amount,
      receivedAt: iso(p.receivedAt),
      method: p.method,
      transactionId: p.transactionId || '',
      notes: p.notes || '',
      reconciled: Boolean(p.reconciled),
    })),
    createdAt: iso(doc.createdAt),
    updatedAt: iso(doc.updatedAt),
  };
}

export const invoiceService = {
  /** Create a new Sales or Proforma Invoice */
  async createInvoice(input: CreateInvoiceInput, ctx: RequestContext): Promise<InvoiceDto> {
    const creatorId = toObjectId(ctx.user.id);
    let partyId = input.partyId ? toObjectId(input.partyId) : null;
    let campaignId = input.campaignId ? toObjectId(input.campaignId) : null;

    // Verify party if provided
    if (partyId) {
      const party = await Lead.findById(partyId).lean();
      if (!party) {
        partyId = null;
      }
    }

    // Verify campaign if provided
    if (campaignId) {
      const camp = await Campaign.findById(campaignId).lean();
      if (!camp) {
        campaignId = null;
      }
    }

    const type = input.type || 'sales_invoice';
    const prefix = input.invoicePrefix || (type === 'proforma' ? 'PI' : 'INV');
    let invoiceNumber = input.invoiceNumber?.trim();

    if (!invoiceNumber) {
      invoiceNumber = await generateNextInvoiceNumber(type, prefix);
    } else {
      // Check for duplicate number across all invoices (unique index applies to soft-deleted too)
      const existing = await Invoice.findOne({ invoiceNumber });
      if (existing) {
        throw new ValidationError(`Invoice number ${invoiceNumber} already exists`);
      }
    }

    const totals = calculateTotals(
      input.items,
      input.discount,
      input.additionalCharges,
      input.tcs,
      input.roundOff,
      0
    );

    const shareToken = crypto.randomBytes(16).toString('hex');

    const doc = new Invoice({
      type,
      invoicePrefix: prefix,
      invoiceNumber,
      shareToken,
      partyId,
      partyName: input.partyName.trim(),
      billingAddress: input.billingAddress || '',
      shippingAddress: input.shippingAddress || '',
      gstin: input.gstin || '',
      placeOfSupply: input.placeOfSupply || 'Maharashtra (27)',
      contactPerson: input.contactPerson || '',
      contactMobile: input.contactMobile || '',
      contactEmail: input.contactEmail || '',
      campaignId,
      invoiceDate: new Date(input.invoiceDate),
      dueDate: new Date(input.dueDate),
      items: totals.items,
      subtotal: totals.subtotal,
      discount: totals.discount,
      additionalCharges: totals.additionalCharges,
      taxableAmount: totals.taxableAmount,
      taxAmount: totals.taxAmount,
      tcs: totals.tcs,
      roundOff: totals.roundOff,
      totalAmount: totals.totalAmount,
      amountReceived: 0,
      balanceAmount: totals.totalAmount,
      status: input.status || 'Draft',
      bankDetails: input.bankDetails || {},
      termsAndConditions: input.termsAndConditions,
      notes: input.notes,
      editHistory: [
        {
          modifiedBy: creatorId,
          modifiedAt: new Date(),
          changesSummary: `Invoice created as ${input.status || 'Draft'}`,
          note: 'Initial creation',
        },
      ],
      createdBy: creatorId,
      isDeleted: false,
    });

    await doc.save();
    await doc.populate(['createdBy', 'campaignId']);

    return toInvoiceDto(doc);
  },

  /** List invoices with filtering & pagination */
  async listInvoices(query: ListInvoicesQuery, _ctx: RequestContext): Promise<PaginatedInvoices> {
    const filter: Record<string, any> = { isDeleted: false };

    if (query.type) {
      filter.type = query.type;
    }

    if (query.status && query.status !== 'all') {
      filter.status = query.status;
    }

    if (query.partyId) {
      filter.partyId = toObjectId(query.partyId);
    }

    if (query.campaignId) {
      filter.campaignId = toObjectId(query.campaignId);
    }

    if (query.search) {
      const term = query.search.trim();
      filter.$or = [
        { invoiceNumber: { $regex: term, $options: 'i' } },
        { partyName: { $regex: term, $options: 'i' } },
        { gstin: { $regex: term, $options: 'i' } },
      ];
    }

    if (query.startDate || query.endDate) {
      filter.invoiceDate = {};
      if (query.startDate) filter.invoiceDate.$gte = new Date(query.startDate);
      if (query.endDate) filter.invoiceDate.$lte = new Date(query.endDate);
    }

    const page = Math.max(1, query.page || 1);
    const pageSize = Math.min(100, Math.max(1, query.pageSize || 20));
    const skip = (page - 1) * pageSize;

    const [docs, total, aggregates] = await Promise.all([
      Invoice.find(filter)
        .populate('createdBy', 'fullName name email workEmail')
        .populate('campaignId', 'campaignCode name')
        .sort({ invoiceDate: -1, createdAt: -1 })
        .skip(skip)
        .limit(pageSize)
        .lean(),
      Invoice.countDocuments(filter),
      Invoice.aggregate([
        { $match: filter },
        {
          $group: {
            _id: null,
            totalAmount: { $sum: '$totalAmount' },
            totalReceived: { $sum: '$amountReceived' },
            totalBalance: { $sum: '$balanceAmount' },
          },
        },
      ]),
    ]);

    const totals = aggregates[0] || { totalAmount: 0, totalReceived: 0, totalBalance: 0 };

    return {
      invoices: docs.map((d) => toInvoiceDto(d)),
      total,
      count: docs.length,
      totalAmount: totals.totalAmount,
      totalReceived: totals.totalReceived,
      totalBalance: totals.totalBalance,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize) || 1,
    };
  },

  /** Get single invoice by ID with linked payment records */
  async getInvoiceById(id: string, _ctx: RequestContext): Promise<InvoiceDto> {
    const objId = toObjectId(id);
    const doc = await Invoice.findOne({ _id: objId, isDeleted: false })
      .populate('createdBy', 'fullName name email workEmail')
      .populate('editHistory.modifiedBy', 'fullName name')
      .populate('campaignId', 'campaignCode name');

    if (!doc) {
      throw new NotFoundError('Invoice not found');
    }

    // Find linked payments
    const payments = await PaymentIn.find({ invoiceId: doc._id }).sort({ receivedAt: -1 }).lean();

    return toInvoiceDto(doc, payments);
  },

  /** Update an existing invoice */
  async updateInvoice(id: string, input: UpdateInvoiceInput, ctx: RequestContext): Promise<InvoiceDto> {
    const objId = toObjectId(id);
    const doc = await Invoice.findOne({ _id: objId, isDeleted: false });

    if (!doc) {
      throw new NotFoundError('Invoice not found');
    }

    const modifierId = toObjectId(ctx.user.id);
    const changes: string[] = [];

    if (input.partyName && input.partyName !== doc.partyName) {
      changes.push(`Party: ${doc.partyName} → ${input.partyName}`);
      doc.partyName = input.partyName.trim();
    }
    if (input.partyId !== undefined) {
      doc.partyId = input.partyId ? toObjectId(input.partyId) : null;
    }
    if (input.billingAddress !== undefined) doc.billingAddress = input.billingAddress;
    if (input.shippingAddress !== undefined) doc.shippingAddress = input.shippingAddress;
    if (input.gstin !== undefined) doc.gstin = input.gstin;
    if (input.placeOfSupply !== undefined) doc.placeOfSupply = input.placeOfSupply;
    if (input.contactPerson !== undefined) doc.contactPerson = input.contactPerson;
    if (input.contactMobile !== undefined) doc.contactMobile = input.contactMobile;
    if (input.contactEmail !== undefined) doc.contactEmail = input.contactEmail;
    if (input.invoiceDate) doc.invoiceDate = new Date(input.invoiceDate);
    if (input.dueDate) doc.dueDate = new Date(input.dueDate);
    if (input.bankDetails) doc.bankDetails = input.bankDetails as any;
    if (input.termsAndConditions !== undefined) doc.termsAndConditions = input.termsAndConditions;
    if (input.notes !== undefined) doc.notes = input.notes;
    if (input.status && input.status !== doc.status) {
      changes.push(`Status: ${doc.status} → ${input.status}`);
      doc.status = input.status;
    }

    // If items or financial fields are updated, recalculate
    const items = input.items || doc.items;
    const discount = input.discount !== undefined ? input.discount : doc.discount;
    const additionalCharges = input.additionalCharges !== undefined ? input.additionalCharges : doc.additionalCharges;
    const tcs = input.tcs !== undefined ? input.tcs : doc.tcs;
    const roundOff = input.roundOff !== undefined ? input.roundOff : doc.roundOff;

    const totals = calculateTotals(
      items,
      discount,
      additionalCharges,
      tcs,
      roundOff,
      doc.amountReceived
    );

    if (input.items) changes.push(`Updated ${items.length} line items`);
    if (totals.totalAmount !== doc.totalAmount) {
      changes.push(`Total: ${formatPaise(doc.totalAmount)} → ${formatPaise(totals.totalAmount)}`);
    }

    doc.items = totals.items;
    doc.subtotal = totals.subtotal;
    doc.discount = totals.discount;
    doc.additionalCharges = totals.additionalCharges;
    doc.taxableAmount = totals.taxableAmount;
    doc.taxAmount = totals.taxAmount;
    doc.tcs = totals.tcs;
    doc.roundOff = totals.roundOff;
    doc.totalAmount = totals.totalAmount;
    doc.balanceAmount = totals.balanceAmount;

    if (changes.length > 0) {
      doc.editHistory.push({
        modifiedBy: modifierId,
        modifiedAt: new Date(),
        changesSummary: changes.join('; '),
        note: input.editNote || 'Invoice updated',
      });
    }

    await doc.save();
    await doc.populate(['createdBy', 'editHistory.modifiedBy', 'campaignId']);

    const payments = await PaymentIn.find({ invoiceId: doc._id }).sort({ receivedAt: -1 }).lean();
    return toInvoiceDto(doc, payments);
  },

  /** Soft delete an invoice */
  async deleteInvoice(id: string, ctx: RequestContext): Promise<{ success: boolean; message: string }> {
    const objId = toObjectId(id);
    const doc = await Invoice.findOne({ _id: objId, isDeleted: false });

    if (!doc) {
      throw new NotFoundError('Invoice not found');
    }

    // Check if invoice has payments recorded
    const paymentCount = await PaymentIn.countDocuments({ invoiceId: doc._id });
    if (paymentCount > 0) {
      throw new ValidationError('Cannot delete an invoice that has recorded client payments. Cancel the invoice or remove linked payments first.');
    }

    doc.isDeleted = true;
    doc.editHistory.push({
      modifiedBy: toObjectId(ctx.user.id),
      modifiedAt: new Date(),
      changesSummary: 'Invoice deleted (soft delete)',
      note: 'Deleted by user',
    });

    await doc.save();
    return { success: true, message: `Invoice ${doc.invoiceNumber} deleted successfully` };
  },

  /** Duplicate an existing invoice / proforma */
  async duplicateInvoice(id: string, ctx: RequestContext): Promise<InvoiceDto> {
    const original = await this.getInvoiceById(id, ctx);
    const nextNumber = await generateNextInvoiceNumber(original.type, original.invoicePrefix);
    const shareToken = crypto.randomBytes(16).toString('hex');

    const doc = new Invoice({
      type: original.type,
      invoicePrefix: original.invoicePrefix,
      invoiceNumber: nextNumber,
      shareToken,
      partyId: original.partyId ? toObjectId(original.partyId) : null,
      partyName: original.partyName,
      billingAddress: original.billingAddress,
      shippingAddress: original.shippingAddress,
      gstin: original.gstin,
      placeOfSupply: original.placeOfSupply,
      contactPerson: original.contactPerson,
      contactMobile: original.contactMobile,
      contactEmail: original.contactEmail,
      campaignId: original.campaignId ? toObjectId(original.campaignId) : null,
      invoiceDate: new Date(),
      dueDate: new Date(Date.now() + 15 * 24 * 60 * 60 * 1000), // 15 days default
      items: original.items,
      subtotal: original.subtotal,
      discount: original.discount,
      additionalCharges: original.additionalCharges,
      taxableAmount: original.taxableAmount,
      taxAmount: original.taxAmount,
      tcs: original.tcs,
      roundOff: original.roundOff,
      totalAmount: original.totalAmount,
      amountReceived: 0,
      balanceAmount: original.totalAmount,
      status: 'Draft',
      bankDetails: original.bankDetails,
      termsAndConditions: original.termsAndConditions,
      notes: original.notes,
      editHistory: [
        {
          modifiedBy: toObjectId(ctx.user.id),
          modifiedAt: new Date(),
          changesSummary: `Duplicated from ${original.invoiceNumber}`,
          note: 'Duplication',
        },
      ],
      createdBy: toObjectId(ctx.user.id),
      isDeleted: false,
    });

    await doc.save();
    await doc.populate(['createdBy', 'campaignId']);
    return toInvoiceDto(doc);
  },

  /** Record a client payment against an invoice */
  async recordInvoicePayment(
    invoiceId: string,
    input: RecordInvoicePaymentInput,
    ctx: RequestContext
  ): Promise<{ invoice: InvoiceDto; payment: any }> {
    const objId = toObjectId(invoiceId);
    const invoice = await Invoice.findOne({ _id: objId, isDeleted: false });

    if (!invoice) {
      throw new NotFoundError('Invoice not found');
    }

    if (invoice.balanceAmount <= 0) {
      throw new ValidationError('This invoice is already fully paid');
    }

    const payAmount = Math.min(input.amount, invoice.balanceAmount);

    // Find or assign campaignId
    let campaignId = invoice.campaignId;
    if (!campaignId) {
      // Look for an existing campaign with this party or create a general reference
      const existingCamp = await Campaign.findOne({ clientId: invoice.partyId }).lean();
      if (existingCamp) {
        campaignId = existingCamp._id as Types.ObjectId;
      }
    }

    // Create payment in record
    const payment = await paymentInService.createPaymentIn(
      {
        campaignId: campaignId ? String(campaignId) : '000000000000000000000000',
        clientId: invoice.partyId ? String(invoice.partyId) : undefined,
        amount: payAmount,
        receivedAt: typeof input.receivedAt === 'string' ? input.receivedAt : input.receivedAt.toISOString(),
        method: input.method,
        transactionId: input.transactionId || `INV-PAY-${invoice.invoiceNumber}`,
        notes: input.notes || `Payment recorded for ${invoice.invoiceNumber}`,
        attachments: input.attachments || [],
      },
      ctx
    );

    // Update payment with invoiceId
    await PaymentIn.findByIdAndUpdate(payment.id, { invoiceId: invoice._id });

    // Update invoice totals and status
    invoice.amountReceived += payAmount;
    invoice.balanceAmount = Math.max(0, invoice.totalAmount - invoice.amountReceived);

    if (invoice.balanceAmount === 0) {
      invoice.status = 'Paid';
    } else if (invoice.amountReceived > 0) {
      invoice.status = 'Partially Paid';
    }

    invoice.editHistory.push({
      modifiedBy: toObjectId(ctx.user.id),
      modifiedAt: new Date(),
      changesSummary: `Payment of ${formatPaise(payAmount)} received (${input.method})`,
      note: input.notes || 'Payment recorded',
    });

    await invoice.save();
    await invoice.populate(['createdBy', 'campaignId']);

    const allPayments = await PaymentIn.find({ invoiceId: invoice._id }).sort({ receivedAt: -1 }).lean();
    return {
      invoice: toInvoiceDto(invoice, allPayments),
      payment,
    };
  },

  /** Get recent historical sales prices for a given party and item */
  async getRecentPartyPrices(partyId: string, itemName?: string): Promise<RecentPricePoint[]> {
    const partyObjId = toObjectId(partyId);
    const filter: Record<string, any> = {
      partyId: partyObjId,
      isDeleted: false,
      status: { $in: ['Sent', 'Partially Paid', 'Paid', 'Draft'] },
    };

    const invoices = await Invoice.find(filter)
      .sort({ invoiceDate: -1, createdAt: -1 })
      .limit(10)
      .lean();

    const pricePoints: RecentPricePoint[] = [];

    for (const inv of invoices) {
      for (const item of inv.items || []) {
        if (!itemName || item.name.toLowerCase().includes(itemName.toLowerCase())) {
          pricePoints.push({
            invoiceNumber: inv.invoiceNumber,
            invoiceDate: iso(inv.invoiceDate),
            itemName: item.name,
            rate: item.rate,
            quantity: item.quantity,
            unit: item.unit,
            taxPercent: item.taxPercent,
          });
        }
      }
    }

    return pricePoints.slice(0, 10);
  },

  /** Generate PDF buffer for invoice */
  async generateInvoicePdf(id: string): Promise<Buffer> {
    const doc = await Invoice.findOne({ _id: toObjectId(id), isDeleted: false })
      .populate('campaignId', 'campaignCode name')
      .lean();

    if (!doc) {
      throw new NotFoundError('Invoice not found');
    }

    const title = doc.type === 'proforma' ? 'PROFORMA INVOICE' : 'TAX INVOICE';
    
    // Check if any line item has discount
    const hasItemDiscount = (doc.items || []).some((item) => (item.discount || 0) > 0);
    const totalItemDiscount = (doc.items || []).reduce((acc, item) => acc + (item.discount || 0), 0);

    const rows = (doc.items || []).map((item, idx) => {
      const descText = item.description?.trim() ? `${item.name}\n${item.description.trim()}` : item.name;
      const hsnText = item.hsn?.trim() || '-';
      const qtyText = `${item.quantity} ${item.unit || 'Nos'}`;
      const rateText = formatPaise(item.rate);
      const taxText = `${item.taxPercent}% (${formatPaise(item.taxAmount)})`;
      const amountText = formatPaise(item.amount);

      if (hasItemDiscount) {
        const discText = (item.discount && item.discount > 0) ? formatPaise(item.discount) : '-';
        return [
          String(idx + 1),
          descText,
          hsnText,
          qtyText,
          discText,
          rateText,
          taxText,
          amountText,
        ];
      }

      return [
        String(idx + 1),
        descText,
        hsnText,
        qtyText,
        rateText,
        taxText,
        amountText,
      ];
    });

    const columns: TableColumn[] = hasItemDiscount
      ? [
          { header: '#', width: 0.05 },
          { header: 'Item & Description', width: 0.29 },
          { header: 'HSN/SAC', width: 0.10 },
          { header: 'Qty', width: 0.10 },
          { header: 'Discount', width: 0.11, align: 'right' },
          { header: 'Rate', width: 0.11, align: 'right' },
          { header: 'Tax', width: 0.10, align: 'right' },
          { header: 'Amount', width: 0.14, align: 'right' },
        ]
      : [
          { header: '#', width: 0.05 },
          { header: 'Item & Description', width: 0.35 },
          { header: 'HSN/SAC', width: 0.12 },
          { header: 'Qty', width: 0.12 },
          { header: 'Rate', width: 0.11, align: 'right' },
          { header: 'Tax', width: 0.11, align: 'right' },
          { header: 'Amount', width: 0.14, align: 'right' },
        ];

    const totals: Array<[string, number]> = [
      ['Subtotal', doc.subtotal],
    ];

    if (totalItemDiscount > 0) totals.push(['Item Discount (-)', -totalItemDiscount]);
    if (doc.discount > 0) totals.push(['Discount (-)', -doc.discount]);
    if (doc.additionalCharges > 0) totals.push(['Additional Charges (+)', doc.additionalCharges]);
    totals.push(['Taxable Amount', doc.taxableAmount]);
    totals.push(['GST / Tax Total', doc.taxAmount]);
    if (doc.tcs > 0) totals.push(['TCS (+)', doc.tcs]);
    if (doc.roundOff !== 0) totals.push(['Round Off', doc.roundOff]);
    totals.push(['Grand Total', doc.totalAmount]);
    if (doc.amountReceived > 0) totals.push(['Amount Received', doc.amountReceived]);
    if (doc.balanceAmount > 0) totals.push(['Balance Due', doc.balanceAmount]);

    // Build meta fields - ONLY non-empty/filled records!
    const meta: Array<[string, string]> = [
      ['Invoice Date', new Date(doc.invoiceDate).toLocaleDateString('en-IN')],
      ['Due Date', new Date(doc.dueDate).toLocaleDateString('en-IN')],
      ['Bill To', doc.partyName],
    ];
    if (doc.billingAddress?.trim()) meta.push(['Address', doc.billingAddress.trim()]);
    if (doc.gstin?.trim()) meta.push(['GSTIN', doc.gstin.trim()]);
    if (doc.placeOfSupply?.trim()) meta.push(['Place of Supply', doc.placeOfSupply.trim()]);
    if (doc.contactPerson?.trim()) meta.push(['Contact Person', doc.contactPerson.trim()]);
    if (doc.contactMobile?.trim()) meta.push(['Mobile', doc.contactMobile.trim()]);
    if (doc.contactEmail?.trim()) meta.push(['Email', doc.contactEmail.trim()]);
    const campaign = doc.campaignId as any;
    if (campaign?.name || campaign?.campaignCode) {
      meta.push(['Campaign', [campaign.campaignCode, campaign.name].filter(Boolean).join(' - ')]);
    }
    meta.push(['Status', doc.status]);

    return renderPdf({
      title,
      reference: doc.invoiceNumber,
      meta,
      build: (pdfDoc) => {
        lineItemsTable(pdfDoc, {
          columns,
          rows,
          totals,
        });

        // Bank Details block - ONLY print if filled!
        const b = doc.bankDetails;
        const hasBankDetails = b && (b.bankName?.trim() || b.accountNumber?.trim() || b.ifsc?.trim() || b.branch?.trim() || b.accountHolderName?.trim());
        if (hasBankDetails) {
          pdfDoc.moveDown(1.5);
          pdfDoc.fontSize(9).font('Helvetica-Bold').fillColor('#0f172a').text('BANK DETAILS');
          pdfDoc.fontSize(8).font('Helvetica').fillColor('#64748b');
          if (b.bankName?.trim()) pdfDoc.text(`Bank: ${b.bankName.trim()}`);
          if (b.accountHolderName?.trim()) pdfDoc.text(`A/C Name: ${b.accountHolderName.trim()}`);
          if (b.accountNumber?.trim()) pdfDoc.text(`A/C No: ${b.accountNumber.trim()}`);
          if (b.ifsc?.trim()) pdfDoc.text(`IFSC: ${b.ifsc.trim()}`);
          if (b.branch?.trim()) pdfDoc.text(`Branch: ${b.branch.trim()}`);
        }

        // Terms block - ONLY print if filled!
        if (doc.termsAndConditions?.trim()) {
          pdfDoc.moveDown(1);
          horizontalRule(pdfDoc);
          pdfDoc.moveDown(0.5);
          pdfDoc.fontSize(8).font('Helvetica-Bold').fillColor('#0f172a').text('Terms & Conditions:');
          pdfDoc.fontSize(7).font('Helvetica').fillColor('#64748b').text(doc.termsAndConditions.trim());
        }

        // Notes block - ONLY print if filled!
        if (doc.notes?.trim()) {
          pdfDoc.moveDown(0.8);
          pdfDoc.fontSize(8).font('Helvetica-Bold').fillColor('#0f172a').text('Notes:');
          pdfDoc.fontSize(7).font('Helvetica').fillColor('#64748b').text(doc.notes.trim());
        }

        // Signatory & Notes block
        pdfDoc.moveDown(2);
        if (pdfDoc.y > pdfDoc.page.height - 110) pdfDoc.addPage();
        const sigY = pdfDoc.y;

        pdfDoc
          .fontSize(8)
          .font('Helvetica')
          .fillColor('#64748b')
          .text('Thank you for your business!\nThis is a computer-generated document.', 48, sigY, { width: 260 });

        pdfDoc
          .fontSize(9)
          .font('Helvetica-Bold')
          .fillColor('#0f172a')
          .text('For MEDIA OCTUS PVT LTD', pdfDoc.page.width - 248, sigY, { width: 200, align: 'right' });

        pdfDoc.moveDown(2.2);
        pdfDoc
          .fontSize(8)
          .font('Helvetica')
          .fillColor('#64748b')
          .text('Authorized Signatory', pdfDoc.page.width - 248, pdfDoc.y, { width: 200, align: 'right' });
      },
    });
  },

  /** Convert an existing Proforma Invoice into a Sales Invoice */
  async convertToSalesInvoice(id: string, ctx: RequestContext): Promise<InvoiceDto> {
    const objId = toObjectId(id);
    const doc = await Invoice.findOne({ _id: objId, isDeleted: false });

    if (!doc) {
      throw new NotFoundError('Proforma invoice not found');
    }

    if (doc.type === 'sales_invoice') {
      throw new ValidationError('Invoice is already a Sales Tax Invoice');
    }

    const previousNumber = doc.invoiceNumber;
    const newInvoiceNumber = await generateNextInvoiceNumber('sales_invoice', 'INV');

    doc.type = 'sales_invoice';
    doc.invoicePrefix = 'INV';
    doc.invoiceNumber = newInvoiceNumber;
    doc.status = 'Sent';
    doc.editHistory.push({
      modifiedBy: toObjectId(ctx.user.id),
      modifiedAt: new Date(),
      changesSummary: `Converted Proforma ${previousNumber} to Sales Tax Invoice ${newInvoiceNumber}`,
      note: 'Converted from Proforma',
    });

    await doc.save();
    await doc.populate(['createdBy', 'campaignId']);

    const payments = await PaymentIn.find({ invoiceId: doc._id }).sort({ receivedAt: -1 }).lean();
    return toInvoiceDto(doc, payments);
  },

  /** Public unauthenticated invoice lookup by secure shareToken */
  async getPublicInvoiceByToken(token: string): Promise<InvoiceDto> {
    if (!token || typeof token !== 'string') {
      throw new ValidationError('Invalid or missing invoice token');
    }

    const cleanToken = token.trim();
    let query: Record<string, any> = { shareToken: cleanToken, isDeleted: false };

    if (Types.ObjectId.isValid(cleanToken)) {
      query = { $or: [{ shareToken: cleanToken }, { _id: toObjectId(cleanToken) }], isDeleted: false };
    }

    const doc = await Invoice.findOne(query)
      .populate('campaignId', 'campaignCode name')
      .lean();

    if (!doc) {
      throw new NotFoundError('Invoice not found or link has expired');
    }

    const payments = await PaymentIn.find({ invoiceId: doc._id }).sort({ receivedAt: -1 }).lean();
    return toInvoiceDto(doc, payments);
  },

  /** Public unauthenticated PDF download by secure shareToken */
  async generatePublicInvoicePdfByToken(token: string): Promise<Buffer> {
    if (!token || typeof token !== 'string') {
      throw new ValidationError('Invalid or missing invoice token');
    }

    const cleanToken = token.trim();
    let query: Record<string, any> = { shareToken: cleanToken, isDeleted: false };

    if (Types.ObjectId.isValid(cleanToken)) {
      query = { $or: [{ shareToken: cleanToken }, { _id: toObjectId(cleanToken) }], isDeleted: false };
    }

    const doc = await Invoice.findOne(query).lean();
    if (!doc) {
      throw new NotFoundError('Invoice not found or link has expired');
    }

    return this.generateInvoicePdf(String(doc._id));
  },
};
