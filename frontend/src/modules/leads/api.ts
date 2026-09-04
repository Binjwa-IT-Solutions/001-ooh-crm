import { api } from '../../shared/api/client';
import {
  Lead,
  LeadFormValues,
  LeadListQuery,
  LeadListResponse,
  ActivityItem,
  LeadStatus,
  LogCallValues,
} from './types';

function buildQuery(query: LeadListQuery): string {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === '') {
      continue;
    }
    params.set(key, String(value));
  }

  const queryString = params.toString();
  return queryString ? `?${queryString}` : '';
}

function toPayload(values: LeadFormValues): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    companyName: values.companyName.trim(),
    contactPerson: values.contactPerson.trim(),
    mobile: values.mobile.trim(),
  };

  if (values.email && values.email.trim() !== '') {
    payload.email = values.email.trim();
  }

  if (values.city && values.city.trim() !== '') {
    payload.city = values.city.trim();
  }

  return payload;
}

export const leadsApi = {
  list: (query: LeadListQuery = {}) =>
    api.get<LeadListResponse>(`/api/leads${buildQuery(query)}`),

  getLeads: (query: LeadListQuery = {}) =>
    api.get<LeadListResponse>(`/api/leads${buildQuery(query)}`),

  getUnclaimed: (query: LeadListQuery = {}) =>
    api.get<LeadListResponse>(`/api/leads?unassigned=true${buildQuery(query).replace('?', '&')}`),

  getById: (id: string) =>
    api.get<Lead>(`/api/leads/${id}`),

  getLead: (id: string) =>
    api.get<Lead>(`/api/leads/${id}`),

  create: (values: LeadFormValues) =>
    api.post<Lead>('/api/leads', toPayload(values)),

  createLead: (data: any) =>
    api.post<Lead>('/api/leads', data),

  updateLead: (id: string, data: any) =>
    api.patch<Lead>(`/api/leads/${id}`, data),

  changeStatus: (id: string, data: { status: LeadStatus; lostReason?: string; qualification?: any }) =>
    api.patch<Lead>(`/api/leads/${id}/status`, data),

  claim: (id: string) =>
    api.post<Lead>(`/api/leads/${id}/claim`),

  claimLead: (id: string) =>
    api.post<Lead>(`/api/leads/${id}/claim`),

  qualifyLead: (id: string, data: any) =>
    api.patch<Lead>(`/api/leads/${id}/qualify`, data),

  logCall: (id: string, values: LogCallValues) =>
    api.post<Lead>(`/api/leads/${id}/log-call`, values),

  logFollowUp: (id: string, values: LogCallValues) =>
    api.post<Lead>(`/api/leads/${id}/follow-up`, values),

  managerApprove: (id: string, values: { approved: boolean; remarks?: string }) =>
    api.post<Lead>(`/api/leads/${id}/approve`, values),

  getActivity: (id: string) =>
    api.get<{ activities: ActivityItem[] }>(`/api/leads/${id}/activity`),

  listAgents: () =>
    api.get<{ agents: { _id: string; name: string; email: string; role: string }[] }>('/api/leads/agents'),
};
