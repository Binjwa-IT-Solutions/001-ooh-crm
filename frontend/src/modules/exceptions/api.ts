import { api } from '@/shared/api/client';
import type {
  ExceptionCountSummary,
  ExceptionFilters,
  ExceptionListResponse,
} from './types';

function buildQuery(filters: ExceptionFilters): string {
  const params = new URLSearchParams();
  if (filters.type && filters.type !== 'ALL') params.append('type', filters.type);
  if (filters.city) params.append('city', filters.city);
  if (filters.campaignId) params.append('campaignId', filters.campaignId);
  if (filters.severity) params.append('severity', filters.severity);
  if (filters.from) params.append('from', filters.from);
  if (filters.to) params.append('to', filters.to);
  if (filters.search?.trim()) params.append('search', filters.search.trim());
  if (filters.includeAcknowledged) params.append('includeAcknowledged', 'true');

  const q = params.toString();
  return q ? `?${q}` : '';
}

export const exceptionsApi = {
  /**
   * Fetch unresolved or filtered operational exceptions.
   */
  async getExceptions(filters: ExceptionFilters = {}): Promise<ExceptionListResponse> {
    return api.get<ExceptionListResponse>(`/api/exceptions${buildQuery(filters)}`);
  },

  /**
   * Fast count summary for sidebar badge.
   */
  async getCount(): Promise<{ data: ExceptionCountSummary }> {
    return api.get<{ data: ExceptionCountSummary }>('/api/exceptions/count');
  },

  /**
   * Acknowledge an exception to hide it from default view.
   */
  async acknowledge(
    id: string,
    payload: { exceptionType?: string; entityId?: string; notes?: string } = {},
  ): Promise<{ success: boolean; message: string }> {
    return api.patch<{ success: boolean; message: string }>(
      `/api/exceptions/${encodeURIComponent(id)}/acknowledge`,
      payload,
    );
  },
};
