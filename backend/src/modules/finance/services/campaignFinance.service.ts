import { Types } from 'mongoose';
import { CampaignFinance, type ICampaignFinance, type PaymentStatus } from '../models/campaignFinance.model.js';
import { PaymentIn } from '../models/paymentIn.model.js';
import { PaymentOut } from '../models/paymentOut.model.js';
import { ProfitLog } from '../models/profitLog.model.js';
import Campaign from '../../campaigns/campaign.model.js';
import { Lead } from '../../leads/leads.model.js';
import { toObjectId } from '../../../core/db/basePlugin.js';
import { ValidationError } from '../../../core/errors/index.js';
import type { RequestContext } from '../../../core/context.js';

export interface CampaignFinanceDto {
  id: string;
  campaignId: string;
  campaignCode?: string;
  campaignName?: string;
  clientId?: string | null;
  clientName?: string;
  revenue: number;
  paymentInCount: number;
  lastPaymentInAt: string | null;
  expenses: number;
  expenses_media: number;
  expenses_production: number;
  expenses_logistics: number;
  expenses_other: number;
  paymentOutCount: number;
  lastPaymentOutAt: string | null;
  profit: number;
  margin: number;
  contractedValue: number;
  actualCost: number;
  budgetVariance: number;
  paymentStatus: PaymentStatus;
  percentageReceived: number;
  calculatedAt: string;
  campaignStartDate: string | null;
  campaignEndDate: string | null;
}

export interface ProfitLeaderboardItem {
  campaignId: string;
  campaignCode: string;
  campaignName: string;
  contractedValue: number;
  revenue: number;
  expenses: number;
  profit: number;
  margin: number;
  paymentStatus: string;
}

export interface RevenueByAgentItem {
  agentId: string;
  agent?: string;
  agentName: string;
  agentEmail: string;
  revenue: number;
  campaignCount: number;
}

export interface FinanceSummaryDto {
  totalRevenue: number;
  totalExpenses: number;
  totalProfit: number;
  averageMargin: number;
  pipelineTotal: number;
  activeCampaignsCount: number;
  totalPaymentsInCount: number;
  totalPaymentsOutCount: number;
  topCampaign?: {
    campaignId: string;
    campaignName: string;
    profit: number;
    margin: number;
  } | null;
}

export interface ExpenseBreakdownDto {
  media: number;
  production: number;
  logistics: number;
  other: number;
  total: number;
  percentages: {
    media: number;
    production: number;
    logistics: number;
    other: number;
  };
}

export interface ProfitTrendPoint {
  date: string;
  profit: number;
  margin: number;
  revenue: number;
  expenses: number;
  campaignCount?: number;
}

function iso(date?: Date | null): string | null {
  return date ? date.toISOString() : null;
}

function toFinanceDto(doc: ICampaignFinance, campaign?: any): CampaignFinanceDto {
  const lead = campaign?.leadId as any;
  const clientName = typeof lead === 'object' && lead ? lead.companyName || lead.contactPerson || '' : '';
  const clientId = typeof lead === 'object' && lead ? String(lead._id) : campaign?.leadId ? String(campaign.leadId) : null;

  return {
    id: String(doc._id),
    campaignId: String(doc.campaignId),
    campaignCode: campaign?.campaignCode || '',
    campaignName: campaign?.name || '',
    clientId,
    clientName,
    revenue: doc.revenue || 0,
    paymentInCount: doc.paymentInCount || 0,
    lastPaymentInAt: iso(doc.lastPaymentInAt),
    expenses: doc.expenses || 0,
    expenses_media: doc.expenses_media || 0,
    expenses_production: doc.expenses_production || 0,
    expenses_logistics: doc.expenses_logistics || 0,
    expenses_other: doc.expenses_other || 0,
    paymentOutCount: doc.paymentOutCount || 0,
    lastPaymentOutAt: iso(doc.lastPaymentOutAt),
    profit: doc.profit || 0,
    margin: doc.margin || 0,
    contractedValue: doc.contractedValue || 0,
    actualCost: doc.actualCost || 0,
    budgetVariance: doc.budgetVariance || 0,
    paymentStatus: doc.paymentStatus || 'pending',
    percentageReceived: doc.percentageReceived || 0,
    calculatedAt: (iso(doc.calculatedAt) || new Date().toISOString()) as string,
    campaignStartDate: iso(doc.campaignStartDate),
    campaignEndDate: iso(doc.campaignEndDate),
  };
}

