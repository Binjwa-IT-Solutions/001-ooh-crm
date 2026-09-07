import { api } from '@/shared/api/client';
import {
  Attendance,
  LeaveType,
  LeaveRequest,
  LeaveBalance,
  WorkType,
  Holiday,
  Candidate,
  CandidateStatus,
  CandidateListQuery,
} from './types';

export const attendanceApi = {
  checkIn: async (data: { gps?: { lat: number; lng: number }; workType?: WorkType; deviceInfo?: string }) => {
    const res = await api.post<Attendance>('/api/attendance/check-in', data);
    return res;
  },
  checkOut: async (data: { gps?: { lat: number; lng: number } }) => {
    const res = await api.post<Attendance>('/api/attendance/check-out', data);
    return res;
  },

  getMyAttendance: async (params?: Record<string, string | number | boolean>) => {
    const res = await api.get<Attendance[]>('/api/attendance/me', { skipAuth: false });
    return res;
  },
  getMyAttendanceSummary: async (month: number, year: number) => {
    const res = await api.get<{
      records: (Attendance & { regularHours?: number; overtime?: number })[];
      stats: { presentCount: number; absentCount: number; leaveHalfCount: number; totalWorkHours: number; };
    }>(`/api/attendance/me/summary?month=${month}&year=${year}`, { skipAuth: false });
    return res;
  },
  getTeamAttendance: async (params?: Record<string, string | number | boolean>) => {
    const res = await api.get<Attendance[]>('/api/attendance/team', { skipAuth: false });
    return res;
  },
};

export const leaveApi = {
  getLeaveTypes: async () => {
    const res = await api.get<{ leaveTypes: LeaveType[] }>('/api/leave-types?pageSize=100');
    return res.leaveTypes;
  },
  createLeaveType: async (data: Partial<LeaveType>) => {
    const res = await api.post<{ leaveType: LeaveType }>('/api/leave-types', {
      name: data.name,
      code: data.code,
      annualQuota: data.annualQuota ?? null,
      carryForward: data.carryForward ?? false,
      maxCarryForward: data.maxCarryForward ?? 0,
      encashable: data.encashable ?? false,
      requiresDocument: data.requiresDocument ?? false,
    });
    return res.leaveType;
  },
  updateLeaveType: async (id: string, data: Partial<LeaveType>) => {
    const res = await api.patch<{ leaveType: LeaveType }>(`/api/leave-types/${id}`, data);
    return res.leaveType;
  },
  deleteLeaveType: async (id: string) => {
    const res = await api.delete<{ message: string; leaveType: LeaveType }>(`/api/leave-types/${id}`);
    return res.leaveType;
  },
  getBalance: async (employeeId: string, year = new Date().getFullYear()) => {
    const res = await api.get<{ balances: LeaveBalance[] }>(`/api/employees/${employeeId}/leave-balance?year=${year}`);
    return res.balances;
  },

  applyLeave: async (data: any) => {
    const res = await api.post<LeaveRequest>('/api/leave-requests', data);
    return res;
  },
  getMyRequests: async () => {
    const res = await api.get<LeaveRequest[]>('/api/leave-requests/me');
    return res;
  },
  getTeamRequests: async () => {
    const res = await api.get<LeaveRequest[]>('/api/leave-requests/team');
    return res;
  },
  approveLeave: async (id: string) => {
    const res = await api.post<LeaveRequest>(`/api/leave-requests/${id}/approve`);
    return res;
  },
  rejectLeave: async (id: string, rejectionReason: string) => {
    const res = await api.post<LeaveRequest>(`/api/leave-requests/${id}/reject`, { status: 'Rejected', rejectionReason });
    return res;
  },
};

export const holidayApi = {
  getHolidays: async () => {
    const res = await api.get<Holiday[]>('/api/holidays');
    return res;
  },
  createHoliday: async (data: { name: string; date: string; description?: string }) => {
    const res = await api.post<Holiday>('/api/holidays', data);
    return res;
  },
  updateHoliday: async (id: string, data: { name: string; date: string; description?: string }) => {
    const res = await api.put<Holiday>(`/api/holidays/${id}`, data);
    return res;
  },
  deleteHoliday: async (id: string) => {
    const res = await api.delete<{ message: string; holiday: Holiday }>(`/api/holidays/${id}`);
    return res;
  },
};

export const reportsApi = {
  getDailySummary: async (date: string) => {
    return await api.get<Attendance[]>(`/api/reports/attendance/daily?date=${date}`);
  },
  getLateReport: async (fromDate: string, toDate: string) => {
    return await api.get<Attendance[]>(`/api/reports/attendance/late?fromDate=${fromDate}&toDate=${toDate}`);
  },
  getMonthlyRegister: async (fromMonth: number, fromYear: number, toMonth?: number, toYear?: number) => {
    const tm = toMonth ?? fromMonth;
    const ty = toYear ?? fromYear;
    return await api.get<unknown[]>(
      `/api/reports/attendance/monthly?fromMonth=${fromMonth}&fromYear=${fromYear}&toMonth=${tm}&toYear=${ty}`
    );
  },
  getAbsenceReport: async (fromDate: string, toDate: string) => {
    return await api.get<unknown[]>(`/api/reports/attendance/absence?fromDate=${fromDate}&toDate=${toDate}`);
  },
};

export const candidatesApi = {
  list: async (query?: CandidateListQuery) => {
    const params = new URLSearchParams();
    if (query) {
      if (query.status) params.set('status', query.status);
      if (query.position) params.set('position', query.position);
      if (query.search) params.set('search', query.search);
      if (query.startDate) params.set('startDate', query.startDate);
      if (query.endDate) params.set('endDate', query.endDate);
      if (query.page) params.set('page', String(query.page));
      if (query.pageSize) params.set('pageSize', String(query.pageSize));
      if (query.sortBy) params.set('sortBy', query.sortBy);
      if (query.sortDir) params.set('sortDir', query.sortDir);
    }
    const qs = params.toString() ? `?${params.toString()}` : '';
    return await api.get<{ data: Candidate[]; total: number; page: number; pageSize: number }>(
      `/api/candidates${qs}`
    );
  },

  getById: async (id: string) => {
    return await api.get<{ data: Candidate }>(`/api/candidates/${id}`);
  },

  create: async (formData: FormData) => {
    return await api.post<{ data: Candidate }>('/api/candidates', formData);
  },

  update: async (id: string, data: { status?: CandidateStatus; notes?: string }) => {
    return await api.patch<{ data: Candidate }>(`/api/candidates/${id}`, data);
  },
};
