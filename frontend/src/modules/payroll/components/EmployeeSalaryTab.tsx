'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/shared/auth/auth-context';
import { Button, Card, Spinner, Alert } from '@/shared/ui';
import { formatPaise, formatDate, toDateInput } from '@/modules/employees/format';
import type { Employee } from '@/modules/employees/types';
import { payrollApi } from '../api';
import type { SalaryStructure, SalaryHistoryItem, Payroll } from '../types';
import { GeneratePayrollModal } from './GeneratePayrollModal';
import { ProcessPaymentModal } from './ProcessPaymentModal';
import { PayslipModal } from './PayslipModal';
import {
  CreditCard,
  Plus,
  Pencil,
  TrendingUp,
  AlertCircle,
  X,
  History,
  Info,
  Calendar,
  Download,
  Eye,
  CheckCircle2,
  Clock,
  FileText,
} from 'lucide-react';

interface EmployeeSalaryTabProps {
  employee: Employee;
}

export function EmployeeSalaryTab({ employee }: EmployeeSalaryTabProps) {
  const { hasPermission } = useAuth();
  const canManageSalary = hasPermission('salary.create') || hasPermission('salary.update');
  const canGenerate = hasPermission('payroll.create');
  const canProcess = hasPermission('payroll.process');
  const canViewPayslip = hasPermission('payroll.payslip');

  const [salary, setSalary] = useState<SalaryStructure | null>(null);
  const [history, setHistory] = useState<SalaryHistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Payslips state
  const [payslips, setPayslips] = useState<Payroll[]>([]);
  const [loadingPayslips, setLoadingPayslips] = useState(false);
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [payingRecord, setPayingRecord] = useState<Payroll | null>(null);
  const [viewingPayslip, setViewingPayslip] = useState<Payroll | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [payslipBanner, setPayslipBanner] = useState<string | null>(null);

  // Form states (in Rupees for direct human input)
  const [formBasic, setFormBasic] = useState('');
  const [formHra, setFormHra] = useState('');
  const [formConveyance, setFormConveyance] = useState('');
  const [formOther, setFormOther] = useState('');
  const [formBonus, setFormBonus] = useState('');
  const [formDeductions, setFormDeductions] = useState('');
  const [formEffectiveFrom, setFormEffectiveFrom] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const empId = employee?.id || (employee as any)?._id || employee?.employeeCode || '';

  const fetchSalary = useCallback(async () => {
    if (!empId) return;
    setIsLoading(true);
    setError(null);
    try {
      const res = await payrollApi.getEmployeeSalary(empId);
      setSalary(res.salary);
      if (res.salary?.history) {
        setHistory(res.salary.history);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load salary structure';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }, [empId]);

  const fetchPayslips = useCallback(async () => {
    if (!empId) return;
    setLoadingPayslips(true);
    try {
      const res = await payrollApi.getPayrollList({ employeeId: empId, limit: 50 });
      setPayslips(res.items || []);
    } catch (err) {
      console.error('Failed to load employee payslips', err);
    } finally {
      setLoadingPayslips(false);
    }
  }, [empId]);

  useEffect(() => {
    fetchSalary();
    fetchPayslips();
  }, [fetchSalary, fetchPayslips]);

  const openEditModal = () => {
    if (salary) {
      setFormBasic(String(Math.round(salary.basicSalary / 100)));
      setFormHra(String(Math.round(salary.hra / 100)));
      setFormConveyance(String(Math.round(salary.conveyance / 100)));
      setFormOther(String(Math.round(salary.otherAllowances / 100)));
      setFormBonus(String(Math.round(salary.bonus / 100)));
      setFormDeductions(String(Math.round(salary.deductions / 100)));
      setFormEffectiveFrom(toDateInput(salary.effectiveFrom));
      setFormNotes(salary.notes || '');
    } else {
      setFormBasic('');
      setFormHra('');
      setFormConveyance('');
      setFormOther('');
      setFormBonus('');
      setFormDeductions('');
      setFormEffectiveFrom(new Date().toISOString().slice(0, 10));
      setFormNotes('');
    }
    setSaveError(null);
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveError(null);

    const basicNum = parseFloat(formBasic) || 0;
    if (basicNum <= 0) {
      setSaveError('Basic salary must be greater than 0');
      return;
    }

    const hraNum = parseFloat(formHra) || 0;
    const convNum = parseFloat(formConveyance) || 0;
    const otherNum = parseFloat(formOther) || 0;
    const bonusNum = parseFloat(formBonus) || 0;
    const dedNum = parseFloat(formDeductions) || 0;

    setIsSaving(true);
    try {
      await payrollApi.upsertEmployeeSalary(empId, {
        basicSalary: Math.round(basicNum * 100),
        hra: Math.round(hraNum * 100),
        conveyance: Math.round(convNum * 100),
        otherAllowances: Math.round(otherNum * 100),
        bonus: Math.round(bonusNum * 100),
        deductions: Math.round(dedNum * 100),
        effectiveFrom: formEffectiveFrom || new Date().toISOString(),
        notes: formNotes.trim(),
      });
      setIsModalOpen(false);
      await fetchSalary();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save salary structure';
      setSaveError(msg);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDownloadSlip = async (record: Payroll) => {
    const id = record.id || record._id || '';
    setDownloadingId(id);
    try {
      await payrollApi.downloadPayslipPdf(id, `payslip-${record.payslipNumber}.pdf`);
    } catch {
      alert('Failed to download PDF. Please try again.');
    } finally {
      setDownloadingId(null);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Paid':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-xs font-semibold bg-emerald-50 text-emerald-800 rounded-full border border-emerald-300">
            <CheckCircle2 className="h-3 w-3" />
            Paid
          </span>
        );
      case 'Pending':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-xs font-semibold bg-amber-50 text-amber-800 rounded-full border border-amber-300">
            <Clock className="h-3 w-3" />
            Pending
          </span>
        );
      case 'Processed':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-xs font-semibold bg-blue-50 text-blue-800 rounded-full border border-blue-300">
            Processed
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-0.5 text-xs font-semibold bg-slate-100 text-slate-700 rounded-full border border-slate-300">
            {status}
          </span>
        );
    }
  };

  const getMethodBadge = (method?: string | null) => {
    if (!method) return <span className="text-slate-400">—</span>;
    switch (method) {
      case 'bank_transfer':
        return (
          <span className="px-2 py-0.5 text-[11px] font-medium bg-blue-50 text-blue-700 rounded border border-blue-200">
            Bank Transfer
          </span>
        );
      case 'upi':
        return (
          <span className="px-2 py-0.5 text-[11px] font-medium bg-emerald-50 text-emerald-700 rounded border border-emerald-200">
            UPI
          </span>
        );
      case 'cheque':
        return (
          <span className="px-2 py-0.5 text-[11px] font-medium bg-amber-50 text-amber-700 rounded border border-amber-200">
            Cheque
          </span>
        );
      case 'cash':
        return (
          <span className="px-2 py-0.5 text-[11px] font-medium bg-slate-100 text-slate-700 rounded border border-slate-300">
            Cash
          </span>
        );
      default:
        return <span className="text-xs text-slate-600">{method}</span>;
    }
  };

  // Live calculations for modal
  const liveBasic = parseFloat(formBasic) || 0;
  const liveHra = parseFloat(formHra) || 0;
  const liveConv = parseFloat(formConveyance) || 0;
  const liveOther = parseFloat(formOther) || 0;
  const liveBonus = parseFloat(formBonus) || 0;
  const liveDeductions = parseFloat(formDeductions) || 0;
  const liveGross = liveBasic + liveHra + liveConv + liveOther + liveBonus;
  const liveNet = Math.max(0, liveGross - liveDeductions);

  if (isLoading) {
    return (
      <div className="flex min-h-[300px] items-center justify-center">
        <Spinner label="Loading salary details…" />
      </div>
    );
  }

  if (error) {
    return (
      <Alert tone="error" title="Could not load salary details">
        {error}
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      {/* Employee master info bar */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <div>
            <div className="text-xs text-slate-500">Employee</div>
            <div className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              {employee.fullName}
            </div>
            <div className="text-xs font-mono text-slate-500">{employee.employeeCode}</div>
          </div>
          <div>
            <div className="text-xs text-slate-500">Department</div>
            <div className="text-sm font-medium text-slate-900 dark:text-slate-100">
              {employee.department || '—'}
            </div>
          </div>
          <div>
            <div className="text-xs text-slate-500">Designation</div>
            <div className="text-sm font-medium text-slate-900 dark:text-slate-100">
              {employee.designation || '—'}
            </div>
          </div>
          <div>
            <div className="text-xs text-slate-500">Joining Date</div>
            <div className="text-sm font-medium text-slate-900 dark:text-slate-100">
              {formatDate(employee.dateOfJoining)}
            </div>
          </div>
        </div>
      </div>

      {/* Salary configuration status */}
      {!salary ? (
        <Card className="flex flex-col items-center justify-center py-12 text-center">
          <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-amber-50 text-amber-700">
            <AlertCircle className="h-7 w-7" />
          </div>
          <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
            Salary information not configured
          </h3>
          <p className="mt-1 max-w-md text-xs text-slate-500">
            No salary structure is currently configured for this employee. Configure the earnings and deduction components to enable payroll generation.
          </p>
          {canManageSalary && (
            <div className="mt-5">
              <Button
                onClick={openEditModal}
                className="bg-[#6E1D1D] hover:bg-[#882424] text-white flex items-center gap-2"
              >
                <Plus className="h-4 w-4" />
                Add Salary Structure
              </Button>
            </div>
          )}
        </Card>
      ) : (
        <>
          {/* Key Metric Highlights */}
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Gross Salary
                </span>
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-50 text-blue-700">
                  <TrendingUp className="h-4 w-4" />
                </span>
              </div>
              <div className="mt-2 text-2xl font-bold font-mono text-slate-900 dark:text-slate-100">
                {formatPaise(salary.grossSalary)}
              </div>
              <div className="mt-1 text-xs text-slate-500">Total monthly earnings</div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                  Total Deductions
                </span>
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-rose-50 text-rose-700">
                  <AlertCircle className="h-4 w-4" />
                </span>
              </div>
              <div className="mt-2 text-2xl font-bold font-mono text-rose-700">
                {formatPaise(salary.deductions)}
              </div>
              <div className="mt-1 text-xs text-slate-500">Applicable deductions</div>
            </div>

            <div className="rounded-xl border border-[#6E1D1D]/20 bg-[#FDF8F8] p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[#6E1D1D] uppercase tracking-wider">
                  Net Monthly Salary
                </span>
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#6E1D1D] text-white">
                  <CreditCard className="h-4 w-4" />
                </span>
              </div>
              <div className="mt-2 text-2xl font-bold font-mono text-[#6E1D1D]">
                {formatPaise(salary.netSalary)}
              </div>
              <div className="mt-1 text-xs text-slate-600">Net payable per month</div>
            </div>
          </div>

          {/* Breakdown Card */}
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900 overflow-hidden">
            <div className="flex flex-wrap items-center justify-between border-b border-slate-200 bg-slate-50/50 px-5 py-4 dark:border-slate-800">
              <div>
                <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  Salary Structure Components
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Effective from: {formatDate(salary.effectiveFrom)}
                </p>
              </div>
              {canManageSalary && (
                <Button
                  onClick={openEditModal}
                  variant="secondary"
                  className="h-8 text-xs flex items-center gap-1.5"
                >
                  <Pencil className="h-3.5 w-3.5" />
                  Edit Structure
                </Button>
              )}
            </div>

            <div className="p-5">
              <div className="grid gap-6 md:grid-cols-2">
                {/* Earnings List */}
                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">
                    Earnings
                  </h4>
                  <dl className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
                    <div className="flex justify-between py-2">
                      <dt className="text-slate-600">Basic Salary</dt>
                      <dd className="font-mono font-medium text-slate-900">{formatPaise(salary.basicSalary)}</dd>
                    </div>
                    <div className="flex justify-between py-2">
                      <dt className="text-slate-600">House Rent Allowance (HRA)</dt>
                      <dd className="font-mono font-medium text-slate-900">{formatPaise(salary.hra)}</dd>
                    </div>
                    <div className="flex justify-between py-2">
                      <dt className="text-slate-600">Conveyance / Allowance</dt>
                      <dd className="font-mono font-medium text-slate-900">{formatPaise(salary.conveyance)}</dd>
                    </div>
                    <div className="flex justify-between py-2">
                      <dt className="text-slate-600">Other Allowances</dt>
                      <dd className="font-mono font-medium text-slate-900">{formatPaise(salary.otherAllowances)}</dd>
                    </div>
                    <div className="flex justify-between py-2">
                      <dt className="text-slate-600">Bonus / Incentives</dt>
                      <dd className="font-mono font-medium text-slate-900">{formatPaise(salary.bonus)}</dd>
                    </div>
                    <div className="flex justify-between py-2.5 font-semibold bg-slate-50 px-2 rounded-md mt-1">
                      <dt className="text-slate-800">Gross Salary</dt>
                      <dd className="font-mono text-slate-900">{formatPaise(salary.grossSalary)}</dd>
                    </div>
                  </dl>
                </div>

                {/* Deductions & Net List */}
                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">
                    Deductions & Net Pay
                  </h4>
                  <dl className="divide-y divide-slate-100 dark:divide-slate-800 text-sm">
                    <div className="flex justify-between py-2">
                      <dt className="text-slate-600">Applicable Deductions</dt>
                      <dd className="font-mono font-medium text-rose-700">{formatPaise(salary.deductions)}</dd>
                    </div>
                    <div className="flex justify-between py-2.5 font-bold bg-[#F8E6E6] text-[#6E1D1D] px-2 rounded-md mt-1">
                      <dt>Net Salary</dt>
                      <dd className="font-mono">{formatPaise(salary.netSalary)}</dd>
                    </div>
                  </dl>

                  {/* Calculation Transparency Box */}
                  <div className="mt-6 rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900">
                    <div className="flex items-start gap-2.5">
                      <Info className="h-4 w-4 text-slate-500 mt-0.5 shrink-0" />
                      <div className="text-xs text-slate-600 leading-relaxed">
                        <span className="font-semibold text-slate-900">Calculation Transparency:</span>
                        <div className="font-mono mt-1 text-slate-700">
                          {formatPaise(salary.grossSalary)} (Gross) − {formatPaise(salary.deductions)} (Deductions) = <strong className="text-[#6E1D1D]">{formatPaise(salary.netSalary)} (Net)</strong>
                        </div>
                      </div>
                    </div>
                  </div>

                  {salary.notes && (
                    <div className="mt-3 text-xs text-slate-500 italic">
                      Notes: {salary.notes}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Salary History */}
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900 overflow-hidden">
            <div className="border-b border-slate-200 bg-slate-50/50 px-5 py-4 dark:border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <History className="h-4 w-4 text-[#6E1D1D]" />
                <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  Salary History
                </h3>
              </div>
              <span className="text-xs text-slate-500">
                {history.length} historical revision{history.length === 1 ? '' : 's'}
              </span>
            </div>

            {history.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-500">
                No past revisions recorded. History is created whenever a salary structure change is saved.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-slate-200 bg-slate-50 text-slate-500 uppercase tracking-wider font-semibold">
                    <tr>
                      <th className="py-2.5 px-4">Effective From</th>
                      <th className="py-2.5 px-4">Gross Salary</th>
                      <th className="py-2.5 px-4">Deductions</th>
                      <th className="py-2.5 px-4">Net Salary</th>
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
                        <td className="py-2.5 px-4 font-mono font-medium text-slate-800">
                          {formatPaise(item.grossSalary)}
                        </td>
                        <td className="py-2.5 px-4 font-mono text-rose-700">
                          {formatPaise(item.deductions)}
                        </td>
                        <td className="py-2.5 px-4 font-mono font-bold text-[#6E1D1D]">
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
          </div>

          {/* Employee Payslips & Salary Payments */}
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900 overflow-hidden">
            <div className="border-b border-slate-200 bg-slate-50/50 px-5 py-4 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <FileText className="h-4 w-4 text-[#6E1D1D]" />
                <div>
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                    Employee Payslips & Salary Payments
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Monthly compensation statements, disbursement records, and payslip generation
                  </p>
                </div>
              </div>

              {canGenerate && (
                <Button
                  onClick={() => setShowGenerateModal(true)}
                  className="h-8 text-xs bg-[#6E1D1D] hover:bg-[#882424] text-white flex items-center gap-1.5"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Generate Payslip
                </Button>
              )}
            </div>

            {payslipBanner && (
              <div className="p-4 border-b border-slate-200">
                <Alert tone="success">{payslipBanner}</Alert>
              </div>
            )}

            {loadingPayslips ? (
              <div className="p-8 text-center">
                <Spinner label="Loading payslip history..." />
              </div>
            ) : payslips.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-500">
                No payslips generated yet for {employee.fullName}. Click &ldquo;Generate Payslip&rdquo; to create a monthly statement based on their configured salary.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="border-b border-slate-200 bg-slate-50 text-slate-500 uppercase tracking-wider font-semibold">
                    <tr>
                      <th className="py-2.5 px-4">Payslip #</th>
                      <th className="py-2.5 px-4">Salary Period</th>
                      <th className="py-2.5 px-4">Gross</th>
                      <th className="py-2.5 px-4">Deductions</th>
                      <th className="py-2.5 px-4">Net Payable</th>
                      <th className="py-2.5 px-4">Status</th>
                      <th className="py-2.5 px-4">Disbursement</th>
                      <th className="py-2.5 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {payslips.map((slip) => {
                      const id = slip.id || slip._id || '';
                      return (
                        <tr key={id} className="hover:bg-slate-50/50">
                          <td className="py-2.5 px-4 font-mono font-medium text-slate-900">
                            {slip.payslipNumber}
                          </td>
                          <td className="py-2.5 px-4 font-medium text-slate-800">
                            {slip.periodLabel}
                          </td>
                          <td className="py-2.5 px-4 font-mono text-slate-800">
                            {formatPaise(slip.grossSalary)}
                          </td>
                          <td className="py-2.5 px-4 font-mono text-rose-700">
                            {formatPaise(slip.deductions)}
                          </td>
                          <td className="py-2.5 px-4 font-mono font-bold text-[#6E1D1D]">
                            {formatPaise(slip.netPayable)}
                          </td>
                          <td className="py-2.5 px-4">
                            {getStatusBadge(slip.status)}
                          </td>
                          <td className="py-2.5 px-4 text-slate-600">
                            {slip.status === 'Paid' ? (
                              <div className="space-y-0.5">
                                <div className="flex items-center gap-1.5">
                                  {getMethodBadge(slip.paymentMethod)}
                                  {slip.paymentDate && (
                                    <span className="text-[11px] text-slate-500">
                                      {formatDate(slip.paymentDate)}
                                    </span>
                                  )}
                                </div>
                                {slip.transactionReference && (
                                  <div className="text-[10px] font-mono text-slate-500">
                                    Ref: {slip.transactionReference}
                                  </div>
                                )}
                              </div>
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
                          </td>
                          <td className="py-2.5 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {canProcess && (slip.status === 'Pending' || slip.status === 'Processed') && (
                                <button
                                  onClick={() => setPayingRecord(slip)}
                                  className="inline-flex items-center gap-1 px-2 py-1 text-[11px] font-semibold text-[#6E1D1D] bg-[#F8E6E6] hover:bg-[#F2D1D1] rounded transition-colors"
                                  title="Disburse / Pay Salary"
                                >
                                  <CreditCard className="h-3 w-3" />
                                  Pay
                                </button>
                              )}
                              {canViewPayslip && (
                                <>
                                  <button
                                    onClick={() => setViewingPayslip(slip)}
                                    className="p-1 text-slate-500 hover:text-slate-800 rounded transition-colors"
                                    title="View Payslip"
                                  >
                                    <Eye className="h-3.5 w-3.5" />
                                  </button>
                                  <button
                                    onClick={() => handleDownloadSlip(slip)}
                                    disabled={downloadingId === id}
                                    className="p-1 text-slate-500 hover:text-slate-800 rounded transition-colors"
                                    title="Download PDF"
                                  >
                                    <Download className={`h-3.5 w-3.5 ${downloadingId === id ? 'animate-spin' : ''}`} />
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}

      {/* Add / Edit Salary Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="relative w-full max-w-xl rounded-xl bg-white shadow-xl dark:bg-slate-900 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 dark:border-slate-800">
              <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                {salary ? 'Edit Salary Structure' : 'Configure Salary Structure'}
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-6 space-y-4">
              {saveError && <Alert tone="error">{saveError}</Alert>}

              <div className="text-xs text-slate-500 bg-slate-50 p-3 rounded-lg border border-slate-200">
                Configuring salary for <strong>{employee.fullName}</strong> ({employee.employeeCode} · {employee.designation || 'No designation'}). All figures are entered in monthly Indian Rupees (₹).
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
                    className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm font-mono focus:border-[#6E1D1D] focus:outline-none"
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
                    className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm font-mono focus:border-[#6E1D1D] focus:outline-none"
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
                    className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm font-mono focus:border-[#6E1D1D] focus:outline-none"
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
                    className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm font-mono focus:border-[#6E1D1D] focus:outline-none"
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
                    className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm font-mono focus:border-[#6E1D1D] focus:outline-none"
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
                    className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm font-mono focus:border-[#6E1D1D] focus:outline-none"
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
                    className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm focus:border-[#6E1D1D] focus:outline-none"
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
                    className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm focus:border-[#6E1D1D] focus:outline-none"
                  />
                </div>
              </div>

              {/* Real-time Calculation Preview */}
              <div className="rounded-lg border border-[#6E1D1D]/30 bg-[#FDF8F8] p-4 text-xs">
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
                    <span className="text-slate-500 block">Net Payable:</span>
                    <strong className="text-[#6E1D1D]">₹{liveNet.toLocaleString('en-IN')}</strong>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-slate-200">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setIsModalOpen(false)}
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
      )}

      {/* Payslip & Payroll Modals */}
      {showGenerateModal && (
        <GeneratePayrollModal
          currentMonth={new Date().getMonth() + 1}
          currentYear={new Date().getFullYear()}
          employeeId={empId}
          employeeName={employee.fullName}
          onClose={() => setShowGenerateModal(false)}
          onSuccess={(summary) => {
            setPayslipBanner(summary);
            fetchPayslips();
          }}
        />
      )}

      {payingRecord && (
        <ProcessPaymentModal
          payroll={payingRecord}
          onClose={() => setPayingRecord(null)}
          onSuccess={() => {
            setPayslipBanner('Salary payment disbursed successfully!');
            fetchPayslips();
          }}
        />
      )}

      {viewingPayslip && (
        <PayslipModal
          payroll={viewingPayslip}
          onClose={() => setViewingPayslip(null)}
        />
      )}
    </div>
  );
}
