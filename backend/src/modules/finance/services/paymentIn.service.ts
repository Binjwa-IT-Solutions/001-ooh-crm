import { Types } from 'mongoose';
import { PaymentIn, type IPaymentIn } from '../models/paymentIn.model.js';
import { campaignFinanceService } from './campaignFinance.service.js';
import Campaign from '../../campaigns/campaign.model.js';
import { Lead } from '../../leads/leads.model.js';
import { Employee } from '../../employees/employees.model.js';
import { NotFoundError, ValidationError, ForbiddenError } from '../../../core/errors/index.js';
import { toObjectId } from '../../../core/db/basePlugin.js';
import type { RequestContext } from '../../../core/context.js';
import type {
  CreatePaymentInInput,
  UpdatePaymentInInput,
  ListPaymentsInQuery,
} from '../validators/finance.validator.js';

export interface PaymentInDto {
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
  amount: number;
  receivedAt: string;
  method: string;
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

export interface PaginatedPaymentsIn {
  payments: PaymentInDto[];
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

function toPaymentInDto(doc: IPaymentIn): PaymentInDto {
  const campaign = doc.campaignId as any;
  const recorder = doc.recordedBy as any;
  const reconciler = doc.reconciledBy as any;

  const campaignIdStr = campaign?._id
    ? String(campaign._id)
    : doc.campaignId
    ? String(doc.campaignId)
    : '';
  const clientDoc = doc.clientId as any;
  const campLead = campaign?.leadId as any;
  const resolvedLead =
    campLead && typeof campLead === 'object' && (campLead.companyName || campLead.contactPerson)
      ? campLead
      : clientDoc && typeof clientDoc === 'object' && (clientDoc.companyName || clientDoc.contactPerson)
      ? clientDoc
      : null;

  const clientName = resolvedLead?.companyName || resolvedLead?.contactPerson || '';
  const clientIdStr = resolvedLead?._id
    ? String(resolvedLead._id)
    : doc.clientId
    ? String(doc.clientId)
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
    amount: doc.amount,
    receivedAt: (iso(doc.receivedAt) || new Date().toISOString()) as string,
    method: doc.method,
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

export const paymentInService = {
  /** Create a new client payment (Payment-In) */
  async createPaymentIn(input: CreatePaymentInInput, ctx: RequestContext): Promise<PaymentInDto> {
    const campaignId = toObjectId(input.campaignId);
    const campaign = await Campaign.findById(campaignId);
    if (!campaign) {
      throw new NotFoundError('Campaign not found');
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
    const created = await PaymentIn.create({
      campaignId,
      clientId: input.clientId ? toObjectId(input.clientId) : campaign.leadId || null,
      amount: input.amount,
      receivedAt: input.receivedAt,
      method: input.method,
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
      { path: 'clientId', select: 'companyName contactPerson' },
      { path: 'recordedBy', select: 'fullName workEmail' },
    ]);

    return toPaymentInDto(created);
  },

  /** List payments with pagination, scoping and filters */
  async listPaymentsIn(query: ListPaymentsInQuery, ctx: RequestContext): Promise<PaginatedPaymentsIn> {
    const filter: Record<string, unknown> = { deletedAt: null };

    if (query.campaignId && Types.ObjectId.isValid(query.campaignId)) {
      filter.campaignId = toObjectId(query.campaignId);
    }

    if (query.clientId && Types.ObjectId.isValid(query.clientId)) {
      filter.clientId = toObjectId(query.clientId);
    }

    if (query.method) {
      filter.method = query.method;
    }

    if (query.reconciled !== undefined) {
      filter.reconciled = query.reconciled;
    }

    if (query.fromDate || query.toDate) {
      filter.receivedAt = {};
      if (query.fromDate) (filter.receivedAt as any).$gte = new Date(query.fromDate);
      if (query.toDate) (filter.receivedAt as any).$lte = new Date(query.toDate);
    }

    if (query.search?.trim()) {
      const safe = query.search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(safe, 'i');

      const matchingLeads = await Lead.find({
        $or: [{ companyName: regex }, { contactPerson: regex }],
      }).select('_id');
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
        { notes: regex },
      ];
      if (campIds.length > 0) {
        orConditions.push({ campaignId: { $in: campIds } });
      }
      if (leadIds.length > 0) {
        orConditions.push({ clientId: { $in: leadIds } });
      }
      filter.$or = orConditions;
    }

    const page = Math.max(1, query.page || 1);
    const pageSize = Math.min(100, Math.max(1, query.pageSize || 20));
    const skip = (page - 1) * pageSize;

    const [documents, total] = await Promise.all([
      PaymentIn.find(filter)
        .sort({ receivedAt: -1, createdAt: -1 })
        .skip(skip)
        .limit(pageSize)
        .populate({
          path: 'campaignId',
          select: 'name campaignCode contractedValue leadId',
          populate: { path: 'leadId', select: 'companyName contactPerson' },
        })
        .populate('clientId', 'companyName contactPerson')
        .populate('recordedBy', 'fullName workEmail')
        .populate('reconciledBy', 'fullName workEmail'),
      PaymentIn.countDocuments(filter),
    ]);

    // Calculate sum of matched payments
    const allFiltered = await PaymentIn.find(filter).select('amount');
    const totalAmount = allFiltered.reduce((sum, item) => sum + (item.amount || 0), 0);

    return {
      payments: documents.map(toPaymentInDto),
      total,
      count: documents.length,
      totalAmount,
      page,
      pageSize,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    };
  },

  /** Get single Payment-In by ID */
  async getPaymentInById(id: string, ctx: RequestContext): Promise<PaymentInDto> {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundError('Payment not found');
    }

    const doc = await PaymentIn.findOne({ _id: toObjectId(id), deletedAt: null })
      .populate({
        path: 'campaignId',
        select: 'name campaignCode contractedValue leadId',
        populate: { path: 'leadId', select: 'companyName contactPerson' },
      })
      .populate('clientId', 'companyName contactPerson')
      .populate('recordedBy', 'fullName workEmail')
      .populate('reconciledBy', 'fullName workEmail');

    if (!doc) {
      throw new NotFoundError('Payment not found');
    }

    return toPaymentInDto(doc);
  },

  /** Update an existing Payment-In */
  async updatePaymentIn(id: string, input: UpdatePaymentInInput, ctx: RequestContext): Promise<PaymentInDto> {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundError('Payment not found');
    }

    const payment = await PaymentIn.findOne({ _id: toObjectId(id), deletedAt: null });
    if (!payment) {
      throw new NotFoundError('Payment not found');
    }

    // Do not allow updating if already reconciled unless Admin
    if (payment.reconciled && ctx.user.role !== 'admin') {
      throw new ForbiddenError('Reconciled payments cannot be modified. Contact an administrator.');
    }

    if (input.amount !== undefined) payment.amount = input.amount;
    if (input.receivedAt !== undefined) payment.receivedAt = new Date(input.receivedAt);
    if (input.method !== undefined) {
      payment.method = input.method;
      if (input.method === 'cash') {
        payment.transactionId = '';
      }
    }
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
      { path: 'clientId', select: 'companyName contactPerson' },
      { path: 'recordedBy', select: 'fullName workEmail' },
      { path: 'reconciledBy', select: 'fullName workEmail' },
    ]);

    return toPaymentInDto(payment);
  },

  /** Soft-delete a Payment-In */
  async deletePaymentIn(id: string, ctx: RequestContext): Promise<{ success: boolean; message: string }> {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundError('Payment not found');
    }

    const payment = await PaymentIn.findOne({ _id: toObjectId(id), deletedAt: null });
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

    return { success: true, message: 'Payment record deleted' };
  },

  /** Reconcile payment */
  async reconcilePaymentIn(id: string, ctx: RequestContext): Promise<PaymentInDto> {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundError('Payment not found');
    }

    const payment = await PaymentIn.findOne({ _id: toObjectId(id), deletedAt: null });
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
      { path: 'clientId', select: 'companyName contactPerson' },
      { path: 'recordedBy', select: 'fullName workEmail' },
      { path: 'reconciledBy', select: 'fullName workEmail' },
    ]);

    return toPaymentInDto(payment);
  },
};
