import { api } from '@/shared/api/client';
import type { AdminDashboardData } from './types';

export const dashboardApi = {
  async getOverview(): Promise<AdminDashboardData> {
    const res = await api.get<{ success: boolean; data: AdminDashboardData }>('/api/dashboard/overview');
    return res.data;
  },
};
