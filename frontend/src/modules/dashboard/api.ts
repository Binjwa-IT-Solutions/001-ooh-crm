import { api } from '@/shared/api/client';
import type { AdminDashboardData } from './types';
import type { HrDashboardData, MyDashboard, OpsDashboardData } from './role-types';

export const dashboardApi = {
  async getOverview(): Promise<AdminDashboardData> {
    const res = await api.get<{ success: boolean; data: AdminDashboardData }>('/api/dashboard/overview');
    return res.data;
  },
  async getMine(): Promise<MyDashboard> {
    return (await api.get<{ success: boolean; data: MyDashboard }>('/api/dashboard/me')).data;
  },
  async getHr(): Promise<HrDashboardData> {
    return (await api.get<{ success: boolean; data: HrDashboardData }>('/api/dashboard/hr')).data;
  },
  async getOps(): Promise<OpsDashboardData> {
    return (await api.get<{ success: boolean; data: OpsDashboardData }>('/api/dashboard/ops')).data;
  },
};
