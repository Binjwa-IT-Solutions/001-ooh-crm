'use client';

import React, { useState } from 'react';
import { Button, Alert } from '@/shared/ui';
import { payrollApi } from '../api';
import { X, Calendar, ShieldCheck, AlertCircle } from 'lucide-react';

interface GeneratePayrollModalProps {
  currentMonth: number;
  currentYear: number;
  employeeId?: string;
  employeeName?: string;
  onClose: () => void;
  onSuccess: (summary: string) => void;
}

const MONTHS = [
  { value: 1, label: 'January' },
  { value: 2, label: 'February' },
  { value: 3, label: 'March' },
  { value: 4, label: 'April' },
  { value: 5, label: 'May' },
  { value: 6, label: 'June' },
  { value: 7, label: 'July' },
  { value: 8, label: 'August' },
  { value: 9, label: 'September' },
  { value: 10, label: 'October' },
  { value: 11, label: 'November' },
  { value: 12, label: 'December' },
];

export function GeneratePayrollModal({
  currentMonth,
  currentYear,
  employeeId,
  employeeName,
  onClose,
  onSuccess,
}: GeneratePayrollModalProps) {
  const [month, setMonth] = useState(currentMonth);
  const [year, setYear] = useState(currentYear);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsGenerating(true);

    try {
      const res = await payrollApi.generatePayroll({
        salaryMonth: month,
        salaryYear: year,
        employeeIds: employeeId ? [employeeId] : undefined,
      });

      const summary = employeeName
        ? `Generated payslip for ${employeeName} for ${res.periodLabel}.`
        : `Generated payroll for ${res.generated} employee(s) for ${res.periodLabel}. (${res.skipped} already existed, ${res.notConfigured} unconfigured).`;
      onSuccess(summary);
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to generate payroll';
      setError(msg);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="relative w-full max-w-md rounded-xl bg-white shadow-xl dark:bg-slate-900">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-red-50 text-[#6E1D1D]">
              <Calendar className="h-4 w-4" />
            </span>
            <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              {employeeName ? `Generate Payslip · ${employeeName}` : 'Generate Monthly Payroll'}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && <Alert tone="error">{error}</Alert>}

          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3.5 text-xs text-slate-600 space-y-2 dark:border-slate-800 dark:bg-slate-950/50">
            <div className="flex items-center gap-1.5 font-semibold text-slate-800">
              <ShieldCheck className="h-4 w-4 text-emerald-600" />
              Duplicate Generation Protection
            </div>
            <p>
              {employeeName
                ? `Generates payslip for ${employeeName} from their configured salary structure. If a record already exists for this period, it will not be duplicated.`
                : 'Payroll will be generated from each employee’s configured salary structure. If an employee already has a payroll record for this period, it will not be duplicated.'}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Salary Month <span className="text-red-500">*</span>
              </label>
              <select
                value={month}
                onChange={(e) => setMonth(Number(e.target.value))}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-[#6E1D1D] focus:outline-none bg-white"
              >
                {MONTHS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Salary Year <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                min="2020"
                max="2035"
                required
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
                className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-[#6E1D1D] focus:outline-none"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-slate-200">
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              isLoading={isGenerating}
              className="bg-[#6E1D1D] hover:bg-[#882424] text-white"
            >
              Generate Payroll
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
