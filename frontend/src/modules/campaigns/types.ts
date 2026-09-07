export type CampaignStatus =
  | "Draft"
  | "Approved"
  | "InProgress"
  | "Completed"
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

  status?: CampaignStatus;

  city?: string;

  manager?: string;

  startDate?: string;

  endDate?: string;
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

  /*
   * Optional quotation.
   */
  quotationId?: string;

  city: string;

  startDate: string;

  endDate: string;

  siteIds: string[];

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