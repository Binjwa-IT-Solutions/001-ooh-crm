'use client';

import React, { useState } from 'react';
import { Button, Alert } from '@/shared/ui';
import { toDateInput } from '@/modules/employees/format';
import type { Employee } from '@/modules/employees/types';
import type { SalaryStructure } from '../types';
import { payrollApi } from '../api';
import { X, CreditCard } from 'lucide-react';

interface SalaryConfigModalProps {
  employee: Employee;
  salary: SalaryStructure | null;
  onClose: () => void;
  onSuccess: (updated: SalaryStructure) => void;
}

export function SalaryConfigModal({
  employee,
  salary,
  onClose,
  onSuccess,
}: SalaryConfigModalProps) {
  const [formBasic, setFormBasic] = useState(
    salary ? String(Math.round(salary.basicSalary / 100)) : ''
  );
  const [formHra, setFormHra] = useState(
    salary ? String(Math.round(salary.hra / 100)) : ''
  );
  const [formConveyance, setFormConveyance] = useState(
    salary ? String(Math.round(salary.conveyance / 100)) : ''
  );
  const [formOther, setFormOther] = useState(
    salary ? String(Math.round(salary.otherAllowances / 100)) : ''
  );
  const [formBonus, setFormBonus] = useState(
    salary ? String(Math.round(salary.bonus / 100)) : ''
  );
  const [formDeductions, setFormDeductions] = useState(
    salary ? String(Math.round(salary.deductions / 100)) : ''
  );
  const [formEffectiveFrom, setFormEffectiveFrom] = useState(
    salary ? toDateInput(salary.effectiveFrom) : new Date().toISOString().slice(0, 10)
  );
  const [formNotes, setFormNotes] = useState(salary?.notes || '');
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const basicNum = parseFloat(formBasic) || 0;
  const hraNum = parseFloat(formHra) || 0;
  const convNum = parseFloat(formConveyance) || 0;
  const otherNum = parseFloat(formOther) || 0;
  const bonusNum = parseFloat(formBonus) || 0;
  const liveDeductions = parseFloat(formDeductions) || 0;
  const liveGross = basicNum + hraNum + convNum + otherNum + bonusNum;
  const liveNet = Math.max(0, liveGross - liveDeductions);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveError(null);

    if (basicNum <= 0) {
      setSaveError('Basic salary must be greater than 0');
      return;
    }

    const empId = employee?.id || (employee as any)?._id || employee?.employeeCode;
    if (!empId) {
      setSaveError('Employee identifier not found');
      return;
    }

    setIsSaving(true);
    try {
      const res = await payrollApi.upsertEmployeeSalary(empId, {
        basicSalary: Math.round(basicNum * 100),
        hra: Math.round(hraNum * 100),
        conveyance: Math.round(convNum * 100),
        otherAllowances: Math.round(otherNum * 100),
        bonus: Math.round(bonusNum * 100),
        deductions: Math.round(liveDeductions * 100),
        effectiveFrom: formEffectiveFrom || new Date().toISOString(),
        notes: formNotes.trim(),
      });
      onSuccess(res.salary);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save salary structure';
      setSaveError(msg);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="relative w-full max-w-xl rounded-2xl bg-white shadow-2xl dark:bg-slate-900 max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 dark:border-slate-800 bg-slate-50">
          <div className="flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-[#6E1D1D]" />
            <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              {salary ? 'Edit Salary Structure' : 'Configure Salary Structure'}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSave} className="p-6 space-y-4">
          {saveError && <Alert tone="error">{saveError}</Alert>}

          <div className="text-xs text-slate-600 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
            Employee: <strong className="text-slate-900">{employee.fullName}</strong> ({employee.employeeCode} · {employee.department || 'No dept'} · {employee.designation || 'No designation'}). All figures are monthly Indian Rupees (₹).
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Basic Salary (₹) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                min="0"
                step="1"
                required
                value={formBasic}
                onChange={(e) => setFormBasic(e.target.value)}
                placeholder="e.g. 50000"
                className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-mono focus:border-[#6E1D1D] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                House Rent Allowance (HRA) (₹)
              </label>
              <input
                type="number"
                min="0"
                step="1"
                value={formHra}
                onChange={(e) => setFormHra(e.target.value)}
                placeholder="e.g. 20000"
                className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-mono focus:border-[#6E1D1D] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Conveyance / Allowance (₹)
              </label>
              <input
                type="number"
                min="0"
                step="1"
                value={formConveyance}
                onChange={(e) => setFormConveyance(e.target.value)}
                placeholder="e.g. 5000"
                className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-mono focus:border-[#6E1D1D] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Other Allowances (₹)
              </label>
              <input
                type="number"
                min="0"
                step="1"
                value={formOther}
                onChange={(e) => setFormOther(e.target.value)}
                placeholder="e.g. 2000"
                className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-mono focus:border-[#6E1D1D] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Bonus / Incentives (₹)
              </label>
              <input
                type="number"
                min="0"
                step="1"
                value={formBonus}
                onChange={(e) => setFormBonus(e.target.value)}
                placeholder="e.g. 3000"
                className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-mono focus:border-[#6E1D1D] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Total Deductions (₹)
              </label>
              <input
                type="number"
                min="0"
                step="1"
                value={formDeductions}
                onChange={(e) => setFormDeductions(e.target.value)}
                placeholder="e.g. 4000"
                className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-mono focus:border-[#6E1D1D] focus:outline-none"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Effective From <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                required
                value={formEffectiveFrom}
                onChange={(e) => setFormEffectiveFrom(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-[#6E1D1D] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Notes
              </label>
              <input
                type="text"
                value={formNotes}
                onChange={(e) => setFormNotes(e.target.value)}
                placeholder="e.g. Annual revision 2026"
                className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-sm focus:border-[#6E1D1D] focus:outline-none"
              />
            </div>
          </div>

          {/* Real-time Calculation Preview */}
          <div className="rounded-xl border border-[#6E1D1D]/30 bg-[#FDF8F8] p-4 text-xs">
            <div className="font-semibold text-[#6E1D1D] mb-1">Live Calculation Preview:</div>
            <div className="grid grid-cols-3 gap-2 font-mono">
              <div>
                <span className="text-slate-500 block">Gross:</span>
                <strong className="text-slate-900">₹{liveGross.toLocaleString('en-IN')}</strong>
              </div>
              <div>
                <span className="text-slate-500 block">Deductions:</span>
                <strong className="text-rose-700">₹{liveDeductions.toLocaleString('en-IN')}</strong>
              </div>
              <div>
                <span className="text-slate-500 block">Net Monthly:</span>
                <strong className="text-[#6E1D1D]">₹{liveNet.toLocaleString('en-IN')}</strong>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-slate-200">
            <Button
              type="button"
              variant="secondary"
              onClick={onClose}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              isLoading={isSaving}
              className="bg-[#6E1D1D] hover:bg-[#882424] text-white"
            >
              Save Salary Structure
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
