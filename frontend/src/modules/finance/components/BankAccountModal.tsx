'use client';

import { useState } from 'react';
import { X, Building2, CreditCard, AlertCircle, Loader2, Check } from 'lucide-react';
import { bankAccountsApi } from '../api';
import type { BankAccount, CreateBankAccountPayload } from '../types';

interface BankAccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (account: BankAccount) => void;
  initialData?: BankAccount | null;
}

const POPULAR_BANKS = [
  'HDFC Bank',
  'ICICI Bank',
  'State Bank of India',
  'Axis Bank',
  'Kotak Mahindra Bank',
  'Punjab National Bank',
  'Bank of Baroda',
  'IndusInd Bank',
  'Yes Bank',
  'Standard Chartered Bank',
];

export function BankAccountModal({
  isOpen,
  onClose,
  onSuccess,
  initialData,
}: BankAccountModalProps) {
  const [bankName, setBankName] = useState(initialData?.bankName || 'HDFC Bank');
  const [customBank, setCustomBank] = useState('');
  const [accountHolderName, setAccountHolderName] = useState(initialData?.accountHolderName || 'Media Octus Pvt Ltd');
  const [accountNumber, setAccountNumber] = useState(initialData?.accountNumber || '');
  const [ifsc, setIfsc] = useState(initialData?.ifsc || '');
  const [branch, setBranch] = useState(initialData?.branch || 'Mumbai');
  const [accountType, setAccountType] = useState<'Current' | 'Savings' | 'Overdraft'>(initialData?.accountType || 'Current');
  const [isDefault, setIsDefault] = useState(initialData?.isDefault ?? false);
  const [notes, setNotes] = useState(initialData?.notes || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const finalBankName = bankName === 'Other' ? customBank.trim() : bankName.trim();
    if (!finalBankName) {
      setError('Please select or specify a bank name');
      return;
    }
    if (!accountNumber.trim()) {
      setError('Account number is required');
      return;
    }
    if (!ifsc.trim() || ifsc.trim().length < 5) {
      setError('Valid IFSC code is required');
      return;
    }
    if (!branch.trim()) {
      setError('Branch name is required');
      return;
    }

    setSaving(true);
    try {
      const payload: CreateBankAccountPayload = {
        bankName: finalBankName,
        accountHolderName: accountHolderName.trim() || 'Media Octus Pvt Ltd',
        accountNumber: accountNumber.trim(),
        ifsc: ifsc.trim().toUpperCase(),
        branch: branch.trim(),
        accountType,
        isDefault,
        notes: notes.trim(),
      };

      let result: BankAccount;
      if (initialData?.id) {
        const res = await bankAccountsApi.updateBankAccount(initialData.id, payload);
        result = res.data;
      } else {
        const res = await bankAccountsApi.createBankAccount(payload);
        result = res.data;
      }

      onSuccess(result);
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Failed to save bank account');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs">
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4 bg-slate-50">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#F8E6E6] text-[#6E1D1D]">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                {initialData ? 'Edit Bank Account' : 'Add Company Bank Account'}
              </h3>
              <p className="text-xs text-slate-500">Configure corporate settlement account for invoice payments</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-600 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto">
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700 flex items-center gap-2">
              <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
              <span>{error}</span>
            </div>
          )}

          {/* Bank Selection */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Bank Name *</label>
            <select
              value={bankName}
              onChange={(e) => setBankName(e.target.value)}
              className="w-full h-9 rounded-lg border border-slate-300 px-3 text-xs bg-white focus:border-[#6E1D1D] focus:ring-1 focus:ring-[#6E1D1D] outline-none"
            >
              {POPULAR_BANKS.map((b) => (
                <option key={b} value={b}>
                  {b}
                </option>
              ))}
              <option value="Other">Other Bank (specify)</option>
            </select>
          </div>

          {bankName === 'Other' && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Custom Bank Name *</label>
              <input
                type="text"
                value={customBank}
                onChange={(e) => setCustomBank(e.target.value)}
                placeholder="e.g. Federal Bank"
                className="w-full h-9 rounded-lg border border-slate-300 px-3 text-xs focus:border-[#6E1D1D] focus:ring-1 focus:ring-[#6E1D1D] outline-none"
                required
              />
            </div>
          )}

          {/* Account Holder Name */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Account Holder Name *</label>
            <input
              type="text"
              value={accountHolderName}
              onChange={(e) => setAccountHolderName(e.target.value)}
              placeholder="Media Octus Pvt Ltd"
              className="w-full h-9 rounded-lg border border-slate-300 px-3 text-xs focus:border-[#6E1D1D] focus:ring-1 focus:ring-[#6E1D1D] outline-none"
              required
            />
          </div>

          {/* Account Number & Account Type */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Account Number *</label>
              <input
                type="text"
                value={accountNumber}
                onChange={(e) => setAccountNumber(e.target.value.replace(/\s+/g, ''))}
                placeholder="e.g. 50200012345678"
                className="w-full h-9 rounded-lg border border-slate-300 px-3 text-xs font-mono focus:border-[#6E1D1D] focus:ring-1 focus:ring-[#6E1D1D] outline-none"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Account Type</label>
              <select
                value={accountType}
                onChange={(e) => setAccountType(e.target.value as any)}
                className="w-full h-9 rounded-lg border border-slate-300 px-3 text-xs bg-white focus:border-[#6E1D1D] focus:ring-1 focus:ring-[#6E1D1D] outline-none"
              >
                <option value="Current">Current Account</option>
                <option value="Savings">Savings Account</option>
                <option value="Overdraft">Overdraft (OD) Account</option>
              </select>
            </div>
          </div>

          {/* IFSC & Branch */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">IFSC Code *</label>
              <input
                type="text"
                value={ifsc}
                onChange={(e) => setIfsc(e.target.value.toUpperCase().replace(/\s+/g, ''))}
                placeholder="e.g. HDFC0000123"
                className="w-full h-9 rounded-lg border border-slate-300 px-3 text-xs font-mono uppercase focus:border-[#6E1D1D] focus:ring-1 focus:ring-[#6E1D1D] outline-none"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Branch Name *</label>
              <input
                type="text"
                value={branch}
                onChange={(e) => setBranch(e.target.value)}
                placeholder="e.g. BKC, Mumbai"
                className="w-full h-9 rounded-lg border border-slate-300 px-3 text-xs focus:border-[#6E1D1D] focus:ring-1 focus:ring-[#6E1D1D] outline-none"
                required
              />
            </div>
          </div>

          {/* Default Account Checkbox */}
          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="isDefaultAccount"
              checked={isDefault}
              onChange={(e) => setIsDefault(e.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-[#6E1D1D] focus:ring-[#6E1D1D]"
            />
            <label htmlFor="isDefaultAccount" className="text-xs text-slate-700 font-medium select-none">
              Set as primary default account for all new invoices
            </label>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Internal Notes (optional)</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. For North region client billing"
              className="w-full h-9 rounded-lg border border-slate-300 px-3 text-xs focus:border-[#6E1D1D] focus:ring-1 focus:ring-[#6E1D1D] outline-none"
            />
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#6E1D1D] hover:bg-[#581717] rounded-lg transition-all shadow-sm disabled:opacity-50"
            >
              {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
              {saving ? 'Saving...' : initialData ? 'Update Account' : 'Save Account'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
