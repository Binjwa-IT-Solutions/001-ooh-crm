import { Types } from 'mongoose';
import { Campaign, CampaignStatus } from '../campaigns/campaign.model.js';
import { Task } from '../tasks/task.model.js';
import { Proof } from '../proofs/proof.model.js';
import { PurchaseOrder } from '../purchase-orders/purchase-order.model.js';
import { EscalationModel } from '../escalations/escalation.model.js';
import { AuditResult } from '../audit/audit-result.model.js';
import { ExceptionAcknowledgement } from './exception-acknowledgement.model.js';
import type {
  IExceptionItem,
  ExceptionFilters,
  ExceptionSeverity,
  ExceptionType,
} from './exception.types.js';

function severityScore(s: ExceptionSeverity): number {
  switch (s) {
    case 'HIGH':
      return 3;
    case 'MEDIUM':
      return 2;
    case 'LOW':
      return 1;
    default:
      return 0;
  }
}

// In-memory cache for fast sidebar badge computation
let countCache: {
  totalUnresolved: number;
  highSeverityCount: number;
  byType: Record<string, number>;
  cachedAt: number;
} | null = null;

const CACHE_TTL_MS = 20_000; // 20s cache for fast nav badge

export class ExceptionsService {
  /**
   * Invalidate count cache whenever exceptions are acknowledged or refreshed.
   */
  static clearCache(): void {
    countCache = null;
  }

  /**
   * Fast cheap count computation for sidebar navigation badge.
   */
  static async getCountSummary(): Promise<{
    totalUnresolved: number;
    highSeverityCount: number;
    byType: Record<string, number>;
  }> {
    const now = Date.now();
    if (countCache && now - countCache.cachedAt < CACHE_TTL_MS) {
      return {
        totalUnresolved: countCache.totalUnresolved,
        highSeverityCount: countCache.highSeverityCount,
        byType: countCache.byType,
      };
    }

    const items = await this.gatherAllExceptions({ includeAcknowledged: false });
    const byType: Record<string, number> = {};
    let highCount = 0;

    for (const item of items) {
      byType[item.type] = (byType[item.type] || 0) + 1;
      if (item.severity === 'HIGH') {
        highCount++;
      }
    }

    countCache = {
      totalUnresolved: items.length,
      highSeverityCount: highCount,
      byType,
      cachedAt: now,
    };

    return {
      totalUnresolved: items.length,
      highSeverityCount: highCount,
      byType,
    };
  }

