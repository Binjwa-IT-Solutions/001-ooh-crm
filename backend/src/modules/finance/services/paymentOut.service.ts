import { Types } from 'mongoose';
import { PaymentOut, type IPaymentOut } from '../models/paymentOut.model.js';
import { campaignFinanceService } from './campaignFinance.service.js';
import Campaign from '../../campaigns/campaign.model.js';
import { Lead } from '../../leads/leads.model.js';
import { Vendor } from '../../vendors/vendor.model.js';
import { Employee } from '../../employees/employees.model.js';
import { NotFoundError, ValidationError, ForbiddenError } from '../../../core/errors/index.js';
import { toObjectId } from '../../../core/db/basePlugin.js';
import type { RequestContext } from '../../../core/context.js';
import type {
  CreatePaymentOutInput,
  UpdatePaymentOutInput,
  ListPaymentsOutQuery,
} from '../validators/finance.validator.js';

export interface PaymentOutDto {
  id: string;
  _id: string;
  campaignId: string;
  campaignCode?: string;
  campaignName?: string;
  clientId?: string | null;
  clientName?: string;
  client?: {
    id: string;
    name: string;
  } | null;
  vendorId: string;
  vendorName?: string;
  poId?: string | null;
  amount: number;
  paidAt: string;
  method: string;
  category: string;
  vendorInvoice?: string;
  transactionId?: string;
  notes?: string;
  recordedBy: {
    id: string;
    name: string;
    email: string;
  } | null;
  recordedAt: string;
  reconciled: boolean;
  reconciledAt?: string | null;
  reconciledBy?: {
    id: string;
    name: string;
  } | null;
  attachments: string[];
  createdAt: string;
  updatedAt: string;
}

