'use client';

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { quotationsApi } from '@/modules/quotations/api';
import { api } from '@/shared/api/client';
import { sessionStore } from '@/shared/auth/session-store';
import type { Quotation } from '@/modules/quotations/types';

export default function QuotationDetailPage() {
  const params = useParams<{ id?: string | string[] }>();
  const id = Array.isArray(params?.id) ? params.id[0] : params?.id ?? '';

  const [quotation, setQuotation] = useState<Quotation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Send modal state
  const [showSendModal, setShowSendModal] = useState(false);
  const [recipientEmail, setRecipientEmail] = useState('');
  const [sendLoading, setSendLoading] = useState(false);
  const [publicUrl, setPublicUrl] = useState<string | null>(null);

  // Edit modal state
  const [showEditModal, setShowEditModal] = useState(false);
  const [editClientName, setEditClientName] = useState('');
  const [editClientEmail, setEditClientEmail] = useState('');
  const [editClientPhone, setEditClientPhone] = useState('');
  const [editValidUntil, setEditValidUntil] = useState('');
  const [editLineItems, setEditLineItems] = useState<{
    siteId: string;
    description: string;
    ratePerDay: number;
    startDate: string;
    endDate: string;
  }[]>([]);
  const [availableSites, setAvailableSites] = useState<{ _id: string; siteCode: string; city?: string }[]>([]);
  const [editSaving, setEditSaving] = useState(false);

  // PDF state
  const [pdfLoading, setPdfLoading] = useState(false);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function withAuthToken(rawUrl: string): string {
    if (!rawUrl) return '';
    const token = sessionStore.getAccessToken();
    if (token && rawUrl.startsWith('/api/files/')) {
      const separator = rawUrl.includes('?') ? '&' : '?';
      return `${rawUrl}${separator}token=${encodeURIComponent(token)}`;
    }
    return rawUrl;
  }

  useEffect(() => {
    if (id) fetchQuotation();
  }, [id]);

  async function fetchQuotation() {
    try {
      setLoading(true);
      setError(null);
      const q = await quotationsApi.getById(id);
      setQuotation(q);
      setRecipientEmail(q.clientEmail || '');

      if (q.pdfKey) {
        loadPdfUrl();
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to load quotation');
    } finally {
      setLoading(false);
    }
  }

  async function openEditModal() {
    if (!quotation) return;
    setEditClientName(quotation.clientName || '');
    setEditClientEmail(quotation.clientEmail || '');
    setEditClientPhone(quotation.clientPhone || '');
    setEditValidUntil(
      quotation.validUntil ? new Date(quotation.validUntil).toISOString().slice(0, 10) : ''
    );
    setEditLineItems(
      quotation.sites.map((s) => ({
        siteId: typeof s.siteId === 'object' && s.siteId ? (s.siteId as any)._id : String(s.siteId),
        description: s.description || '',
        ratePerDay: s.ratePerDay / 100,
        startDate: new Date(s.startDate).toISOString().slice(0, 10),
        endDate: new Date(s.endDate).toISOString().slice(0, 10),
      }))
    );

    try {
      const res = await api.get<{ data?: any[]; sites?: any[] }>('/api/sites?limit=100').catch(() => ({ data: [], sites: [] }));
      const loaded = (res as any).data || res.sites || [];
      setAvailableSites(loaded);
    } catch {
      // ignore
    }

    setShowEditModal(true);
  }

  function handleLineItemChange(index: number, field: string, value: any) {
    setEditLineItems((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  }

  function addEditLineItem() {
    const defaultSiteId = availableSites.length > 0
      ? availableSites[0]._id
      : (quotation?.sites[0]?.siteId
        ? (typeof quotation.sites[0].siteId === 'object'
          ? (quotation.sites[0].siteId as any)._id
          : String(quotation.sites[0].siteId))
        : '');
    const today = new Date().toISOString().slice(0, 10);
    const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    setEditLineItems((prev) => [
      ...prev,
      {
        siteId: defaultSiteId,
        description: '',
        ratePerDay: 1000,
        startDate: today,
        endDate: nextWeek,
      },
    ]);
  }

  function removeEditLineItem(index: number) {
    if (editLineItems.length <= 1) {
      alert('Quotation must have at least one media site line item.');
      return;
    }
    setEditLineItems((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleEditSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (editLineItems.length === 0) {
      alert('At least one site is required');
      return;
    }

    try {
      setEditSaving(true);
      const updated = await quotationsApi.update(id, {
        clientName: editClientName.trim() || undefined,
        clientEmail: editClientEmail.trim() || undefined,
        clientPhone: editClientPhone.trim() || undefined,
        validUntil: editValidUntil ? new Date(editValidUntil).toISOString() : undefined,
        sites: editLineItems.map((item) => ({
          siteId: item.siteId,
          description: item.description,
          ratePerDay: Number(item.ratePerDay),
          startDate: item.startDate,
          endDate: item.endDate,
        })),
      });
      setQuotation(updated);
      setShowEditModal(false);
      loadPdfUrl();
      alert('Quotation updated successfully!');
    } catch (err: any) {
      alert(err.message || 'Failed to update quotation');
    } finally {
      setEditSaving(false);
    }
  }

  async function loadPdfUrl() {
    try {
      const res = await quotationsApi.getPdfUrl(id);
      setPdfUrl(withAuthToken(res.pdfUrl));
    } catch (err) {
      console.error(err);
    }
  }

  async function handleGeneratePdf() {
    try {
      setPdfLoading(true);
      const res = await quotationsApi.generatePdf(id);
      setPdfUrl(withAuthToken(res.pdfUrl));
      if (quotation) {
        setQuotation({ ...quotation, pdfKey: res.pdfKey });
      }
    } catch (err: any) {
      alert(err.message || 'PDF generation failed');
    } finally {
      setPdfLoading(false);
    }
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type !== 'application/pdf') {
      alert('Please select a valid PDF file');
      return;
    }

    try {
      setUploadLoading(true);
      const res = await quotationsApi.uploadPdf(id, file);
      setPdfUrl(withAuthToken(res.pdfUrl));
      if (quotation) {
        setQuotation({ ...quotation, pdfKey: res.pdfKey });
      }
      alert('Custom proposal PDF uploaded successfully!');
    } catch (err: any) {
      alert(err.message || 'Failed to upload PDF');
    } finally {
      setUploadLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  async function handleSendSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!recipientEmail.trim()) return;

    try {
      setSendLoading(true);
      const res = await quotationsApi.send(id, recipientEmail.trim());
      setQuotation(res.quotation);
      setPublicUrl(window.location.origin + res.publicUrl);
    } catch (err: any) {
      alert(err.message || 'Failed to send proposal');
    } finally {
      setSendLoading(false);
    }
  }

  function formatRupees(paise: number): string {
    return `₹${(paise / 100).toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })}`;
  }

  if (loading) {
    return <div className="p-8 text-center text-slate-500">Loading quotation details...</div>;
  }

  if (error || !quotation) {
    return (
      <div className="p-8 text-center text-rose-600">
        {error || 'Quotation not found'}
      </div>
    );
  }

  const leadInfo = typeof quotation.leadId === 'object' ? quotation.leadId : null;
  const clientDisplayName = quotation.clientName || leadInfo?.companyName || 'Valued Client';

  return (
    <div className="space-y-6">
      {/* Hidden PDF file input */}
      <input
        type="file"
        ref={fileInputRef}
        accept="application/pdf"
        className="hidden"
        onChange={handleFileUpload}
      />

      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold text-slate-900 dark:text-white">
              {quotation.quoteNumber}
            </h1>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-800 dark:bg-slate-800 dark:text-slate-200">
              {quotation.status}
            </span>
          </div>
          <p className="text-sm text-slate-500">
            Created for <span className="font-medium text-slate-900 dark:text-white">{clientDisplayName}</span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link
            href="/quotations"
            className="rounded border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            Back
          </Link>
          {quotation.status === 'Draft' && (
            <button
              type="button"
              onClick={openEditModal}
              className="rounded border border-[#8B2424] bg-white px-3 py-1.5 text-xs font-semibold text-[#8B2424] hover:bg-[#8B2424] hover:text-white transition shadow-sm dark:bg-slate-800"
            >
              ✏️ Edit Quotation
            </button>
          )}

          <button
            type="button"
            onClick={handleGeneratePdf}
            disabled={pdfLoading || uploadLoading}
            className="rounded bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {pdfLoading ? 'Generating PDF...' : quotation.pdfKey ? 'Regenerate PDF' : 'Generate PDF'}
          </button>

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadLoading || pdfLoading}
            className="rounded border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
          >
            {uploadLoading ? 'Uploading...' : '📤 Upload Custom PDF'}
          </button>

          {pdfUrl && (
            <a
              href={pdfUrl}
              target="_blank"
              rel="noreferrer"
              className="rounded border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 dark:border-indigo-800 dark:bg-indigo-950 dark:text-indigo-300"
            >
              📄 View PDF
            </a>
          )}

          <button
            type="button"
            onClick={() => setShowSendModal(true)}
            className="rounded bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700"
          >
            Send Proposal
          </button>
        </div>
      </div>

      {/* Main Details Grid */}
      <div className="grid gap-6 md:grid-cols-3">
        {/* Left Column (2 spans) */}
        <div className="space-y-6 md:col-span-2">
          {/* Sites & Line Items Table */}
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <h2 className="mb-4 text-base font-semibold text-slate-900 dark:text-white">Selected Media Sites</h2>
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-xs">
                <thead className="border-b border-slate-200 bg-slate-50 font-semibold text-slate-700 dark:border-slate-800 dark:bg-slate-800 dark:text-slate-300">
                  <tr>
                    <th className="p-2">Site / Code</th>
                    <th className="p-2">Dates</th>
                    <th className="p-2 text-right">Days</th>
                    <th className="p-2 text-right">Rate/Day</th>
                    <th className="p-2 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {quotation.sites.map((line, idx) => {
                    const siteObj = typeof line.siteId === 'object' ? line.siteId : null;
                    const code = siteObj?.siteCode || 'Outdoor Site';
                    const city = siteObj?.city || '';

                    return (
                      <tr key={idx}>
                        <td className="p-2 font-medium text-slate-900 dark:text-white">
                          {code} {city && <span className="text-slate-400">({city})</span>}
                        </td>
                        <td className="p-2 text-slate-500">
                          {new Date(line.startDate).toLocaleDateString('en-IN')} -{' '}
                          {new Date(line.endDate).toLocaleDateString('en-IN')}
                        </td>
                        <td className="p-2 text-right">{line.days}</td>
                        <td className="p-2 text-right">{formatRupees(line.ratePerDay)}</td>
                        <td className="p-2 text-right font-semibold text-slate-900 dark:text-white">
                          {formatRupees(line.amount)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* PDF Viewer Block */}
          {pdfUrl && (
            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-base font-semibold text-slate-900 dark:text-white">Proposal PDF Preview</h2>
                <a
                  href={pdfUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs font-semibold text-blue-600 hover:underline dark:text-blue-400"
                >
                  Open PDF in New Tab
                </a>
              </div>
              <iframe src={pdfUrl} className="h-96 w-full rounded border border-slate-200 dark:border-slate-800" />
            </div>
          )}
        </div>

        {/* Right Column: Financial Summary & Timeline */}
        <div className="space-y-6">
          {/* Financial Breakdown */}
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <h2 className="mb-4 text-base font-semibold text-slate-900 dark:text-white">Financial Breakdown</h2>
            <div className="space-y-2 text-xs">
              <div className="flex justify-between">
                <span className="text-slate-500">Subtotal</span>
                <span className="font-medium text-slate-900 dark:text-white">{formatRupees(quotation.subtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">GST (18%)</span>
                <span className="font-medium text-slate-900 dark:text-white">{formatRupees(quotation.taxAmount)}</span>
              </div>
              <div className="border-t border-slate-200 pt-2 dark:border-slate-800 flex justify-between text-sm font-semibold">
                <span className="text-slate-900 dark:text-white">Total Amount</span>
                <span className="text-emerald-600 dark:text-emerald-400">{formatRupees(quotation.total)}</span>
              </div>
            </div>
          </div>

          {/* Proposal Tracking Timeline (B3) */}
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
            <h2 className="mb-4 text-base font-semibold text-slate-900 dark:text-white">Tracking Timeline</h2>
            <div className="space-y-3 text-xs">
              <div>
                <span className="font-semibold text-slate-900 dark:text-white">Created:</span>{' '}
                {quotation.createdAt ? new Date(quotation.createdAt).toLocaleString('en-IN') : '-'}
              </div>
              <div>
                <span className="font-semibold text-slate-900 dark:text-white">Sent At:</span>{' '}
                {quotation.sentAt ? new Date(quotation.sentAt).toLocaleString('en-IN') : 'Not sent yet'}
              </div>
              <div>
                <span className="font-semibold text-slate-900 dark:text-white">First Viewed:</span>{' '}
                {quotation.viewedAt ? new Date(quotation.viewedAt).toLocaleString('en-IN') : 'Not viewed'}
              </div>
              <div>
                <span className="font-semibold text-slate-900 dark:text-white">Status Decision:</span>{' '}
                {quotation.acceptedAt
                  ? `Accepted on ${new Date(quotation.acceptedAt).toLocaleString('en-IN')}`
                  : quotation.rejectedAt
                    ? `Rejected on ${new Date(quotation.rejectedAt).toLocaleString('en-IN')}`
                    : 'Awaiting decision'}
              </div>
              {quotation.rejectionReason && (
                <div className="rounded bg-rose-50 p-2 text-rose-800 dark:bg-rose-950 dark:text-rose-300">
                  <span className="font-semibold">Reason:</span> {quotation.rejectionReason}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Edit Quotation Modal */}
      {showEditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 overflow-y-auto">
          <div className="w-full max-w-2xl rounded-xl bg-white p-6 shadow-xl dark:bg-slate-900 my-8 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4 border-b border-slate-100 pb-3 dark:border-slate-800">
              <div>
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                  Edit Quotation ({quotation.quoteNumber})
                </h2>
                <p className="text-xs text-slate-500">
                  Update rates, campaign dates, sites, or client info.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowEditModal(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-semibold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="space-y-4">
              {/* Client Info Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="font-medium text-slate-700 dark:text-slate-300">Client / Company Name</label>
                  <input
                    type="text"
                    value={editClientName}
                    onChange={(e) => setEditClientName(e.target.value)}
                    className="mt-1 w-full rounded border border-slate-300 bg-white p-2 text-xs dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                  />
                </div>
                <div>
                  <label className="font-medium text-slate-700 dark:text-slate-300">Client Email</label>
                  <input
                    type="email"
                    value={editClientEmail}
                    onChange={(e) => setEditClientEmail(e.target.value)}
                    className="mt-1 w-full rounded border border-slate-300 bg-white p-2 text-xs dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                  />
                </div>
                <div>
                  <label className="font-medium text-slate-700 dark:text-slate-300">Client Phone</label>
                  <input
                    type="text"
                    value={editClientPhone}
                    onChange={(e) => setEditClientPhone(e.target.value)}
                    className="mt-1 w-full rounded border border-slate-300 bg-white p-2 text-xs dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                  />
                </div>
                <div>
                  <label className="font-medium text-slate-700 dark:text-slate-300">Valid Until Date</label>
                  <input
                    type="date"
                    value={editValidUntil}
                    onChange={(e) => setEditValidUntil(e.target.value)}
                    className="mt-1 w-full rounded border border-slate-300 bg-white p-2 text-xs dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                  />
                </div>
              </div>

              {/* Line items header */}
              <div className="border-t border-slate-200 pt-3 dark:border-slate-800">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-600 dark:text-slate-400">
                    Media Sites & Daily Rates
                  </h3>
                  <button
                    type="button"
                    onClick={addEditLineItem}
                    className="text-xs font-semibold text-[#8B2424] hover:underline"
                  >
                    + Add Another Site
                  </button>
                </div>

                <div className="space-y-3">
                  {editLineItems.map((item, idx) => (
                    <div
                      key={idx}
                      className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs dark:border-slate-800 dark:bg-slate-800/50 space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-slate-700 dark:text-slate-300">Site #{idx + 1}</span>
                        {editLineItems.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeEditLineItem(idx)}
                            className="text-[11px] text-rose-600 hover:underline font-medium"
                          >
                            Remove
                          </button>
                        )}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        <div>
                          <label className="text-[11px] text-slate-500">Select Media Site</label>
                          <select
                            value={item.siteId}
                            onChange={(e) => handleLineItemChange(idx, 'siteId', e.target.value)}
                            className="mt-1 w-full rounded border border-slate-300 bg-white p-1.5 text-xs dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                          >
                            {availableSites.map((s) => (
                              <option key={s._id} value={s._id}>
                                {s.siteCode} {s.city ? `(${s.city})` : ''}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="text-[11px] text-slate-500">Daily Rate (₹ Rupees)</label>
                          <input
                            type="number"
                            min="0"
                            step="1"
                            value={item.ratePerDay}
                            onChange={(e) => handleLineItemChange(idx, 'ratePerDay', Number(e.target.value))}
                            className="mt-1 w-full rounded border border-slate-300 bg-white p-1.5 text-xs dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                          />
                        </div>
                        <div>
                          <label className="text-[11px] text-slate-500">Start Date</label>
                          <input
                            type="date"
                            value={item.startDate}
                            onChange={(e) => handleLineItemChange(idx, 'startDate', e.target.value)}
                            className="mt-1 w-full rounded border border-slate-300 bg-white p-1.5 text-xs dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                          />
                        </div>
                        <div>
                          <label className="text-[11px] text-slate-500">End Date</label>
                          <input
                            type="date"
                            value={item.endDate}
                            onChange={(e) => handleLineItemChange(idx, 'endDate', e.target.value)}
                            className="mt-1 w-full rounded border border-slate-300 bg-white p-1.5 text-xs dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex items-center justify-end gap-2 pt-4 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="rounded border border-slate-300 px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editSaving}
                  className="rounded bg-[#8B2424] px-5 py-2 text-xs font-semibold text-white hover:bg-[#6E1D1D] disabled:opacity-50 shadow-sm"
                >
                  {editSaving ? 'Saving Changes...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Send Proposal Modal */}
      {showSendModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl dark:bg-slate-900">
            <h2 className="mb-2 text-lg font-semibold text-slate-900 dark:text-white">Send Proposal to Client</h2>
            <p className="mb-4 text-xs text-slate-500">
              Generates a cryptographically random 32-character tracking token for public viewing.
            </p>

            <form onSubmit={handleSendSubmit} className="space-y-4">
              <label className="block text-xs font-medium text-slate-700 dark:text-slate-300">
                Recipient Email *
                <input
                  type="email"
                  value={recipientEmail}
                  onChange={(e) => setRecipientEmail(e.target.value)}
                  className="mt-1 w-full rounded border border-slate-300 bg-white p-2 text-xs text-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                  required
                />
              </label>

              {publicUrl && (
                <div className="rounded bg-emerald-50 p-3 text-xs text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                  <p className="font-semibold">Proposal Sent!</p>
                  <p className="mt-1 font-mono text-[11px] break-all">{publicUrl}</p>
                  <a
                    href={publicUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-2 inline-block font-semibold underline"
                  >
                    Test Client View $\rightarrow$
                  </a>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowSendModal(false)}
                  className="rounded border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                >
                  Close
                </button>
                <button
                  type="submit"
                  disabled={sendLoading}
                  className="rounded bg-emerald-600 px-4 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                >
                  {sendLoading ? 'Sending...' : 'Confirm & Send'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
