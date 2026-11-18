import type { Employee } from '../employees/types';

export type PayrollStatus =
  | 'Draft'
  | 'Pending'
  | 'Processed'
  | 'Paid'
  | 'Failed'
  | 'Cancelled';

export type SalaryPaymentMethod =
  | 'bank_transfer'
  | 'cheque'
  | 'cash'
  | 'upi';

export interface SalaryHistoryItem {
  effectiveFrom: string;
  basicSalary: number; // paise
  hra: number;
  conveyance: number;
  otherAllowances: number;
  bonus: number;
  grossSalary: number;
  deductions: number;
  netSalary: number;
  notes?: string;
  updatedBy?: { _id: string; name: string; email: string } | string;
  updatedByName?: string;
  createdAt: string;
}

export interface SalaryStructure {
  id: string;
  employeeId: string;
  effectiveFrom: string;
  basicSalary: number; // paise
  hra: number;
  conveyance: number;
  otherAllowances: number;
  bonus: number;
  grossSalary: number;
  deductions: number;
  netSalary: number;
  notes?: string;
  updatedBy?: string;
  history: SalaryHistoryItem[];
  createdAt: string;
  updatedAt: string;
}

export interface SalaryStructureSnapshot {
  basicSalary: number;
  hra: number;
  conveyance: number;
  otherAllowances: number;
  bonus: number;
  grossSalary: number;
  deductions: number;
  netSalary: number;
}

export interface Payroll {
  id: string;
  _id?: string;
  payslipNumber: string;
  employeeId: Employee;
  salaryMonth: number;
  salaryYear: number;
  periodLabel: string;
  salaryStructureSnapshot: SalaryStructureSnapshot;
  grossSalary: number;
  deductions: number;
  netPayable: number;
  status: PayrollStatus;
  paymentDate?: string | null;
  paymentMethod?: SalaryPaymentMethod | null;
  transactionReference?: string;
  notes?: string;
  paidAt?: string | null;
  createdAt: string;
}

export interface UpsertSalaryPayload {
  basicSalary: number; // in paise
  hra?: number;
  conveyance?: number;
  otherAllowances?: number;
  bonus?: number;
  deductions?: number;
  effectiveFrom?: string;
  notes?: string;
}

export interface GeneratePayrollPayload {
  salaryMonth: number;
  salaryYear: number;
  employeeIds?: string[];
}

export interface ProcessPaymentPayload {
  paymentDate: string;
  paymentMethod: SalaryPaymentMethod;
  transactionReference?: string;
  notes?: string;
}

export interface PayrollListResponse {
  items: Payroll[];
  total: number;
  page: number;
  limit: number;
  pages: number;
  summary: {
    totalGross: number;
    totalDeductions: number;
    totalNet: number;
    paidCount: number;
    pendingCount: number;
  };
}
