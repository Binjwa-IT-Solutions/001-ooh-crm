import { Types } from 'mongoose';
import { RequestContext } from '../../core/context.js';
import { ConflictError, NotFoundError, ValidationError } from '../../core/errors/index.js';
import { scopedFind, scopedFindOne, scopedCount } from '../../core/scoping/index.js';
import {
  Lead,
  type ILead,
  type LeadStatus,
  type LeadSource,
  type FollowUpType,
} from './leads.model.js';
import { STATUS_TRANSITIONS } from './leads.validator.js';
import { toObjectId } from '../../core/db/basePlugin.js';
import { AuthUser } from '../../core/auth/auth-model.js';

export class LeadsService {
  /**
   * List leads with filtering, pagination, and scoping rules applied.
   */
  static async listLeads(
    filters: any,
    ctx: RequestContext,
  ): Promise<{ leads: ILead[]; total: number }> {
    const query: Record<string, any> = {};

    if (filters.search) {
      const searchRegex = { $regex: filters.search, $options: 'i' };
      query.$or = [{ companyName: searchRegex }, { mobile: searchRegex }];
    }

    if (filters.status) query.status = filters.status;
    if (filters.city) query.city = filters.city;
    if (filters.source) query.source = filters.source;

    if (filters.fromDate || filters.toDate) {
      query.createdAt = {};
      if (filters.fromDate) query.createdAt.$gte = filters.fromDate;
      if (filters.toDate) query.createdAt.$lte = filters.toDate;
    }

    // Always exclude soft-deleted
    query.deletedAt = null;

    if (filters.unassigned) {
      query.status = 'New';
      query.assignedTo = null;
      query.claimedBy = null;

      const skip = (filters.page - 1) * filters.limit;
      const [leads, total] = await Promise.all([
        Lead.find(query)
          .sort({ createdAt: -1 })
          .skip(skip)
          .limit(filters.limit)
          .populate('assignedTo claimedBy', 'name email role')
          .exec(),
        Lead.countDocuments(query).exec(),
      ]);
      return { leads, total };
    }

    // Scoped retrieval for sales agents and managers
    const skip = (filters.page - 1) * filters.limit;

    if (filters.assignedTo) {
      query.assignedTo = toObjectId(filters.assignedTo);
    } else if (filters.assignedToMe) {
      query.assignedTo = toObjectId(ctx.user.id);
    }

    const [leads, total] = await Promise.all([
      scopedFind(Lead, query, ctx, { ownerField: 'assignedTo' })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(filters.limit)
        .populate('assignedTo claimedBy', 'name email role')
        .exec(),
      scopedCount(Lead, query, ctx, { ownerField: 'assignedTo' }),
    ]);

    return { leads, total };
  }

  static async getLead(id: string, ctx: RequestContext): Promise<ILead> {
    if (!Types.ObjectId.isValid(id)) throw new NotFoundError('Lead not found');

    let lead = await scopedFindOne(Lead, { _id: toObjectId(id) }, ctx, {
      ownerField: 'assignedTo',
    });

    if (!lead) {
      // Fallback for creator or unassigned New leads
      lead = await Lead.findOne({
        _id: toObjectId(id),
        deletedAt: null,
        $or: [
          { createdBy: toObjectId(ctx.user.id) },
          { assignedTo: null, status: 'New' },
        ],
      }).exec();
    }

    if (!lead) throw new NotFoundError('Lead not found');

    await lead.populate('assignedTo claimedBy', 'name email role');
    return lead;
  }

  /**
   * Manual authenticated lead creation.
   */
  static async createLead(data: any, ctx: RequestContext): Promise<ILead> {
    const now = new Date();
    const windowStart = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const existing = await Lead.findOne({
      mobile: data.mobile,
      source: data.source,
      createdAt: { $gte: windowStart },
      deletedAt: null,
    }).exec();

    let status: LeadStatus = existing ? 'Duplicate' : 'New';

    const leadData: any = {
      ...data,
      receivedAt: now,
      createdBy: toObjectId(ctx.user.id),
      assignedTo: toObjectId(ctx.user.id),
      claimedBy: toObjectId(ctx.user.id),
      claimedAt: now,
      slaTimerEnd: new Date(now.getTime() + 24 * 60 * 60 * 1000),
      status,
      statusHistory: [
        {
          to: status,
          changedBy: toObjectId(ctx.user.id),
          reason: existing ? 'Duplicate within 24 hours' : 'Manual Lead Intake',
          changedAt: now,
        },
      ],
    };

    // If sales agent provided initial follow-up notes or next action date during creation
    if (data.remarks || data.note || data.followUpType) {
      const followUpEntry = {
        user: toObjectId(ctx.user.id),
        followUpType: data.followUpType || 'Call',
        reason: data.reason || 'Initial Contact',
        remarks: data.remarks || data.note || '',
        note: data.note || data.remarks || '',
        nextActionDate: data.nextActionDate || undefined,
        delayResponsibility: data.delayResponsibility || undefined,
        durationSec: data.durationSec || undefined,
        createdAt: now,
      };
      leadData.callLogs = [followUpEntry];
      if (followUpEntry.followUpType === 'Call') {
        leadData.firstCallAt = now;
      }
      leadData.firstResponseAt = now;
      if (status === 'New') {
        leadData.status = 'Contacted';
        leadData.assignedTo = toObjectId(ctx.user.id);
        leadData.claimedBy = toObjectId(ctx.user.id);
        leadData.claimedAt = now;
        leadData.statusHistory.push({
          from: 'New',
          to: 'Contacted',
          changedBy: toObjectId(ctx.user.id),
          reason: 'Initial follow-up logged during lead creation',
          changedAt: now,
        });
      }
    }

    if (data.nextActionDate) {
      leadData.nextActionDate = data.nextActionDate;
    }

    const lead = await Lead.create(leadData);
    return lead;
  }

