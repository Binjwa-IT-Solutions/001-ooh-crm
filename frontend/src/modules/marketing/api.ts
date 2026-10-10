import { api } from '../../shared/api/client';
import type {
  DailyLogItem,
  MarketingTaskItem,
  MarketingSpendItem,
  MarketingLeadItem,
  MarketingDashboardData,
  MarketingTeamMember,
} from './types';

export const marketingApi = {
  // 1. Dashboard Overview
  getOverview: (month?: string) =>
    api.get<MarketingDashboardData>(`/api/marketing/overview${month ? `?month=${month}` : ''}`),

  // 2. Daily Logs
  getDailyLogs: (filters: { date?: string; userId?: string; category?: string } = {}) => {
    const params = new URLSearchParams();
    if (filters.date) params.set('date', filters.date);
    if (filters.userId) params.set('userId', filters.userId);
    if (filters.category) params.set('category', filters.category);
    const qs = params.toString();
    return api.get<{ data: DailyLogItem[] }>(`/api/marketing/daily-logs${qs ? `?${qs}` : ''}`);
  },

  submitDailyLog: (data: {
    date: string;
    category: string;
    taskTitle: string;
    hoursSpent: number;
    description: string;
    outputLink?: string;
    statusAfterToday: string;
  }) => api.post<DailyLogItem>('/api/marketing/daily-logs', data),

  getManagerDailySummary: (date?: string) =>
    api.get<{ data: any[] }>(`/api/marketing/daily-logs/summary${date ? `?date=${date}` : ''}`),

  // 3. Tasks & Content
  getTeamMembers: () => api.get<{ data: MarketingTeamMember[] }>('/api/marketing/team-members'),

  getTasks: (filters: { status?: string; assignedTo?: string; isContent?: boolean } = {}) => {
    const params = new URLSearchParams();
    if (filters.status) params.set('status', filters.status);
    if (filters.assignedTo) params.set('assignedTo', filters.assignedTo);
    if (filters.isContent !== undefined) params.set('isContent', String(filters.isContent));
    const qs = params.toString();
    return api.get<{ data: MarketingTaskItem[] }>(`/api/marketing/tasks${qs ? `?${qs}` : ''}`);
  },

  createTask: (data: {
    title: string;
    description?: string;
    type: string;
    assignedTo: string;
    priority?: string;
    dueDate?: string;
    isContent?: boolean;
    platform?: string;
    postUrl?: string;
    city?: string;
  }) => api.post<MarketingTaskItem>('/api/marketing/tasks', data),

  updateTaskStatus: (id: string, status: string, reason?: string) =>
    api.patch<MarketingTaskItem>(`/api/marketing/tasks/${id}/status`, { status, reason }),

  updateTask: (id: string, data: Partial<MarketingTaskItem>) =>
    api.patch<MarketingTaskItem>(`/api/marketing/tasks/${id}`, data),

  // 4. Budget & Spend
  getBudget: (month?: string) =>
    api.get<any>(`/api/marketing/budget/${month || new Date().toISOString().slice(0, 7)}`),

  setBudget: (data: { month: string; period: string; plannedAmount: number; notes?: string }) =>
    api.post<any>('/api/marketing/budget', data),

  getSpends: (month?: string) =>
    api.get<{ data: MarketingSpendItem[] }>(`/api/marketing/spend${month ? `?month=${month}` : ''}`),

  recordSpend: (data: {
    date?: string;
    campaignName: string;
    platform: string;
    city: string;
    amount: number;
    type: string;
    receiptUrl?: string;
    paymentStatus?: string;
    notes?: string;
  }) => api.post<MarketingSpendItem>('/api/marketing/spend', data),

  // 5. Leads & Attribution
  getLeads: (stage?: string) =>
    api.get<{ data: MarketingLeadItem[] }>(`/api/marketing/leads${stage ? `?stage=${stage}` : ''}`),

  createLead: (data: {
    companyName: string;
    contactPerson: string;
    phone: string;
    email?: string;
    city: string;
    sourcePlatform: string;
    serviceInterested?: string;
    notes?: string;
  }) => api.post<MarketingLeadItem>('/api/marketing/leads', data),

  updateLeadStage: (id: string, data: { stage: string; dealValue?: number; lostReason?: string; notes?: string }) =>
    api.patch<MarketingLeadItem>(`/api/marketing/leads/${id}/stage`, data),
};
