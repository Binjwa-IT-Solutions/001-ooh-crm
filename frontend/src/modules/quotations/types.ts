export type QuotationStatus = 'Draft' | 'Sent' | 'Accepted' | 'Rejected' | 'Expired';

export interface QuotationLineItem {
  siteId: string | { _id?: string; code?: string; siteCode?: string; city?: string; type?: string; address?: string };
  description?: string;
  ratePerDay: number; // paise
  startDate?: string | null;
  endDate?: string | null;
  days: number;
  discountPercent?: number;
  taxPercent?: number;
  amount: number; // paise
}

export interface BankDetails {
  bankName?: string;
  accountName?: string;
  accountNumber?: string;
  ifscCode?: string;
  branch?: string;
}

export interface Quotation {
  id: string;
  _id?: string;
  quoteNumber: string;
  leadId?: string | { _id?: string; companyName?: string; contactPerson?: string; email?: string; mobile?: string };
  clientName?: string;
  clientContactPerson?: string;
  clientEmail?: string;
  clientPhone?: string;
  clientGstin?: string;
  clientAddress?: string;
  clientCity?: string;
  clientState?: string;
  isInterState?: boolean;
  notes?: string;
  terms?: string[];
  bankDetails?: BankDetails;
  signatureImage?: string;
  signatoryName?: string;
  signatoryDesignation?: string;
  sites: QuotationLineItem[];
  subtotal: number; // paise
  taxPercent: number;
  taxAmount: number; // paise
  total: number; // paise
  validUntil: string;
  status: QuotationStatus;
  pdfKey?: string;
  sentAt?: string | null;
  sentTo?: string | null;
  trackingToken?: string | null;
  viewedAt?: string | null;
  acceptedAt?: string | null;
  rejectedAt?: string | null;
  rejectionReason?: string | null;
  createdAt?: string;
  updatedAt?: string;
  createdBy?: string | { _id?: string; name?: string; email?: string; role?: string };
}

export interface QuotationStats {
  totalQuotedValue: number;
  totalCount: number;
  awaitingValue: number;
  awaitingCount: number;
  acceptedValue: number;
  acceptedCount: number;
  draftValue: number;
  draftCount: number;
}

export interface QuotationsListResponse {
  quotations: Quotation[];
  meta: {
    total: number;
    page: number;
    limit: number;
  };
}

export interface QuotationFilters {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  leadId?: string;
  agentId?: string;
  createdBy?: string;
}

export interface CreateQuotationLineInput {
  siteId: string;
  description?: string;
  ratePerDay: number; // in rupees from UI
  days?: number;
  discountPercent?: number;
  taxPercent?: number;
  startDate?: string | null;
  endDate?: string | null;
}

export interface CreateQuotationFormValues {
  leadId: string;
  clientName?: string;
  clientContactPerson?: string;
  clientEmail?: string;
  clientPhone?: string;
  clientGstin?: string;
  clientAddress?: string;
  clientCity?: string;
  clientState?: string;
  isInterState?: boolean;
  taxPercent?: number;
  taxAmount?: number;
  notes?: string;
  terms?: string[];
  bankDetails?: BankDetails;
  signatureImage?: string;
  signatoryName?: string;
  signatoryDesignation?: string;
  validUntil?: string;
  sites: CreateQuotationLineInput[];
}

export interface PublicProposalSite {
  siteCode: string;
  description?: string;
  city: string;
  type: string;
  startDate?: string | null;
  endDate?: string | null;
  days: number;
  ratePerDayRupees: number;
  discountPercent?: number;
  taxPercent?: number;
  amountRupees: number;
}

export interface PublicProposalView {
  quoteNumber: string;
  clientName: string;
  clientContactPerson?: string;
  clientEmail: string;
  clientPhone?: string;
  clientAddress?: string;
  clientCity?: string;
  clientState?: string;
  clientGstin?: string;
  isInterState?: boolean;
  sites: PublicProposalSite[];
  subtotalRupees: number;
  taxPercent: number;
  taxAmountRupees: number;
  totalRupees: number;
  validUntil: string;
  status: QuotationStatus;
  terms?: string[];
  bankDetails?: BankDetails;
  signatoryName?: string;
  signatoryDesignation?: string;
  viewedAt?: string | null;
  acceptedAt?: string | null;
  rejectedAt?: string | null;
  rejectionReason?: string | null;
  pdfUrl?: string | null;
}
