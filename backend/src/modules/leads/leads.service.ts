import mongoose, { Types } from 'mongoose';
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
import { notifyMany } from '../../core/notifications/index.js';
import { extractLeadWithGemini } from './leads.ai.js';
import { Quotation } from '../quotations/quotations.model.js';
import { Campaign } from '../campaigns/campaign.model.js';

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

    if (filters.overdueOnly) {
      query.nextActionDate = { $ne: null, $lt: new Date() };
      if (!filters.status) {
        query.status = { $nin: ['Won', 'Lost', 'Rejected'] };
      }
    }

    // Always exclude soft-deleted
    query.deletedAt = null;

    let sortObj: Record<string, any> = { createdAt: -1 };
    if (filters.sortBy === 'nextActionDate') {
      const dir = filters.sortDir === 'desc' ? -1 : 1;
      sortObj = { nextActionDate: dir, createdAt: -1 };
    } else if (filters.sortBy === 'companyName') {
      const dir = filters.sortDir === 'desc' ? -1 : 1;
      sortObj = { companyName: dir, createdAt: -1 };
    } else if (filters.sortBy === 'source') {
      const dir = filters.sortDir === 'desc' ? -1 : 1;
      sortObj = { source: dir, createdAt: -1 };
    } else if (filters.sortBy === 'receivedAt' || filters.sortBy === 'createdAt') {
      const dir = filters.sortDir === 'asc' ? 1 : -1;
      sortObj = { createdAt: dir };
    } else if (filters.overdueOnly) {
      sortObj = { nextActionDate: 1, createdAt: -1 };
    }

    if (filters.unassigned) {
      query.status = 'New';
      query.assignedTo = null;
      query.claimedBy = null;

      const skip = (filters.page - 1) * filters.limit;
      const [leads, total] = await Promise.all([
        Lead.find(query)
          .sort(sortObj)
          .skip(skip)
          .limit(filters.limit)
          .populate('assignedTo claimedBy', 'name email role')
          .exec(),
        Lead.countDocuments(query).exec(),
      ]);
      return { leads, total };
    }

    if (filters.status === 'Rejected') {
      query.status = 'Rejected';
      const skip = (filters.page - 1) * filters.limit;
      const [leads, total] = await Promise.all([
        scopedFind(Lead, query, ctx, { ownerField: 'rejectedBy' })
          .sort({ updatedAt: -1, createdAt: -1 })
          .skip(skip)
          .limit(filters.limit)
          .populate('assignedTo claimedBy rejectedBy', 'name email role')
          .exec(),
        scopedCount(Lead, query, ctx, { ownerField: 'rejectedBy' }),
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
        .sort(sortObj)
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
      // Fallback for: creator, unassigned New leads, or leads the user personally rejected
      lead = await Lead.findOne({
        _id: toObjectId(id),
        deletedAt: null,
        $or: [
          { createdBy: toObjectId(ctx.user.id) },
          { assignedTo: null, status: 'New' },
          { rejectedBy: toObjectId(ctx.user.id), status: 'Rejected' },
        ],
      }).exec();
    }

    if (!lead) throw new NotFoundError('Lead not found');

    await lead.populate('assignedTo claimedBy rejectedBy', 'name email role');
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

    const status: LeadStatus = existing ? 'Duplicate' : 'New';

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

    // Inbound Email Parsing & Extraction
    let emailContactPerson: string | undefined;
    let emailAddress: string | undefined;
    let emailMobile: string | undefined;
    let emailCity: string | undefined;
    let emailNotes: string | undefined;
    let emailCompanyName: string | undefined;
    let emailBudgetPaise: number | undefined;
    let emailLocationPreference: any | undefined;
    let emailCampaignDuration: string | undefined;

    if (source === 'Email' || payload.from || payload.subject || payload.text || payload.body) {
      // 1. Combine text and body, strip HTML tags
      const rawText = String(payload.text || payload.body || payload.message || payload.html || '').trim();
      const plainText = rawText.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ');

      // 2. Check for explicit structured form fields first (e.g. Website Form forwarded via email: Name: ..., Phone: ...)
      const nameMatch = plainText.match(/(?:Name|Contact Person|Full Name)\s*[:=-]\s*([^\n\r,;]+)/i);
      if (nameMatch) emailContactPerson = nameMatch[1].trim();

      const cityMatch = plainText.match(/(?:City|Location|Area)\s*[:=-]\s*([^\n\r,;]+)/i);
      if (cityMatch) emailCity = cityMatch[1].trim();

      const phoneMatch = plainText.match(/(?:Phone|Mobile|Contact|Cell|Tel|WhatsApp)\s*[:=-]\s*([^\n\r,;]+)/i);
      if (phoneMatch) emailMobile = phoneMatch[1].trim();

      // 3. Optional Gemini AI Extraction (Runs when GEMINI_API_KEY is configured and not in unit test mock)
      if (process.env.GEMINI_API_KEY && process.env.NODE_ENV !== 'test') {
        try {
          const aiData = await extractLeadWithGemini({
            from: payload.from,
            subject: payload.subject,
            text: payload.text || payload.body || payload.message,
          });
          if (aiData) {
            if (!emailContactPerson && aiData.contactPerson) emailContactPerson = aiData.contactPerson;
            if (aiData.companyName) emailCompanyName = aiData.companyName;
            if (!emailAddress && aiData.email) emailAddress = aiData.email;
            if (!emailMobile && aiData.mobile) emailMobile = aiData.mobile;
            if (!emailCity && aiData.city) emailCity = aiData.city;
            if (aiData.budgetInRupees && !isNaN(aiData.budgetInRupees)) {
              emailBudgetPaise = Math.round(Number(aiData.budgetInRupees) * 100);
            }
            if (aiData.locationPreference) emailLocationPreference = aiData.locationPreference;
            if (aiData.campaignDuration) emailCampaignDuration = aiData.campaignDuration;
            if (aiData.summary) {
              emailNotes = `[AI Lead Summary]\n${aiData.summary}`;
            }
          }
        } catch (aiErr: any) {
          console.warn('[Leads Intake] AI extraction failed, seamlessly using regex fallback:', aiErr?.message);
        }
      }

      // 4. Extract Sender Name & Email from "From" header (Only if not already found)
      const fromStr = String(payload.from || '').trim();
      if (fromStr) {
        const fromMatch = fromStr.match(/^([^<]+)<([^>]+)>$/);
        if (fromMatch) {
          if (!emailContactPerson) emailContactPerson = fromMatch[1].trim().replace(/^["']|["']$/g, '');
          if (!emailAddress) emailAddress = fromMatch[2].trim().toLowerCase();
        } else if (fromStr.includes('@')) {
          if (!emailAddress) emailAddress = fromStr.toLowerCase();
          if (!emailContactPerson) {
            const localPart = fromStr.split('@')[0].replace(/[._-]/g, ' ');
            emailContactPerson = localPart.charAt(0).toUpperCase() + localPart.slice(1);
          }
        }
      }

      // 5. Fallback: Search for Indian 10-digit mobile number regex across the whole email body
      if (!emailMobile) {
        const genericPhoneMatch = plainText.match(/(?:(?:\+|00)?91[\s.-]?)?[6-9]\d{4}[\s.-]?\d{5}|[6-9]\d{9}/);
        if (genericPhoneMatch) {
          emailMobile = genericPhoneMatch[0].trim();
        }
      }

      // 6. Build rich notes (Preserves AI summary, key highlights, and original message)
      const noteSections: string[] = [];
      if (emailNotes) {
        noteSections.push(emailNotes);
        const highlights: string[] = [];
        if (emailBudgetPaise) highlights.push(`• Budget: ₹${(emailBudgetPaise / 100).toLocaleString('en-IN')}`);
        if (emailCampaignDuration) highlights.push(`• Duration: ${emailCampaignDuration}`);
        if (emailCity) highlights.push(`• Location: ${emailCity}`);
        if (highlights.length > 0) {
          noteSections.push(`[Key Highlights]\n${highlights.join('\n')}`);
        }
      }

      const originalDetails: string[] = [];
      if (payload.subject) originalDetails.push(`Subject: ${payload.subject}`);
      if (payload.from) originalDetails.push(`From: ${payload.from}`);
      if (plainText) originalDetails.push(`Message:\n${plainText.trim()}`);
      if (originalDetails.length > 0) {
        noteSections.push(`[Email Lead Details]\n${originalDetails.join('\n')}`);
      }

      emailNotes = noteSections.join('\n\n');
    }

    const rawMobile = String(payload.mobile || payload.phone || payload.contactNumber || emailMobile || '').trim();
    const digitsOnly = rawMobile.replace(/\D/g, '');
    const mobile = digitsOnly.length >= 10 ? digitsOnly.slice(-10) : (digitsOnly || rawMobile || 'Not Provided');

    const combinedName = [
      payload.firstName || payload.first_name || payload['First Name'],
      payload.lastName || payload.last_name || payload['Last Name'],
    ].filter(Boolean).join(' ').trim();

    const contactPerson = payload.contactPerson || payload.name || combinedName || emailContactPerson || 'Prospective Client';
    const companyName = payload.company_name || payload.companyName || payload.company || emailCompanyName || contactPerson || 'Web Lead';
    const email = payload.email ? String(payload.email).trim().toLowerCase() : (emailAddress || undefined);
    const city = payload.city || payload.area || emailCity || undefined;

    // Rich contextual note for Justdial / third-party / website leads
    let notes: string | undefined = emailNotes;
    if (source === 'JustDial' || payload.leadid || payload.category) {
      const noteParts: string[] = [];
      if (payload.leadid) noteParts.push(`JD Lead ID: ${payload.leadid}`);
      if (payload.category) noteParts.push(`Category: ${payload.category}`);
      if (payload.area) noteParts.push(`Area: ${payload.area}`);
      if (payload.pincode) noteParts.push(`Pincode: ${payload.pincode}`);
      if (payload.lead_type) noteParts.push(`Type: ${payload.lead_type}`);
      if (noteParts.length > 0) {
        notes = `[JustDial Lead Details]\n${noteParts.join(' | ')}`;
      }
    } else if (!notes && (payload.comments || payload.comment || payload.message || payload.questions || payload['Comments / Questions'])) {
      notes = String(payload.comments || payload.comment || payload.message || payload.questions || payload['Comments / Questions']).trim();
    }

    const duplicateFilter: Record<string, any> = {
      source: source as LeadSource,
      createdAt: { $gte: windowStart },
      deletedAt: null,
    };
    if (mobile !== 'Not Provided') {
      duplicateFilter.mobile = mobile;
    } else if (email) {
      duplicateFilter.email = email;
    } else {
      duplicateFilter._id = null;
    }

    const existing = await Lead.findOne(duplicateFilter).exec();

    const status: LeadStatus = existing ? 'Duplicate' : 'New';

    // Build qualification block with notes, city, and optional AI-extracted fields
    const qualificationData: any = {};
    if (city) qualificationData.city = city;
    if (notes) qualificationData.notes = notes;
    if (emailBudgetPaise) qualificationData.budget = emailBudgetPaise;
    if (emailLocationPreference) qualificationData.locationPreference = emailLocationPreference;
    if (emailCampaignDuration) qualificationData.campaignDuration = emailCampaignDuration;

    const lead = await Lead.create({
      source: source as LeadSource,
      companyName,
      contactPerson,
      designation: payload.designation || undefined,
      mobile,
      secondaryContactPerson: payload.secondaryContactPerson || undefined,
      secondaryDesignation: payload.secondaryDesignation || undefined,
      secondaryMobile: payload.secondaryMobile || undefined,
      companyAddress: payload.companyAddress || payload.address || undefined,
      companyLocation: payload.companyLocation || payload.location || undefined,
      email,
      city,
      qualification: Object.keys(qualificationData).length > 0 ? qualificationData : undefined,
      rawPayload: payload,
      receivedAt: now,
      status,
      notifiedAt: now,
      slaTimerEnd: status === 'New' ? new Date(now.getTime() + 24 * 60 * 60 * 1000) : undefined,
      statusHistory: [
        {
          to: status,
          reason: existing ? 'Duplicate within 24h' : `Incoming Webhook from ${source}`,
          changedAt: now,
        },
      ],
    });

    // Notify Admin, Manager, and Sales agents on new external lead intake
    if (status === 'New' && mongoose.connection.readyState === 1) {
      try {
        const recipients = await AuthUser.find({
          role: { $in: ['admin', 'manager', 'sales_agent'] },
          deletedAt: null,
        }).select('_id');

        const recipientIds = recipients.map((r: any) => r._id);
        if (recipientIds.length > 0) {
          await notifyMany(recipientIds, {
            type: 'leads.new_intake',
            title: `New Lead from ${source}!`,
            body: `${companyName || contactPerson} (${mobile}) just arrived from ${source}.`,
            link: `/leads/${lead._id}`,
          });
        }
      } catch (err) {
        // Best-effort: notification failure must never block lead creation
        console.error('[intakeLead] Notification failed:', err);
      }
    }

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
      { returnDocument: 'after' },
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
      contactedPerson?: string;
      campaignId?: string;
      reason?: string;
      remarks?: string;
      note?: string;
      nextActionDate?: Date;
      delayResponsibility?: string;
      durationSec?: number;
      budget?: number;
      secondaryContactPerson?: string;
      secondaryDesignation?: string;
      secondaryMobile?: string;
      companyAddress?: string;
      companyLocation?: string;
      email?: string;
    },
    ctx: RequestContext,
  ): Promise<ILead> {
    if (!Types.ObjectId.isValid(id)) throw new NotFoundError('Lead not found');

    const lead = await LeadsService.getLead(id, ctx);
    const now = new Date();

    const followUpEntry = {
      user: toObjectId(ctx.user.id),
      campaignId: payload.campaignId && Types.ObjectId.isValid(payload.campaignId) ? toObjectId(payload.campaignId) : undefined,
      followUpType: payload.followUpType || 'Call',
      contactedPerson: payload.contactedPerson || undefined,
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

    // Optional quick profile updates during call
    if (payload.budget !== undefined) {
      lead.qualification = lead.qualification || {};
      lead.qualification.budget = payload.budget;
    }
    if (payload.secondaryContactPerson) {
      lead.secondaryContactPerson = payload.secondaryContactPerson;
    }
    if (payload.secondaryDesignation) {
      lead.secondaryDesignation = payload.secondaryDesignation;
    }
    if (payload.secondaryMobile) {
      lead.secondaryMobile = payload.secondaryMobile;
    }
    if (payload.companyAddress) {
      lead.companyAddress = payload.companyAddress;
    }
    if (payload.companyLocation) {
      lead.companyLocation = payload.companyLocation;
    }
    if (payload.email) {
      lead.email = payload.email.toLowerCase().trim();
    }

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

    // 1. Check state transitions map (Admins and Managers have override privileges; Reopening from Won/Lost/Rejected is allowed for all roles)
    const isManagerOrAdmin = ctx.user?.role === 'admin' || ctx.user?.role === 'manager';
    const isTerminalStatus = fromStatus === 'Won' || fromStatus === 'Lost' || fromStatus === 'Rejected';
    const isActiveStatus = !['Won', 'Lost', 'Duplicate', 'duplicate', 'Rejected'].includes(toStatus);
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

    // 4b. Rejected Gate: moving to Rejected records reason and tracks who rejected
    if (toStatus === 'Rejected') {
      const reason = payload.lostReason || lead.qualification?.lostReason || 'Junk / Irrelevant inquiry';
      if (lead.qualification) {
        lead.qualification.lostReason = reason.trim();
      }
      lead.rejectedBy = toObjectId(ctx.user.id);
    }

    // 5. Cycle Increment on Re-activation from Won / Lost to an active stage
    if (isReopening) {
      if (fromStatus !== 'Rejected') {
        lead.cycle = (lead.cycle || 1) + 1;
      }
      if (lead.qualification?.lostReason) {
        lead.qualification.lostReason = undefined;
      }
      // If restoring from Rejected to New, ensure it is back in the unclaimed pool
      if (fromStatus === 'Rejected' && toStatus === 'New') {
        lead.assignedTo = undefined;
        lead.claimedBy = undefined;
        lead.rejectedBy = null;
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
      reason: payload.lostReason || (isReopening ? (fromStatus === 'Rejected' ? 'Restored to Unclaimed pool' : 'Re-opened for new campaign inquiry') : undefined),
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
   * Activity timeline combining status changes, follow-ups, quotations, and campaigns chronologically.
   */
  static async getActivity(id: string, ctx: RequestContext): Promise<{ activities: any[] }> {
    const lead = await LeadsService.getLead(id, ctx);
    const leadObjId = toObjectId(id);

    // Fetch linked quotations and campaigns in parallel (with safe fallback for disconnected test environments)
    let quotations: any[] = [];
    let campaigns: any[] = [];
    try {
      [quotations, campaigns] = await Promise.all([
        Quotation.find({ leadId: leadObjId, deletedAt: null }).sort({ createdAt: -1 }).lean().exec(),
        Campaign.find({ leadId: leadObjId, deletedAt: null }).sort({ createdAt: -1 }).lean().exec(),
      ]);
    } catch {
      quotations = [];
      campaigns = [];
    }

    const campaignMap = new Map<string, string>();
    for (const c of campaigns) {
      campaignMap.set(c._id.toString(), c.name);
    }

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

    // Push follow-up logs (with campaign tagging)
    if (lead.callLogs) {
      for (const cl of lead.callLogs) {
        const cId = cl.campaignId ? cl.campaignId.toString() : undefined;
        activities.push({
          type: 'follow_up',
          followUpType: cl.followUpType || 'Call',
          contactedPerson: cl.contactedPerson,
          campaignId: cId,
          campaignName: cId ? campaignMap.get(cId) : undefined,
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

    // Push quotation milestones
    for (const q of quotations) {
      activities.push({
        type: 'quotation',
        referenceCode: q.quoteNumber,
        amount: q.total,
        reason: `Quotation #${q.quoteNumber} created (${q.status})`,
        timestamp: q.createdAt,
      });
      if (q.sentAt) {
        activities.push({
          type: 'quotation',
          referenceCode: q.quoteNumber,
          amount: q.total,
          reason: `Quotation #${q.quoteNumber} sent to client`,
          timestamp: q.sentAt,
        });
      }
      if (q.acceptedAt) {
        activities.push({
          type: 'quotation',
          referenceCode: q.quoteNumber,
          amount: q.total,
          reason: `Quotation #${q.quoteNumber} accepted by client`,
          timestamp: q.acceptedAt,
        });
      }
    }

    // Push campaign execution milestones
    for (const c of campaigns) {
      activities.push({
        type: 'campaign_event',
        campaignId: c._id.toString(),
        campaignName: c.name,
        referenceCode: c.campaignCode,
        amount: c.contractedValue,
        reason: `Campaign "${c.name}" initiated (${c.status})`,
        timestamp: c.createdAt,
      });
    }

    // Sort descending by timestamp
    activities.sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    );

    return { activities };
  }
}
