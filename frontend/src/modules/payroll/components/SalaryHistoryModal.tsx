'use client';

import React, { useState, useEffect } from 'react';
import { Button, Spinner, Alert } from '@/shared/ui';
import { formatPaise, formatDate } from '@/modules/employees/format';
import type { Employee } from '@/modules/employees/types';
import type { SalaryHistoryItem } from '../types';
import { payrollApi } from '../api';
import { X, History } from 'lucide-react';

interface SalaryHistoryModalProps {
  employee: Employee;
  onClose: () => void;
}

export function SalaryHistoryModal({ employee, onClose }: SalaryHistoryModalProps) {
  const [history, setHistory] = useState<SalaryHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const empId = employee?.id || (employee as any)?._id || employee?.employeeCode;

  useEffect(() => {
    async function fetchHistory() {
      if (!empId) {
        setError('Employee identifier not found');
        setLoading(false);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const res = await payrollApi.getSalaryHistory(empId);
        setHistory(res.history || []);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Failed to fetch salary history';
        setError(msg);
      } finally {
        setLoading(false);
      }
    }
    fetchHistory();
  }, [empId]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="relative w-full max-w-2xl rounded-2xl bg-white shadow-2xl dark:bg-slate-900 max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 dark:border-slate-800 bg-slate-50">
          <div className="flex items-center gap-2">
            <History className="h-5 w-5 text-[#6E1D1D]" />
            <div>
              <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                Salary Structure History
              </h3>
              <p className="text-xs text-slate-500">
                {employee.fullName} ({employee.employeeCode})
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6">
          {loading ? (
            <div className="flex min-h-[200px] items-center justify-center">
              <Spinner label="Loading revisions…" />
            </div>
          ) : error ? (
            <Alert tone="error">{error}</Alert>
          ) : history.length === 0 ? (
            <div className="text-center py-12 text-slate-500 text-xs">
              No historical revisions found for this employee. Historical records are automatically saved whenever a salary structure is edited.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-200">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-200 bg-slate-50 text-slate-500 uppercase tracking-wider font-semibold">
                  <tr>
                    <th className="py-2.5 px-4">Effective From</th>
                    <th className="py-2.5 px-4 text-right">Gross Salary</th>
                    <th className="py-2.5 px-4 text-right">Deductions</th>
                    <th className="py-2.5 px-4 text-right">Net Salary</th>
                    <th className="py-2.5 px-4">Updated By</th>
                    <th className="py-2.5 px-4">Recorded On</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {history.map((item, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/50">
                      <td className="py-2.5 px-4 font-medium text-slate-900">
                        {formatDate(item.effectiveFrom)}
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono text-slate-800">
                        {formatPaise(item.grossSalary)}
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono text-rose-700">
                        {formatPaise(item.deductions)}
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono font-bold text-[#6E1D1D]">
                        {formatPaise(item.netSalary)}
                      </td>
                      <td className="py-2.5 px-4 text-slate-600">
                        {item.updatedByName ||
                          (typeof item.updatedBy === 'object' && item.updatedBy !== null
                            ? item.updatedBy.name
                            : 'HR')}
                      </td>
                      <td className="py-2.5 px-4 text-slate-500">
                        {formatDate(item.createdAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="mt-6 flex justify-end">
            <Button variant="secondary" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
