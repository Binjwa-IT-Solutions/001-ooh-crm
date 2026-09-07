export type LeadSource =
  | 'JustDial'
  | 'Website'
  | 'WhatsApp'
  | 'Facebook'
  | 'Instagram'
  | 'Email'
  | 'Referral'
  | 'Manual';

export type LeadStatus =
  | 'New'
  | 'Contacted'
  | 'Interested'
  | 'Qualified'
  | 'Proposal Sent'
  | 'Negotiation'
  | 'Won'
  | 'Lost'
  | 'Duplicate'
  | 'duplicate';

export const STATUS_TRANSITIONS: Record<string, LeadStatus[]> = {
  New: ['Contacted', 'Lost'],
  Contacted: ['Interested', 'Lost'],
  Interested: ['Qualified', 'Lost'],
  Qualified: ['Proposal Sent', 'Negotiation', 'Lost'],
  'Proposal Sent': ['Negotiation', 'Won', 'Lost'],
  Negotiation: ['Won', 'Lost'],
  Won: [],
  Lost: [],
  Duplicate: [],
  duplicate: [],
};

export type LocationPreference = 'Airport' | 'Highway' | 'Mall' | 'Metro' | 'Other';

export const FOLLOW_UP_TYPES = ['Call', 'Meeting', 'WhatsApp', 'Email', 'Visit', 'Other'] as const;
export type FollowUpType = (typeof FOLLOW_UP_TYPES)[number];

export const FOLLOW_UP_REASONS = [
  'Requirement Gathering',
  'Quotation Review',
  'Rate Negotiation',
  'Payment Follow-up',
  'Design / Creative',
  'General Follow-up',
] as const;
export type FollowUpReason = (typeof FOLLOW_UP_REASONS)[number];

export interface LeadQualification {
  city?: string;
  locationPreference?: LocationPreference;
  campaignDuration?: string;
  budget?: number; // integer paise
  targetAudience?: string;
  campaignObjective?: string;
  creativeRequirements?: string;
  notes?: string;
  lostReason?: string;
}

export interface ManagerApproval {
  approved: boolean;
  approvedBy?: any;
  approvedAt?: string | null;
  remarks?: string;
}

export interface FollowUpLog {
  user?: any;
  followUpType?: FollowUpType;
  reason?: string;
  remarks?: string;
  note?: string;
  nextActionDate?: string | null;
  delayResponsibility?: string;
  durationSec?: number;
  createdAt: string;
}

export interface ActivityItem {
  type: 'status_change' | 'call_log' | 'follow_up' | 'manager_review';
  from?: string;
  to?: string;
  reason?: string;
  changedBy?: any;
  user?: any;
  note?: string;
  remarks?: string;
  followUpType?: FollowUpType;
  nextActionDate?: string | null;
  delayResponsibility?: string;
  approved?: boolean;
  durationSec?: number;
  cycle?: number;
  timestamp: string;
}

export interface Lead {
  id: string;
  _id?: string;
  companyName: string;
  contactPerson: string;
  mobile: string;
  email?: string;
  city?: string;
  source: LeadSource;
  status: LeadStatus;
  rawPayload?: Record<string, any>;
  receivedAt: string;
  assignedTo?: any;
  notifiedAt?: string | null;
  claimedBy?: any;
  claimedAt?: string | null;
  firstResponseAt?: string | null;
  firstCallAt?: string | null;
  qualifiedAt?: string | null;
  slaTimerEnd?: string | null;
  nextActionDate?: string | null;
  managerApproval?: ManagerApproval | null;
  statusHistory?: Array<{ from?: string; to: string; changedBy?: any; reason?: string; cycle?: number; changedAt: string }>;
  callLogs?: FollowUpLog[];
  qualification?: LeadQualification;
  cycle?: number;
  createdAt: string;
  updatedAt: string;
}

export interface LeadListResponse {
  leads: Lead[];
  data: Lead[];
  meta: {
    total: number;
    page: number;
    limit: number;
  };
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export type LeadsListResponse = LeadListResponse;

export interface LeadListQuery {
  source?: LeadSource | '';
  status?: LeadStatus | '';
  city?: string;
  page?: number;
  pageSize?: number;
  limit?: number;
  search?: string;
  assignedTo?: string;
  assignedToMe?: boolean;
  unassigned?: boolean;
  fromDate?: string;
  toDate?: string;
  sortBy?: 'receivedAt' | 'companyName' | 'source';
  sortDir?: 'asc' | 'desc';
}

export type LeadFilters = LeadListQuery;

export interface LeadFormValues {
  companyName: string;
  contactPerson: string;
  mobile: string;
  email: string;
  city: string;
}

export type CallOutcome = 'Connected' | 'Busy' | 'Left Message' | 'No Answer';

export interface LogCallValues {
  outcome?: CallOutcome;
  followUpType?: FollowUpType;
  reason?: string;
  remarks?: string;
  note?: string;
  nextActionDate?: string;
  delayResponsibility?: string;
  durationSec?: number;
}