  /**
   * Public webhook lead intake (A1).
   */
  static async intakeLead(source: string, payload: any): Promise<ILead> {
    const now = new Date();
    const windowStart = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const mobile = payload.mobile || payload.phone || payload.contactNumber;
    const companyName = payload.companyName || payload.company || payload.name || 'Web Lead';
    const contactPerson = payload.contactPerson || payload.name || 'Prospective Client';
    const email = payload.email || undefined;
    const city = payload.city || undefined;

    const existing = await Lead.findOne({
      mobile,
      source: source as LeadSource,
      createdAt: { $gte: windowStart },
      deletedAt: null,
    }).exec();

    const status: LeadStatus = existing ? 'Duplicate' : 'New';

    const lead = await Lead.create({
      source: source as LeadSource,
      companyName,
      contactPerson,
      mobile,
      email,
      city,
      rawPayload: payload,
      receivedAt: now,
      status,
      notifiedAt: now,
      statusHistory: [
        {
          to: status,
          reason: existing ? 'Duplicate within 24h' : `Incoming Webhook from ${source}`,
          changedAt: now,
        },
      ],
    });

    return lead;
  }

  /**
   * Atomic First-Response Claim (A2).
   */
  static async claimLead(id: string, ctx: RequestContext): Promise<ILead> {
    if (!Types.ObjectId.isValid(id)) throw new NotFoundError('Lead not found');

    const now = new Date();

    const updated = await Lead.findOneAndUpdate(
      {
        _id: toObjectId(id),
        status: 'New',
        $or: [{ claimedBy: null }, { claimedBy: { $exists: false } }],
        deletedAt: null,
      },
      {
        $set: {
          claimedBy: toObjectId(ctx.user.id),
          assignedTo: toObjectId(ctx.user.id),
          claimedAt: now,
          status: 'New',
          slaTimerEnd: new Date(now.getTime() + 24 * 60 * 60 * 1000),
          updatedBy: toObjectId(ctx.user.id),
        },
        $push: {
          statusHistory: {
            from: 'New',
            to: 'New',
            changedBy: toObjectId(ctx.user.id),
            reason: 'Lead Claimed by Agent',
            changedAt: now,
          },
        },
      },
      { new: true },
    ).populate('assignedTo claimedBy', 'name email role');

    if (!updated) {
      const current = await Lead.findOne({ _id: toObjectId(id) });
      if (!current) throw new NotFoundError('Lead not found');
      if (current.claimedBy || current.assignedTo) {
        throw new ConflictError('This lead was claimed by another agent.');
      }
      throw new ConflictError('Cannot claim this lead in its current state.');
    }

    return updated;
  }

