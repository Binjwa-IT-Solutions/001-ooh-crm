import { Types } from 'mongoose';
import { RequestContext } from '../../core/context.js';
import { ValidationError, NotFoundError } from '../../core/errors/index.js';
import { AuthUser } from '../../core/auth/auth-model.js';
import {
  MarketingDailyLog,
  MarketingTask,
  MarketingBudget,
  MarketingSpend,
  MarketingLead,
  type IMarketingDailyLog,
  type IMarketingTask,
  type IMarketingBudget,
  type IMarketingSpend,
  type IMarketingLead,
} from './marketing.model.js';

export class MarketingService {
  // ─── 1. DAILY LOGS ────────────────────────────────────────────────────────
  static async submitDailyLog(
    input: {
      date: Date;
      category: string;
      taskTitle: string;
      hoursSpent: number;
      description: string;
      outputLink?: string;
      statusAfterToday: string;
    },
    ctx: RequestContext
  ): Promise<IMarketingDailyLog> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const logDate = new Date(input.date);
    logDate.setHours(0, 0, 0, 0);

    const diffDays = Math.floor((today.getTime() - logDate.getTime()) / (1000 * 60 * 60 * 24));
    const isBackdated = diffDays > 0;

    const log = await MarketingDailyLog.create({
      userId: new Types.ObjectId(ctx.user.id),
      date: input.date,
      category: input.category,
      taskTitle: input.taskTitle,
      hoursSpent: input.hoursSpent,
      description: input.description,
      outputLink: input.outputLink || undefined,
      statusAfterToday: input.statusAfterToday,
      isBackdated,
    });

