'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useAuth } from '@/shared/auth/auth-context';
import { RequireAuth } from '@/shared/auth/require-auth';
import { formatPaise, formatDate, initials } from '@/modules/employees/format';
import { payrollApi } from '@/modules/payroll/api';
import type { Payroll } from '@/modules/payroll/types';
import { GeneratePayrollModal } from '@/modules/payroll/components/GeneratePayrollModal';
import { ProcessPaymentModal } from '@/modules/payroll/components/ProcessPaymentModal';
import { PayslipModal } from '@/modules/payroll/components/PayslipModal';
import { Button, Alert, Spinner } from '@/shared/ui';
import {
  CreditCard,
  Calendar,
  Search,
  RefreshCw,
  Plus,
  CheckCircle2,
  Clock,
  AlertCircle,
  Download,
  Eye,
  Filter,
  Building2,
} from 'lucide-react';

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

const DEPARTMENTS = [
  'Sales',
  'Operations',
  'Finance',
  'HR',
  'Marketing',
  'Management',
];

export default function PayrollPage() {
  const { hasPermission } = useAuth();
  const canGenerate = hasPermission('payroll.create');
  const canProcess = hasPermission('payroll.process');
  const canViewPayslip = hasPermission('payroll.payslip');

  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState<number>(now.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState<number>(now.getFullYear());
  const [selectedDept, setSelectedDept] = useState<string>('all');
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [search, setSearch] = useState<string>('');

  const [records, setRecords] = useState<Payroll[]>([]);
  const [total, setTotal] = useState<number>(0);
  const [summary, setSummary] = useState({
    totalGross: 0,
    totalDeductions: 0,
    totalNet: 0,
    paidCount: 0,
    pendingCount: 0,
  });
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [successBanner, setSuccessBanner] = useState<string | null>(null);

  // Modals state
  const [showGenerateModal, setShowGenerateModal] = useState<boolean>(false);
  const [payingRecord, setPayingRecord] = useState<Payroll | null>(null);
  const [viewingPayslip, setViewingPayslip] = useState<Payroll | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const fetchPayroll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await payrollApi.getPayrollList({
        month: selectedMonth,
        year: selectedYear,
        department: selectedDept,
        status: selectedStatus,
        search,
      });
      setRecords(res.items || []);
      setTotal(res.total || 0);
      if (res.summary) {
        setSummary(res.summary);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to fetch payroll records';
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [selectedMonth, selectedYear, selectedDept, selectedStatus, search]);

  useEffect(() => {
    fetchPayroll();
  }, [fetchPayroll]);

  const handleDownload = async (record: Payroll) => {
    const id = record.id || record._id || record.payslipNumber || '';
    setDownloadingId(id);
    try {
      await payrollApi.downloadPayslipPdf(id, `payslip-${record.payslipNumber}.pdf`);
    } catch (err: unknown) {
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
      case 'Failed':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-xs font-semibold bg-rose-50 text-rose-800 rounded-full border border-rose-300">
            <AlertCircle className="h-3 w-3" />
            Failed
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

  return (
    <RequireAuth permission="payroll.view">
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#F8E6E6] text-[#6E1D1D]">
                <CreditCard className="h-5 w-5" />
              </span>
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">
                Payroll / Salary Payments
              </h1>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Monthly employee compensation, salary disbursements, payslips, and payment records
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={() => fetchPayroll()}
              disabled={loading}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 shadow-sm"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>

            {canGenerate && (
              <Button
                onClick={() => setShowGenerateModal(true)}
                className="bg-[#6E1D1D] hover:bg-[#882424] text-white flex items-center gap-1.5"
              >
                <Plus className="h-4 w-4" />
                Generate Payroll
              </Button>
            )}
          </div>
        </div>

        {successBanner && (
          <Alert tone="success">
            {successBanner}
          </Alert>
        )}

        {error && <Alert tone="error">{error}</Alert>}

        {/* Metric Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800">
            <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
              <span>Gross Payroll</span>
              <Building2 className="h-4 w-4 text-blue-600" />
            </div>
            <div className="mt-2 text-xl font-bold font-mono text-slate-900">
              {formatPaise(summary.totalGross)}
            </div>
            <div className="mt-0.5 text-[11px] text-slate-500">Period earnings total</div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800">
            <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
              <span>Total Deductions</span>
              <AlertCircle className="h-4 w-4 text-rose-600" />
            </div>
            <div className="mt-2 text-xl font-bold font-mono text-rose-700">
              {formatPaise(summary.totalDeductions)}
            </div>
            <div className="mt-0.5 text-[11px] text-slate-500">Period total deductions</div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800">
            <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
              <span>Net Payable</span>
              <CreditCard className="h-4 w-4 text-[#6E1D1D]" />
            </div>
            <div className="mt-2 text-xl font-bold font-mono text-[#6E1D1D]">
              {formatPaise(summary.totalNet)}
            </div>
            <div className="mt-0.5 text-[11px] text-slate-500">Total net disbursement</div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800">
            <div className="flex items-center justify-between text-xs text-slate-500 font-medium">
              <span>Payment Progress</span>
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-xl font-bold font-mono text-emerald-700">
                {summary.paidCount}
              </span>
              <span className="text-xs text-slate-500 font-medium">
                Paid / {summary.paidCount + summary.pendingCount} Total
              </span>
            </div>
            <div className="mt-0.5 text-[11px] text-amber-700 font-medium">
              {summary.pendingCount} pending payment
            </div>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
            {/* Month Filter */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                Salary Month
              </label>
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(Number(e.target.value))}
                className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-xs focus:border-[#6E1D1D] focus:outline-none bg-white"
              >
                {MONTHS.map((m) => (
                  <option key={m.value} value={m.value}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Year Filter */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                Year
              </label>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-xs focus:border-[#6E1D1D] focus:outline-none bg-white"
              >
                {[2024, 2025, 2026, 2027].map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>

            {/* Department Filter */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                Department
              </label>
              <select
                value={selectedDept}
                onChange={(e) => setSelectedDept(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-xs focus:border-[#6E1D1D] focus:outline-none bg-white"
              >
                <option value="all">All Departments</option>
                {DEPARTMENTS.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>

            {/* Status Filter */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                Payment Status
              </label>
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-xs focus:border-[#6E1D1D] focus:outline-none bg-white"
              >
                <option value="all">All Statuses</option>
                <option value="Pending">Pending</option>
                <option value="Paid">Paid</option>
                <option value="Processed">Processed</option>
                <option value="Draft">Draft</option>
                <option value="Failed">Failed</option>
              </select>
            </div>

            {/* Search */}
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                Search
              </label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Employee name or code…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full rounded-md border border-slate-300 pl-8 pr-3 py-1.5 text-xs focus:border-[#6E1D1D] focus:outline-none"
                />
                <Search className="h-3.5 w-3.5 text-slate-400 absolute left-2.5 top-2" />
              </div>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 overflow-hidden">
          {loading ? (
            <div className="flex min-h-[300px] items-center justify-center">
              <Spinner label="Loading payroll records…" />
            </div>
          ) : records.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-500">
                <CreditCard className="h-6 w-6" />
              </div>
              <h3 className="text-sm font-semibold text-slate-900">
                No payroll records found
              </h3>
              <p className="mt-1 text-xs text-slate-500 max-w-sm">
                No payroll has been generated for {MONTHS.find((m) => m.value === selectedMonth)?.label} {selectedYear} matching your criteria.
              </p>
              {canGenerate && (
                <div className="mt-4">
                  <Button
                    onClick={() => setShowGenerateModal(true)}
                    className="bg-[#6E1D1D] hover:bg-[#882424] text-white text-xs flex items-center gap-1.5"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Generate Payroll for this Month
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-slate-200 bg-slate-50 text-slate-500 uppercase tracking-wider font-semibold">
                  <tr>
                    <th className="py-3 px-4">Employee</th>
                    <th className="py-3 px-4">Dept / Code</th>
                    <th className="py-3 px-4">Salary Period</th>
                    <th className="py-3 px-4 text-right">Gross</th>
                    <th className="py-3 px-4 text-right">Deductions</th>
                    <th className="py-3 px-4 text-right">Net Payable</th>
                    <th className="py-3 px-4">Payment Date</th>
                    <th className="py-3 px-4">Method</th>
                    <th className="py-3 px-4">Txn Ref</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {records.map((r, index) => (
                    <tr
                      key={r.id || r._id || `payroll-${r.payslipNumber || index}`}
                      className="hover:bg-slate-50/60 transition-colors"
                    >
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#F8E6E6] text-xs font-bold text-[#6E1D1D]">
                            {initials(r.employeeId?.fullName || '')}
                          </span>
                          <div>
                            <Link
                              href={`/employees/${r.employeeId?.id || (r.employeeId as any)?._id || ''}`}
                              className="font-medium text-slate-900 hover:text-[#6E1D1D] hover:underline"
                            >
                              {r.employeeId?.fullName}
                            </Link>
                            <div className="text-[11px] text-slate-500">
                              {r.employeeId?.designation || 'No designation'}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        <span className="font-mono text-slate-600 block">
                          {r.employeeId?.employeeCode}
                        </span>
                        <span className="text-[11px] text-slate-500">
                          {r.employeeId?.department || '—'}
                        </span>
                      </td>

                      <td className="py-3 px-4 font-medium text-slate-800">
                        {r.periodLabel}
                        <span className="block font-mono text-[10px] text-slate-400">
                          {r.payslipNumber}
                        </span>
                      </td>

                      <td className="py-3 px-4 text-right font-mono text-slate-800">
                        {formatPaise(r.grossSalary)}
                      </td>

                      <td className="py-3 px-4 text-right font-mono text-rose-700">
                        {r.deductions > 0 ? `− ${formatPaise(r.deductions)}` : '—'}
                      </td>

                      <td className="py-3 px-4 text-right font-mono font-bold text-[#6E1D1D]">
                        {formatPaise(r.netPayable)}
                      </td>

                      <td className="py-3 px-4 text-slate-600">
                        {r.paymentDate ? formatDate(r.paymentDate) : '—'}
                      </td>

                      <td className="py-3 px-4">{getMethodBadge(r.paymentMethod)}</td>

                      <td className="py-3 px-4 font-mono text-[11px] text-slate-600">
                        {r.transactionReference || '—'}
                      </td>

                      <td className="py-3 px-4 text-center">{getStatusBadge(r.status)}</td>

                      <td className="py-3 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Process Payment */}
                          {r.status !== 'Paid' && canProcess && (
                            <button
                              onClick={() => setPayingRecord(r)}
                              className="px-2.5 py-1 text-xs font-semibold rounded bg-[#6E1D1D] hover:bg-[#882424] text-white"
                            >
                              Pay
                            </button>
                          )}

                          {/* View Payslip */}
                          {canViewPayslip && (
                            <button
                              onClick={() => setViewingPayslip(r)}
                              title="View Payslip"
                              className="p-1 rounded text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                            >
                              <Eye className="h-4 w-4" />
                            </button>
                          )}

                          {/* Download PDF */}
                          {canViewPayslip && (
                            <button
                              onClick={() => handleDownload(r)}
                              disabled={downloadingId === (r.id || r._id)}
                              title="Download Payslip PDF"
                              className="p-1 rounded text-[#6E1D1D] hover:text-[#882424] hover:bg-[#F8E6E6]"
                            >
                              <Download
                                className={`h-4 w-4 ${
                                  downloadingId === (r.id || r._id) ? 'animate-bounce' : ''
                                }`}
                              />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Modals */}
        {showGenerateModal && (
          <GeneratePayrollModal
            currentMonth={selectedMonth}
            currentYear={selectedYear}
            onClose={() => setShowGenerateModal(false)}
            onSuccess={(msg) => {
              setSuccessBanner(msg);
              fetchPayroll();
            }}
          />
        )}

        {payingRecord && (
          <ProcessPaymentModal
            payroll={payingRecord}
            onClose={() => setPayingRecord(null)}
            onSuccess={() => {
              setSuccessBanner('Salary payment processed successfully!');
              fetchPayroll();
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
    </RequireAuth>
  );
}
