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
  type LeadDocumentType,
} from './leads.model.js';
import { STATUS_TRANSITIONS } from './leads.validator.js';
import { toObjectId } from '../../core/db/basePlugin.js';
import { fileService } from '../../core/files/index.js';
import { AuthUser } from '../../core/auth/auth-model.js';
import { notify, notifyMany } from '../../core/notifications/index.js';
import { extractLeadWithGemini } from './leads.ai.js';
import { Quotation } from '../quotations/quotations.model.js';
import { Campaign } from '../campaigns/campaign.model.js';

function escapeRegex(text: string): string {
  return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, '\\$&');
}

export class LeadsService {
  /**
   * Release leads back to Unclaimed pool if claimed for >= 24 hours
   * without any action/response taken (firstResponseAt is empty, callLogs is empty, and status is still New).
   */
  static async releaseBreachedClaimedLeads(): Promise<number> {
    const now = new Date();
    const cutoff24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const candidates = await Lead.find({
      status: 'New',
      claimedBy: { $ne: null },
      deletedAt: null,
      $or: [
        { firstResponseAt: null },
        { firstResponseAt: { $exists: false } },
      ],
      $and: [
        {
          $or: [
            { slaTimerEnd: { $ne: null, $lt: now } },
            { claimedAt: { $ne: null, $lt: cutoff24h } },
          ],
        },
      ],
    }).exec();

    let releasedCount = 0;

    for (const lead of candidates) {
      if (lead.callLogs && lead.callLogs.length > 0) {
        continue;
      }

      const prevClaimedBy = lead.claimedBy;
      const prevClaimedById = prevClaimedBy ? prevClaimedBy.toString() : null;

      lead.claimedBy = null as any;
      lead.assignedTo = null as any;
      lead.claimedAt = null as any;
      lead.slaTimerEnd = null as any;
      lead.status = 'New';

      lead.statusHistory = lead.statusHistory || [];
      lead.statusHistory.push({
        from: 'New',
        to: 'New',
        changedBy: prevClaimedBy,
        reason: 'Auto-released to Unclaimed pool: 24h SLA breached without any action/response taken.',
        changedAt: now,
      });

      await lead.save();
      releasedCount++;

      if (prevClaimedById && mongoose.connection.readyState === 1) {
        void notify({
          userId: prevClaimedById,
          type: 'leads.sla_breached_unclaimed',
          title: 'Lead SLA Breached - Claim Released',
          body: `Lead "${lead.companyName}" was returned to the Unclaimed pool because no action was logged within 24 hours of claiming.`,
          link: `/leads/${lead._id}`,
        });
      }
    }

    return releasedCount;
  }

