'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { quotationsApi } from '@/modules/quotations/api';
import type { PublicProposalView } from '@/modules/quotations/types';
import { AlertTriangle, CheckCircle, XCircle } from 'lucide-react';

export default function PublicProposalPage() {
  const params = useParams<{ token?: string | string[] }>();
  const token = Array.isArray(params?.token) ? params.token[0] : params?.token ?? '';

  const [proposal, setProposal] = useState<PublicProposalView | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Reject modal
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);
  const [actionSuccessMessage, setActionSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    if (token) fetchPublicProposal();
  }, [token]);

  async function fetchPublicProposal() {
    try {
      setLoading(true);
      setError(null);
      const res = await quotationsApi.getPublic(token);
      setProposal(res);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Proposal not found or link has expired');
    } finally {
      setLoading(false);
    }
  }

  async function handleAccept() {
    if (!confirm('Are you sure you want to accept this proposal?')) return;
    try {
      setActionLoading(true);
      setError(null);
      const updated = await quotationsApi.acceptPublic(token);
      setProposal(updated);
      setActionSuccessMessage('Thank you! You have successfully accepted this proposal.');
    } catch (err: any) {
      setError(err.message || 'Failed to accept proposal');
    } finally {
      setActionLoading(false);
    }
  }

  async function handleRejectSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (rejectionReason.trim().length < 10) {
      alert('Please provide a reason of at least 10 characters.');
      return;
    }

    try {
      setActionLoading(true);
      setError(null);
      const updated = await quotationsApi.rejectPublic(token, rejectionReason.trim());
      setProposal(updated);
      setShowRejectModal(false);
      setActionSuccessMessage('Proposal status updated to Rejected.');
    } catch (err: any) {
      setError(err.message || 'Failed to submit rejection');
    } finally {
      setActionLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
        <div className="text-center text-sm text-slate-500">Loading proposal details...</div>
      </div>
    );
  }

  if (error || !proposal) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
        <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-sm text-center border border-slate-200">
          <h2 className="text-lg font-semibold text-rose-600">Proposal Unavailable</h2>
          <p className="mt-2 text-sm text-slate-600">{error || 'Invalid or expired proposal link.'}</p>
        </div>
      </div>
    );
  }

  const isExpired = proposal.status === 'Expired' || new Date(proposal.validUntil) < new Date();
  const isAccepted = proposal.status === 'Accepted';
  const isRejected = proposal.status === 'Rejected';

  return (
    <div className="min-h-screen bg-slate-50 py-10 px-4">
      <div className="mx-auto max-w-3xl space-y-6">
        {/* Brand Header */}
        <div className="flex items-center justify-between rounded-xl bg-slate-900 p-6 text-white shadow-md">
          <div>
            <span className="text-xs tracking-widest text-slate-400 uppercase font-semibold">Media Octus</span>
            <h1 className="text-xl font-bold">OOH Media Campaign Proposal</h1>
          </div>
          <div className="text-right">
            <span className="text-xs text-slate-400">Proposal Ref</span>
            <p className="font-mono text-base font-semibold">{proposal.quoteNumber}</p>
          </div>
        </div>

        {/* Status Banners */}
        {actionSuccessMessage && (
          <div className="rounded-lg bg-emerald-100 p-4 text-sm font-semibold text-emerald-800 border border-emerald-200">
            {actionSuccessMessage}
          </div>
        )}

        {isExpired && !isAccepted && (
          <div className="flex items-center gap-2.5 rounded-lg bg-amber-100 p-4 text-sm font-semibold text-amber-800 border border-amber-200">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
            <span>This proposal expired on {new Date(proposal.validUntil).toLocaleDateString('en-IN')}. It can no longer be accepted.</span>
          </div>
        )}

        {isAccepted && (
          <div className="flex items-center gap-2.5 rounded-lg bg-emerald-100 p-4 text-sm font-semibold text-emerald-800 border border-emerald-200">
            <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />
            <span>This proposal was accepted on {proposal.acceptedAt ? new Date(proposal.acceptedAt).toLocaleDateString('en-IN') : 'date'}.</span>
          </div>
        )}

        {isRejected && (
          <div className="flex items-center gap-2.5 rounded-lg bg-rose-100 p-4 text-sm font-semibold text-rose-800 border border-rose-200">
            <XCircle className="w-5 h-5 text-rose-600 shrink-0" />
            <span>This proposal was declined.</span>
          </div>
        )}

        {/* Client & Date Info */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <span className="text-xs text-slate-400 font-medium">Prepared For</span>
              <p className="text-base font-semibold text-slate-900">{proposal.clientName}</p>
            </div>
            <div>
              <span className="text-xs text-slate-400 font-medium">Proposal Valid Until</span>
              <p className="text-base font-semibold text-slate-900">
                {new Date(proposal.validUntil).toLocaleDateString('en-IN')}
              </p>
            </div>
          </div>
        </div>

        {/* Sites & Line Items Table */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-sm font-semibold text-slate-900 uppercase tracking-wider">Campaign Sites & Duration</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-xs">
              <thead className="border-b border-slate-200 bg-slate-50 font-semibold text-slate-700">
                <tr>
                  <th className="p-3">Location / Site Code</th>
                  <th className="p-3">Duration</th>
                  <th className="p-3 text-right">Days</th>
                  <th className="p-3 text-right">Rate / Day</th>
                  <th className="p-3 text-right">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {proposal.sites.map((item, idx) => (
                  <tr key={idx}>
                    <td className="p-3 font-medium text-slate-900">
                      {item.siteCode} {item.city && <span className="text-slate-500">({item.city})</span>}
                    </td>
                    <td className="p-3 text-slate-600">
                      {new Date(item.startDate).toLocaleDateString('en-IN')} -{' '}
                      {new Date(item.endDate).toLocaleDateString('en-IN')}
                    </td>
                    <td className="p-3 text-right">{item.days}</td>
                    <td className="p-3 text-right">₹{item.ratePerDayRupees.toLocaleString('en-IN')}</td>
                    <td className="p-3 text-right font-semibold text-slate-900">
                      ₹{item.amountRupees.toLocaleString('en-IN')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Totals Block */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="ml-auto max-w-xs space-y-2 text-sm text-slate-700">
            <div className="flex justify-between">
              <span>Subtotal:</span>
              <span className="font-medium">₹{proposal.subtotalRupees.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="flex justify-between">
              <span>GST ({proposal.taxPercent}%):</span>
              <span className="font-medium text-slate-500">₹{proposal.taxAmountRupees.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="flex justify-between border-t border-slate-200 pt-2 text-base font-bold text-slate-900">
              <span>Total Investment:</span>
              <span className="text-emerald-600">₹{proposal.totalRupees.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
            </div>
          </div>
        </div>

        {/* Action Buttons (Accept / Reject) */}
        {!isAccepted && !isRejected && !isExpired && (
          <div className="flex items-center justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={() => setShowRejectModal(true)}
              disabled={actionLoading}
              className="rounded-lg border border-slate-300 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              Decline Proposal
            </button>
            <button
              type="button"
              onClick={handleAccept}
              disabled={actionLoading}
              className="rounded-lg bg-emerald-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 shadow-sm"
            >
              {actionLoading ? 'Processing...' : 'Accept Proposal'}
            </button>
          </div>
        )}

        {/* Rejection Modal */}
        {showRejectModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
              <h3 className="text-base font-semibold text-slate-900">Decline Proposal</h3>
              <p className="mt-1 text-xs text-slate-500">
                Please provide a brief reason for declining (minimum 10 characters).
              </p>

              <form onSubmit={handleRejectSubmit} className="mt-4 space-y-4">
                <textarea
                  rows={3}
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="e.g. Budget constraints, campaign dates changed..."
                  className="w-full rounded-md border border-slate-300 p-2 text-xs text-slate-900 outline-none focus:border-slate-500"
                  required
                />

                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowRejectModal(false)}
                    className="rounded border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={actionLoading}
                    className="rounded bg-rose-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-rose-700 disabled:opacity-50"
                  >
                    Confirm Decline
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
