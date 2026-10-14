'use client';

import React, { useState } from 'react';
import { Button, Alert } from '@/shared/ui';
import { formatPaise } from '@/modules/employees/format';
import type { Payroll, SalaryPaymentMethod } from '../types';
import { payrollApi } from '../api';
import { X, CheckCircle, AlertCircle } from 'lucide-react';

interface ProcessPaymentModalProps {
  payroll: Payroll;
  onClose: () => void;
  onSuccess: () => void;
}

export function ProcessPaymentModal({
  payroll,
  onClose,
  onSuccess,
}: ProcessPaymentModalProps) {
  const [paymentDate, setPaymentDate] = useState(
    new Date().toISOString().slice(0, 10),
  );
  const [paymentMethod, setPaymentMethod] = useState<SalaryPaymentMethod>('bank_transfer');
  const [transactionReference, setTransactionReference] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Business rule: Cash payments cannot have transaction reference
    const effectiveTxRef = paymentMethod === 'cash' ? '' : transactionReference.trim();

    const payrollId = payroll?.id || payroll?._id || payroll?.payslipNumber;
    if (!payrollId) {
      setError('Payroll record identifier not found');
      return;
    }

    setIsSubmitting(true);
    try {
      await payrollApi.processPayment(payrollId, {
        paymentDate: new Date(paymentDate).toISOString(),
        paymentMethod,
        transactionReference: effectiveTxRef,
        notes: notes.trim(),
      });
      onSuccess();
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to process payment';
      setError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="relative w-full max-w-lg rounded-xl bg-white shadow-xl dark:bg-slate-900">
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-50 text-emerald-700">
              <CheckCircle className="h-4 w-4" />
            </span>
            <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
              Process Salary Payment
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

          {/* Employee & Amount Summary */}
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/50 space-y-2 text-xs">
            <div className="flex justify-between">
              <span className="text-slate-500">Employee:</span>
              <span className="font-semibold text-slate-900">
                {payroll.employeeId?.fullName} ({payroll.employeeId?.employeeCode})
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Salary Period:</span>
              <span className="font-medium text-slate-800">{payroll.periodLabel}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Gross Salary:</span>
              <span className="font-mono text-slate-800">{formatPaise(payroll.grossSalary)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Deductions:</span>
              <span className="font-mono text-rose-700">{formatPaise(payroll.deductions)}</span>
            </div>
            <div className="flex justify-between border-t border-slate-200 pt-2 font-bold text-sm">
              <span className="text-slate-900">Net Payable:</span>
              <span className="font-mono text-[#6E1D1D]">{formatPaise(payroll.netPayable)}</span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Payment Date <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              required
              value={paymentDate}
              onChange={(e) => setPaymentDate(e.target.value)}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-[#6E1D1D] focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Payment Method <span className="text-red-500">*</span>
            </label>
            <select
              value={paymentMethod}
              onChange={(e) => {
                const method = e.target.value as SalaryPaymentMethod;
                setPaymentMethod(method);
                if (method === 'cash') {
                  setTransactionReference('');
                }
              }}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-[#6E1D1D] focus:outline-none bg-white"
            >
              <option value="bank_transfer">Bank Transfer (NEFT/RTGS/IMPS)</option>
              <option value="upi">UPI</option>
              <option value="cheque">Cheque</option>
              <option value="cash">Cash</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Transaction Reference
            </label>
            <input
              type="text"
              disabled={paymentMethod === 'cash'}
              value={paymentMethod === 'cash' ? '' : transactionReference}
              onChange={(e) => setTransactionReference(e.target.value)}
              placeholder={
                paymentMethod === 'cash'
                  ? 'Not applicable for Cash'
                  : 'e.g. UTR / IMPS Ref / Cheque No'
              }
              className={`w-full rounded-md border px-3 py-2 text-sm font-mono focus:border-[#6E1D1D] focus:outline-none ${
                paymentMethod === 'cash'
                  ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'
                  : 'border-slate-300'
              }`}
            />
            {paymentMethod === 'cash' ? (
              <p className="mt-1 text-[11px] text-slate-500 italic">
                Transaction reference remains empty for cash payments.
              </p>
            ) : (
              <p className="mt-1 text-[11px] text-slate-500">
                Optional reference number from the bank transfer or cheque.
              </p>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Payment Notes
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Approved and processed via corporate netbanking"
              className="w-full rounded-md border border-slate-300 px-3 py-1.5 text-sm focus:border-[#6E1D1D] focus:outline-none"
            />
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-slate-200">
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              isLoading={isSubmitting}
              className="bg-[#6E1D1D] hover:bg-[#882424] text-white"
            >
              Mark as Paid
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