  /**
   * List leads with filtering, pagination, and scoping rules applied.
   */
  static async listLeads(
    filters: any,
    ctx: RequestContext,
  ): Promise<{ leads: ILead[]; total: number }> {
    try {
      await LeadsService.releaseBreachedClaimedLeads();
    } catch (err) {
      console.error('[leads] failed to release breached leads on list:', err);
    }

    const query: Record<string, any> = {};

    if (filters.search) {
      const searchRegex = { $regex: filters.search, $options: 'i' };
      query.$or = [{ companyName: searchRegex }, { mobile: searchRegex }];
    }

    if (filters.status) query.status = filters.status;
    if (filters.city) query.city = new RegExp(escapeRegex(filters.city.trim()), 'i');
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

  static async exportLeads(filters: any, ctx: RequestContext): Promise<string> {
    const query: Record<string, any> = { deletedAt: null };

    if (filters.search) {
      const searchRegex = new RegExp(filters.search, 'i');
      query.$or = [
        { companyName: searchRegex },
        { contactPerson: searchRegex },
        { mobile: searchRegex },
        { email: searchRegex },
        { city: searchRegex },
      ];
    }

    if (filters.status) {
      query.status = filters.status;
    }

    if (filters.city) {
      query.city = new RegExp(escapeRegex(filters.city.trim()), 'i');
    }

    if (filters.source) {
      query.source = filters.source;
    }

    if (filters.unassigned) {
      query.status = 'New';
      query.assignedTo = null;
      query.claimedBy = null;
    } else if (filters.assignedTo) {
      query.assignedTo = toObjectId(filters.assignedTo);
    } else if (filters.assignedToMe) {
      query.assignedTo = toObjectId(ctx.user.id);
    }

    if (filters.overdueOnly) {
      query.nextActionDate = { $ne: null, $lt: new Date() };
      if (!filters.status) {
        query.status = { $nin: ['Won', 'Lost', 'Rejected'] };
      }
    }

    const leads = await scopedFind(Lead, query, ctx, { ownerField: 'assignedTo' })
      .sort({ createdAt: -1 })
      .populate('assignedTo claimedBy', 'name email role')
      .exec();

    const headers = [
      'Company Name',
      'Primary Contact Person',
      'Designation',
      'Mobile',
      'Secondary Contact Person',
      'Secondary Designation',
      'Secondary Mobile',
      'Email',
      'Company Address',
      'Company Location',
      'City',
      'Source',
      'Status',
      'Assigned To',
      'Claimed By',
      'Next Action Date',
      'Budget (INR)',
      'Location Preference',
      'Campaign Duration',
      'Target Audience',
      'Created At',
    ];

    const escapeCsv = (val: any): string => {
      if (val === null || val === undefined) return '';
      const str = String(val).trim();
      if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
        return `"${str.replace(/"/g, '""')}"`;
      }
      return str;
    };

    const rows = leads.map((l: any) => {
      const assignedToName = l.assignedTo?.name || '';
      const claimedByName = l.claimedBy?.name || '';
      const nextAction = l.nextActionDate ? new Date(l.nextActionDate).toLocaleString('en-IN') : '';
      const budgetRupees = l.qualification?.budget ? (l.qualification.budget / 100).toFixed(0) : '';
      const createdAtFormatted = l.createdAt ? new Date(l.createdAt).toLocaleString('en-IN') : '';

      return [
        escapeCsv(l.companyName),
        escapeCsv(l.contactPerson),
        escapeCsv(l.designation || ''),
        escapeCsv(l.mobile),
        escapeCsv(l.secondaryContactPerson || ''),
        escapeCsv(l.secondaryDesignation || ''),
        escapeCsv(l.secondaryMobile || ''),
        escapeCsv(l.email || ''),
        escapeCsv(l.companyAddress || ''),
        escapeCsv(l.companyLocation || ''),
        escapeCsv(l.city || ''),
        escapeCsv(l.source),
        escapeCsv(l.status),
        escapeCsv(assignedToName),
        escapeCsv(claimedByName),
        escapeCsv(nextAction),
        escapeCsv(budgetRupees),
        escapeCsv(l.qualification?.locationPreference || ''),
        escapeCsv(l.qualification?.campaignDuration || ''),
        escapeCsv(l.qualification?.targetAudience || ''),
        escapeCsv(createdAtFormatted),
      ].join(',');
    });

    return '\uFEFFsep=,\r\n' + [headers.join(','), ...rows].join('\r\n');
  }

