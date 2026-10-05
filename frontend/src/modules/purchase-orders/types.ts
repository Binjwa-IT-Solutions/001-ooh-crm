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
  ratePerDay?: number;
  days?: number;
  amount?: number;

  item?: string;
  service?: string;
  description?: string;
  hsn?: string;
  qty?: number;
  unit?: string;
  rate?: number;
  discount?: number;
  tax?: number;
}

export interface BankDetails {
  bankName?: string;
  personName?: string;
  accountNumber?: string;
  ifsc?: string;
  branch?: string;
}

export interface CompanyProfile {
  companyName?: string;
  companyAddress?: string;
  companyGstin?: string;
  companyEmail?: string;
  companyPhone?: string;
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
  campaignName?: string;
  vendorId?:
    | string
    | {
        _id: string;
        name: string;
        state?: string;
        city?: string;
        address?: string;
        gstin?: string;
        status?: string;
        contactPerson?: string;
        mobile?: string;
        email?: string;
      };
  vendorName?: string;

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

  poDate?: string;
  placeOfSupply?: string;
  vendorAddress?: string;
  vendorGstin?: string;
  subtotal?: number;
  gstRate?: number;
  gstAmount?: number;
  companyName?: string;
  companyAddress?: string;
  companyGstin?: string;
  companyEmail?: string;
  companyPhone?: string;
  notes?: string;
  termsAndConditions?: string[];
  bankDetails?: BankDetails | null;

  // Payment Tracking
  paymentTerms?: string;
  dueDate?: string;
  paymentMethod?: string;
  gstApplicable?: boolean;
  accountsStatus?: string;
  accountsComments?: string;
  invoiceNumber?: string;
  invoiceDate?: string;
  paymentStatus?: "Pending" | "Partial" | "Paid";
  paidAmount?: number;
  paymentDate?: string;

  lineItems: PurchaseOrderLineItem[];
  totalAmount: number;
  status: PurchaseOrderStatus;
  issuedAt?: string;
  pdfKey?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface PurchaseOrderFormData {
  poNumber?: string;
  pricingId?: string;
  vendorId?: string;
  vendorName?: string;
  campaignId?: string;
  campaignName?: string;

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

  poDate?: string;
  placeOfSupply?: string;
  vendorAddress?: string;
  vendorGstin?: string;
  subtotal?: number;
  gstRate?: number;
  gstAmount?: number;
  companyName?: string;
  companyAddress?: string;
  companyGstin?: string;
  companyEmail?: string;
  companyPhone?: string;
  notes?: string;
  termsAndConditions?: string[];
  bankDetails?: BankDetails | null;
  status?: PurchaseOrderStatus;

  totalAmount?: number;
  lineItems?: PurchaseOrderLineItem[];
}

export interface PaymentTrackingData {
  invoiceNumber?: string;
  invoiceDate?: string;
  paidAmount?: number;
  paymentDate?: string;
  paymentTerms?: string;
  dueDate?: string;
  paymentMethod?: string;
  gstApplicable?: boolean;
  accountsStatus?: string;
  accountsComments?: string;
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
  address?: string;
  gstin?: string;
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