export interface PaginatedPaymentsOut {
  payments: PaymentOutDto[];
  total: number;
  count: number;
  totalAmount: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

function iso(date?: Date | null): string | null {
  return date ? date.toISOString() : null;
}

function toPaymentOutDto(doc: IPaymentOut): PaymentOutDto {
  const campaign = doc.campaignId as any;
  const vendor = doc.vendorId as any;
  const recorder = doc.recordedBy as any;
  const reconciler = doc.reconciledBy as any;

  const campaignIdStr = campaign?._id
    ? String(campaign._id)
    : doc.campaignId
    ? String(doc.campaignId)
    : '';
  const vendorIdStr = vendor?._id
    ? String(vendor._id)
    : doc.vendorId
    ? String(doc.vendorId)
    : '';

  const campLead = campaign?.leadId as any;
  const resolvedLead =
    campLead && typeof campLead === 'object' && (campLead.companyName || campLead.contactPerson)
      ? campLead
      : null;

  const clientName = resolvedLead?.companyName || resolvedLead?.contactPerson || '';
  const clientIdStr = resolvedLead?._id
    ? String(resolvedLead._id)
    : campLead?._id
    ? String(campLead._id)
    : campaign?.leadId
    ? String(campaign.leadId)
    : null;

  return {
    id: String(doc._id),
    _id: String(doc._id),
    campaignId: campaignIdStr,
    campaignCode: campaign?.campaignCode || '',
    campaignName: campaign?.name || '',
    clientId: clientIdStr,
    clientName,
    client: clientIdStr ? { id: clientIdStr, name: clientName } : null,
    vendorId: vendorIdStr,
    vendorName: vendor?.name || 'Vendor',
    poId: doc.poId ? String(doc.poId) : null,
    amount: doc.amount,
    paidAt: (iso(doc.paidAt) || new Date().toISOString()) as string,
    method: doc.method,
    category: doc.category,
    vendorInvoice: doc.vendorInvoice || '',
    transactionId: doc.transactionId || '',
    notes: doc.notes || '',
    recordedBy: recorder
      ? {
          id: String(recorder._id || doc.recordedBy),
          name: recorder.fullName || recorder.name || 'Staff',
          email: recorder.workEmail || recorder.email || '',
        }
      : null,
    recordedAt: (iso(doc.recordedAt) || new Date().toISOString()) as string,
    reconciled: Boolean(doc.reconciled),
    reconciledAt: iso(doc.reconciledAt),
    reconciledBy: reconciler
      ? {
          id: String(reconciler._id || doc.reconciledBy),
          name: reconciler.fullName || reconciler.name || 'Auditor',
        }
      : null,
    attachments: doc.attachments || [],
    createdAt: (iso(doc.createdAt) || new Date().toISOString()) as string,
    updatedAt: (iso(doc.updatedAt) || new Date().toISOString()) as string,
  };
}

export const paymentOutService = {
  /** Create a new vendor payment (Payment-Out / Expense) */
  async createPaymentOut(input: CreatePaymentOutInput, ctx: RequestContext): Promise<PaymentOutDto> {
    const campaignId = toObjectId(input.campaignId);
    const campaign = await Campaign.findById(campaignId);
    if (!campaign) {
      throw new NotFoundError('Campaign not found');
    }

    const vendorId = toObjectId(input.vendorId);
    const vendor = await Vendor.findById(vendorId);
    if (!vendor) {
      throw new NotFoundError('Vendor not found');
    }

    let recordedByEmpId: Types.ObjectId | null = null;
    const emp = await Employee.findOne({ userId: toObjectId(ctx.user.id), deletedAt: null });
    if (emp) {
      recordedByEmpId = emp._id as Types.ObjectId;
    } else {
      const anyEmp = await Employee.findOne({ deletedAt: null });
      if (anyEmp) recordedByEmpId = anyEmp._id as Types.ObjectId;
      else recordedByEmpId = toObjectId(ctx.user.id);
    }

    const isCash = input.method === 'cash';
    const created = await PaymentOut.create({
      campaignId,
      vendorId,
      poId: input.poId ? toObjectId(input.poId) : null,
      amount: input.amount,
      paidAt: input.paidAt,
      method: input.method,
      category: input.category,
      vendorInvoice: input.vendorInvoice || '',
      transactionId: isCash ? '' : (input.transactionId || ''),
      notes: input.notes || '',
      recordedBy: recordedByEmpId,
      recordedAt: new Date(),
      reconciled: false,
      attachments: input.attachments || [],
    });

    // TRIGGER: Automatically recalculate campaign finance rollup
    await campaignFinanceService.updateCampaignFinance(campaignId);

    await created.populate([
      {
        path: 'campaignId',
        select: 'name campaignCode contractedValue leadId',
        populate: { path: 'leadId', select: 'companyName contactPerson' },
      },
      { path: 'vendorId', select: 'name' },
      { path: 'recordedBy', select: 'fullName workEmail' },
    ]);

    return toPaymentOutDto(created);
  },

  /** List vendor payments with pagination and filters */
  async listPaymentsOut(query: ListPaymentsOutQuery, ctx: RequestContext): Promise<PaginatedPaymentsOut> {
    const filter: Record<string, unknown> = { deletedAt: null };

    if (query.campaignId && Types.ObjectId.isValid(query.campaignId)) {
      filter.campaignId = toObjectId(query.campaignId);
    }

    if (query.vendorId && Types.ObjectId.isValid(query.vendorId)) {
      filter.vendorId = toObjectId(query.vendorId);
    }

    if (query.category) {
      filter.category = query.category;
    }

    if (query.method) {
      filter.method = query.method;
    }

    if (query.reconciled !== undefined) {
      filter.reconciled = query.reconciled;
    }

    if (query.fromDate || query.toDate) {
      filter.paidAt = {};
      if (query.fromDate) (filter.paidAt as any).$gte = new Date(query.fromDate);
      if (query.toDate) (filter.paidAt as any).$lte = new Date(query.toDate);
    }

    if (query.search?.trim()) {
      const safe = query.search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(safe, 'i');

      const [matchingVendors, matchingLeads] = await Promise.all([
        Vendor.find({ name: regex }).select('_id'),
        Lead.find({
          $or: [{ companyName: regex }, { contactPerson: regex }],
        }).select('_id'),
      ]);
      const vendorIds = matchingVendors.map((v) => v._id);
      const leadIds = matchingLeads.map((l) => l._id);

      const matchingCampaigns = await Campaign.find({
        $or: [
          { name: regex },
          { campaignCode: regex },
          ...(leadIds.length > 0 ? [{ leadId: { $in: leadIds } }] : []),
        ],
      }).select('_id');
      const campIds = matchingCampaigns.map((c) => c._id);

      const orConditions: any[] = [
        { transactionId: regex },
        { vendorInvoice: regex },
        { notes: regex },
      ];
      if (vendorIds.length > 0) {
        orConditions.push({ vendorId: { $in: vendorIds } });
      }
      if (campIds.length > 0) {
        orConditions.push({ campaignId: { $in: campIds } });
      }
      filter.$or = orConditions;
    }

    const page = Math.max(1, query.page || 1);
    const pageSize = Math.min(100, Math.max(1, query.pageSize || 20));
    const skip = (page - 1) * pageSize;

    const [documents, total] = await Promise.all([
      PaymentOut.find(filter)
        .sort({ paidAt: -1, createdAt: -1 })
        .skip(skip)
        .limit(pageSize)
        .populate({
          path: 'campaignId',
          select: 'name campaignCode contractedValue leadId',
          populate: { path: 'leadId', select: 'companyName contactPerson' },
        })
        .populate('vendorId', 'name')
        .populate('recordedBy', 'fullName workEmail')
        .populate('reconciledBy', 'fullName workEmail'),
      PaymentOut.countDocuments(filter),
    ]);

    const allFiltered = await PaymentOut.find(filter).select('amount');
    const totalAmount = allFiltered.reduce((sum, item) => sum + (item.amount || 0), 0);

    return {
      payments: documents.map(toPaymentOutDto),
      total,
      count: documents.length,
      totalAmount,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    };
  },

  /** Get single Payment-Out by ID */
  async getPaymentOutById(id: string, ctx: RequestContext): Promise<PaymentOutDto> {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundError('Payment not found');
    }

    const doc = await PaymentOut.findOne({ _id: toObjectId(id), deletedAt: null })
      .populate({
        path: 'campaignId',
        select: 'name campaignCode contractedValue leadId',
        populate: { path: 'leadId', select: 'companyName contactPerson' },
      })
      .populate('vendorId', 'name')
      .populate('recordedBy', 'fullName workEmail')
      .populate('reconciledBy', 'fullName workEmail');

    if (!doc) {
      throw new NotFoundError('Payment not found');
    }

    return toPaymentOutDto(doc);
  },