  static async getLead(id: string, ctx: RequestContext): Promise<ILead> {
    if (!Types.ObjectId.isValid(id)) throw new NotFoundError('Lead not found');

    const now = new Date();
    const cutoff24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    // Auto-release if this lead was previously claimed but breached 24h SLA with no action
    const existing = await Lead.findOne({ _id: toObjectId(id), deletedAt: null });
    if (
      existing &&
      existing.status === 'New' &&
      existing.claimedBy &&
      !existing.firstResponseAt &&
      (!existing.callLogs || existing.callLogs.length === 0)
    ) {
      const isBreached =
        (existing.slaTimerEnd && existing.slaTimerEnd.getTime() < now.getTime()) ||
        (existing.claimedAt && existing.claimedAt.getTime() < cutoff24h.getTime());

      if (isBreached) {
        const prevClaimedBy = existing.claimedBy;
        const prevClaimedById = prevClaimedBy ? prevClaimedBy.toString() : null;

        existing.claimedBy = null as any;
        existing.assignedTo = null as any;
        existing.claimedAt = null as any;
        existing.slaTimerEnd = null as any;
        existing.statusHistory = existing.statusHistory || [];
        existing.statusHistory.push({
          from: 'New',
          to: 'New',
          changedBy: prevClaimedBy,
          reason: 'Auto-released to Unclaimed pool: 24h SLA breached without any action/response taken.',
          changedAt: now,
        });
        await existing.save();

        if (prevClaimedById && mongoose.connection.readyState === 1) {
          void notify({
            userId: prevClaimedById,
            type: 'leads.sla_breached_unclaimed',
            title: 'Lead SLA Breached - Claim Released',
            body: `Lead "${existing.companyName}" was returned to the Unclaimed pool because no action was logged within 24 hours of claiming.`,
            link: `/leads/${existing._id}`,
          });
        }
      }
    }

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

    if (lead.populate) {
      await lead.populate('assignedTo claimedBy rejectedBy documents.uploadedBy', 'name email role');
    }
    if (lead.documents && lead.documents.length > 0) {
      for (const doc of lead.documents) {
        if (doc.fileKey && !doc.fileUrl) {
          try {
            doc.fileUrl = await fileService.url(doc.fileKey);
          } catch {
            // ignore
          }
        }
      }
    }
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
    const cutoff24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    // If target lead has breached 24h SLA without action, release it before attempting claim
    const targetLead = await Lead.findOne({ _id: toObjectId(id), deletedAt: null });
    if (
      targetLead &&
      targetLead.status === 'New' &&
      targetLead.claimedBy &&
      !targetLead.firstResponseAt &&
      (!targetLead.callLogs || targetLead.callLogs.length === 0)
    ) {
      const isBreached =
        (targetLead.slaTimerEnd && targetLead.slaTimerEnd.getTime() < now.getTime()) ||
        (targetLead.claimedAt && targetLead.claimedAt.getTime() < cutoff24h.getTime());

      if (isBreached) {
        const prevClaimedBy = targetLead.claimedBy;
        const prevClaimedById = prevClaimedBy ? prevClaimedBy.toString() : null;

        targetLead.claimedBy = null as any;
        targetLead.assignedTo = null as any;
        targetLead.claimedAt = null as any;
        targetLead.slaTimerEnd = null as any;
        targetLead.statusHistory = targetLead.statusHistory || [];
        targetLead.statusHistory.push({
          from: 'New',
          to: 'New',
          changedBy: prevClaimedBy,
          reason: 'Auto-released to Unclaimed pool: 24h SLA breached without any action/response taken.',
          changedAt: now,
        });
        await targetLead.save();

        if (prevClaimedById && mongoose.connection.readyState === 1) {
          void notify({
            userId: prevClaimedById,
            type: 'leads.sla_breached_unclaimed',
            title: 'Lead SLA Breached - Claim Released',
            body: `Lead "${targetLead.companyName}" was returned to the Unclaimed pool because no action was logged within 24 hours of claiming.`,
            link: `/leads/${targetLead._id}`,
          });
        }
      }
    }

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
      loggedAt?: Date;
      nextActionDate?: Date | null;
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

    if (payload.loggedAt) {
      const minDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 0, 0, 0);
      if (payload.loggedAt.getTime() > now.getTime() + 5 * 60 * 1000) {
        throw new ValidationError('Interaction date/time cannot be in the future.');
      }
      if (payload.loggedAt.getTime() < minDate.getTime()) {
        throw new ValidationError('Action cannot be backdated more than 1 day.');
      }
    }

    const interactionTime = payload.loggedAt || now;

