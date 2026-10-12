'use client';

import React, { useState } from 'react';
import { Button } from '@/shared/ui';
import { formatPaise, formatDate } from '@/modules/employees/format';
import type { Payroll } from '../types';
import { payrollApi } from '../api';
import { X, Download, FileText, Building2, CheckCircle2, Printer } from 'lucide-react';

interface PayslipModalProps {
  payroll: Payroll;
  onClose: () => void;
}

export function PayslipModal({ payroll, onClose }: PayslipModalProps) {
  const [isDownloading, setIsDownloading] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const employee = payroll.employeeId;
  const snapshot = payroll.salaryStructureSnapshot;

  const handleDownload = async () => {
    setIsDownloading(true);
    try {
      await payrollApi.downloadPayslipPdf(
        payroll.id || payroll._id || payroll.payslipNumber || '',
        `payslip-${payroll.payslipNumber}.pdf`,
      );
    } catch (err: unknown) {
      alert('Could not download payslip PDF. Please try again.');
    } finally {
      setIsDownloading(false);
    }
  };

  const handlePrint = async () => {
    setIsPrinting(true);
    try {
      await payrollApi.printPayslipPdf(payroll.id || payroll._id || payroll.payslipNumber || '');
    } catch (err: unknown) {
      alert('Could not print payslip PDF. Please try again.');
    } finally {
      setIsPrinting(false);
    }
  };

  const methodLabel =
    payroll.paymentMethod === 'bank_transfer'
      ? 'Bank Transfer'
      : payroll.paymentMethod === 'upi'
        ? 'UPI'
        : payroll.paymentMethod === 'cheque'
          ? 'Cheque'
          : payroll.paymentMethod === 'cash'
            ? 'Cash'
            : '—';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="relative w-full max-w-2xl rounded-2xl bg-white shadow-2xl dark:bg-slate-900 max-h-[92vh] overflow-y-auto">
        {/* Top Action Bar */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 dark:border-slate-800 bg-slate-50">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-[#6E1D1D]" />
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              Payslip Preview · {payroll.payslipNumber}
            </h3>
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={handlePrint}
              isLoading={isPrinting}
              variant="secondary"
              className="h-8 text-xs flex items-center gap-1.5"
            >
              <Printer className="h-3.5 w-3.5 text-slate-600" />
              Print
            </Button>
            <Button
              onClick={handleDownload}
              isLoading={isDownloading}
              className="h-8 text-xs bg-[#6E1D1D] hover:bg-[#882424] text-white flex items-center gap-1.5"
            >
              <Download className="h-3.5 w-3.5" />
              Download PDF
            </Button>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600 p-1"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Payslip Document Body */}
        <div className="p-8 space-y-6">
          {/* Header */}
          <div className="border-b-2 border-[#6E1D1D] pb-5">
            <div className="flex justify-between items-start">
              <div>
                <h1 className="text-xl font-bold tracking-tight text-[#6E1D1D]">
                  MEDIA OCTUS PVT LTD
                </h1>
                <p className="text-xs text-slate-500 mt-0.5">
                  Trade Tower, Bandra Kurla Complex, Mumbai - 400051
                </p>
                <p className="text-xs text-slate-500">accounts@mediaoctus.com</p>
              </div>
              <div className="text-right">
                <span className="inline-block rounded-md bg-[#F8E6E6] px-3 py-1 text-xs font-bold text-[#6E1D1D] uppercase tracking-wide">
                  Employee Payslip
                </span>
                <p className="text-sm font-bold text-slate-900 mt-2">{payroll.periodLabel}</p>
                <p className="text-xs font-mono text-slate-500">{payroll.payslipNumber}</p>
              </div>
            </div>
          </div>

          {/* Employee Information (only populated fields!) */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4 dark:border-slate-800">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
              Employee Information
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-y-3 gap-x-4 text-xs">
              <div>
                <span className="text-slate-500 block">Employee Name:</span>
                <strong className="text-slate-900">{employee?.fullName || '—'}</strong>
              </div>
              <div>
                <span className="text-slate-500 block">Employee Code:</span>
                <strong className="text-slate-900 font-mono">{employee?.employeeCode || '—'}</strong>
              </div>
              {employee?.department && (
                <div>
                  <span className="text-slate-500 block">Department:</span>
                  <strong className="text-slate-900">{employee.department}</strong>
                </div>
              )}
              {employee?.designation && (
                <div>
                  <span className="text-slate-500 block">Designation:</span>
                  <strong className="text-slate-900">{employee.designation}</strong>
                </div>
              )}
              {employee?.dateOfJoining && (
                <div>
                  <span className="text-slate-500 block">Date of Joining:</span>
                  <strong className="text-slate-900">{formatDate(employee.dateOfJoining)}</strong>
                </div>
              )}
              {employee?.bankAccountNumber && (
                <div>
                  <span className="text-slate-500 block">Bank Account:</span>
                  <strong className="text-slate-900 font-mono">{employee.bankAccountNumber}</strong>
                </div>
              )}
              {employee?.ifsc && (
                <div>
                  <span className="text-slate-500 block">IFSC:</span>
                  <strong className="text-slate-900 font-mono">{employee.ifsc}</strong>
                </div>
              )}
              <div>
                <span className="text-slate-500 block">Payment Status:</span>
                <span className="inline-flex items-center gap-1 font-semibold text-emerald-700">
                  <CheckCircle2 className="h-3 w-3" />
                  {payroll.status}
                </span>
              </div>
            </div>
          </div>

          {/* Salary Components Table */}
          <div className="rounded-xl border border-slate-200 overflow-hidden">
            <div className="bg-slate-100/70 px-4 py-2 text-xs font-bold uppercase tracking-wider text-slate-700 border-b border-slate-200">
              Salary Details & Deductions
            </div>
            <table className="w-full text-xs">
              <thead className="border-b border-slate-200 bg-slate-50 text-slate-500">
                <tr>
                  <th className="py-2.5 px-4 text-left">Salary Component</th>
                  <th className="py-2.5 px-4 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                <tr>
                  <td className="py-2 px-4 text-slate-700">Basic Salary</td>
                  <td className="py-2 px-4 text-right font-mono font-medium text-slate-900">
                    {formatPaise(snapshot.basicSalary)}
                  </td>
                </tr>
                {snapshot.hra > 0 && (
                  <tr>
                    <td className="py-2 px-4 text-slate-700">House Rent Allowance (HRA)</td>
                    <td className="py-2 px-4 text-right font-mono font-medium text-slate-900">
                      {formatPaise(snapshot.hra)}
                    </td>
                  </tr>
                )}
                {snapshot.conveyance > 0 && (
                  <tr>
                    <td className="py-2 px-4 text-slate-700">Conveyance / Allowance</td>
                    <td className="py-2 px-4 text-right font-mono font-medium text-slate-900">
                      {formatPaise(snapshot.conveyance)}
                    </td>
                  </tr>
                )}
                {snapshot.otherAllowances > 0 && (
                  <tr>
                    <td className="py-2 px-4 text-slate-700">Other Allowances</td>
                    <td className="py-2 px-4 text-right font-mono font-medium text-slate-900">
                      {formatPaise(snapshot.otherAllowances)}
                    </td>
                  </tr>
                )}
                {snapshot.bonus > 0 && (
                  <tr>
                    <td className="py-2 px-4 text-slate-700">Bonus / Incentives</td>
                    <td className="py-2 px-4 text-right font-mono font-medium text-slate-900">
                      {formatPaise(snapshot.bonus)}
                    </td>
                  </tr>
                )}
                <tr className="bg-slate-50 font-semibold text-slate-900">
                  <td className="py-2.5 px-4">Gross Salary</td>
                  <td className="py-2.5 px-4 text-right font-mono">
                    {formatPaise(payroll.grossSalary)}
                  </td>
                </tr>
                {payroll.deductions > 0 && (
                  <tr>
                    <td className="py-2 px-4 text-rose-700">Applicable Deductions</td>
                    <td className="py-2 px-4 text-right font-mono font-medium text-rose-700">
                      − {formatPaise(payroll.deductions)}
                    </td>
                  </tr>
                )}
                <tr className="bg-[#F8E6E6] font-bold text-[#6E1D1D] text-sm">
                  <td className="py-3 px-4">Net Payable Salary</td>
                  <td className="py-3 px-4 text-right font-mono">
                    {formatPaise(payroll.netPayable)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Payment Details */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
              Payment Details
            </h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div>
                <span className="text-slate-500 block">Salary Month:</span>
                <strong className="text-slate-900">{payroll.periodLabel}</strong>
              </div>
              <div>
                <span className="text-slate-500 block">Payment Date:</span>
                <strong className="text-slate-900">
                  {payroll.paymentDate ? formatDate(payroll.paymentDate) : 'Pending'}
                </strong>
              </div>
              <div>
                <span className="text-slate-500 block">Payment Method:</span>
                <strong className="text-slate-900">{methodLabel}</strong>
              </div>
              {payroll.transactionReference && (
                <div>
                  <span className="text-slate-500 block">Transaction Reference:</span>
                  <strong className="text-slate-900 font-mono">
                    {payroll.transactionReference}
                  </strong>
                </div>
              )}
            </div>
          </div>

          <div className="text-center text-[11px] text-slate-400 italic pt-2">
            This is a computer-generated payslip and does not require a physical signature.
          </div>
        </div>
      </div>
    </div>
  );
}