    return log;
  }

  static async listDailyLogs(
    filters: { date?: string; userId?: string; category?: string },
    ctx: RequestContext
  ): Promise<any[]> {
    const query: Record<string, any> = { deletedAt: null };

    // Team members can only see their own logs.
    // In "My Daily Logs", managers/admins also see their own logs by default unless another userId is specified.
    const isManagerOrAdmin = ['admin', 'manager'].includes(ctx.user.role.toLowerCase());
    if (!isManagerOrAdmin) {
      query.userId = new Types.ObjectId(ctx.user.id);
    } else if (filters.userId && filters.userId !== 'all') {
      query.userId = new Types.ObjectId(filters.userId);
    } else if (!filters.userId) {
      query.userId = new Types.ObjectId(ctx.user.id);
    }

    if (filters.date) {
      const d = new Date(filters.date);
      const startOfDay = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0);
      const endOfDay = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59);
      query.date = { $gte: startOfDay, $lte: endOfDay };
    }

    if (filters.category) {
      query.category = filters.category;
    }

    return await MarketingDailyLog.find(query)
      .populate('userId', 'name email role')
      .sort({ createdAt: -1 })
      .lean();
  }

  static async getManagerDailySummary(dateStr: string): Promise<any> {
    const d = dateStr ? new Date(dateStr) : new Date();
    const startOfDay = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0);
    const endOfDay = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59);

    const logs = await MarketingDailyLog.find({
      date: { $gte: startOfDay, $lte: endOfDay },
      deletedAt: null,
    })
      .populate('userId', 'name email role')
      .lean();

    // Group logs by user
    const userMap: Record<string, { user: any; totalHours: number; logs: any[] }> = {};
    for (const log of logs) {
      const u: any = log.userId;
      if (!u) continue;
      const uid = String(u._id);
      if (!userMap[uid]) {
        userMap[uid] = { user: u, totalHours: 0, logs: [] };
      }
      userMap[uid].totalHours += log.hoursSpent;
      userMap[uid].logs.push(log);
    }

    return Object.values(userMap);
  }

  // ─── 2. TASKS & CONTENT ───────────────────────────────────────────────────
  static async createTask(
    input: {
      title: string;
      description?: string;
      type: string;
      assignedTo?: string;
      priority: string;
      startDate?: string;
      dueDate?: string;
      estimatedHours?: number;
      isContent?: boolean;
      platform?: string;
      postUrl?: string;
      city?: string;
    },
    ctx: RequestContext
  ): Promise<IMarketingTask> {
    const task = await MarketingTask.create({
      title: input.title,
      description: input.description,
      type: input.type,
      assignedTo: input.assignedTo && Types.ObjectId.isValid(input.assignedTo)
        ? new Types.ObjectId(input.assignedTo)
        : new Types.ObjectId(ctx.user.id),
      assignedBy: new Types.ObjectId(ctx.user.id),
      priority: input.priority,
      startDate: input.startDate ? new Date(input.startDate) : undefined,
      dueDate: input.dueDate ? new Date(input.dueDate) : undefined,
      estimatedHours: input.estimatedHours || 0,
      isContent: Boolean(input.isContent),
      platform: input.platform || undefined,
      postUrl: input.postUrl || undefined,
      city: input.city || 'Indore',
      status: 'To Do',
    });

    return task;
  }

  static async listTasks(
    filters: { status?: string; assignedTo?: string; isContent?: boolean },
    ctx: RequestContext
  ): Promise<any[]> {
    const query: Record<string, any> = { deletedAt: null };
    if (filters.status) query.status = filters.status;
    if (filters.isContent !== undefined) query.isContent = filters.isContent;

    // Normal marketing employees can ONLY see tasks assigned to them!
    const isManagerOrAdmin = ['admin', 'superadmin', 'managing_director', 'manager'].includes(
      ctx.user.role.toLowerCase()
    );
    if (!isManagerOrAdmin) {
      query.assignedTo = new Types.ObjectId(ctx.user.id);
    } else if (filters.assignedTo) {
      query.assignedTo = new Types.ObjectId(filters.assignedTo);
    }

    const tasks = await MarketingTask.find(query)
      .populate('assignedTo', 'name email role designation')
      .populate('assignedBy', 'name email role designation')
      .sort({ priority: -1, createdAt: -1 })
      .lean();

    // Check aging/stale flag
    const now = new Date();
    return tasks.map((t) => {
      const isPastDue = t.dueDate && new Date(t.dueDate) < now && t.status !== 'Done';
      const isStale = t.status === 'In Progress' && (now.getTime() - new Date(t.updatedAt).getTime()) > (3 * 24 * 60 * 60 * 1000);
      return {
        ...t,
        isPastDue: Boolean(isPastDue),
        staleAlert: Boolean(isStale),
      };
    });
  }

  static async updateTaskStatus(
    taskId: string,
    newStatus: string,
    _ctx: RequestContext
  ): Promise<IMarketingTask> {
    const task = await MarketingTask.findOne({ _id: new Types.ObjectId(taskId), deletedAt: null });
    if (!task) throw new NotFoundError('Task not found');

    // WIP Limit Rule: Max 3 tasks can be 'In Progress' for any assignee
    if (newStatus === 'In Progress' && task.status !== 'In Progress') {
      const inProgressCount = await MarketingTask.countDocuments({
        assignedTo: task.assignedTo,
        status: 'In Progress',
        deletedAt: null,
      });

      if (inProgressCount >= 3) {
        throw new ValidationError(
          'WIP Limit Exceeded: This team member already has 3 tasks In Progress. Complete or put an existing task on hold first.'
        );
      }
    }

    // Carry forward check if due date passed
    if (task.dueDate && new Date(task.dueDate) < new Date() && newStatus !== 'Done') {
      task.carryForwardCount = (task.carryForwardCount || 0) + 1;
    }

    task.status = newStatus;
    await task.save();
    return task;
  }

  static async updateTask(taskId: string, input: any): Promise<IMarketingTask> {
    const task = await MarketingTask.findOne({ _id: new Types.ObjectId(taskId), deletedAt: null });
    if (!task) throw new NotFoundError('Task not found');

    if (input.title) task.title = input.title;
    if (input.description !== undefined) task.description = input.description;
    if (input.type) task.type = input.type;
    if (input.priority) task.priority = input.priority;
    if (input.dueDate) task.dueDate = new Date(input.dueDate);
    if (input.postUrl !== undefined) task.postUrl = input.postUrl;
    if (input.platform) task.platform = input.platform;
    if (input.actualHours !== undefined) task.actualHours = input.actualHours;
    if (input.status) task.status = input.status;

    await task.save();
    return task;
  }

  static async getTeamMembers(): Promise<any[]> {
    // Strictly exclude non-marketing roles: Sales Agent, Operations, Finance, and HR
    const excludedRoles = ['sales_agent', 'ops', 'finance', 'hr'];

    return await AuthUser.find({
      deletedAt: null,
      status: 'Active',
      role: { $nin: excludedRoles as any },
    })
      .select('name email role designation')
      .sort({ name: 1 })
      .lean();
  }

  // ─── 3. BUDGET & SPEND ────────────────────────────────────────────────────
  static async setBudget(input: { month: string; period: string; plannedAmount: number; notes?: string }, ctx: RequestContext): Promise<IMarketingBudget> {
    let budget = await MarketingBudget.findOne({ month: input.month, deletedAt: null });
    if (budget) {
      budget.period = input.period;
      budget.plannedAmount = input.plannedAmount;
      budget.notes = input.notes || '';
      budget.approvedBy = new Types.ObjectId(ctx.user.id);
      await budget.save();
    } else {
      budget = await MarketingBudget.create({
        month: input.month,
        period: input.period,
        plannedAmount: input.plannedAmount,
        notes: input.notes,
        approvedBy: new Types.ObjectId(ctx.user.id),
      });
    }
    return budget;
  }

  static async getBudget(month: string): Promise<IMarketingBudget | null> {
    return await MarketingBudget.findOne({ month, deletedAt: null }).lean();
  }

  static async recordSpend(input: {
    date?: Date;
    campaignName: string;
    platform: string;
    city: string;
    amount: number;
    type: string;
    receiptUrl?: string;
    paymentStatus: string;
    notes?: string;
  }, ctx: RequestContext): Promise<IMarketingSpend> {
    return await MarketingSpend.create({
      ...input,
      date: input.date || new Date(),
      enteredBy: new Types.ObjectId(ctx.user.id),
    });
  }

  static async listSpends(monthPrefix?: string): Promise<any[]> {
    const query: Record<string, any> = { deletedAt: null };
    if (monthPrefix) {
      const [year, month] = monthPrefix.split('-').map(Number);
      const startOfMonth = new Date(year, month - 1, 1);
      const endOfMonth = new Date(year, month, 0, 23, 59, 59);
      query.date = { $gte: startOfMonth, $lte: endOfMonth };
    }
    return await MarketingSpend.find(query).sort({ date: -1 }).lean();
  }

  // ─── 4. LEADS & ROI ───────────────────────────────────────────────────────
  static async createLead(input: {
    companyName: string;
    contactPerson: string;
    designation?: string;
    phone: string;
    email?: string;
    city: string;
    sourcePlatform: string;
    serviceInterested?: string;
    notes?: string;
  }, ctx: RequestContext): Promise<IMarketingLead> {
    return await MarketingLead.create({
      ...input,
      stage: 'New',
      owner: new Types.ObjectId(ctx.user.id),
    });
  }

  static async listLeads(stage?: string): Promise<any[]> {
    const query: Record<string, any> = { deletedAt: null };
    if (stage) query.stage = stage;
    return await MarketingLead.find(query).sort({ createdAt: -1 }).lean();
  }

  static async updateLeadStage(
    leadId: string,
    input: { stage: string; dealValue?: number; lostReason?: string; notes?: string }
  ): Promise<IMarketingLead> {
    const lead = await MarketingLead.findOne({ _id: new Types.ObjectId(leadId), deletedAt: null });
    if (!lead) throw new NotFoundError('Lead not found');

    if (input.stage === 'Won') {
      if (!input.dealValue || input.dealValue <= 0) {
        throw new ValidationError('Deal value is mandatory when marking a lead as Won');
      }
      lead.dealValue = input.dealValue;
    } else if (input.stage === 'Lost') {
      lead.lostReason = input.lostReason || 'Not interested';
    }

    lead.stage = input.stage;
    if (input.notes) lead.notes = input.notes;
    await lead.save();
    return lead;
  }

  // ─── 5. EXECUTIVE OVERVIEW & ROI ANALYTICS ────────────────────────────────
  static async getDashboardOverview(monthStr?: string): Promise<any> {
    const targetMonth = monthStr || new Date().toISOString().slice(0, 7); // e.g. '2026-10'
    const [year, month] = targetMonth.split('-').map(Number);
    const startOfMonth = new Date(year, month - 1, 1);
    const endOfMonth = new Date(year, month, 0, 23, 59, 59);

    const [budgetDoc, spends, leads, tasks] = await Promise.all([
      MarketingBudget.findOne({ month: targetMonth, deletedAt: null }).lean(),
      MarketingSpend.find({ date: { $gte: startOfMonth, $lte: endOfMonth }, deletedAt: null }).lean(),
      MarketingLead.find({ createdAt: { $gte: startOfMonth, $lte: endOfMonth }, deletedAt: null }).lean(),
      MarketingTask.find({ deletedAt: null }).lean(),
    ]);

    const plannedBudget = budgetDoc?.plannedAmount || 150000; // Default ₹1.5L if not set
    const totalSpend = spends.reduce((sum, s) => sum + s.amount, 0);

    const budgetUtilizationPct = plannedBudget > 0 ? Math.round((totalSpend / plannedBudget) * 100) : 0;
    const isBudgetAlert = budgetUtilizationPct >= 90;

    const totalLeads = leads.length;
    const wonLeads = leads.filter((l) => l.stage === 'Won');
    const totalWonRevenue = wonLeads.reduce((sum, l) => sum + (l.dealValue || 0), 0);

    // ROI & ROAS Formulas
    const netRoi = totalSpend > 0 ? Math.round(((totalWonRevenue - totalSpend) / totalSpend) * 100) : 0;
    const roas = totalSpend > 0 ? parseFloat((totalWonRevenue / totalSpend).toFixed(2)) : 0;
    const cpl = totalLeads > 0 ? Math.round(totalSpend / totalLeads) : 0;

    // Platform Breakdown Matrix (Aligned with Spend & Lead Dropdown options)
    const platformDefs = [
      { id: 'Instagram', aliases: ['instagram', 'insta', 'meta'] },
      { id: 'Facebook', aliases: ['facebook', 'fb'] },
      { id: 'Google Ads', aliases: ['google'] },
      { id: 'Justdial', aliases: ['justdial'] },
      { id: 'WhatsApp Business', aliases: ['whatsapp'] },
      { id: 'LinkedIn', aliases: ['linkedin'] },
      { id: 'Print / Hoardings', aliases: ['print', 'hoarding', 'ooh'] },
      { id: 'Other', aliases: [] },
    ];

    const knownKeywords = ['meta', 'facebook', 'instagram', 'google', 'justdial', 'linkedin', 'whatsapp', 'print', 'hoarding'];

    const platformMatrix = platformDefs.map(({ id, aliases }) => {
      const pSpends = spends.filter((s) => {
        const plat = (s.platform || '').toLowerCase();
        if (id === 'Other') {
          return !knownKeywords.some((k) => plat.includes(k));
        }
        return aliases.some((a) => plat.includes(a));
      });

      const pLeads = leads.filter((l) => {
        const plat = (l.sourcePlatform || '').toLowerCase();
        if (id === 'Other') {
          return !knownKeywords.some((k) => plat.includes(k));
        }
        return aliases.some((a) => plat.includes(a));
      });

      const pSpendAmount = pSpends.reduce((sum, s) => sum + (Number(s.amount) || 0), 0);
      const pWon = pLeads.filter((l) => l.stage === 'Won');
      const pRevenue = pWon.reduce((sum, l) => sum + (Number(l.dealValue) || 0), 0);
      const pRoi = pSpendAmount > 0 ? parseFloat((pRevenue / pSpendAmount).toFixed(1)) : 0;

      return {
        platform: id,
        spend: pSpendAmount,
        leadsCount: pLeads.length,
        wonCount: pWon.length,
        revenue: pRevenue,
        roasMultiplier: pRoi,
      };
    });

    // City Breakdown Matrix (Dynamic, capturing standard cities + active cities from DB)
    const standardCities = ['Jaipur', 'Indore', 'Delhi NCR', 'Mumbai', 'Bangalore', 'National'];
    const activeCities = Array.from(
      new Set([
        ...spends.map((s) => s.city).filter(Boolean),
        ...leads.map((l) => l.city).filter(Boolean),
        ...standardCities,
      ])
    ).slice(0, 6);

    const cityMatrix = activeCities.map((c) => {
      const cSpends = spends.filter((s) => (s.city || '').toLowerCase() === c.toLowerCase());
      const cLeads = leads.filter((l) => (l.city || '').toLowerCase() === c.toLowerCase());
      const cSpendAmount = cSpends.reduce((sum, s) => sum + (Number(s.amount) || 0), 0);
      const cWon = cLeads.filter((l) => l.stage === 'Won');
      const cRevenue = cWon.reduce((sum, l) => sum + (Number(l.dealValue) || 0), 0);

      return {
        city: c,
        spend: cSpendAmount,
        leadsCount: cLeads.length,
        wonCount: cWon.length,
        revenue: cRevenue,
      };
    });

    return {
      month: targetMonth,
      budget: {
        planned: plannedBudget,
        spent: totalSpend,
        remaining: Math.max(0, plannedBudget - totalSpend),
        utilizationPct: budgetUtilizationPct,
        isAlert: isBudgetAlert,
      },
      metrics: {
        totalLeads,
        wonDealsCount: wonLeads.length,
        totalRevenue: totalWonRevenue,
        netRoiPct: netRoi,
        roas,
        cpl,
      },
      tasksSummary: {
        total: tasks.length,
        completed: tasks.filter((t) => t.status === 'Done').length,
        inProgress: tasks.filter((t) => t.status === 'In Progress').length,
        stale: tasks.filter((t) => t.staleAlert).length,
      },
      platformMatrix,
      cityMatrix,
    };
  }
}
