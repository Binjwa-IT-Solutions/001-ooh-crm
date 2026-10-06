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