  /** Update an existing Payment-Out */
  async updatePaymentOut(id: string, input: UpdatePaymentOutInput, ctx: RequestContext): Promise<PaymentOutDto> {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundError('Payment not found');
    }

    const payment = await PaymentOut.findOne({ _id: toObjectId(id), deletedAt: null });
    if (!payment) {
      throw new NotFoundError('Payment not found');
    }

    if (payment.reconciled && ctx.user.role !== 'admin') {
      throw new ForbiddenError('Reconciled payments cannot be modified. Contact an administrator.');
    }

    if (input.amount !== undefined) payment.amount = input.amount;
    if (input.paidAt !== undefined) payment.paidAt = new Date(input.paidAt);
    if (input.method !== undefined) {
      payment.method = input.method;
      if (input.method === 'cash') {
        payment.transactionId = '';
      }
    }
    if (input.category !== undefined) payment.category = input.category;
    if (input.vendorInvoice !== undefined) payment.vendorInvoice = input.vendorInvoice;
    if (input.transactionId !== undefined && payment.method !== 'cash') {
      payment.transactionId = input.transactionId;
    }
    if (input.notes !== undefined) payment.notes = input.notes;
    if (input.attachments !== undefined) payment.attachments = input.attachments;

    await payment.save();

    // TRIGGER: Recalculate campaign finance rollup
    await campaignFinanceService.updateCampaignFinance(payment.campaignId);

    await payment.populate([
      {
        path: 'campaignId',
        select: 'name campaignCode contractedValue leadId',
        populate: { path: 'leadId', select: 'companyName contactPerson' },
      },
      { path: 'vendorId', select: 'name' },
      { path: 'recordedBy', select: 'fullName workEmail' },
      { path: 'reconciledBy', select: 'fullName workEmail' },
    ]);

    return toPaymentOutDto(payment);
  },

  /** Soft-delete a Payment-Out */
  async deletePaymentOut(id: string, ctx: RequestContext): Promise<{ success: boolean; message: string }> {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundError('Payment not found');
    }

    const payment = await PaymentOut.findOne({ _id: toObjectId(id), deletedAt: null });
    if (!payment) {
      throw new NotFoundError('Payment not found');
    }

    if (payment.reconciled && ctx.user.role !== 'admin') {
      throw new ForbiddenError('Reconciled payments cannot be deleted.');
    }

    payment.deletedAt = new Date();
    await payment.save();

    // TRIGGER: Recalculate campaign finance rollup
    await campaignFinanceService.updateCampaignFinance(payment.campaignId);

    return { success: true, message: 'Expense record deleted' };
  },

  /** Reconcile Payment-Out */
  async reconcilePaymentOut(id: string, ctx: RequestContext): Promise<PaymentOutDto> {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundError('Payment not found');
    }

    const payment = await PaymentOut.findOne({ _id: toObjectId(id), deletedAt: null });
    if (!payment) {
      throw new NotFoundError('Payment not found');
    }

    const emp = await Employee.findOne({ userId: toObjectId(ctx.user.id), deletedAt: null });
    const reconcilerId = emp ? emp._id : toObjectId(ctx.user.id);

    payment.reconciled = true;
    payment.reconciledAt = new Date();
    payment.reconciledBy = reconcilerId as Types.ObjectId;
    await payment.save();

    await payment.populate([
      {
        path: 'campaignId',
        select: 'name campaignCode contractedValue leadId',
        populate: { path: 'leadId', select: 'companyName contactPerson' },
      },
      { path: 'vendorId', select: 'name' },
      { path: 'recordedBy', select: 'fullName workEmail' },
      { path: 'reconciledBy', select: 'fullName workEmail' },
    ]);

    return toPaymentOutDto(payment);
  },
};
