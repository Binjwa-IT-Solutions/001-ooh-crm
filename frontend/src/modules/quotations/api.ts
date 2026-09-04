import { api } from '../../shared/api/client';
import type {
  CreateQuotationFormValues,
  PublicProposalView,
  Quotation,
  QuotationFilters,
  QuotationsListResponse,
} from './types';

function buildQuery(query: QuotationFilters): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== '') {
      params.set(key, String(value));
    }
  }
  const str = params.toString();
  return str ? `?${str}` : '';
}

export const quotationsApi = {
  list: (query: QuotationFilters = {}) =>
    api.get<QuotationsListResponse>(`/api/quotations${buildQuery(query)}`),

  getById: (id: string) =>
    api.get<{ quotation: Quotation }>(`/api/quotations/${id}`).then((res) => res.quotation),

  create: (data: CreateQuotationFormValues) =>
    api.post<{ quotation: Quotation }>('/api/quotations', data).then((res) => res.quotation),

  update: (id: string, data: Partial<CreateQuotationFormValues>) =>
    api.patch<{ quotation: Quotation }>(`/api/quotations/${id}`, data).then((res) => res.quotation),

  generatePdf: (id: string) =>
    api.post<{ pdfKey: string; pdfUrl: string }>(`/api/quotations/${id}/pdf`),

  getPdfUrl: (id: string) =>
    api.get<{ pdfKey?: string; pdfUrl: string }>(`/api/quotations/${id}/pdf`),

  uploadPdf: (id: string, file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post<{ pdfKey: string; pdfUrl: string }>(`/api/quotations/${id}/upload-pdf`, formData);
  },

  send: (id: string, sentTo: string, message?: string) =>
    api.post<{ quotation: Quotation; trackingToken: string; publicUrl: string }>(
      `/api/quotations/${id}/send`,
      { sentTo, message },
    ),

  // --- Public Unauthenticated API Methods ---
  getPublic: (token: string) =>
    api.get<{ proposal: PublicProposalView }>(`/q/${token}`).then((res) => res.proposal),

  acceptPublic: (token: string) =>
    api.post<{ proposal: PublicProposalView }>(`/q/${token}/accept`, {}).then((res) => res.proposal),

  rejectPublic: (token: string, rejectionReason: string) =>
    api
      .post<{ proposal: PublicProposalView }>(`/q/${token}/reject`, { rejectionReason })
      .then((res) => res.proposal),
};
