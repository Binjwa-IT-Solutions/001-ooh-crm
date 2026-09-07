export type PurchaseOrderStatus =
  | "Draft"
  | "Issued"
  | "Accepted"
  | "Cancelled";

export interface PurchaseOrderLineItem {
  _id?: string;
  siteId: string;
  from: string;
  to: string;
  negotiatedRatePerDay: number;
  days: number;
  amount: number;
}

export interface PurchaseOrder {
  _id: string;
  poNumber: string;
  campaignId:
    | string
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
  lineItems: PurchaseOrderLineItem[];
  totalAmount: number;
  status: PurchaseOrderStatus;
  issuedAt?: string;
  pdfKey?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface PurchaseOrderFormData {
  campaignId: string;
  vendorId: string;
  lineItems: Omit<
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
}

export interface PurchaseOrdersResponse {
  data: PurchaseOrder[];
  message?: string;
}

export interface PurchaseOrderResponse {
  data: PurchaseOrder;
  message?: string;
}