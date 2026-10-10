'use client';

import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { financeApi } from '../api';
import { api } from '@/shared/api/client';
import type { PaymentMethod, PaymentOutCategory } from '../types';

interface PaymentOutModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  defaultCampaignId?: string;
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

interface VendorOption {
  _id?: string;
  id?: string;
  name: string;
  city?: string;
}

interface CampaignsApiResponse {
  campaigns?: CampaignOption[];
  data?: CampaignOption[];
}

interface VendorsApiResponse {
  vendors?: VendorOption[];
  data?: VendorOption[];
}

export function PaymentOutModal({
  isOpen,
  onClose,
  onSuccess,
  defaultCampaignId = '',
}: PaymentOutModalProps) {
  const [campaignId, setCampaignId] = useState(defaultCampaignId);
  const [vendorId, setVendorId] = useState('');
  const [amountRupees, setAmountRupees] = useState('');
  const [paidAt, setPaidAt] = useState(new Date().toISOString().slice(0, 10));
  const [method, setMethod] = useState<PaymentMethod>('bank_transfer');
  const [category, setCategory] = useState<PaymentOutCategory>('media_cost');
  const [vendorInvoice, setVendorInvoice] = useState('');
  const [transactionId, setTransactionId] = useState('');
  const [notes, setNotes] = useState('');

  const [campaigns, setCampaigns] = useState<CampaignOption[]>([]);
  const [vendors, setVendors] = useState<VendorOption[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      // Load campaigns & vendors in parallel
      Promise.all([
        api.get<CampaignsApiResponse>('/api/campaigns?limit=100').catch(() => ({} as CampaignsApiResponse)),
        api.get<VendorsApiResponse>('/api/vendors?limit=100').catch(() => ({} as VendorsApiResponse)),
      ]).then(([campRes, vendRes]) => {
        const cList = campRes.campaigns || campRes.data || (Array.isArray(campRes) ? (campRes as CampaignOption[]) : []);
        const vList = vendRes.vendors || vendRes.data || (Array.isArray(vendRes) ? (vendRes as VendorOption[]) : []);
        setCampaigns(cList);
        setVendors(vList);

        if (!campaignId && cList.length > 0) setCampaignId(cList[0]._id || cList[0].id || '');
        if (!vendorId && vList.length > 0) setVendorId(vList[0]._id || vList[0].id || '');
      });
    }
  }, [isOpen, campaignId, vendorId]);

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

    if (!campaignId) {
      setError('Please select a campaign');
      return;
    }

    if (!vendorId) {
      setError('Please select a vendor');
      return;
    }

    setSubmitting(true);
    try {
      const isCash = method === 'cash';
      const finalTxnId = isCash ? undefined : transactionId.trim() || undefined;

      await financeApi.createPaymentOut({
        campaignId,
        vendorId,
        amount: Math.round(rupees * 100), // convert to paise
        paidAt: new Date(paidAt).toISOString(),
        method,
        category,
        vendorInvoice: vendorInvoice.trim() || undefined,
        transactionId: finalTxnId,
        notes: notes.trim() || undefined,
      });

      onSuccess();
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : (err as { message?: string })?.message || 'Failed to record vendor payment';
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
              <h3 className="text-base font-bold text-slate-900">Record Vendor Payment</h3>
              <p className="text-xs text-slate-500">Track expense disbursements & cost rollups</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
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

          {/* Vendor Selector */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Select Vendor / Supplier <span className="text-red-500">*</span>
            </label>
            <select
              value={vendorId}
              onChange={(e) => setVendorId(e.target.value)}
              required
              className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#6E1D1D] focus:border-[#6E1D1D] text-slate-900 truncate transition-colors"
            >
              <option value="" disabled>Select vendor...</option>
              {vendors.map((v) => (
                <option key={v._id || v.id} value={v._id || v.id}>
                  {v.name} ({v.city || 'Vendor'})
                </option>
              ))}
            </select>
          </div>

          {/* Amount & Category Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Amount Paid (₹ Rupees) <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-semibold text-slate-400 pointer-events-none">₹</span>
                <input
                  type="number"
                  min="1"
                  step="any"
                  placeholder="e.g. 30000"
                  value={amountRupees}
                  onChange={(e) => setAmountRupees(e.target.value)}
                  required
                  className="w-full pl-9 pr-3 py-2 text-sm font-semibold font-mono bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#6E1D1D] focus:border-[#6E1D1D] text-slate-900 transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Expense Category <span className="text-red-500">*</span>
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as PaymentOutCategory)}
                required
                className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#6E1D1D] focus:border-[#6E1D1D] text-slate-900 transition-colors"
              >
                <option value="media_cost">Media Cost (Billboard/Site)</option>
                <option value="production_cost">Production (Printing/Flex)</option>
                <option value="logistics">Logistics & Mounting</option>
                <option value="other">Other Overhead</option>
              </select>
            </div>
          </div>

          {/* Date & Method Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Payment Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={paidAt}
                onChange={(e) => setPaidAt(e.target.value)}
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

          {/* Vendor Invoice & Reference Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Vendor Invoice No.
              </label>
              <input
                type="text"
                placeholder="e.g. INV-2026-881"
                value={vendorInvoice}
                onChange={(e) => setVendorInvoice(e.target.value)}
                className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#6E1D1D] focus:border-[#6E1D1D] font-mono text-slate-900 transition-colors"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                Txn / UTR Reference
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
          </div>

          {/* Notes */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Notes & Remarks
            </label>
            <textarea
              rows={2}
              placeholder="Optional remarks..."
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
              {submitting ? 'Saving...' : 'Record Expense'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
