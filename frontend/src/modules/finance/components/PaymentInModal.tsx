'use client';

import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { financeApi, invoicesApi } from '../api';
import { api } from '@/shared/api/client';
import type { PaymentMethod } from '../types';

interface PaymentInModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  defaultCampaignId?: string;
  defaultAmountRupees?: number;
  invoiceId?: string;
  prefillData?: {
    campaignId?: string;
    clientId?: string;
    amountPaise?: number;
  };
}

interface CampaignOption {
  _id?: string;
  id?: string;
  name: string;
  campaignCode?: string;
  clientName?: string;
  client?: { id?: string; name?: string };
  leadId?: { _id?: string; companyName?: string; contactPerson?: string } | string;
}

interface CampaignsApiResponse {
  campaigns?: CampaignOption[];
  data?: CampaignOption[];
}

export function PaymentInModal({
  isOpen,
  onClose,
  onSuccess,
  defaultCampaignId = '',
  defaultAmountRupees,
  invoiceId,
  prefillData,
}: PaymentInModalProps) {
  const initialCamp = prefillData?.campaignId || defaultCampaignId || '';
  const initialAmt = prefillData?.amountPaise
    ? String(prefillData.amountPaise / 100)
    : defaultAmountRupees
    ? String(defaultAmountRupees)
    : '';

  const [campaignId, setCampaignId] = useState(initialCamp);
  const [amountRupees, setAmountRupees] = useState(initialAmt);
  const [receivedAt, setReceivedAt] = useState(new Date().toISOString().slice(0, 10));
  const [method, setMethod] = useState<PaymentMethod>('bank_transfer');
  const [transactionId, setTransactionId] = useState('');
  const [notes, setNotes] = useState('');
  const [campaigns, setCampaigns] = useState<CampaignOption[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Sync state if prefillData changes while modal is open
  const [prevPrefill, setPrevPrefill] = useState(prefillData);
  if (prefillData !== prevPrefill) {
    setPrevPrefill(prefillData);
    if (prefillData?.amountPaise) {
      setAmountRupees(String(prefillData.amountPaise / 100));
    }
    if (prefillData?.campaignId) {
      setCampaignId(prefillData.campaignId);
    }
  }

  useEffect(() => {
    if (isOpen) {
      api.get<CampaignsApiResponse>('/api/campaigns?limit=100')
        .then((res) => {
          const list = res.campaigns || res.data || (Array.isArray(res) ? (res as CampaignOption[]) : []);
          setCampaigns(list);
          if (!campaignId && list.length > 0) {
            setCampaignId(list[0]._id || list[0].id || '');
          }
        })
        .catch(() => {});
    }
  }, [isOpen, campaignId]);

  if (!isOpen) return null;

  const selectedCampaign = campaigns.find((c) => (c._id || c.id) === campaignId);
  const leadObj =
    selectedCampaign?.leadId && typeof selectedCampaign.leadId === 'object'
      ? selectedCampaign.leadId
      : null;
  const clientName =
    leadObj?.companyName ||
    leadObj?.contactPerson ||
    selectedCampaign?.clientName ||
    selectedCampaign?.client?.name ||
    '';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const rupees = parseFloat(amountRupees);
    if (isNaN(rupees) || rupees <= 0) {
      setError('Please enter a valid positive payment amount');
      return;
    }

    if (!campaignId && !invoiceId) {
      setError('Please select a campaign');
      return;
    }

    setSubmitting(true);
    try {
      const isCash = method === 'cash';
      const finalTxnId = isCash ? undefined : transactionId.trim() || undefined;
      const derivedClientId =
        prefillData?.clientId ||
        (leadObj?._id
          ? String(leadObj._id)
          : selectedCampaign?.leadId && typeof selectedCampaign.leadId === 'string'
          ? selectedCampaign.leadId
          : undefined);

      if (invoiceId) {
        await invoicesApi.recordPayment(invoiceId, {
          amount: Math.round(rupees * 100),
          receivedAt: new Date(receivedAt).toISOString(),
          method,
          transactionId: finalTxnId,
          notes: notes.trim() || undefined,
        });
      } else {
        await financeApi.createPaymentIn({
          campaignId: campaignId || '000000000000000000000000',
          clientId: derivedClientId,
          amount: Math.round(rupees * 100), // convert to paise
          receivedAt: new Date(receivedAt).toISOString(),
          method,
          transactionId: finalTxnId,
          notes: notes.trim() || undefined,
        });
      }

      onSuccess();
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : (err as { message?: string })?.message || 'Failed to record payment';
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200 animate-in fade-in zoom-in duration-200">
        {/* Header */}
        <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 flex items-center justify-center bg-[#6E1D1D] text-white rounded-lg font-bold text-sm shadow-2xs">
              ₹
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Record Client Payment</h3>
              <p className="text-xs text-slate-500">Track incoming revenue for campaign billing</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
            title="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 text-xs bg-red-50 border border-red-200 text-red-700 rounded-lg">
              {error}
            </div>
          )}

          {/* Campaign Selector */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Select Campaign <span className="text-red-500">*</span>
            </label>
            <select
              value={campaignId}
              onChange={(e) => setCampaignId(e.target.value)}
              required
              className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#6E1D1D] focus:border-[#6E1D1D] text-slate-900 truncate transition-colors"
            >
              <option value="" disabled>Select campaign...</option>
              {campaigns.map((c) => (
                <option key={c._id || c.id} value={c._id || c.id}>
                  {c.campaignCode ? `[${c.campaignCode}] ` : ''}{c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Client Name (Derived from Campaign) */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Client Name <span className="text-slate-400 font-normal">(derived from selected campaign)</span>
            </label>
            <input
              type="text"
              readOnly
              value={clientName || (campaignId ? 'No client linked to this campaign' : 'Select a campaign above')}
              className="w-full px-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-700 font-medium focus:outline-none cursor-default transition-colors"
            />
          </div>

          {/* Amount in Rupees */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Amount Received (₹ Rupees) <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-semibold text-slate-400 pointer-events-none">₹</span>
              <input
                type="number"
                min="1"
                step="any"
                placeholder="e.g. 50000"
                value={amountRupees}
                onChange={(e) => setAmountRupees(e.target.value)}
                required
                className="w-full pl-9 pr-3 py-2 text-sm font-semibold font-mono bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#6E1D1D] focus:border-[#6E1D1D] text-slate-900 transition-colors"
              />
            </div>
          </div>

          {/* Date & Method Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Received Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={receivedAt}
                onChange={(e) => setReceivedAt(e.target.value)}
                max={new Date().toISOString().slice(0, 10)}
                required
                className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#6E1D1D] focus:border-[#6E1D1D] text-slate-900 transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Payment Method <span className="text-red-500">*</span>
              </label>
              <select
                value={method}
                onChange={(e) => {
                  const newMethod = e.target.value as PaymentMethod;
                  setMethod(newMethod);
                  if (newMethod === 'cash') {
                    setTransactionId('');
                  }
                }}
                required
                className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#6E1D1D] focus:border-[#6E1D1D] text-slate-900 transition-colors"
              >
                <option value="bank_transfer">Bank Transfer (NEFT/RTGS)</option>
                <option value="upi">UPI / QR Code</option>
                <option value="cheque">Cheque</option>
                <option value="credit_card">Credit Card</option>
                <option value="cash">Cash</option>
              </select>
            </div>
          </div>

          {/* Transaction / Reference ID */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Transaction / Cheque / UTR Reference
              {method === 'cash' && (
                <span className="text-slate-400 font-normal ml-1.5">(Not applicable for Cash)</span>
              )}
            </label>
            <input
              type="text"
              placeholder={method === 'cash' ? 'Not applicable for cash payments' : 'e.g. UTR-HDFC-99281726'}
              value={method === 'cash' ? '' : transactionId}
              onChange={(e) => setTransactionId(e.target.value)}
              disabled={method === 'cash'}
              className={`w-full px-3 py-2 text-xs border rounded-lg focus:outline-none font-mono transition-colors ${
                method === 'cash'
                  ? 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed'
                  : 'bg-white border-slate-200 focus:ring-1 focus:ring-[#6E1D1D] focus:border-[#6E1D1D] text-slate-900'
              }`}
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Notes & Remarks
            </label>
            <textarea
              rows={2}
              placeholder="Optional payment notes..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#6E1D1D] focus:border-[#6E1D1D] text-slate-900 transition-colors resize-y"
            />
          </div>

          {/* Footer buttons */}
          <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2 text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 text-xs font-semibold bg-[#6E1D1D] hover:bg-[#581717] text-white rounded-lg shadow-2xs transition-colors flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
            >
              {submitting ? 'Saving...' : 'Save Payment'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