  /**
   * Acknowledge an exception to hide it from default view (never deleted).
   */
  static async acknowledge(
    exceptionKey: string,
    exceptionType: string,
    entityId: string,
    userId: string | Types.ObjectId,
    notes?: string,
  ): Promise<void> {
    const uId = typeof userId === 'string' ? new Types.ObjectId(userId) : userId;

    await ExceptionAcknowledgement.findOneAndUpdate(
      { exceptionKey },
      {
        $set: {
          exceptionType,
          entityId,
          acknowledgedBy: uId,
          acknowledgedAt: new Date(),
          notes: notes || undefined,
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );

    this.clearCache();
  }

  /**
   * Fetch sorted and filtered exceptions for Manager / Admin dashboard.
   */
  static async getExceptions(filters: ExceptionFilters = {}): Promise<IExceptionItem[]> {
    let items = await this.gatherAllExceptions(filters);

    // Filter by type
    if (filters.type && filters.type !== 'ALL') {
      items = items.filter((i) => i.type === filters.type);
    }

    // Filter by severity
    if (filters.severity) {
      items = items.filter((i) => i.severity === filters.severity);
    }

    // Filter by city
    if (filters.city?.trim()) {
      const cLower = filters.city.trim().toLowerCase();
      items = items.filter((i) => i.city?.toLowerCase().includes(cLower));
    }

    // Filter by campaignId
    if (filters.campaignId?.trim()) {
      items = items.filter((i) => i.campaignId === filters.campaignId?.trim());
    }

    // Search keyword
    if (filters.search?.trim()) {
      const term = filters.search.trim().toLowerCase();
      items = items.filter(
        (i) =>
          i.title.toLowerCase().includes(term) ||
          i.description.toLowerCase().includes(term) ||
          i.campaignName?.toLowerCase().includes(term) ||
          i.city?.toLowerCase().includes(term),
      );
    }

    // Date range filter
    if (filters.from) {
      const fromTime = new Date(filters.from).getTime();
      items = items.filter((i) => new Date(i.occurredAt).getTime() >= fromTime);
    }
    if (filters.to) {
      const toTime = new Date(filters.to).getTime();
      items = items.filter((i) => new Date(i.occurredAt).getTime() <= toTime);
    }

    // Spec rule: "Sort by severity then age — the oldest unaddressed problem is usually the most expensive."
    items.sort((a, b) => {
      const sevDiff = severityScore(b.severity) - severityScore(a.severity);
      if (sevDiff !== 0) return sevDiff;
      return new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime();
    });

    return items;
  }

  /**
   * Internal aggregator reading signals produced by Tracks H1, D4, E2, F1, F2, D1, D2.
   */
  private static async gatherAllExceptions(filters: ExceptionFilters = {}): Promise<IExceptionItem[]> {
    const now = new Date();
    const items: IExceptionItem[] = [];

    // 1. Fetch acknowledgements to check what's already acknowledged
    const acks = await ExceptionAcknowledgement.find({}).lean();
    const ackMap = new Map<string, { by: string; at: Date }>();
    for (const a of acks) {
      ackMap.set(a.exceptionKey, {
        by: String(a.acknowledgedBy),
        at: a.acknowledgedAt,
      });
    }

    // Pre-fetch campaign details for quick lookup
    const allCampaigns = await Campaign.find({ deletedAt: null }).select('_id name campaignCode city status endDate contractedValue quotationId').lean();
    const campaignMap = new Map<string, any>();
    for (const c of allCampaigns) {
      campaignMap.set(String(c._id), c);
    }

    // ── Exception 1: Missing or rejected proof photos (Track E) ─────────────
    try {
      // 1A: Rejected proofs
      const rejectedProofs = await Proof.find({ status: 'Rejected' }).sort({ createdAt: -1 }).limit(100).lean();
      for (const p of rejectedProofs) {
        const pId = String(p._id);
        const key = `proof_rejected:${pId}`;
        const cId = p.campaignId ? String(p.campaignId) : undefined;
        const cmp = cId ? campaignMap.get(cId) : undefined;

        items.push({
          id: key,
          type: 'missing_or_rejected_proof',
          severity: 'HIGH',
          title: `Proof Rejected: ${p.locationName || 'Media Site'}`,
          description: p.rejectionReason
            ? `Rejected: "${p.rejectionReason}". Re-upload required.`
            : 'Proof photo failed verification criteria. Re-upload required.',
          source: 'Proof of Display',
          entityType: 'proof',
          entityId: pId,
          campaignId: cId,
          campaignName: cmp?.name,
          city: cmp?.city,
          occurredAt: p.reviewedAt || (p as any).createdAt || p.capturedAt || now,
          acknowledged: ackMap.has(key),
          acknowledgedBy: ackMap.get(key)?.by,
          acknowledgedAt: ackMap.get(key)?.at,
          link: cId ? `/proofs?campaignId=${encodeURIComponent(cId)}` : `/proofs`,
          metadata: { locationName: p.locationName, rejectionReason: p.rejectionReason },
        });
      }

      // 1B: Mandatory tasks past deadline with missing proofs
      const missingProofTasks = await Task.find({
        deletedAt: null,
        proofRequired: true,
        proofId: null,
        deadline: { $lt: now },
      }).sort({ deadline: 1 }).limit(100).lean();

      for (const t of missingProofTasks) {
        const tId = String(t._id);
        const key = `task_missing_proof:${tId}`;
        const cId = t.campaignId ? String(t.campaignId) : undefined;
        const cmp = cId ? campaignMap.get(cId) : undefined;

        items.push({
          id: key,
          type: 'missing_or_rejected_proof',
          severity: 'HIGH',
          title: `Missing Proof: ${t.title}`,
          description: `Mandatory proof for ${t.type || 'task'} not uploaded. Task deadline passed on ${new Date(t.deadline).toLocaleDateString('en-IN')}.`,
          source: 'Task Proofs',
          entityType: 'task',
          entityId: tId,
          campaignId: cId,
          campaignName: cmp?.name,
          city: cmp?.city,
          occurredAt: t.deadline || now,
          acknowledged: ackMap.has(key),
          acknowledgedBy: ackMap.get(key)?.by,
          acknowledgedAt: ackMap.get(key)?.at,
          link: `/tasks?search=${encodeURIComponent(t.title)}`,
          metadata: { taskType: t.type, deadline: t.deadline, taskTitle: t.title },
        });
      }
    } catch (err) {
      console.error('[ExceptionsService] Error gathering proof exceptions:', err);
    }

    // ── Exception 2: Campaigns past deadline without completion ─────────
    try {
      const overdueCampaigns = allCampaigns.filter((c) => {
        if (!c.endDate) return false;
        const end = new Date(c.endDate);
        const st = String(c.status || '').toLowerCase().trim();
        const isFinishedOrClosed =
          st === 'campaign end' ||
          st === 'completed' ||
          st === 'complete' ||
          st === 'cancelled' ||
          st === 'rejected' ||
          c.status === CampaignStatus.COMPLETED ||
          c.status === CampaignStatus.COMPLETE ||
          c.status === CampaignStatus.CANCELLED;
        return end < now && !isFinishedOrClosed;
      });

      for (const c of overdueCampaigns) {
        const cId = String(c._id);
        const key = `campaign_past_deadline:${cId}`;

        items.push({
          id: key,
          type: 'campaign_past_deadline',
          severity: 'HIGH',
          title: `Campaign Overdue: ${c.name}`,
          description: `Campaign ended on ${new Date(c.endDate).toLocaleDateString('en-IN')} but status remains "${c.status}". Operational closure required.`,
          source: 'Campaign Schedule',
          entityType: 'campaign',
          entityId: cId,
          campaignId: cId,
          campaignName: c.name,
          city: c.city,
          occurredAt: c.endDate,
          acknowledged: ackMap.has(key),
          acknowledgedBy: ackMap.get(key)?.by,
          acknowledgedAt: ackMap.get(key)?.at,
          link: `/campaigns?search=${encodeURIComponent(c.campaignCode || c.name)}`,
          metadata: { campaignCode: c.campaignCode, status: c.status, endDate: c.endDate },
        });
      }
    } catch (err) {
      console.error('[ExceptionsService] Error gathering overdue campaign exceptions:', err);
    }

    // ── Exception 3: Tasks escalated to L3 ──────────────────────────────
    try {
      const l3Escalations = await EscalationModel.find({ level: 'L3' })
        .populate('taskId')
        .sort({ triggeredAt: -1 })
        .limit(50)
        .lean();

      for (const esc of l3Escalations) {
        const task: any = esc.taskId;
        // Skip orphaned test escalations where task doesn't exist or is already completed/deleted
        if (!task || !task._id || task.deletedAt || task.status === 'Completed') {
          continue;
        }

        const escId = String(esc._id);
        const key = `escalation_l3:${escId}`;
        const cId = task.campaignId ? String(task.campaignId) : undefined;
        const cmp = cId ? campaignMap.get(cId) : undefined;

        items.push({
          id: key,
          type: 'task_escalated_l3',
          severity: 'HIGH',
          title: `L3 Escalation: ${task.title || 'Operational Task'}`,
          description: `Task "${task.title}" (${task.type || 'Field Operation'}) is overdue and escalated to Level 3 Management. Immediate resolution required.`,
          source: 'Task Escalations',
          entityType: 'task',
          entityId: String(task._id),
          campaignId: cId,
          campaignName: cmp?.name,
          city: cmp?.city,
          occurredAt: esc.triggeredAt || esc.createdAt || now,
          acknowledged: ackMap.has(key),
          acknowledgedBy: ackMap.get(key)?.by,
          acknowledgedAt: ackMap.get(key)?.at,
          link: `/tasks?search=${encodeURIComponent(task.title)}`,
          metadata: { escalationLevel: 'L3', taskType: task.type, triggeredAt: esc.triggeredAt, taskTitle: task.title },
        });
      }
    } catch (err) {
      console.error('[ExceptionsService] Error gathering L3 escalations:', err);
    }

    // ── Exception 4: GPS mismatches on proof uploads (E2) ─────────────────
    // ── Exception 5: Failed audit checks pending review (H1) ──────────────
    try {
      const failedAuditChecks = await AuditResult.find({ passed: false })
        .sort({ checkedAt: -1 })
        .limit(100)
        .lean();

      for (const audit of failedAuditChecks) {
        const auditId = String(audit._id);
        const cId = String(audit.campaignId);
        const cmp = campaignMap.get(cId);
        const isGps = audit.checkType === 'gps_match';
        const key = `audit_${audit.checkType}:${cId}`;

        items.push({
          id: key,
          type: isGps ? 'gps_mismatch' : 'failed_audit_check',
          severity: isGps ? 'HIGH' : 'MEDIUM',
          title: isGps
            ? `GPS Radius Breach: ${cmp?.name || 'Campaign Site'}`
            : `Audit Flag: ${audit.checkType.replace(/_/g, ' ')}`,
          description: audit.details?.summary || 'Automated compliance check failed during verification scan.',
          source: isGps ? 'Geo-Fence Radius' : 'Compliance Check',
          entityType: 'audit_result',
          entityId: auditId,
          campaignId: cId,
          campaignName: cmp?.name,
          city: cmp?.city,
          occurredAt: audit.checkedAt || audit.createdAt || now,
          acknowledged: ackMap.has(key),
          acknowledgedBy: ackMap.get(key)?.by,
          acknowledgedAt: ackMap.get(key)?.at,
          link: `/audit?tab=compliance&campaignId=${encodeURIComponent(cId)}`,
          metadata: { checkType: audit.checkType, details: audit.details },
        });
      }
    } catch (err) {
      console.error('[ExceptionsService] Error gathering audit failure exceptions:', err);
    }

    // ── Exception 6: Outstanding vendor payments & cancelled POs ──────────
    try {
      const cancelledPos = await PurchaseOrder.find({ status: 'Cancelled' })
        .sort({ updatedAt: -1 })
        .limit(50)
        .lean();

      for (const po of cancelledPos) {
        const poId = String(po._id);
        const key = `po_cancelled:${poId}`;
        const cId = po.campaignId ? String(po.campaignId) : undefined;
        const cmp = cId ? campaignMap.get(cId) : undefined;

        items.push({
          id: key,
          type: 'vendor_payment_outstanding',
          severity: 'MEDIUM',
          title: `Cancelled PO: ${po.poNumber || 'Vendor PO'}`,
          description: `Vendor purchase order ${po.poNumber || ''} is cancelled but was committed for fulfillment.`,
          source: 'Vendor Purchase Orders',
          entityType: 'purchase_order',
          entityId: poId,
          campaignId: cId,
          campaignName: cmp?.name,
          city: cmp?.city,
          amount: po.totalAmount,
          occurredAt: po.updatedAt || now,
          acknowledged: ackMap.has(key),
          acknowledgedBy: ackMap.get(key)?.by,
          acknowledgedAt: ackMap.get(key)?.at,
          link: `/purchase-orders/${poId}`,
          metadata: { poNumber: po.poNumber, status: po.status, totalAmount: po.totalAmount },
        });
      }
    } catch (err) {
      console.error('[ExceptionsService] Error gathering vendor PO exceptions:', err);
    }

    // ── Exception 7: Outstanding client billing / contracted payments ──────
    try {
      const activeCompletedWithQuote = allCampaigns.filter((c) => {
        if (!c.quotationId) return false;
        const st = String(c.status || '').toLowerCase().trim();
        return (
          st === 'campaign end' ||
          st === 'completed' ||
          st === 'complete' ||
          st === 'campaign live' ||
          st === 'in progress' ||
          st === 'inprogress' ||
          c.status === CampaignStatus.COMPLETED ||
          c.status === CampaignStatus.COMPLETE ||
          c.status === CampaignStatus.IN_PROGRESS
        );
      });

      for (const c of activeCompletedWithQuote) {
        const st = String(c.status || '').toLowerCase().trim();
        const isDone =
          st === 'campaign end' ||
          st === 'completed' ||
          st === 'complete' ||
          c.status === CampaignStatus.COMPLETED ||
          c.status === CampaignStatus.COMPLETE;

        // If contracted value > 0 and campaign is completed / campaign end, surface financial sign-off pending
        if (isDone && c.contractedValue && c.contractedValue > 0) {
          const cId = String(c._id);
          const key = `client_payment_check:${cId}`;

          items.push({
            id: key,
            type: 'client_payment_outstanding',
            severity: 'MEDIUM',
            title: `Client Billing Reconciliation: ${c.name}`,
            description: `Campaign is completed (${c.status}) with contracted value ₹${(c.contractedValue || 0).toLocaleString('en-IN')}. Verify full billing reconciliation.`,
            source: 'Client Billing',
            entityType: 'campaign',
            entityId: cId,
            campaignId: cId,
            campaignName: c.name,
            city: c.city,
            amount: c.contractedValue,
            occurredAt: c.endDate || now,
            acknowledged: ackMap.has(key),
            acknowledgedBy: ackMap.get(key)?.by,
            acknowledgedAt: ackMap.get(key)?.at,
            link: `/campaigns?search=${encodeURIComponent(c.campaignCode || c.name)}`,
            metadata: { contractedValue: c.contractedValue, campaignCode: c.campaignCode },
          });
        }
      }
    } catch (err) {
      console.error('[ExceptionsService] Error gathering client payment exceptions:', err);
    }

    // Filter out acknowledged exceptions if includeAcknowledged is false (default)
    if (!filters.includeAcknowledged) {
      return items.filter((i) => !i.acknowledged);
    }

    return items;
  }
}
