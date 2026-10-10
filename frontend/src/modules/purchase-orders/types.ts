export type PurchaseOrderStatus =
  | "Draft"
  | "Issued"
  | "Accepted"
  | "Cancelled";

export interface PurchaseOrderLineItem {
  _id?: string;
  siteId?: string;
  city?: string;
  spaceType?: string;
  from?: string;
  to?: string;
  negotiatedRatePerDay?: number;
  days?: number;
  amount?: number;
}

export interface PurchaseOrder {
  _id: string;
  poNumber: string;
  pricingId?: string;
  campaignId?:
    | string
    | null
    | {
        _id: string;
        name: string;
        campaignCode?: string;
        city?: string;
        startDate?: string;
        endDate?: string;
        status?: string;
      };
  vendorId:
    | string
    | {
        _id: string;
        name: string;
        state?: string;
        city?: string;
        status?: string;
        contactPerson?: string;
        mobile?: string;
        email?: string;
      };

  city?: string;
  spaceType?: string;
  cardRate?: number;
  negotiatedRate?: number;
  discountGiven?: number;
  discountPercent?: number;
  companyCostPrice?: number;
  companySellingPrice?: number;
  profitPerUnit?: number;
  profitMarginPercent?: number;
  durationDays?: number;
  validityFrom?: string;
  validityTo?: string;
  negotiationRounds?: number;
  negotiationNotes?: string;
  approvedBy?: string;

  lineItems: PurchaseOrderLineItem[];
  totalAmount: number;
  status: PurchaseOrderStatus;
  issuedAt?: string;
  pdfKey?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface PurchaseOrderFormData {
  pricingId?: string;
  vendorId: string;
  campaignId?: string;

  city: string;
  spaceType: string;

  cardRate: number;
  negotiatedRate: number;
  discountGiven?: number;
  discountPercent?: number;

  companyCostPrice: number;
  companySellingPrice: number;
  profitPerUnit?: number;
  profitMarginPercent?: number;

  durationDays: number;
  validityFrom?: string;
  validityTo?: string;

  negotiationRounds?: number;
  negotiationNotes?: string;
  approvedBy?: string;

  totalAmount?: number;
  lineItems?: Omit<
    PurchaseOrderLineItem,
    "amount" | "days"
  >[];
}

export interface CampaignOption {
  _id: string;
  name: string;
  campaignCode?: string;
  city?: string;
  status?: string;
  startDate?: string;
  endDate?: string;
}

export interface VendorOption {
  _id: string;
  name: string;
  state?: string;
  city?: string;
  status?: string;
  contactPerson?: string;
  mobile?: string;
}

export interface PurchaseOrderFilters {
  search?: string;
  status?: string;
  campaignId?: string;
  vendorId?: string;
  city?: string;
}

export interface PurchaseOrdersResponse {
  data: PurchaseOrder[];
  message?: string;
}

export interface PurchaseOrderResponse {
  data: PurchaseOrder;
  message?: string;
}