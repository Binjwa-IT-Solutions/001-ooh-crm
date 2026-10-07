export type AuditAction =
  | 'create'
  | 'update'
  | 'delete'
  | 'login'
  | 'logout'
  | 'login_failed'
  | 'export'
  | 'other';

export interface AuditChange {
  field: string;
  from: unknown;
  to: unknown;
}

export interface AuditLogEntry {
  _id: string;
  actorId?: string | null;
  actorEmail?: string | null;
  actorRole?: string | null;
  action: AuditAction;
  entity: string;
  entityId?: string | null;
  payload?: unknown;
  changes?: AuditChange[];
  method?: string | null;
  path?: string | null;
  statusCode?: number | null;
  ip?: string | null;
  userAgent?: string | null;
  createdAt: string;
}

export interface AuditFilters {
  entity?: string;
  action?: string;
  from?: string;
  to?: string;
  search?: string;
  page?: number;
  pageSize?: number;
}

export interface AuditListResponse {
  data: AuditLogEntry[];
  meta: {
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
  };
}

export type ComplianceCheckType =
  | 'executed_on_time'
  | 'deadlines_met'
  | 'proofs_complete'
  | 'gps_match'
  | 'payments_in_reconciled'
  | 'payments_out_reconciled';

export interface ComplianceCheckResult {
  _id: string;
  campaignId: string;
  checkType: ComplianceCheckType;
  passed: boolean;
  details: {
    summary: string;
    message?: string;
    failingItems?: Array<{ id: string; name?: string; reason?: string }>;
    metadata?: Record<string, unknown>;
  };
  checkedAt: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface ComplianceRunSummary {
  totalCampaignsAudited: number;
  totalChecksRun: number;
  failingChecksCount: number;
}

export interface UserSummaryItem {
  _id: string;
  name: string;
  email: string;
  role: string;
  designation?: string;
  phone?: string;
  status: string;
  lastLoginAt?: string | null;
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
    lastLoginAt?: string | null;
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
      leadConversionRate: number;
      taskCompletionRate: number;
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
      nextActionDate?: string | null;
      isOverdue: boolean;
      createdAt: string;
    }>;
    quotations: Array<{
      _id: string;
      quoteNumber: string;
      clientName: string;
      status: string;
      totalPaise: number;
      validUntil: string;
      createdAt: string;
    }>;
    tasks: Array<{
      _id: string;
      title: string;
      type: string;
      status: string;
      deadline: string;
      isOverdue: boolean;
    }>;
    paymentsIn?: Array<{
      _id: string;
      campaignCode: string;
      clientName: string;
      city?: string;
      contractedValuePaise: number;
      status: string;
      createdAt: string;
    }>;
    paymentsOut?: Array<{
      _id: string;
      poNumber: string;
      vendorName: string;
      totalAmountPaise: number;
      paidAmountPaise: number;
      paymentStatus: string;
      dueDate?: string | null;
      createdAt: string;
    }>;
    leaves?: Array<{
      _id: string;
      employeeName: string;
      leaveType: string;
      days: number;
      reason: string;
      status: string;
      fromDate: string;
      toDate: string;
      createdAt: string;
    }>;
    attendance?: Array<{
      _id: string;
      employeeName: string;
      date: string;
      status: string;
      workType: string;
      checkInTime?: string | null;
      flaggedForReview: boolean;
    }>;
    interviews?: Array<{
      _id: string;
      candidateName: string;
      position: string;
      interviewDate: string;
      status: string;
      mobile: string;
    }>;
    approvals?: Array<{
      _id: string;
      type: 'Lead' | 'Campaign' | 'Leave';
      title: string;
      requesterName: string;
      status: string;
      requestedAt: string;
    }>;
    escalations?: Array<{
      _id: string;
      taskTitle: string;
      campaignName?: string;
      level: string;
      triggeredAt: string;
    }>;
    exceptions?: Array<{
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
    createdAt: string;
  }>;
}

