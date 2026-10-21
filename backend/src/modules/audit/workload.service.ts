import { Types } from 'mongoose';
import { AuthUser } from '../../core/auth/auth-model.js';
import { AuditLog } from '../../core/audit/audit-model.js';
import { Lead } from '../leads/leads.model.js';
import { Quotation } from '../quotations/quotations.model.js';
import { Task } from '../tasks/task.model.js';
import { Campaign, CampaignStatus } from '../campaigns/campaign.model.js';
import { Proof } from '../proofs/proof.model.js';
import { PurchaseOrder } from '../purchase-orders/purchase-order.model.js';
import { LeaveRequest } from '../HR/models/leave.model.js';
import Attendance from '../HR/models/attendance.model.js';
import { CandidateModel } from '../candidates/candidates.model.js';
import { EscalationModel } from '../escalations/escalation.model.js';
import { ExceptionsService } from '../exceptions/exceptions.service.js';
import { toObjectId } from '../../core/db/basePlugin.js';
import { NotFoundError } from '../../core/errors/index.js';

export interface UserSummaryItem {
  _id: string;
  name: string;
  email: string;
  role: string;
  designation?: string;
  phone?: string;
  status: string;
  lastLoginAt?: Date | null;
  activeLeadsCount: number;
  openTasksCount: number;
}

export interface UserWorkloadAuditResponse {
  user: {
    _id: string;
    name: string;
    email: string;
    role: string;
    designation?: string;
    phone?: string;
    status: string;
    lastLoginAt?: Date | null;
  };
  metrics: {
    completed: {
      leadsWon: number;
      leadsContacted: number;
      callsLogged: number;
      quotationsSent: number;
      quotationsAccepted: number;
      tasksCompleted: number;
      totalAuditActions: number;
    };
    pending: {
      leadsActive: number;
      leadsNew: number;
      quotationsDraft: number;
      tasksPending: number;
      tasksInProgress: number;
    };
    overdue: {
      leadsOverdueFollowUp: number;
      tasksOverdue: number;
    };
    performance: {
      leadConversionRate: number; // percentage
      taskCompletionRate: number; // percentage
      totalTasksCount: number;
      wonContractValuePaise: number;
      pipelineValuePaise: number;
    };
    ops?: {
      campaignsManaged: number;
      activeCampaigns: number;
      proofsUploaded: number;
      tasksByType: {
        printing: number;
        installation: number;
        verification: number;
        removal: number;
        custom: number;
      };
    };
    finance?: {
      paymentsInCount: number;
      paymentsOutCount: number;
      totalBillingPaise: number;
      pendingDisbursementPaise: number;
      realizedRevenuePaise?: number;
      pendingReceivablePaise?: number;
    };
    hr?: {
      pendingLeavesCount: number;
      attendanceIrregularCount: number;
      upcomingInterviewsCount: number;
    };
    manager?: {
      pendingApprovalsCount: number;
      activeEscalationsCount: number;
      managedCampaignsCount: number;
    };
    admin?: {
      activeExceptionsCount: number;
      highSeverityExceptionsCount: number;
      totalEscalationsCount: number;
    };
  };
  pendingItems: {
    leads: Array<{
      _id: string;
      companyName: string;
      contactPerson: string;
      mobile: string;
      status: string;
      city?: string;
      nextActionDate?: Date | null;
      isOverdue: boolean;
      createdAt: Date;
    }>;
    quotations: Array<{
      _id: string;
      quoteNumber: string;
      clientName: string;
      status: string;
      totalPaise: number;
      validUntil: Date;
      createdAt: Date;
    }>;
    tasks: Array<{
      _id: string;
      title: string;
      type: string;
      status: string;
      deadline: Date;
      isOverdue: boolean;
    }>;
    paymentsIn: Array<{
      _id: string;
      campaignCode: string;
      clientName: string;
      city?: string;
      contractedValuePaise: number;
      status: string;
      createdAt: Date;
    }>;
    paymentsOut: Array<{
      _id: string;
      poNumber: string;
      vendorName: string;
      totalAmountPaise: number;
      paidAmountPaise: number;
      paymentStatus: string;
      dueDate?: Date | null;
      createdAt: Date;
    }>;
    leaves: Array<{
      _id: string;
      employeeName: string;
      leaveType: string;
      days: number;
      reason: string;
      status: string;
      fromDate: Date;
      toDate: Date;
      createdAt: Date;
    }>;
    attendance: Array<{
      _id: string;
      employeeName: string;
      date: Date;
      status: string;
      workType: string;
      checkInTime?: Date | null;
      flaggedForReview: boolean;
    }>;
    interviews: Array<{
      _id: string;
      candidateName: string;
      position: string;
      interviewDate: Date;
      status: string;
      mobile: string;
    }>;
    approvals: Array<{
      _id: string;
      type: 'Lead' | 'Campaign' | 'Leave';
      title: string;
      requesterName: string;
      status: string;
      requestedAt: Date;
    }>;
    escalations: Array<{
      _id: string;
      taskTitle: string;
      campaignName?: string;
      level: string;
      triggeredAt: Date;
    }>;
    exceptions: Array<{
      key: string;
      title: string;
      type: string;
      severity: string;
      message: string;
      entityId?: string;
    }>;
  };
  recentActivities: Array<{
    _id: string;
    action: string;
    entity: string;
    entityId?: string;
    statusCode?: number;
    path?: string;
    createdAt: Date;
  }>;
}