    const followUpEntry = {
      user: toObjectId(ctx.user.id),
      campaignId: payload.campaignId && Types.ObjectId.isValid(payload.campaignId) ? toObjectId(payload.campaignId) : undefined,
      followUpType: payload.followUpType || 'Call',
      contactedPerson: payload.contactedPerson || undefined,
      reason: payload.reason ?? '',
      remarks: payload.remarks || payload.note || '',
      note: payload.note || payload.remarks || '',
      nextActionDate: payload.nextActionDate instanceof Date
        ? payload.nextActionDate
        : payload.nextActionDate
          ? new Date(payload.nextActionDate)
          : null,
      delayResponsibility: payload.delayResponsibility || undefined,
      durationSec: payload.durationSec ?? undefined,
      createdAt: interactionTime,
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

    lead.nextActionDate = payload.nextActionDate instanceof Date
      ? payload.nextActionDate
      : payload.nextActionDate
        ? new Date(payload.nextActionDate)
        : null;

    if (followUpEntry.followUpType === 'Call' && !lead.firstCallAt) {
      lead.firstCallAt = interactionTime;
    }

    if (!lead.firstResponseAt) {
      lead.firstResponseAt = interactionTime;
      if (lead.status === 'New') {
        lead.status = 'Contacted';
        lead.assignedTo = lead.assignedTo || toObjectId(ctx.user.id);
        lead.claimedBy = lead.claimedBy || toObjectId(ctx.user.id);
        lead.claimedAt = lead.claimedAt || interactionTime;

        lead.statusHistory = lead.statusHistory || [];
        lead.statusHistory.push({
          from: 'New',
          to: 'Contacted',
          changedBy: toObjectId(ctx.user.id),
          reason: `First Follow-up Logged (${followUpEntry.followUpType}): ${followUpEntry.reason || followUpEntry.remarks || 'Client Contacted'}`,
          changedAt: interactionTime,
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
    payload: { note?: string; durationSec?: number; followUpType?: FollowUpType; reason?: string; loggedAt?: Date; nextActionDate?: Date | null; delayResponsibility?: string },
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
    if (lead.populate) {
      await lead.populate('callLogs.user statusHistory.changedBy managerApproval.approvedBy', 'name email role');
    }
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

  /**
   * Upload and attach a document to a lead.
   */
  static async uploadDocument(
    id: string,
    file: Express.Multer.File | undefined,
    data: { documentType: LeadDocumentType; title: string; notes?: string },
    ctx: RequestContext,
  ): Promise<ILead> {
    if (!file) throw new ValidationError('No file was uploaded');
    const lead = await LeadsService.getLead(id, ctx);

    const stored = await fileService.save(file, { folder: 'leads', ctx });

    const newDoc = {
      documentType: data.documentType,
      title: data.title.trim(),
      originalName: stored.originalName,
      fileKey: stored.key,
      fileUrl: stored.url,
      fileSize: stored.size,
      mimeType: stored.contentType,
      uploadedBy: toObjectId(ctx.user.id),
      uploadedAt: new Date(),
      notes: data.notes?.trim() || '',
    };

    lead.documents = lead.documents || [];
    lead.documents.push(newDoc as any);
    await lead.save();

    if (lead.populate) {
      await lead.populate('assignedTo claimedBy rejectedBy documents.uploadedBy', 'name email role');
    }
    return lead;
  }

  /**
   * Delete an attached document from a lead.
   */
  static async deleteDocument(
    id: string,
    docId: string,
    ctx: RequestContext,
  ): Promise<ILead> {
    const lead = await LeadsService.getLead(id, ctx);
    const docIndex = (lead.documents || []).findIndex(
      (d: any) => String(d._id) === docId || String(d.id) === docId,
    );
    if (docIndex === -1) throw new NotFoundError('Document not found');

    const doc = lead.documents![docIndex];
    if (doc.fileKey) {
      try {
        await fileService.remove(doc.fileKey);
      } catch {
        // Continue even if file already absent from storage
      }
    }

    lead.documents!.splice(docIndex, 1);
    await lead.save();

    if (lead.populate) {
      await lead.populate('assignedTo claimedBy rejectedBy documents.uploadedBy', 'name email role');
    }
    return lead;
  }

  static async getDistinctCities(ctx: RequestContext): Promise<string[]> {
    const rawCities = await Lead.distinct('city', { deletedAt: null });
    const cleanSet = new Set<string>();
    for (const c of rawCities) {
      if (!c || typeof c !== 'string') continue;
      const clean = c.replace(/^.*?\]/, '').trim();
      if (clean) cleanSet.add(clean);
    }
    return Array.from(cleanSet).sort((a, b) => a.localeCompare(b));
  }
}

