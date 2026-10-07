'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { quotationsApi } from '@/modules/quotations/api';
import type { PublicProposalView } from '@/modules/quotations/types';
import { AlertTriangle, CheckCircle, XCircle, Building2, CreditCard, Clock, Calendar, Download } from 'lucide-react';

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

  function formatDate(d?: string | null) {
    if (!d) return '-';
    const date = new Date(d);
    return isNaN(date.getTime()) ? '-' : date.toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
        <div className="text-center text-sm font-medium text-slate-500">Loading official proposal...</div>
      </div>
    );
  }

  if (error || !proposal) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
        <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-sm text-center border border-slate-200">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-rose-50 text-[#8B2424]">
            <XCircle className="h-6 w-6" />
          </div>
          <h2 className="text-lg font-bold text-gray-900">Proposal Unavailable</h2>
          <p className="mt-2 text-xs text-gray-500">{error || 'Invalid or expired proposal link.'}</p>
        </div>
      </div>
    );
  }

  const isExpired = proposal.status === 'Expired' || new Date(proposal.validUntil) < new Date();
  const isAccepted = proposal.status === 'Accepted';
  const isRejected = proposal.status === 'Rejected';

  return (
    <div className="min-h-screen bg-slate-50/70 py-10 px-4">
      <div className="mx-auto max-w-4xl space-y-6">
        {/* Brand Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl bg-[#8B2424] p-6 text-white shadow-md">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold tracking-widest uppercase bg-white/20 px-2 py-0.5 rounded">Media Octus</span>
              <span className="text-xs text-rose-200 font-medium">Outdoor Advertising</span>
            </div>
            <h1 className="text-xl font-bold mt-1">Outdoor Media Campaign Proposal</h1>
          </div>
          <div className="flex flex-col sm:items-end gap-2 text-left sm:text-right">
            <div>
              <span className="text-xs text-rose-200">Proposal Reference</span>
              <p className="font-mono text-base font-bold">{proposal.quoteNumber}</p>
            </div>
            {proposal.pdfUrl && (
              <a
                href={proposal.pdfUrl}
                download={`${proposal.quoteNumber}.pdf`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 rounded-lg bg-white/20 hover:bg-white/30 px-3 py-1.5 text-xs font-semibold text-white transition backdrop-blur-xs w-fit"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download PDF</span>
              </a>
            )}
          </div>
        </div>

        {/* Status Banners */}
        {actionSuccessMessage && (
          <div className="rounded-xl bg-emerald-100 p-4 text-sm font-semibold text-emerald-800 border border-emerald-200">
            {actionSuccessMessage}
          </div>
        )}

        {isExpired && !isAccepted && (
          <div className="flex items-center gap-2.5 rounded-xl bg-amber-100 p-4 text-sm font-semibold text-amber-800 border border-amber-200">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
            <span>This proposal expired on {formatDate(proposal.validUntil)}. It can no longer be accepted.</span>
          </div>
        )}

        {isAccepted && (
          <div className="flex items-center gap-2.5 rounded-xl bg-emerald-100 p-4 text-sm font-semibold text-emerald-800 border border-emerald-200">
            <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />
            <span>This proposal was successfully accepted on {proposal.acceptedAt ? formatDate(proposal.acceptedAt) : 'date'}.</span>
          </div>
        )}

        {isRejected && (
          <div className="flex items-center gap-2.5 rounded-xl bg-rose-100 p-4 text-sm font-semibold text-rose-800 border border-rose-200">
            <XCircle className="w-5 h-5 text-rose-600 shrink-0" />
            <span>This proposal was declined {proposal.rejectionReason ? `• Reason: ${proposal.rejectionReason}` : ''}.</span>
          </div>
        )}

        {/* Client & Date Info */}
        <div className="grid gap-4 sm:grid-cols-2 rounded-2xl border border-slate-200 bg-white p-6 shadow-xs">
          <div>
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Proposal Prepared For</span>
            <p className="text-base font-bold text-slate-900 mt-0.5">{proposal.clientName}</p>
            {proposal.clientContactPerson && (
              <p className="text-xs text-slate-600 mt-0.5">Attention: <span className="font-semibold">{proposal.clientContactPerson}</span></p>
            )}
            {proposal.clientCity && (
              <p className="text-xs text-slate-500">{proposal.clientCity}{proposal.clientState ? `, ${proposal.clientState}` : ''}</p>
            )}
          </div>
          <div className="sm:text-right">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Validity &amp; Status</span>
            <p className="text-sm font-semibold text-slate-900 mt-0.5">
              Valid Until: <span className="text-amber-700 font-bold">{formatDate(proposal.validUntil)}</span>
            </p>
            <div className="mt-1">
              <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider ${
                isAccepted ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                isRejected ? 'bg-rose-50 text-rose-700 border border-rose-200' :
                'bg-blue-50 text-blue-700 border border-blue-200'
              }`}>
                Status: {proposal.status}
              </span>
            </div>
          </div>
        </div>

        {/* Agreed 7-Column Line Items Table */}
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xs">
          <div className="border-b border-slate-100 bg-slate-50/80 px-4 py-3">
            <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider">Proposed Media Sites &amp; Campaign Duration</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-xs">
              <thead className="border-b border-slate-200 bg-slate-100/70 text-[10px] font-bold uppercase tracking-wider text-slate-600">
                <tr>
                  <th className="py-2.5 pl-3 pr-2">NO.</th>
                  <th className="px-3 py-2.5">SITE / ITEM DETAILS</th>
                  <th className="px-3 py-2.5 text-center">DURATION (QTY)</th>
                  <th className="px-3 py-2.5 text-right">RATE (₹)</th>
                  <th className="px-3 py-2.5 text-right">DISCOUNT</th>
                  <th className="px-3 py-2.5 text-center">TAX</th>
                  <th className="py-2.5 pl-2 pr-3 text-right">AMOUNT (₹)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {proposal.sites.map((item, idx) => {
                  const hasCustomDates = item.startDate && item.endDate && !isNaN(new Date(item.startDate).getTime()) && !isNaN(new Date(item.endDate).getTime());
                  return (
                    <tr key={idx} className="hover:bg-slate-50/50">
                      <td className="py-3 pl-3 pr-2 text-slate-400 font-mono">{idx + 1}</td>
                      <td className="px-3 py-3">
                        <div className="font-bold text-slate-900">
                          {item.description || item.siteCode}
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {item.type || 'Hoarding'} &bull; {item.city}
                        </div>
                      </td>
                      <td className="px-3 py-3 text-center whitespace-nowrap">
                        <span className="font-bold text-slate-800">{item.days} Days</span>
                        {hasCustomDates ? (
                          <div className="text-[10px] text-slate-400">
                            {formatDate(item.startDate)} - {formatDate(item.endDate)}
                          </div>
                        ) : (
                          <div className="text-[10px] text-slate-400 italic">Dates TBD</div>
                        )}
                      </td>
                      <td className="px-3 py-3 text-right font-mono text-slate-700 whitespace-nowrap">
                        ₹{item.ratePerDayRupees.toLocaleString('en-IN')}/d
                      </td>
                      <td className="px-3 py-3 text-right text-slate-500 whitespace-nowrap">
                        {item.discountPercent ? `${item.discountPercent}%` : '-'}
                      </td>
                      <td className="px-3 py-3 text-center text-slate-600 whitespace-nowrap font-medium">
                        {item.taxPercent !== undefined ? `${item.taxPercent}% GST` : '18% GST'}
                      </td>
                      <td className="py-3 pl-2 pr-3 text-right font-bold text-slate-900 whitespace-nowrap">
                        ₹{item.amountRupees.toLocaleString('en-IN')}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Financial Summary */}
        <div className="flex justify-end">
          <div className="w-80 space-y-2 rounded-2xl border border-slate-200 bg-white p-5 text-xs shadow-xs">
            <div className="flex justify-between text-slate-600">
              <span>Subtotal:</span>
              <span className="font-semibold text-slate-900">₹{proposal.subtotalRupees.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="flex justify-between text-slate-600">
              <span>GST ({proposal.taxPercent}%):</span>
              <span className="font-semibold text-slate-900">₹{proposal.taxAmountRupees.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="flex justify-between border-t border-slate-200 pt-2 text-sm font-bold text-[#8B2424]">
              <span>Total Investment:</span>
              <span>₹{proposal.totalRupees.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</span>
            </div>
          </div>
        </div>

        {/* Bank Details & Terms Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {proposal.bankDetails && proposal.bankDetails.accountNumber && (
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs text-xs space-y-2">
              <div className="flex items-center gap-1.5 font-bold uppercase tracking-wider text-slate-400">
                <CreditCard className="h-3.5 w-3.5 text-[#8B2424]" />
                <span>Bank Payment Information</span>
              </div>
              <div className="mt-2 space-y-1 text-slate-700">
                <p><span className="font-semibold">Bank:</span> {proposal.bankDetails.bankName || 'HDFC Bank'}</p>
                <p><span className="font-semibold">Account Name:</span> {proposal.bankDetails.accountName}</p>
                <p><span className="font-semibold font-mono">A/C Number:</span> {proposal.bankDetails.accountNumber}</p>
                <p><span className="font-semibold font-mono">IFSC Code:</span> {proposal.bankDetails.ifscCode}</p>
                {proposal.bankDetails.branch && (
                  <p><span className="font-semibold">Branch:</span> {proposal.bankDetails.branch}</p>
                )}
              </div>
            </div>
          )}

          {proposal.terms && proposal.terms.length > 0 && (
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-xs text-xs space-y-2">
              <div className="flex items-center gap-1.5 font-bold uppercase tracking-wider text-slate-400">
                <Clock className="h-3.5 w-3.5 text-[#8B2424]" />
                <span>Terms &amp; Conditions</span>
              </div>
              <ol className="mt-2 space-y-1 text-slate-600 list-decimal pl-4">
                {proposal.terms.map((term, tIdx) => (
                  <li key={tIdx} className="leading-relaxed">{term}</li>
                ))}
              </ol>
            </div>
          )}
        </div>

        {/* Action Buttons (Accept / Reject) */}
        {!isAccepted && !isRejected && !isExpired && (
          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setShowRejectModal(true)}
              disabled={actionLoading}
              className="rounded-xl border border-slate-300 bg-white px-5 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition cursor-pointer"
            >
              Decline Proposal
            </button>
            <button
              type="button"
              onClick={handleAccept}
              disabled={actionLoading}
              className="rounded-xl bg-[#8B2424] px-6 py-2.5 text-xs font-bold text-white hover:bg-[#721c1c] disabled:opacity-50 shadow-sm transition cursor-pointer"
            >
              {actionLoading ? 'Processing...' : 'Accept Proposal & Confirm'}
            </button>
          </div>
        )}

        {/* Rejection Modal */}
        {showRejectModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl space-y-4">
              <h3 className="text-sm font-bold text-slate-900">Decline Proposal</h3>
              <p className="text-xs text-slate-500">
                Please provide a brief reason for declining (minimum 10 characters).
              </p>

              <form onSubmit={handleRejectSubmit} className="space-y-4">
                <textarea
                  rows={3}
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  placeholder="e.g. Budget constraints, campaign dates changed..."
                  className="w-full rounded-xl border border-slate-200 p-2.5 text-xs text-slate-900 outline-none focus:border-[#8B2424]"
                  required
                />

                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowRejectModal(false)}
                    className="rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={actionLoading}
                    className="rounded-xl bg-rose-600 px-4 py-1.5 text-xs font-bold text-white hover:bg-rose-700 disabled:opacity-50"
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
