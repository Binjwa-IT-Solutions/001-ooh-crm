export type QuotationStatus = 'Draft' | 'Sent' | 'Accepted' | 'Rejected' | 'Expired';

export interface QuotationLineItem {
  siteId: string | { _id?: string; siteCode?: string; city?: string; type?: string; address?: string };
  description?: string;
  ratePerDay: number; // paise
  startDate: string;
  endDate: string;
  days: number;
  amount: number; // paise
}

export interface Quotation {
  id: string;
  _id?: string;
  quoteNumber: string;
  leadId?: string | { _id?: string; companyName?: string; contactPerson?: string; email?: string; mobile?: string };
  clientName?: string;
  clientEmail?: string;
  clientPhone?: string;
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
  startDate: string;
  endDate: string;
}

export interface CreateQuotationFormValues {
  leadId: string;
  clientName?: string;
  clientEmail?: string;
  clientPhone?: string;
  validUntil?: string;
  sites: CreateQuotationLineInput[];
}

export interface PublicProposalSite {
  siteCode: string;
  city: string;
  type: string;
  startDate: string;
  endDate: string;
  days: number;
  ratePerDayRupees: number;
  amountRupees: number;
}

export interface PublicProposalView {
  quoteNumber: string;
  clientName: string;
  clientEmail: string;
  sites: PublicProposalSite[];
  subtotalRupees: number;
  taxPercent: number;
  taxAmountRupees: number;
  totalRupees: number;
  validUntil: string;
  status: QuotationStatus;
  viewedAt?: string | null;
  acceptedAt?: string | null;
  rejectedAt?: string | null;
  rejectionReason?: string | null;
}
