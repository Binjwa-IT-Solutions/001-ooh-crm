export type CampaignStatus =
  | "In Progress"
  | "Campaign Live"
  | "Campaign End"
  | "Rejected"
  | "Draft"
  | "Approved"
  | "InProgress"
  | "Completed"
  | "Complete"
  | "Cancelled";

export interface CampaignLead {
  _id: string;
  name?: string;
  company?: string;
  companyName?: string;
  contactPerson?: string;
  email?: string;
  phone?: string;
  mobile?: string;
  city?: string;
  assignedTo?: string | { _id: string; name?: string; email?: string; role?: string };
}

export interface CampaignQuotation {
  _id: string;
  quoteNumber?: string;
  total?: number;
  sites?: unknown[];
}

export interface CampaignManager {
  _id: string;
  name?: string;
  email?: string;
  role?: string;
}

export interface CampaignSite {
  _id: string;
  name?: string;
  code?: string;
  city?: string;
  type?: string;
  size?: string;
  baseCostPerDay?: number;
}

export interface Campaign {
  _id: string;

  campaignCode: string;

  name: string;

  leadId:
    | string
    | CampaignLead;

  /*
   * Quotation is optional.
   * A campaign can exist without a quotation.
   */
  quotationId?:
    | string
    | CampaignQuotation
    | null;

  quotationNo?: string;

  quotationName?: string;

  piNo?: string;

  state?: string;

  city: string;

  startDate: string;

  endDate: string;

  siteIds:
    | string[]
    | CampaignSite[];

  contractedValue: number;

  status: CampaignStatus;

  assignedManager?:
    | string
    | CampaignManager
    | null;

  createdAt: string;

  updatedAt: string;
}

export interface CampaignFilters {
  search?: string;
  leadId?: string;
  status?: CampaignStatus;
  state?: string;
  city?: string;
  manager?: string;
  startDate?: string;
  endDate?: string;
  myCampaigns?: boolean;
  agentId?: string;
  tab?: "all" | "live" | "closed" | "renewals";
}

export interface LeadOption {
  _id: string;
  companyName: string;
  contactPerson?: string;
  email?: string;
  mobile?: string;
  city?: string;
}

export interface ManagerOption {
  _id: string;
  name: string;
  email?: string;
  role?: string;
}

export interface CreateCampaignPayload {
  name: string;

  leadId: string;

  quotationId?: string;

  quotationNo?: string;

  quotationName?: string;

  piNo?: string;

  state?: string;

  city: string;

  startDate: string;

  endDate: string;

  siteIds?: string[];

  contractedValue: number;

  status: CampaignStatus;

  assignedManager?: string;
}

export interface CampaignListResponse {
  success: boolean;

  data: Campaign[];

  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface CampaignResponse {
  success: boolean;

  data: Campaign;
}