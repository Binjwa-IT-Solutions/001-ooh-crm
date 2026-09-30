import { api } from '@/shared/api/client';
import { sessionStore } from '@/shared/auth/session-store';
import { appConfig } from '@/shared/config';
import type { AuditFilters, AuditListResponse, AuditLogEntry } from './types';

export const auditApi = {
  /**
   * Fetch paginated and filtered audit logs.
   */
  async getLogs(filters: AuditFilters = {}): Promise<AuditListResponse> {
    const params = new URLSearchParams();

    if (filters.entity && filters.entity !== 'ALL') params.append('entity', filters.entity);
    if (filters.action && filters.action !== 'ALL') params.append('action', filters.action);
    if (filters.from) params.append('from', filters.from);
    if (filters.to) params.append('to', filters.to);
    if (filters.search) params.append('actorEmail', filters.search);
    if (filters.page) params.append('page', String(filters.page));
    if (filters.pageSize) params.append('pageSize', String(filters.pageSize));

    const query = params.toString() ? `?${params.toString()}` : '';
    return api.get<AuditListResponse>(`/api/audit${query}`);
  },

  /**
   * Fetch audit history for a single record.
   */
  async getEntityLogs(entity: string, id: string, limit = 50): Promise<{ data: AuditLogEntry[] }> {
    return api.get<{ data: AuditLogEntry[] }>(`/api/audit/${encodeURIComponent(entity)}/${encodeURIComponent(id)}?limit=${limit}`);
  },

  /**
   * Export audit log records to CSV.
   */
  async exportCsv(filters: AuditFilters = {}): Promise<void> {
    const params = new URLSearchParams();

    if (filters.entity && filters.entity !== 'ALL') params.append('entity', filters.entity);
    if (filters.action && filters.action !== 'ALL') params.append('action', filters.action);
    if (filters.from) params.append('from', filters.from);
    if (filters.to) params.append('to', filters.to);

    const token = sessionStore.getAccessToken();
    const query = params.toString() ? `?${params.toString()}` : '';
    const url = `${appConfig.apiUrl}/api/audit/export${query}`;

    const headers: Record<string, string> = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(url, { headers });
    if (!response.ok) {
      throw new Error(`Failed to export audit logs: ${response.statusText}`);
    }

    const blob = await response.blob();
    const blobUrl = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = `audit_logs_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(blobUrl);
  },
};