export class WorkloadAuditService {
  /**
   * List all users with quick overview counts of active leads & tasks.
   */
  static async listUsersSummary(): Promise<UserSummaryItem[]> {
    const users = await AuthUser.find({
      deletedAt: null,
      role: { $ne: 'admin' },
    }).sort({ name: 1 }).lean();

    const userSummaries: UserSummaryItem[] = [];

    for (const u of users) {
      const userId = u._id;

      const [activeLeads, openTasks] = await Promise.all([
        Lead.countDocuments({
          $or: [{ assignedTo: userId }, { claimedBy: userId }],
          status: { $nin: ['Won', 'Lost', 'Rejected', 'Duplicate', 'duplicate'] },
          deletedAt: null,
        }),
        Task.countDocuments({
          assignedTo: userId,
          status: { $in: ['Pending', 'InProgress'] },
          deletedAt: null,
        }),
      ]);

      userSummaries.push({
        _id: String(u._id),
        name: u.name,
        email: u.email,
        role: u.role,
        designation: u.designation,
        phone: u.phone,
        status: u.status,
        lastLoginAt: u.lastLoginAt,
        activeLeadsCount: activeLeads,
        openTasksCount: openTasks,
      });
    }

    return userSummaries;
  }

  /**
   * Deep-dive audit into a single user's workload, completed items, pending backlog, and real-time activity trail.
   */
  static async getUserWorkload(userIdStr: string, options: { from?: Date; to?: Date } = {}): Promise<UserWorkloadAuditResponse> {
    const userObjectId = toObjectId(userIdStr);
    const user = await AuthUser.findOne({ _id: userObjectId, deletedAt: null }).lean();

    if (!user) {
      throw new NotFoundError('User not found');
    }

    const now = new Date();

    // 1. Fetch all Leads assigned to or claimed by this user
    const leadQuery: Record<string, any> = {
      $or: [{ assignedTo: userObjectId }, { claimedBy: userObjectId }],
      deletedAt: null,
    };
    if (options.from || options.to) {
      leadQuery.createdAt = {};
      if (options.from) leadQuery.createdAt.$gte = options.from;
      if (options.to) leadQuery.createdAt.$lte = options.to;
    }

    const leads = await Lead.find(leadQuery).sort({ updatedAt: -1 }).lean();

    let leadsWon = 0;
    let leadsContacted = 0;
    let leadsActive = 0;
    let leadsNew = 0;
    let leadsOverdueFollowUp = 0;
    let callsLogged = 0;

    const pendingLeadsList: UserWorkloadAuditResponse['pendingItems']['leads'] = [];

    for (const l of leads) {
      const st = l.status;
      if (st === 'Won') leadsWon++;
      else if (st === 'Contacted' || st === 'Interested' || st === 'Qualified' || st === 'Proposal Sent' || st === 'Negotiation') {
        leadsContacted++;
      }

      if (st === 'New') {
        leadsNew++;
      }

      const isClosed = ['Won', 'Lost', 'Rejected', 'Duplicate', 'duplicate'].includes(st);
      if (!isClosed) {
        leadsActive++;

        const isOverdue = Boolean(l.nextActionDate && new Date(l.nextActionDate) < now);
        if (isOverdue) {
          leadsOverdueFollowUp++;
        }

        if (pendingLeadsList.length < 15) {
          pendingLeadsList.push({
            _id: String(l._id),
            companyName: l.companyName,
            contactPerson: l.contactPerson,
            mobile: l.mobile,
            status: l.status,
            city: l.city,
            nextActionDate: l.nextActionDate,
            isOverdue,
            createdAt: l.createdAt,
          });
        }
      }

      // Count follow-ups / calls logged by this user
      if (l.callLogs && Array.isArray(l.callLogs)) {
        for (const cl of l.callLogs) {
          if (cl.user && String(cl.user) === String(userObjectId)) {
            callsLogged++;
          }
        }
      }
    }

    // 2. Fetch Quotations created by this user
    const quoteQuery: Record<string, any> = {
      createdBy: userObjectId,
      deletedAt: null,
    };
    if (options.from || options.to) {
      quoteQuery.createdAt = {};
      if (options.from) quoteQuery.createdAt.$gte = options.from;
      if (options.to) quoteQuery.createdAt.$lte = options.to;
    }

    const quotations = await Quotation.find(quoteQuery).sort({ createdAt: -1 }).lean();

    let quotationsSent = 0;
    let quotationsAccepted = 0;
    let quotationsDraft = 0;
    let wonContractValuePaise = 0;
    let pipelineValuePaise = 0;

    const pendingQuotesList: UserWorkloadAuditResponse['pendingItems']['quotations'] = [];

    for (const q of quotations) {
      const qVal = q.total || 0;
      if (q.status === 'Accepted') {
        quotationsAccepted++;
        wonContractValuePaise += qVal;
      } else if (q.status === 'Sent') {
        quotationsSent++;
        pipelineValuePaise += qVal;
      } else if (q.status === 'Draft') {
        quotationsDraft++;
        pipelineValuePaise += qVal;
      }

      if (['Draft', 'Sent'].includes(q.status) && pendingQuotesList.length < 15) {
        pendingQuotesList.push({
          _id: String(q._id),
          quoteNumber: q.quoteNumber,
          clientName: q.clientName || 'Client',
          status: q.status,
          totalPaise: q.total || 0,
          validUntil: q.validUntil,
          createdAt: q.createdAt,
        });
      }
    }

    // 3. Fetch Tasks assigned to this user
    const taskQuery: Record<string, any> = {
      assignedTo: userObjectId,
      deletedAt: null,
    };
    if (options.from || options.to) {
      taskQuery.createdAt = {};
      if (options.from) taskQuery.createdAt.$gte = options.from;
      if (options.to) taskQuery.createdAt.$lte = options.to;
    }

    const tasks = await Task.find(taskQuery).sort({ deadline: 1 }).lean();

    let tasksCompleted = 0;
    let tasksPending = 0;
    let tasksInProgress = 0;
    let tasksOverdue = 0;

    const pendingTasksList: UserWorkloadAuditResponse['pendingItems']['tasks'] = [];

    for (const t of tasks) {
      if (t.status === 'Completed') {
        tasksCompleted++;
      } else {
        if (t.status === 'Pending') tasksPending++;
        else if (t.status === 'InProgress') tasksInProgress++;

        const isOverdue = Boolean(t.deadline && new Date(t.deadline) < now);
        if (isOverdue) {
          tasksOverdue++;
        }

        if (pendingTasksList.length < 15) {
          pendingTasksList.push({
            _id: String(t._id),
            title: t.title,
            type: t.type,
            status: t.status,
            deadline: t.deadline,
            isOverdue,
          });
        }
      }
    }

    // 4. Fetch recent Audit Log activity records
    const auditQuery: Record<string, any> = {
      actorId: String(userObjectId),
    };
    if (options.from || options.to) {
      auditQuery.createdAt = {};
      if (options.from) auditQuery.createdAt.$gte = options.from;
      if (options.to) auditQuery.createdAt.$lte = options.to;
    }

    const [totalAuditActions, recentAuditLogs] = await Promise.all([
      AuditLog.countDocuments(auditQuery),
      AuditLog.find(auditQuery).sort({ createdAt: -1 }).limit(25).lean(),
    ]);

    const recentActivities = recentAuditLogs.map((log) => ({
      _id: String(log._id),
      action: log.action,
      entity: log.entity,
      entityId: log.entityId || undefined,
      statusCode: log.statusCode !== null && log.statusCode !== undefined ? log.statusCode : undefined,
      path: log.path || undefined,
      createdAt: log.createdAt,
    }));

    // Performance Ratios
    const totalProcessedLeads = leadsWon + leads.filter((l) => l.status === 'Lost' || l.status === 'Rejected').length;
    const leadConversionRate = totalProcessedLeads > 0 ? Math.round((leadsWon / totalProcessedLeads) * 100) : (leads.length > 0 ? Math.round((leadsWon / leads.length) * 100) : 0);

    const totalTasks = tasks.length;
    const taskCompletionRate = totalTasks > 0 ? Math.round((tasksCompleted / totalTasks) * 100) : 0;

    // 5. Operations specific queries (Campaigns & Proofs)
    const [campaignsManaged, activeCampaigns, proofsUploaded] = await Promise.all([
      Campaign.countDocuments({ assignedManager: userObjectId, deletedAt: null }),
      Campaign.countDocuments({
        assignedManager: userObjectId,
        status: { $in: [CampaignStatus.IN_PROGRESS, CampaignStatus.APPROVED] },
        deletedAt: null,
      }),
      Proof.countDocuments({ uploadedBy: userObjectId }),
    ]);

    const tasksByType = {
      printing: 0,
      installation: 0,
      verification: 0,
      removal: 0,
      custom: 0,
    };
    for (const t of tasks) {
      const tp = (t.type || '').toLowerCase();
      if (tp === 'printing') tasksByType.printing++;
      else if (tp === 'installation') tasksByType.installation++;
      else if (tp === 'verification') tasksByType.verification++;
      else if (tp === 'removal') tasksByType.removal++;
      else tasksByType.custom++;
    }

    // 6. Role-Adaptive Auxiliary Queries (Finance, HR, Manager, Admin)
    const [
      activeCampaignsBilling,
      pendingPOs,
      leavesDocs,
      attendanceDocs,
      candidateDocs,
      escalationDocs,
    ] = await Promise.all([
      Campaign.find({
        deletedAt: null,
      }).sort({ updatedAt: -1 }).limit(15).lean(),
      PurchaseOrder.find({
        deletedAt: null,
        status: { $ne: 'Cancelled' },
      }).sort({ createdAt: -1 }).limit(15).lean(),
      LeaveRequest.find({})
        .populate('employeeId', 'name email')
        .populate('leaveTypeId', 'name code')
        .sort({ createdAt: -1 })
        .limit(15)
        .lean(),
      Attendance.find({
        $or: [{ status: { $in: ['Late', 'Half-Day', 'Absent'] } }, { flaggedForReview: true }],
        deletedAt: null,
      })
        .populate('employeeId', 'name email')
        .sort({ date: -1 })
        .limit(15)
        .lean(),
      CandidateModel.find({}).sort({ interviewDate: -1 }).limit(15).lean(),
      EscalationModel.find({})
        .populate({ path: 'taskId', select: 'title deadline status campaignId' })
        .sort({ triggeredAt: -1 })
        .limit(15)
        .lean(),
    ]);

    let rawExceptions: any[] = [];
    try {
      rawExceptions = await ExceptionsService.getExceptions();
    } catch (e) {
      console.warn('[WorkloadAuditService] Exceptions retrieval error:', e);
    }

    const pendingPaymentsInList = activeCampaignsBilling.map((c) => ({
      _id: String(c._id),
      campaignCode: c.campaignCode || 'CAMPAIGN',
      clientName: c.name || 'Client',
      city: c.city || 'National',
      contractedValuePaise: c.contractedValue || 0,
      status: c.status,
      createdAt: c.createdAt,
    }));

    const pendingPaymentsOutList = pendingPOs.map((po: any) => ({
      _id: String(po._id),
      poNumber: po.poNumber,
      vendorName: po.vendorName || po.companyName || 'Vendor',
      totalAmountPaise: po.totalAmount || 0,
      paidAmountPaise: po.paidAmount || 0,
      paymentStatus: po.paymentStatus || po.status || 'Pending',
      dueDate: po.dueDate || po.validityTo || null,
      createdAt: po.createdAt,
    }));

    const pendingLeavesList = leavesDocs.map((l: any) => ({
      _id: String(l._id),
      employeeName: l.employeeId?.name || 'Staff Member',
      leaveType: l.leaveTypeId?.name || l.leaveTypeId?.code || 'Casual Leave',
      days: l.days || 1,
      reason: l.reason || 'Personal Leave',
      status: l.status || 'Pending',
      fromDate: l.fromDate,
      toDate: l.toDate,
      createdAt: l.createdAt,
    }));

    const attendanceIssuesList = attendanceDocs.map((a: any) => ({
      _id: String(a._id),
      employeeName: a.employeeId?.name || 'Employee',
      date: a.date,
      status: a.status,
      workType: a.workType || 'Office',
      checkInTime: a.checkInTime || null,
      flaggedForReview: Boolean(a.flaggedForReview),
    }));

    const interviewList = candidateDocs.map((cd) => ({
      _id: String(cd._id),
      candidateName: cd.name,
      position: cd.position,
      interviewDate: cd.interviewDate,
      status: cd.status,
      mobile: cd.mobile,
    }));

    // Approvals: Qualified leads, draft campaigns, pending leaves
    const qualLeads = leads.filter((l) => l.status === 'Qualified').slice(0, 5);
    const draftCampaigns = activeCampaignsBilling.filter((c) => c.status === CampaignStatus.DRAFT).slice(0, 5);
    const pendingLeaves = leavesDocs.filter((l: any) => l.status === 'Pending').slice(0, 5);

    const approvalsList: Array<{ _id: string; type: 'Lead' | 'Campaign' | 'Leave'; title: string; requesterName: string; status: string; requestedAt: Date }> = [
      ...qualLeads.map((l) => ({
        _id: String(l._id),
        type: 'Lead' as const,
        title: `Lead Qualification: ${l.companyName}`,
        requesterName: l.contactPerson || 'Sales Team',
        status: l.status,
        requestedAt: l.updatedAt || l.createdAt,
      })),
      ...draftCampaigns.map((c) => ({
        _id: String(c._id),
        type: 'Campaign' as const,
        title: `Campaign Launch: ${c.name} (${c.campaignCode})`,
        requesterName: c.city || 'Operations',
        status: c.status,
        requestedAt: c.createdAt,
      })),
      ...pendingLeaves.map((lv: any) => ({
        _id: String(lv._id),
        type: 'Leave' as const,
        title: `Leave Approval: ${lv.days} day(s) - ${lv.reason}`,
        requesterName: lv.employeeId?.name || 'Staff Member',
        status: lv.status,
        requestedAt: lv.createdAt,
      })),
    ];

    const escalationsList = escalationDocs.map((e: any) => ({
      _id: String(e._id),
      taskTitle: e.taskId?.title || 'Operational Task',
      campaignName: e.taskId?.campaignId ? String(e.taskId.campaignId) : undefined,
      level: e.level,
      triggeredAt: e.triggeredAt,
    }));

    const exceptionsList = rawExceptions.slice(0, 15).map((ex) => ({
      key: ex.id,
      title: ex.title,
      type: ex.type,
      severity: ex.severity,
      message: ex.message,
      entityId: ex.entityId,
    }));

    // Aggregated metrics
    const totalBillingPaise = pendingPaymentsInList.reduce((sum, item) => sum + (item.contractedValuePaise || 0), 0);
    const pendingDisbursementPaise = pendingPOs
      .filter((p: any) => p.paymentStatus !== 'Paid' && p.status !== 'Accepted')
      .reduce((sum, p) => sum + (p.totalAmount || 0), 0);

    // Completed/Reconciled campaigns count as collected/realized revenue
    const realizedRevenuePaise = activeCampaignsBilling
      .filter((c) => c.status === CampaignStatus.COMPLETED || c.status === CampaignStatus.COMPLETE)
      .reduce((sum, c) => sum + (c.contractedValue || 0), 0);
    const pendingReceivablePaise = Math.max(0, totalBillingPaise - realizedRevenuePaise);

    const financeMetrics = {
      paymentsInCount: pendingPaymentsInList.length,
      paymentsOutCount: pendingPOs.filter((p: any) => p.paymentStatus !== 'Paid' && p.status !== 'Accepted').length,
      totalBillingPaise,
      pendingDisbursementPaise,
      realizedRevenuePaise,
      pendingReceivablePaise,
    };

    const hrMetrics = {
      pendingLeavesCount: pendingLeavesList.filter((l) => l.status === 'Pending').length,
      attendanceIrregularCount: attendanceIssuesList.length,
      upcomingInterviewsCount: interviewList.filter((i) => i.status === 'Scheduled').length,
    };

    const managerMetrics = {
      pendingApprovalsCount: approvalsList.length,
      activeEscalationsCount: escalationsList.length,
      managedCampaignsCount: campaignsManaged || activeCampaignsBilling.length,
    };

    const adminMetrics = {
      activeExceptionsCount: rawExceptions.length,
      highSeverityExceptionsCount: rawExceptions.filter((x) => x.severity === 'HIGH').length,
      totalEscalationsCount: escalationDocs.length,
    };

    return {
      user: {
        _id: String(user._id),
        name: user.name,
        email: user.email,
        role: user.role,
        designation: user.designation,
        phone: user.phone,
        status: user.status,
        lastLoginAt: user.lastLoginAt,
      },
      metrics: {
        completed: {
          leadsWon,
          leadsContacted,
          callsLogged,
          quotationsSent,
          quotationsAccepted,
          tasksCompleted,
          totalAuditActions,
        },
        pending: {
          leadsActive,
          leadsNew,
          quotationsDraft,
          tasksPending,
          tasksInProgress,
        },
        overdue: {
          leadsOverdueFollowUp,
          tasksOverdue,
        },
        performance: {
          leadConversionRate,
          taskCompletionRate,
          totalTasksCount: totalTasks,
          wonContractValuePaise,
          pipelineValuePaise,
        },
        ops: {
          campaignsManaged,
          activeCampaigns,
          proofsUploaded,
          tasksByType,
        },
        finance: financeMetrics,
        hr: hrMetrics,
        manager: managerMetrics,
        admin: adminMetrics,
      },
      pendingItems: {
        leads: pendingLeadsList,
        quotations: pendingQuotesList,
        tasks: pendingTasksList,
        paymentsIn: pendingPaymentsInList,
        paymentsOut: pendingPaymentsOutList,
        leaves: pendingLeavesList,
        attendance: attendanceIssuesList,
        interviews: interviewList,
        approvals: approvalsList,
        escalations: escalationsList,
        exceptions: exceptionsList,
      },
      recentActivities,
    };
  }
}
