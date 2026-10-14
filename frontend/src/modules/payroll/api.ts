import { api } from '@/shared/api/client';
import { appConfig } from '@/shared/config';
import { sessionStore } from '@/shared/auth/session-store';
import type { Employee } from '../employees/types';
import type {
  SalaryStructure,
  SalaryHistoryItem,
  Payroll,
  PayrollListResponse,
  UpsertSalaryPayload,
  GeneratePayrollPayload,
  ProcessPaymentPayload,
} from './types';

export const payrollApi = {
  // ============================================================================
  // Employee Salary Management
  // ============================================================================

  async getAllEmployeeSalaries(params: {
    search?: string;
    department?: string;
  } = {}): Promise<{
    items: Array<{
      employee: Employee;
      salary: SalaryStructure | null;
    }>;
  }> {
    const searchParams = new URLSearchParams();
    if (params.search?.trim()) searchParams.set('search', params.search.trim());
    if (params.department && params.department !== 'all') {
      searchParams.set('department', params.department);
    }
    const qs = searchParams.toString();
    return api.get<{
      items: Array<{
        employee: Employee;
        salary: SalaryStructure | null;
      }>;
    }>(`/api/payroll/salaries${qs ? `?${qs}` : ''}`);
  },

  async getEmployeeSalary(employeeId: string): Promise<{
    employee: Employee;
    salary: SalaryStructure | null;
  }> {
    return api.get<{
      employee: Employee;
      salary: SalaryStructure | null;
    }>(`/api/payroll/salary/${employeeId}`);
  },

  async upsertEmployeeSalary(
    employeeId: string,
    payload: UpsertSalaryPayload,
  ): Promise<{ message: string; salary: SalaryStructure }> {
    return api.post<{ message: string; salary: SalaryStructure }>(
      `/api/payroll/salary/${employeeId}`,
      payload,
    );
  },

  async getSalaryHistory(employeeId: string): Promise<{ history: SalaryHistoryItem[] }> {
    return api.get<{ history: SalaryHistoryItem[] }>(`/api/payroll/salary/${employeeId}/history`);
  },

  // ============================================================================
  // Payroll & Salary Payments
  // ============================================================================

  async getPayrollList(params: {
    month?: number;
    year?: number;
    department?: string;
    employeeId?: string;
    status?: string;
    search?: string;
    page?: number;
    limit?: number;
  } = {}): Promise<PayrollListResponse> {
    const searchParams = new URLSearchParams();
    if (params.month) searchParams.set('month', String(params.month));
    if (params.year) searchParams.set('year', String(params.year));
    if (params.department && params.department !== 'all') {
      searchParams.set('department', params.department);
    }
    if (params.employeeId) searchParams.set('employeeId', params.employeeId);
    if (params.status && params.status !== 'all') searchParams.set('status', params.status);
    if (params.search?.trim()) searchParams.set('search', params.search.trim());
    if (params.page) searchParams.set('page', String(params.page));
    if (params.limit) searchParams.set('limit', String(params.limit));

    const qs = searchParams.toString();
    return api.get<PayrollListResponse>(`/api/payroll${qs ? `?${qs}` : ''}`);
  },

  async generatePayroll(
    payload: GeneratePayrollPayload,
  ): Promise<{
    message: string;
    generated: number;
    skipped: number;
    notConfigured: number;
    periodLabel: string;
  }> {
    return api.post('/api/payroll/generate', payload);
  },

  async processPayment(
    payrollId: string,
    payload: ProcessPaymentPayload,
  ): Promise<{ message: string; payroll: Payroll }> {
    return api.post<{ message: string; payroll: Payroll }>(
      `/api/payroll/${payrollId}/pay`,
      payload,
    );
  },

  async getPayrollById(payrollId: string): Promise<{ payroll: Payroll }> {
    return api.get<{ payroll: Payroll }>(`/api/payroll/${payrollId}`);
  },

  async downloadPayslipPdf(payrollId: string, filename?: string): Promise<void> {
    const token = sessionStore.getAccessToken();
    const res = await fetch(`${appConfig.apiUrl}/api/payroll/${payrollId}/payslip.pdf`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });

    if (!res.ok) {
      throw new Error('Failed to generate payslip PDF');
    }

    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename || `payslip-${payrollId}.pdf`;
    document.body.appendChild(link);
    link.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(link);
  },

  async printPayslipPdf(payrollId: string): Promise<void> {
    const token = sessionStore.getAccessToken();
    const res = await fetch(`${appConfig.apiUrl}/api/payroll/${payrollId}/payslip.pdf`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });

    if (!res.ok) {
      throw new Error('Failed to fetch payslip PDF for printing');
    }

    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    iframe.src = url;
    document.body.appendChild(iframe);
    iframe.onload = () => {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    };
  },
};
