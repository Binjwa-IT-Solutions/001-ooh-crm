import { z } from 'zod';
import { PAYROLL_STATUSES, SALARY_PAYMENT_METHODS } from './payroll.model.js';

export const objectId = z
  .string()
  .trim()
  .regex(/^[0-9a-fA-F]{24}$/, 'Not a valid id');

export const isoDate = z.coerce.date();

export const upsertSalarySchema = z.object({
  effectiveFrom: isoDate.optional().default(() => new Date()),
  basicSalary: z.coerce.number().min(0, 'Basic salary must be non-negative'),
  hra: z.coerce.number().min(0).optional().default(0),
  conveyance: z.coerce.number().min(0).optional().default(0),
  otherAllowances: z.coerce.number().min(0).optional().default(0),
  bonus: z.coerce.number().min(0).optional().default(0),
  deductions: z.coerce.number().min(0).optional().default(0),
  notes: z.string().trim().optional(),
});

export const generatePayrollSchema = z.object({
  salaryMonth: z.coerce.number().int().min(1).max(12),
  salaryYear: z.coerce.number().int().min(2000).max(2100),
  employeeIds: z.array(z.string().trim().min(1)).optional(),
});

export const processPaymentSchema = z.object({
  paymentDate: isoDate,
  paymentMethod: z.enum(SALARY_PAYMENT_METHODS),
  transactionReference: z.string().trim().optional(),
  notes: z.string().trim().optional(),
});

export const listPayrollQuerySchema = z.object({
  month: z.coerce.number().int().min(1).max(12).optional(),
  year: z.coerce.number().int().min(2000).optional(),
  department: z.string().trim().optional(),
  employeeId: z.string().trim().optional(),
  status: z.enum(PAYROLL_STATUSES).optional(),
  search: z.string().trim().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export type UpsertSalaryInput = z.infer<typeof upsertSalarySchema>;
export type GeneratePayrollInput = z.infer<typeof generatePayrollSchema>;
export type ProcessPaymentInput = z.infer<typeof processPaymentSchema>;
export type ListPayrollQuery = z.infer<typeof listPayrollQuerySchema>;