  /**
   * Log Follow-up / Action (ATR Card support).
   */
  static async logFollowUpLead(
    id: string,
    payload: {
      followUpType?: FollowUpType;
      reason?: string;
      remarks?: string;
      note?: string;
      nextActionDate?: Date;
      delayResponsibility?: string;
      durationSec?: number;
    },
    ctx: RequestContext,
  ): Promise<ILead> {
    if (!Types.ObjectId.isValid(id)) throw new NotFoundError('Lead not found');

    const lead = await LeadsService.getLead(id, ctx);
    const now = new Date();

    const followUpEntry = {
      user: toObjectId(ctx.user.id),
      followUpType: payload.followUpType || 'Call',
      reason: payload.reason ?? '',
      remarks: payload.remarks || payload.note || '',
      note: payload.note || payload.remarks || '',
      nextActionDate: payload.nextActionDate || undefined,
      delayResponsibility: payload.delayResponsibility || undefined,
      durationSec: payload.durationSec ?? undefined,
      createdAt: now,
    };

    lead.callLogs = lead.callLogs || [];
    lead.callLogs.push(followUpEntry);

    if (payload.nextActionDate) {
      lead.nextActionDate = payload.nextActionDate;
    }

    if (followUpEntry.followUpType === 'Call' && !lead.firstCallAt) {
      lead.firstCallAt = now;
    }

    if (!lead.firstResponseAt) {
      lead.firstResponseAt = now;
      if (lead.status === 'New') {
        lead.status = 'Contacted';
        lead.assignedTo = lead.assignedTo || toObjectId(ctx.user.id);
        lead.claimedBy = lead.claimedBy || toObjectId(ctx.user.id);
        lead.claimedAt = lead.claimedAt || now;

        lead.statusHistory = lead.statusHistory || [];
        lead.statusHistory.push({
          from: 'New',
          to: 'Contacted',
          changedBy: toObjectId(ctx.user.id),
          reason: `First Follow-up Logged (${followUpEntry.followUpType}): ${followUpEntry.reason || followUpEntry.remarks || 'Client Contacted'}`,
          changedAt: now,
        });
      }
    }

    lead.updatedBy = toObjectId(ctx.user.id);
    await lead.save();
    await lead.populate('assignedTo claimedBy', 'name email role');
    return lead;
  }

  /**
   * Backward compatible logCall wrapper.
   */
  static async logCallLead(
    id: string,
    payload: { note?: string; durationSec?: number; followUpType?: FollowUpType; reason?: string; nextActionDate?: Date; delayResponsibility?: string },
    ctx: RequestContext,
  ): Promise<ILead> {
    return LeadsService.logFollowUpLead(id, payload, ctx);
  }

  /**
   * Manager review & approval sign-off (ATR Card support).
   */
  static async managerApproveLead(
    id: string,
    payload: { approved: boolean; remarks?: string },
    ctx: RequestContext,
  ): Promise<ILead> {
    if (!Types.ObjectId.isValid(id)) throw new NotFoundError('Lead not found');

    const lead = await LeadsService.getLead(id, ctx);
    const now = new Date();

    lead.managerApproval = {
      approved: payload.approved,
      approvedBy: toObjectId(ctx.user.id),
      approvedAt: now,
      remarks: payload.remarks || '',
    };

    lead.statusHistory = lead.statusHistory || [];
    lead.statusHistory.push({
      from: lead.status,
      to: lead.status,
      changedBy: toObjectId(ctx.user.id),
      reason: `Manager Review Sign-off: ${payload.remarks || (payload.approved ? 'Approved' : 'Rejected')}`,
      changedAt: now,
    });

    lead.updatedBy = toObjectId(ctx.user.id);
    await lead.save();
    await lead.populate('assignedTo claimedBy', 'name email role');
    return lead;
  }

  /**
   * Update qualification data (A3).
   */
  static async qualifyLead(
    id: string,
    qualificationData: any,
    ctx: RequestContext,
  ): Promise<ILead> {
    const lead = await LeadsService.getLead(id, ctx);

    lead.qualification = {
      ...lead.qualification,
      ...qualificationData,
    };

    if (qualificationData.city) {
      lead.city = qualificationData.city;
    }

    lead.updatedBy = toObjectId(ctx.user.id);
    await lead.save();
    return lead;
  }