export const campaignFinanceService = {
  /**
   * CRITICAL ROLLUP CALCULATION FUNCTION.
   * Recalculates revenue, expenses breakdown, profit, and margin for a campaign.
   */
  async updateCampaignFinance(campaignIdInput: string | Types.ObjectId): Promise<ICampaignFinance | null> {
    if (!campaignIdInput || !Types.ObjectId.isValid(String(campaignIdInput))) {
      return null;
    }
    const campaignId = toObjectId(campaignIdInput);
    const campaign = await Campaign.findById(campaignId);
    if (!campaign) {
      return null;
    }

    const contractedValue = campaign.contractedValue || 0;

    // 1. Calculate REVENUE from non-deleted PaymentIn
    const paymentsIn = await PaymentIn.find({
      campaignId,
      deletedAt: null,
    }).sort({ receivedAt: -1 });

    const paymentInCount = paymentsIn.length;
    let revenue = 0;
    for (const p of paymentsIn) {
      revenue += p.amount || 0;
    }
    const lastPaymentInAt = paymentsIn.length > 0 ? paymentsIn[0].receivedAt : null;

    // 2. Calculate EXPENSES with category breakdown from non-deleted PaymentOut
    const paymentsOut = await PaymentOut.find({
      campaignId,
      deletedAt: null,
    }).sort({ paidAt: -1 });

    const paymentOutCount = paymentsOut.length;
    let expenses = 0;
    let expenses_media = 0;
    let expenses_production = 0;
    let expenses_logistics = 0;
    let expenses_other = 0;

    for (const p of paymentsOut) {
      const amt = p.amount || 0;
      expenses += amt;
      switch (p.category) {
        case 'media_cost':
          expenses_media += amt;
          break;
        case 'production_cost':
          expenses_production += amt;
          break;
        case 'logistics':
          expenses_logistics += amt;
          break;
        default:
          expenses_other += amt;
          break;
      }
    }
    const lastPaymentOutAt = paymentsOut.length > 0 ? paymentsOut[0].paidAt : null;

    // 3. Calculate PROFIT & MARGIN
    const profit = revenue - expenses;
    let margin = 0;
    if (revenue > 0) {
      margin = Math.round(((profit / revenue) * 100) * 100) / 100; // 2 decimals
    }

    const actualCost = expenses;
    const budgetVariance = expenses - contractedValue;

    // 4. Payment status
    let paymentStatus: PaymentStatus = 'pending';
    if (revenue >= contractedValue && contractedValue > 0) {
      paymentStatus = 'complete';
    } else if (revenue > 0) {
      paymentStatus = 'partial';
    }

    let percentageReceived = 0;
    if (contractedValue > 0) {
      percentageReceived = Math.round(((revenue / contractedValue) * 100) * 100) / 100;
    }

    // 5. Upsert CampaignFinance record
    let financeDoc = await CampaignFinance.findOne({ campaignId });
    if (!financeDoc) {
      financeDoc = new CampaignFinance({
        campaignId,
      });
    }

    financeDoc.revenue = revenue;
    financeDoc.paymentInCount = paymentInCount;
    financeDoc.lastPaymentInAt = lastPaymentInAt;

    financeDoc.expenses = expenses;
    financeDoc.expenses_media = expenses_media;
    financeDoc.expenses_production = expenses_production;
    financeDoc.expenses_logistics = expenses_logistics;
    financeDoc.expenses_other = expenses_other;
    financeDoc.paymentOutCount = paymentOutCount;
    financeDoc.lastPaymentOutAt = lastPaymentOutAt;

    financeDoc.profit = profit;
    financeDoc.margin = margin;
    financeDoc.contractedValue = contractedValue;
    financeDoc.actualCost = actualCost;
    financeDoc.budgetVariance = budgetVariance;
    financeDoc.paymentStatus = paymentStatus;
    financeDoc.percentageReceived = percentageReceived;

    financeDoc.calculatedAt = new Date();
    financeDoc.campaignStartDate = campaign.startDate || null;
    financeDoc.campaignEndDate = campaign.endDate || null;

    await financeDoc.save();
    return financeDoc;
  },

  /** Get finance summary for a single campaign */
  async getCampaignFinance(campaignIdInput: string | Types.ObjectId): Promise<CampaignFinanceDto> {
    if (!campaignIdInput || !Types.ObjectId.isValid(String(campaignIdInput))) {
      throw new ValidationError('Invalid campaign ID');
    }
    const campaignId = toObjectId(campaignIdInput);
    let doc: any = await CampaignFinance.findOne({ campaignId });
    const campaign = await Campaign.findById(campaignId).populate('leadId', 'companyName contactPerson');

    if (!doc) {
      // Auto-compute if not found
      doc = await campaignFinanceService.updateCampaignFinance(campaignId);
    }

    if (!doc) {
      return {
        id: '',
        campaignId: String(campaignId),
        campaignCode: campaign?.campaignCode || '',
        campaignName: campaign?.name || '',
        revenue: 0,
        paymentInCount: 0,
        lastPaymentInAt: null,
        expenses: 0,
        expenses_media: 0,
        expenses_production: 0,
        expenses_logistics: 0,
        expenses_other: 0,
        paymentOutCount: 0,
        lastPaymentOutAt: null,
        profit: 0,
        margin: 0,
        contractedValue: campaign?.contractedValue || 0,
        actualCost: 0,
        budgetVariance: 0,
        paymentStatus: 'pending',
        percentageReceived: 0,
        calculatedAt: new Date().toISOString(),
        campaignStartDate: iso(campaign?.startDate),
        campaignEndDate: iso(campaign?.endDate),
      };
    }

    return toFinanceDto(doc, campaign);
  },

  /** Top N campaigns by profit or margin */
  async getProfitLeaderboard(limit = 10, sortBy: 'profit' | 'margin' = 'profit'): Promise<ProfitLeaderboardItem[]> {
    const sortField = sortBy === 'margin' ? { margin: -1, profit: -1 } : { profit: -1, margin: -1 };

    const records = await CampaignFinance.find({ deletedAt: null })
      .sort(sortField as any)
      .limit(limit)
      .populate('campaignId', 'name campaignCode contractedValue status');

    return records.map((r) => {
      const c = r.campaignId as any;
      const cId = c?._id ? String(c._id) : (r.campaignId ? String(r.campaignId) : '');
      return {
        campaignId: cId,
        campaignCode: c?.campaignCode || '',
        campaignName: c?.name || 'Unnamed Campaign',
        contractedValue: r.contractedValue || c?.contractedValue || 0,
        revenue: r.revenue || 0,
        expenses: r.expenses || 0,
        profit: r.profit || 0,
        margin: r.margin || 0,
        paymentStatus: r.paymentStatus || 'pending',
      };
    });
  },

  /** Campaigns with margin below threshold percentage (e.g. < 10%) */
  async getLowMarginCampaigns(threshold = 10): Promise<ProfitLeaderboardItem[]> {
    const records = await CampaignFinance.find({
      margin: { $lt: threshold },
      deletedAt: null,
    })
      .sort({ margin: 1, profit: 1 })
      .limit(50)
      .populate('campaignId', 'name campaignCode contractedValue status');

    return records.map((r) => {
      const c = r.campaignId as any;
      const cId = c?._id ? String(c._id) : (r.campaignId ? String(r.campaignId) : '');
      return {
        campaignId: cId,
        campaignCode: c?.campaignCode || '',
        campaignName: c?.name || 'Unnamed Campaign',
        contractedValue: r.contractedValue || c?.contractedValue || 0,
        revenue: r.revenue || 0,
        expenses: r.expenses || 0,
        profit: r.profit || 0,
        margin: r.margin || 0,
        paymentStatus: r.paymentStatus || 'pending',
      };
    });
  },

  /** Revenue grouped by Sales Agent (from Lead / Campaign linkage) */
  async getRevenueByAgent(fromDate?: string, toDate?: string): Promise<RevenueByAgentItem[]> {
    const filter: Record<string, unknown> = { deletedAt: null };
    if (fromDate || toDate) {
      filter.receivedAt = {};
      if (fromDate) (filter.receivedAt as any).$gte = new Date(fromDate);
      if (toDate) (filter.receivedAt as any).$lte = new Date(toDate);
    }

    const payments = await PaymentIn.find(filter).populate({
      path: 'campaignId',
      select: 'name leadId',
      populate: {
        path: 'leadId',
        select: 'assignedTo createdBy',
        populate: {
          path: 'assignedTo',
          select: 'name email',
        },
      },
    });

    const agentMap = new Map<string, { agentId: string; name: string; email: string; revenue: number; campaigns: Set<string> }>();

    for (const p of payments) {
      const campaign = p.campaignId as any;
      const lead = campaign?.leadId as any;
      const agent = lead?.assignedTo as any;

      const agentId = String(agent?._id || 'unassigned');
      const agentName = agent?.name || 'Direct / House Account';
      const agentEmail = agent?.email || 'sales@mediaoctus.com';

      if (!agentMap.has(agentId)) {
        agentMap.set(agentId, {
          agentId,
          name: agentName,
          email: agentEmail,
          revenue: 0,
          campaigns: new Set<string>(),
        });
      }

      const entry = agentMap.get(agentId)!;
      entry.revenue += p.amount || 0;
      if (campaign?._id) {
        entry.campaigns.add(String(campaign._id));
      }
    }

    const result: RevenueByAgentItem[] = Array.from(agentMap.values()).map((item) => ({
      agentId: item.agentId,
      agent: item.name,
      agentName: item.name,
      agentEmail: item.email,
      revenue: item.revenue,
      campaignCount: item.campaigns.size,
    }));

    result.sort((a, b) => b.revenue - a.revenue);
    return result;
  },

  /** Aggregate Summary for Dashboard Cards */
  async getSummary(ctx?: RequestContext): Promise<FinanceSummaryDto> {
    const [finances, totalPipelineCampaigns, countIn, countOut] = await Promise.all([
      CampaignFinance.find({ deletedAt: null }).populate('campaignId', 'name contractedValue status'),
      Campaign.find({ deletedAt: null }),
      PaymentIn.countDocuments({ deletedAt: null }),
      PaymentOut.countDocuments({ deletedAt: null }),
    ]);

    let totalRevenue = 0;
    let totalExpenses = 0;
    let totalProfit = 0;
    let pipelineTotal = 0;
    let activeCampaignsCount = 0;
    let topCampaign: FinanceSummaryDto['topCampaign'] = null;
    let maxProfit = -Infinity;

    for (const c of totalPipelineCampaigns) {
      pipelineTotal += c.contractedValue || 0;
      if (c.status === 'Approved' || c.status === 'InProgress') {
        activeCampaignsCount += 1;
      }
    }

    for (const f of finances) {
      totalRevenue += f.revenue || 0;
      totalExpenses += f.expenses || 0;
      totalProfit += f.profit || 0;

      if (f.profit > maxProfit && f.profit > 0) {
        maxProfit = f.profit;
        const c = f.campaignId as any;
        const cId = c?._id ? String(c._id) : (f.campaignId ? String(f.campaignId) : '');
        topCampaign = {
          campaignId: cId,
          campaignName: c?.name || 'Top Campaign',
          profit: f.profit,
          margin: f.margin,
        };
      }
    }

    const averageMargin = totalRevenue > 0
      ? Math.round(((totalProfit / totalRevenue) * 100) * 100) / 100
      : 0;

    return {
      totalRevenue,
      totalExpenses,
      totalProfit,
      averageMargin,
      pipelineTotal,
      activeCampaignsCount: activeCampaignsCount || totalPipelineCampaigns.length,
      totalPaymentsInCount: countIn,
      totalPaymentsOutCount: countOut,
      topCampaign,
    };
  },

  /** Get historical profit trends (from ProfitLog or aggregated payments) */
  async getProfitTrends(campaignId?: string, days = 30): Promise<ProfitTrendPoint[]> {
    const sinceDate = new Date();
    sinceDate.setDate(sinceDate.getDate() - days);
    sinceDate.setHours(0, 0, 0, 0);

    const logFilter: Record<string, unknown> = {
      logDate: { $gte: sinceDate },
    };
    if (campaignId && Types.ObjectId.isValid(campaignId)) {
      logFilter.campaignId = toObjectId(campaignId);
    }

    const logs = await ProfitLog.find(logFilter).sort({ logDate: 1 });

    if (logs.length > 0) {
      const dailyMap = new Map<string, { revenue: number; expenses: number; profit: number; count: number }>();

      for (const log of logs) {
        const dateKey = log.logDate.toISOString().slice(0, 10);
        if (!dailyMap.has(dateKey)) {
          dailyMap.set(dateKey, { revenue: 0, expenses: 0, profit: 0, count: 0 });
        }
        const item = dailyMap.get(dateKey)!;
        item.revenue += log.revenue;
        item.expenses += log.expenses;
        item.profit += log.profit;
        item.count += 1;
      }

      return Array.from(dailyMap.entries()).map(([date, val]) => ({
        date,
        revenue: val.revenue,
        expenses: val.expenses,
        profit: val.profit,
        margin: val.revenue > 0 ? Math.round(((val.profit / val.revenue) * 100) * 100) / 100 : 0,
        campaignCount: val.count,
      }));
    }

    // Fallback: Aggregate from PaymentIn & PaymentOut dynamically across days
    const [paymentsIn, paymentsOut] = await Promise.all([
      PaymentIn.find({
        ...(campaignId && Types.ObjectId.isValid(campaignId) ? { campaignId: toObjectId(campaignId) } : {}),
        receivedAt: { $gte: sinceDate },
        deletedAt: null,
      }),
      PaymentOut.find({
        ...(campaignId && Types.ObjectId.isValid(campaignId) ? { campaignId: toObjectId(campaignId) } : {}),
        paidAt: { $gte: sinceDate },
        deletedAt: null,
      }),
    ]);

    const dateMap = new Map<string, { revenue: number; expenses: number }>();

    for (let i = 0; i <= days; i++) {
      const d = new Date(sinceDate);
      d.setDate(d.getDate() + i);
      const key = d.toISOString().slice(0, 10);
      dateMap.set(key, { revenue: 0, expenses: 0 });
    }

    for (const p of paymentsIn) {
      const key = p.receivedAt.toISOString().slice(0, 10);
      if (dateMap.has(key)) {
        dateMap.get(key)!.revenue += p.amount;
      }
    }

    for (const p of paymentsOut) {
      const key = p.paidAt.toISOString().slice(0, 10);
      if (dateMap.has(key)) {
        dateMap.get(key)!.expenses += p.amount;
      }
    }

    let runningProfit = 0;
    return Array.from(dateMap.entries()).map(([date, val]) => {
      const dailyProfit = val.revenue - val.expenses;
      runningProfit += dailyProfit;
      const margin = val.revenue > 0 ? Math.round(((val.revenue - val.expenses) / val.revenue * 100) * 100) / 100 : 0;
      return {
        date,
        revenue: val.revenue,
        expenses: val.expenses,
        profit: dailyProfit,
        margin,
      };
    });
  },

  /** Expense breakdown by category */
  async getExpenseBreakdown(campaignId?: string): Promise<ExpenseBreakdownDto> {
    const filter: Record<string, unknown> = { deletedAt: null };
    if (campaignId && Types.ObjectId.isValid(campaignId)) {
      filter.campaignId = toObjectId(campaignId);
    }

    const expenses = await PaymentOut.find(filter);

    let media = 0;
    let production = 0;
    let logistics = 0;
    let other = 0;

    for (const e of expenses) {
      const amt = e.amount || 0;
      switch (e.category) {
        case 'media_cost':
          media += amt;
          break;
        case 'production_cost':
          production += amt;
          break;
        case 'logistics':
          logistics += amt;
          break;
        default:
          other += amt;
          break;
      }
    }

    const total = media + production + logistics + other;

    return {
      media,
      production,
      logistics,
      other,
      total,
      percentages: {
        media: total > 0 ? Math.round((media / total) * 1000) / 10 : 0,
        production: total > 0 ? Math.round((production / total) * 1000) / 10 : 0,
        logistics: total > 0 ? Math.round((logistics / total) * 1000) / 10 : 0,
        other: total > 0 ? Math.round((other / total) * 1000) / 10 : 0,
      },
    };
  },
};