  /**
   * Change status with server-side state machine enforcement (A3).
   */
  static async changeStatus(
    id: string,
    payload: { status: LeadStatus; lostReason?: string; qualification?: any },
    ctx: RequestContext,
  ): Promise<ILead> {
    const lead = await LeadsService.getLead(id, ctx);
    const fromStatus = lead.status;
    const toStatus = payload.status;

    if (fromStatus === toStatus) {
      return lead;
    }

    // 1. Check state transitions map (Admins and Managers have override privileges; Reopening from Won/Lost is allowed for all roles)
    const isManagerOrAdmin = ctx.user?.role === 'admin' || ctx.user?.role === 'manager';
    const isTerminalStatus = fromStatus === 'Won' || fromStatus === 'Lost';
    const isActiveStatus = !['Won', 'Lost', 'Duplicate', 'duplicate'].includes(toStatus);
    const isReopening = isTerminalStatus && isActiveStatus;

    const allowed = STATUS_TRANSITIONS[fromStatus] || [];
    if (!isManagerOrAdmin && !isReopening && !allowed.includes(toStatus)) {
      throw new ValidationError(`Invalid status transition from ${fromStatus} to ${toStatus}.`);
    }

    // 2. Apply qualification updates if passed
    if (payload.qualification) {
      lead.qualification = { ...lead.qualification, ...payload.qualification };
    }

    // 3. Qualification Gate: moving to Qualified requires budget, city and duration
    if (toStatus === 'Qualified') {
      const q = lead.qualification || {};
      const city = q.city || lead.city;
      const budget = q.budget;
      const duration = q.campaignDuration;

      if (!city || budget === undefined || budget === null || !duration) {
        throw new ValidationError(
          'Moving to Qualified requires budget, city and duration to be filled.',
        );
      }
      lead.qualifiedAt = new Date();
    }

    // 4. Lost Gate: moving to Lost requires a reason
    if (toStatus === 'Lost') {
      const reason = payload.lostReason || lead.qualification?.lostReason;
      if (!reason || reason.trim().length === 0) {
        throw new ValidationError('Lost status requires a reason.');
      }
      if (lead.qualification) {
        lead.qualification.lostReason = reason.trim();
      }
    }

    // 5. Cycle Increment on Re-activation from Won / Lost to an active stage
    if (isReopening) {
      lead.cycle = (lead.cycle || 1) + 1;
      if (lead.qualification?.lostReason) {
        lead.qualification.lostReason = undefined;
      }
    }

    const now = new Date();
    lead.status = toStatus;
    lead.updatedBy = toObjectId(ctx.user.id);

    lead.statusHistory = lead.statusHistory || [];
    lead.statusHistory.push({
      from: fromStatus,
      to: toStatus,
      changedBy: toObjectId(ctx.user.id),
      reason: payload.lostReason || (isReopening ? 'Re-opened for new campaign inquiry' : undefined),
      cycle: lead.cycle || 1,
      changedAt: now,
    });

    await lead.save();
    await lead.populate('assignedTo claimedBy', 'name email role');
    return lead;
  }

  /**
   * List active users/agents for assignment (sales_agent, manager, admin only).
   */
  static async listAgents(): Promise<any[]> {
    return AuthUser.find(
      {
        status: 'Active',
        role: { $in: ['sales_agent', 'manager', 'admin'] },
      },
      '_id name email role',
    )
      .sort({ name: 1 })
      .lean();
  }

  /**
   * Update lead info (A1/A4).
   */
  static async updateLead(id: string, data: any, ctx: RequestContext): Promise<ILead> {
    const lead = await LeadsService.getLead(id, ctx);

    if (data.status && data.status !== lead.status) {
      return LeadsService.changeStatus(
        id,
        { status: data.status, lostReason: data.lostReason, qualification: data.qualification },
        ctx,
      );
    }

    if (data.assignedTo !== undefined) {
      if (data.assignedTo) {
        const targetId = toObjectId(data.assignedTo);
        lead.assignedTo = targetId;
        lead.claimedBy = targetId;
      } else {
        // Move to Unclaimed Pool
        lead.assignedTo = null;
        lead.claimedBy = null;
        lead.claimedAt = null;
        lead.status = 'New';
      }
      delete data.assignedTo;
    }

    Object.assign(lead, data);
    lead.updatedBy = toObjectId(ctx.user.id);
    await lead.save();
    await lead.populate('assignedTo claimedBy', 'name email role');
    return lead;
  }

  /**
   * Activity timeline combining status changes and follow-ups chronologically.
   */
  static async getActivity(id: string, ctx: RequestContext): Promise<{ activities: any[] }> {
    const lead = await LeadsService.getLead(id, ctx);

    const activities: any[] = [];

    // Push status history items
    if (lead.statusHistory) {
      for (const sh of lead.statusHistory) {
        activities.push({
          type: 'status_change',
          from: sh.from,
          to: sh.to,
          reason: sh.reason,
          changedBy: sh.changedBy,
          cycle: sh.cycle,
          timestamp: sh.changedAt,
        });
      }
    }

    // Push follow-up logs
    if (lead.callLogs) {
      for (const cl of lead.callLogs) {
        activities.push({
          type: 'follow_up',
          followUpType: cl.followUpType || 'Call',
          reason: cl.reason,
          remarks: cl.remarks || cl.note,
          note: cl.note || cl.remarks,
          nextActionDate: cl.nextActionDate,
          delayResponsibility: cl.delayResponsibility,
          user: cl.user,
          durationSec: cl.durationSec,
          timestamp: cl.createdAt,
        });
      }
    }

    // Push manager approval if exists
    if (lead.managerApproval && lead.managerApproval.approvedAt) {
      activities.push({
        type: 'manager_review',
        approved: lead.managerApproval.approved,
        remarks: lead.managerApproval.remarks,
        user: lead.managerApproval.approvedBy,
        timestamp: lead.managerApproval.approvedAt,
      });
    }

    // Sort descending by timestamp
    activities.sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    );

    return { activities };
  }
}
