'use client';

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { quotationsApi } from '@/modules/quotations/api';
import { api } from '@/shared/api/client';
import { sessionStore } from '@/shared/auth/session-store';
import { DatePicker, Dropdown, SiteSearchSelect, SignatureInput } from '@/shared/ui';
import type { Quotation } from '@/modules/quotations/types';
import { Pencil, Upload, FileText, X, Download, ArrowLeft, Mail, RefreshCw, CreditCard, Plus, Trash2, CheckCircle2 } from 'lucide-react';

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
  const [editClientContactPerson, setEditClientContactPerson] = useState('');
  const [editClientEmail, setEditClientEmail] = useState('');
  const [editClientPhone, setEditClientPhone] = useState('');
  const [editClientGstin, setEditClientGstin] = useState('');
  const [editClientAddress, setEditClientAddress] = useState('');
  const [editClientCity, setEditClientCity] = useState('');
  const [editClientState, setEditClientState] = useState('');
  const [editIsInterState, setEditIsInterState] = useState(false);
  const [editTaxPercent, setEditTaxPercent] = useState<number>(18);
  const [editIsManualTaxAmount, setEditIsManualTaxAmount] = useState<boolean>(false);
  const [editManualTaxAmount, setEditManualTaxAmount] = useState<string>('');
  const [editNotes, setEditNotes] = useState('');
  const [editValidUntil, setEditValidUntil] = useState('');
  const [editLineItems, setEditLineItems] = useState<{
    siteId: string;
    description: string;
    ratePerDay: number;
    discountPercent: number;
    taxPercent: number;
    startDate: string;
    endDate: string;
  }[]>([]);
  const [availableSites, setAvailableSites] = useState<{ _id: string; siteCode: string; city?: string }[]>([]);
  const [editSaving, setEditSaving] = useState(false);

  // Edit Bank Details & Terms state
  const [editShowBankDetails, setEditShowBankDetails] = useState<boolean>(true);
  const [editBankName, setEditBankName] = useState('HDFC Bank');
  const [editAccountName, setEditAccountName] = useState('Media Octus Private Limited');
  const [editAccountNumber, setEditAccountNumber] = useState('50200012345678');
  const [editIfscCode, setEditIfscCode] = useState('HDFC0001234');
  const [editBranch, setEditBranch] = useState('Vijay Nagar Branch, Indore');
  const [editTermsList, setEditTermsList] = useState<string[]>([
    'Gst applicable .',
    'for any query please feel free to call or message any time .',
    '100%Payment in Advance.',
    'please visit https://www.mediaoctus.com.',
  ]);

  // Edit Signature State
  const [editShowSignature, setEditShowSignature] = useState<boolean>(true);
  const [editSignatureImage, setEditSignatureImage] = useState<string | undefined>(undefined);
  const [editSignatoryName, setEditSignatoryName] = useState<string>('Rishabh Jain');
  const [editSignatoryDesignation, setEditSignatoryDesignation] = useState<string>('Authorized Signatory');

  function handleEditAddCondition() {
    setEditTermsList((prev) => [...prev, '']);
  }

  function handleEditUpdateCondition(index: number, val: string) {
    setEditTermsList((prev) => prev.map((item, i) => (i === index ? val : item)));
  }

  function handleEditRemoveCondition(index: number) {
    setEditTermsList((prev) => prev.filter((_, i) => i !== index));
  }

  // PDF state
  const [pdfLoading, setPdfLoading] = useState(false);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [downloadLoading, setDownloadLoading] = useState(false);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleDownloadPdf() {
    if (!pdfUrl) return;
    try {
      setDownloadLoading(true);
      const filename = `${quotation?.quoteNumber || 'Quotation'}.pdf`;
      const res = await fetch(pdfUrl);
      if (!res.ok) throw new Error('Failed to fetch file');
      const blob = await res.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch (err) {
      console.error('Download error:', err);
      const separator = pdfUrl.includes('?') ? '&' : '?';
      window.open(`${pdfUrl}${separator}download=1&filename=${encodeURIComponent(quotation?.quoteNumber || 'Quotation')}.pdf`, '_blank');
    } finally {
      setDownloadLoading(false);
    }
  }

  function withAuthToken(rawUrl: string): string {
    if (!rawUrl) return '';
    const token = sessionStore.getAccessToken();
    if (token && (rawUrl.startsWith('/api/files/') || rawUrl.includes('/api/files/')) && !rawUrl.includes('token=')) {
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
    setEditClientContactPerson(quotation.clientContactPerson || '');
    setEditClientEmail(quotation.clientEmail || '');
    setEditClientPhone(quotation.clientPhone || '');
    setEditClientGstin(quotation.clientGstin || '');
    setEditClientAddress(quotation.clientAddress || '');
    setEditClientCity(quotation.clientCity || '');
    setEditClientState(quotation.clientState || '');
    setEditIsInterState(quotation.isInterState ?? false);
    const taxRate = quotation.taxPercent !== undefined ? quotation.taxPercent : 18;
    setEditTaxPercent(taxRate);

    // If quotation has an explicit taxAmount that differs significantly from subtotal * rate
    const calculatedTaxPaise = Math.round(((quotation.subtotal || 0) * taxRate) / 100);
    const hasManualTax = quotation.taxAmount !== undefined && Math.abs(quotation.taxAmount - calculatedTaxPaise) > 100;
    setEditIsManualTaxAmount(hasManualTax);
    setEditManualTaxAmount(quotation.taxAmount !== undefined ? String(Math.round(quotation.taxAmount / 100)) : '');

    setEditNotes(quotation.notes || '');
    if (quotation.bankDetails) {
      setEditShowBankDetails(true);
      setEditBankName(quotation.bankDetails.bankName || 'HDFC Bank');
      setEditAccountName(quotation.bankDetails.accountName || 'Media Octus Private Limited');
      setEditAccountNumber(quotation.bankDetails.accountNumber || '50200012345678');
      setEditIfscCode(quotation.bankDetails.ifscCode || 'HDFC0001234');
      setEditBranch(quotation.bankDetails.branch || 'Vijay Nagar Branch, Indore');
    } else {
      setEditShowBankDetails(false);
    }

    if (quotation.terms && quotation.terms.length > 0) {
      setEditTermsList(quotation.terms);
    } else {
      setEditTermsList([
        'Gst applicable .',
        'for any query please feel free to call or message any time .',
        '100%Payment in Advance.',
        'please visit https://www.mediaoctus.com.',
      ]);
    }
    setEditSignatureImage(quotation.signatureImage || undefined);
    setEditSignatoryName(quotation.signatoryName || 'Rishabh Jain');
    setEditSignatoryDesignation(quotation.signatoryDesignation || 'Authorized Signatory');
    setEditShowSignature(Boolean(quotation.signatureImage || quotation.signatoryName));
    setEditValidUntil(
      quotation.validUntil ? new Date(quotation.validUntil).toISOString().slice(0, 10) : ''
    );
    setEditLineItems(
      quotation.sites.map((s) => ({
        siteId: typeof s.siteId === 'object' && s.siteId ? (s.siteId as any)._id : String(s.siteId),
        description: s.description || '',
        ratePerDay: s.ratePerDay / 100,
        discountPercent: s.discountPercent ?? 0,
        taxPercent: s.taxPercent ?? 18,
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
        discountPercent: 0,
        taxPercent: 18,
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
      const editSubtotal = editLineItems.reduce((acc, it) => {
        const s = new Date(it.startDate).getTime();
        const eTime = new Date(it.endDate).getTime();
        const d = Math.max(1, Math.round((eTime - s) / 86400000) + 1);
        const base = d * Number(it.ratePerDay || 0);
        const disc = Number(it.discountPercent || 0);
        return acc + Math.max(0, base - (base * disc) / 100);
      }, 0);
      const editTax = editLineItems.reduce((acc, it) => {
        const s = new Date(it.startDate).getTime();
        const eTime = new Date(it.endDate).getTime();
        const d = Math.max(1, Math.round((eTime - s) / 86400000) + 1);
        const base = d * Number(it.ratePerDay || 0);
        const disc = Number(it.discountPercent || 0);
        const net = Math.max(0, base - (base * disc) / 100);
        return acc + (net * Number(it.taxPercent ?? 18)) / 100;
      }, 0);
      const effectiveTaxRate = editSubtotal > 0 ? Math.round((editTax / editSubtotal) * 100) : 18;

      const updated = await quotationsApi.update(id, {
        clientName: editClientName.trim() || undefined,
        clientContactPerson: editClientContactPerson.trim() || undefined,
        clientEmail: editClientEmail.trim() || undefined,
        clientPhone: editClientPhone.trim() || undefined,
        clientGstin: editClientGstin.trim() || undefined,
        clientAddress: editClientAddress.trim() || undefined,
        clientCity: editClientCity.trim() || undefined,
        clientState: editClientState.trim() || undefined,
        isInterState: editIsInterState,
        taxPercent: effectiveTaxRate,
        taxAmount: Math.round(editTax),
        notes: editNotes.trim() || undefined,
        terms: editTermsList.map((t) => t.trim()).filter(Boolean),
        bankDetails: editShowBankDetails ? {
          bankName: editBankName.trim(),
          accountName: editAccountName.trim(),
          accountNumber: editAccountNumber.trim(),
          ifscCode: editIfscCode.trim(),
          branch: editBranch.trim(),
        } : undefined,
        signatureImage: editShowSignature ? editSignatureImage : undefined,
        signatoryName: editShowSignature ? (editSignatoryName.trim() || undefined) : undefined,
        signatoryDesignation: editShowSignature ? (editSignatoryDesignation.trim() || undefined) : undefined,
        validUntil: editValidUntil ? new Date(editValidUntil).toISOString() : undefined,
        sites: editLineItems.map((item) => ({
          siteId: item.siteId,
          description: item.description,
          ratePerDay: Number(item.ratePerDay),
          discountPercent: Number(item.discountPercent || 0),
          taxPercent: Number(item.taxPercent ?? 18),
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

      {/* Top Breadcrumb & Quick Info */}
      <div className="flex items-center justify-between">
        <Link
          href="/quotations"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-[#6A1B21] transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Quotations</span>
        </Link>

        {quotation.validUntil && (
          <div className="text-xs text-slate-400">
            Valid Until:{' '}
            <span className="font-semibold text-slate-700 dark:text-slate-300">
              {new Date(quotation.validUntil).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
            </span>
          </div>
        )}
      </div>

      {/* Main Header Card with Balanced Action Toolbar */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between rounded-xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white whitespace-nowrap">
              {quotation.quoteNumber}
            </h1>
            <span
              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${
                quotation.status === 'Accepted'
                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                  : quotation.status === 'Sent'
                    ? 'bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                    : quotation.status === 'Rejected'
                      ? 'bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300'
                      : 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300'
              }`}
            >
              {quotation.status}
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Created for <span className="font-semibold text-slate-800 dark:text-slate-200">{clientDisplayName}</span>
          </p>
        </div>

        {/* Cohesive Action Toolbar */}
        <div className="flex flex-wrap items-center justify-start lg:justify-end gap-2">
          {/* Edit Action (Draft only) */}
          {quotation.status === 'Draft' && (
            <button
              type="button"
              onClick={openEditModal}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#6A1B21]/30 bg-white px-3 py-1.5 text-xs font-semibold text-[#6A1B21] hover:bg-[#6A1B21]/10 transition shadow-2xs dark:bg-slate-800"
            >
              <Pencil className="w-3.5 h-3.5 shrink-0" />
              <span>Edit Quotation</span>
            </button>
          )}

          {/* PDF View & Download Actions */}
          {pdfUrl && (
            <>
              <a
                href={pdfUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition shadow-2xs dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              >
                <FileText className="w-3.5 h-3.5 shrink-0 text-slate-500" />
                <span>View PDF</span>
              </a>

              <button
                type="button"
                onClick={handleDownloadPdf}
                disabled={downloadLoading}
                className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition shadow-2xs dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                title="Download PDF directly to computer"
              >
                <Download className={`w-3.5 h-3.5 shrink-0 text-slate-500 ${downloadLoading ? 'animate-bounce' : ''}`} />
                <span>{downloadLoading ? 'Downloading...' : 'Download'}</span>
              </button>
            </>
          )}

          {/* Regenerate / Upload */}
          <button
            type="button"
            onClick={handleGeneratePdf}
            disabled={pdfLoading || uploadLoading}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition shadow-2xs dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
          >
            <RefreshCw className={`w-3.5 h-3.5 shrink-0 text-slate-500 ${pdfLoading ? 'animate-spin' : ''}`} />
            <span>{pdfLoading ? 'Generating...' : quotation.pdfKey ? 'Regenerate' : 'Generate PDF'}</span>
          </button>

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadLoading || pdfLoading}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 transition shadow-2xs dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
          >
            <Upload className="w-3.5 h-3.5 shrink-0 text-slate-500" />
            <span>{uploadLoading ? 'Uploading...' : 'Upload PDF'}</span>
          </button>

          {/* Primary High-Priority CTA: Send Proposal */}
          <button
            type="button"
            onClick={() => setShowSendModal(true)}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-1.5 text-xs font-bold text-white hover:bg-emerald-700 shadow-sm transition shrink-0 ml-1"
          >
            <Mail className="w-3.5 h-3.5 shrink-0" />
            <span>Send Proposal</span>
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
                    <th className="p-2 text-right">Disc (%)</th>
                    <th className="p-2 text-right">Tax</th>
                    <th className="p-2 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {quotation.sites.map((line, idx) => {
                    const siteObj = typeof line.siteId === 'object' ? line.siteId : null;
                    const code = siteObj?.code || siteObj?.siteCode || 'Outdoor Site';
                    const city = siteObj?.city || '';

                    return (
                      <tr key={idx}>
                        <td className="p-2 font-medium text-slate-900 dark:text-white">
                          <div>
                            {code} {city && <span className="text-slate-400">({city})</span>}
                          </div>
                          {line.description && (
                            <div className="text-[11px] text-slate-500 dark:text-slate-400 font-normal">
                              {line.description}
                            </div>
                          )}
                        </td>
                        <td className="p-2 text-slate-500">
                          {new Date(line.startDate).toLocaleDateString('en-IN')} -{' '}
                          {new Date(line.endDate).toLocaleDateString('en-IN')}
                        </td>
                        <td className="p-2 text-right">{line.days}</td>
                        <td className="p-2 text-right">{formatRupees(line.ratePerDay)}</td>
                        <td className="p-2 text-right text-emerald-600 font-medium">
                          {line.discountPercent ? `${line.discountPercent}%` : '-'}
                        </td>
                        <td className="p-2 text-right text-slate-600 dark:text-slate-400">
                          {line.taxPercent !== undefined ? `${line.taxPercent}%` : '18%'}
                        </td>
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

          {/* Bank Details & Terms and Conditions Section (50/50 Balanced Pair) */}
          <div className="grid gap-6 sm:grid-cols-2">
            {/* Bank Details View */}
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-center gap-2 border-b border-slate-100 pb-3 dark:border-slate-800 mb-3 text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-white">
                <CreditCard className="w-4 h-4 text-[#6A1B21]" />
                <span>Bank Details</span>
              </div>
              {quotation.bankDetails ? (
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Bank Name:</span>
                    <span className="font-semibold text-slate-800 dark:text-white">{quotation.bankDetails.bankName || '-'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Account Name:</span>
                    <span className="font-semibold text-slate-800 dark:text-white">{quotation.bankDetails.accountName || '-'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Account No:</span>
                    <span className="font-semibold text-slate-800 dark:text-white">{quotation.bankDetails.accountNumber || '-'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">IFSC Code:</span>
                    <span className="font-semibold text-slate-800 dark:text-white">{quotation.bankDetails.ifscCode || '-'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Branch:</span>
                    <span className="font-semibold text-slate-800 dark:text-white">{quotation.bankDetails.branch || '-'}</span>
                  </div>
                </div>
              ) : (
                <div className="text-xs text-slate-400 italic">No bank details attached to this proposal.</div>
              )}
            </div>

            {/* Terms & Conditions View */}
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-center gap-1.5 border-b border-slate-100 pb-3 dark:border-slate-800 mb-3 text-xs font-bold uppercase tracking-wider text-[#6A1B21]">
                <span>+</span>
                <span>Terms & Conditions</span>
              </div>
              {quotation.terms && quotation.terms.length > 0 ? (
                <ol className="space-y-1.5 text-xs text-slate-600 dark:text-slate-300 list-decimal list-inside">
                  {quotation.terms.map((t, idx) => (
                    <li key={idx} className="leading-relaxed">{t}</li>
                  ))}
                </ol>
              ) : (
                <div className="text-xs text-slate-400 italic">Standard proposal terms apply.</div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Financial Summary, Signatory & Timeline */}
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
                <span className="text-slate-500">
                  {quotation.taxPercent !== undefined
                    ? quotation.isInterState
                      ? `IGST (${quotation.taxPercent}%)`
                      : `GST (${quotation.taxPercent}%)`
                    : 'GST (18%)'}
                </span>
                <span className="font-medium text-slate-900 dark:text-white">{formatRupees(quotation.taxAmount)}</span>
              </div>
              <div className="border-t border-slate-200 pt-2 dark:border-slate-800 flex justify-between text-sm font-semibold">
                <span className="text-slate-900 dark:text-white">Total Amount</span>
                <span className="text-emerald-600 dark:text-emerald-400">{formatRupees(quotation.total)}</span>
              </div>
            </div>
          </div>

          {/* Authorized Signatory & Stamp Card */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800 mb-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800 dark:text-white">
                Authorized Signatory & Stamp
              </h3>
              {quotation.signatureImage ? (
                <span className="inline-flex items-center gap-1 rounded bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
                  <CheckCircle2 className="w-3 h-3" />
                  <span>E-Signature Attached</span>
                </span>
              ) : (
                <span className="text-[10px] text-slate-400">Default Signatory</span>
              )}
            </div>
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs font-semibold text-slate-800 dark:text-slate-200 truncate">
                  {quotation.signatoryName || 'Authorized Signatory'}
                </p>
                <p className="text-[11px] text-slate-500">
                  {quotation.signatoryDesignation || 'Authorized Signatory'}
                </p>
                <p className="text-[10px] text-slate-400">Media Octus Private Limited</p>
              </div>
              {quotation.signatureImage && (
                <div className="h-10 w-24 shrink-0 rounded border border-dashed border-slate-300 bg-slate-50 p-1 flex items-center justify-center dark:border-slate-700 dark:bg-slate-950">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={quotation.signatureImage}
                    alt="Signature"
                    className="max-h-8 max-w-full object-contain"
                  />
                </div>
              )}
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

      {/* PDF Viewer Block (Full-Width Bottom Section) */}
      {pdfUrl && (
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">Proposal PDF Preview</h2>
              <p className="text-xs text-slate-400">Official enterprise document generated with digital signature and GST billing details.</p>
            </div>
            <a
              href={pdfUrl}
              target="_blank"
              rel="noreferrer"
              className="text-xs font-semibold text-[#8B2424] hover:underline dark:text-[#E8929A]"
            >
              Open PDF in New Tab
            </a>
          </div>
          <iframe src={pdfUrl} className="h-[580px] w-full rounded-lg border border-slate-200 dark:border-slate-800" />
        </div>
      )}

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
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors p-1"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="space-y-4">
              {/* Client Info Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div>
                  <label className="font-medium text-slate-700 dark:text-slate-300">Client / Company Name *</label>
                  <input
                    type="text"
                    value={editClientName}
                    onChange={(e) => setEditClientName(e.target.value)}
                    required
                    className="mt-1 w-full rounded border border-slate-300 bg-white p-2 text-xs dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                  />
                </div>
                <div>
                  <label className="font-medium text-slate-700 dark:text-slate-300">Contact Person</label>
                  <input
                    type="text"
                    value={editClientContactPerson}
                    onChange={(e) => setEditClientContactPerson(e.target.value)}
                    placeholder="e.g. Rajesh Sharma"
                    className="mt-1 w-full rounded border border-slate-300 bg-white p-2 text-xs dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                  />
                </div>
                <div>
                  <label className="font-medium text-slate-700 dark:text-slate-300">Client Phone</label>
                  <input
                    type="tel"
                    value={editClientPhone}
                    onChange={(e) => setEditClientPhone(e.target.value)}
                    placeholder="e.g. 9876543210"
                    className="mt-1 w-full rounded border border-slate-300 bg-white p-2 text-xs dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                  />
                </div>
                <div>
                  <label className="font-medium text-slate-700 dark:text-slate-300">Client Email</label>
                  <input
                    type="email"
                    value={editClientEmail}
                    onChange={(e) => setEditClientEmail(e.target.value)}
                    placeholder="e.g. client@company.com"
                    className="mt-1 w-full rounded border border-slate-300 bg-white p-2 text-xs dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                  />
                </div>
                <div>
                  <label className="font-medium text-slate-700 dark:text-slate-300">Client GSTIN (Tax ID)</label>
                  <input
                    type="text"
                    value={editClientGstin}
                    onChange={(e) => setEditClientGstin(e.target.value.toUpperCase())}
                    placeholder="e.g. 23AAAAA0000A1Z5"
                    className="mt-1 w-full rounded border border-slate-300 bg-white p-2 text-xs dark:border-slate-700 dark:bg-slate-950 dark:text-white uppercase"
                  />
                </div>
                <div>
                  <DatePicker
                    label="Valid Until Date"
                    value={editValidUntil}
                    onChange={setEditValidUntil}
                    triggerClassName="mt-1 p-2 text-xs"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="font-medium text-slate-700 dark:text-slate-300">Billing Address</label>
                  <input
                    type="text"
                    value={editClientAddress}
                    onChange={(e) => setEditClientAddress(e.target.value)}
                    placeholder="e.g. Scheme 54, Vijay Nagar"
                    className="mt-1 w-full rounded border border-slate-300 bg-white p-2 text-xs dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="font-medium text-slate-700 dark:text-slate-300">City</label>
                    <input
                      type="text"
                      value={editClientCity}
                      onChange={(e) => setEditClientCity(e.target.value)}
                      placeholder="e.g. Indore"
                      className="mt-1 w-full rounded border border-slate-300 bg-white p-2 text-xs dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="font-medium text-slate-700 dark:text-slate-300">State</label>
                    <input
                      type="text"
                      value={editClientState}
                      onChange={(e) => setEditClientState(e.target.value)}
                      placeholder="e.g. MP"
                      className="mt-1 w-full rounded border border-slate-300 bg-white p-2 text-xs dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                    />
                  </div>
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
                          <label className="text-[11px] text-slate-500 mb-1 block">Select Media Site</label>
                          <SiteSearchSelect
                            value={item.siteId}
                            sites={availableSites as any}
                            onChange={(val) => handleLineItemChange(idx, 'siteId', val)}
                            placeholder="Search & select site..."
                            triggerClassName="w-full h-8 px-2 py-1 text-xs"
                          />
                        </div>
                        <div>
                          <label className="text-[11px] text-slate-500">Dimensions / Description</label>
                          <input
                            type="text"
                            value={item.description}
                            onChange={(e) => handleLineItemChange(idx, 'description', e.target.value)}
                            placeholder="e.g. Frontlit Hoarding (30ft x 15ft)"
                            className="mt-1 w-full rounded border border-slate-300 bg-white p-1.5 text-xs dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                          />
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
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <DatePicker
                              label="Start Date"
                              value={item.startDate}
                              onChange={(val) => handleLineItemChange(idx, 'startDate', val)}
                              triggerClassName="p-1.5 text-xs h-[30px]"
                            />
                          </div>
                          <div>
                            <DatePicker
                              label="End Date"
                              value={item.endDate}
                              onChange={(val) => handleLineItemChange(idx, 'endDate', val)}
                              triggerClassName="p-1.5 text-xs h-[30px]"
                            />
                          </div>
                        </div>
                        {/* Discount & Tax Slab */}
                        <div className="grid grid-cols-2 gap-2 sm:col-span-2 pt-1 border-t border-slate-200/60 dark:border-slate-700/60">
                          <div>
                            <label className="text-[11px] text-slate-500">Discount (%)</label>
                            <input
                              type="number"
                              min="0"
                              max="100"
                              value={item.discountPercent || ''}
                              placeholder="0"
                              onChange={(e) => handleLineItemChange(idx, 'discountPercent', Math.max(0, Math.min(100, Number(e.target.value) || 0)))}
                              className="mt-1 w-full rounded border border-slate-300 bg-white p-1.5 text-xs dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                            />
                          </div>
                          <div>
                            <label className="text-[11px] text-slate-500">Tax Slab</label>
                            <select
                              value={item.taxPercent ?? 18}
                              onChange={(e) => handleLineItemChange(idx, 'taxPercent', Number(e.target.value))}
                              className="mt-1 w-full rounded border border-slate-300 bg-white p-1.5 text-xs dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                            >
                              <option value={18}>18% GST</option>
                              <option value={12}>12% GST</option>
                              <option value={5}>5% GST</option>
                              <option value={0}>0% (Nil)</option>
                            </select>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Tax Settings & Notes */}
              <div className="border-t border-slate-200 pt-3 dark:border-slate-800 space-y-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">GST Tax Supply Type</label>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <button
                      type="button"
                      onClick={() => setEditIsInterState(false)}
                      className={`p-2.5 rounded border text-left transition ${
                        !editIsInterState
                          ? 'border-[#8B2424] bg-[#8B2424]/5 text-[#8B2424] font-semibold'
                          : 'border-slate-200 text-slate-600 dark:border-slate-700 dark:text-slate-300'
                      }`}
                    >
                      <div className="font-bold">Intra-State</div>
                      <div className="text-[10px] text-slate-400 font-normal">CGST + SGST Split</div>
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditIsInterState(true)}
                      className={`p-2.5 rounded border text-left transition ${
                        editIsInterState
                          ? 'border-[#8B2424] bg-[#8B2424]/5 text-[#8B2424] font-semibold'
                          : 'border-slate-200 text-slate-600 dark:border-slate-700 dark:text-slate-300'
                      }`}
                    >
                      <div className="font-bold">Inter-State</div>
                      <div className="text-[10px] text-slate-400 font-normal">IGST Full</div>
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Custom Quotation Terms / Notes
                  </label>
                    <textarea
                    rows={2}
                    value={editNotes}
                    onChange={(e) => setEditNotes(e.target.value)}
                    placeholder="e.g. 50% advance along with PO. Flex printing extra."
                    className="w-full rounded border border-slate-300 bg-white p-2 text-xs dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                  />
                </div>

                {/* Bank Details & Terms & Conditions Edit */}
                <div className="border-t border-slate-200 pt-3 dark:border-slate-800 space-y-4">
                  {/* Bank Details */}
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-800/40">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-1.5 font-bold text-xs text-slate-800 dark:text-white">
                        <CreditCard className="w-3.5 h-3.5 text-[#6A1B21]" />
                        <span>BANK DETAILS</span>
                      </div>
                      {editShowBankDetails ? (
                        <button
                          type="button"
                          onClick={() => setEditShowBankDetails(false)}
                          className="text-xs font-semibold text-rose-600 hover:underline flex items-center gap-1"
                        >
                          <Trash2 className="w-3 h-3" />
                          <span>Remove Bank Details</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setEditShowBankDetails(true)}
                          className="text-xs font-semibold text-[#6A1B21] hover:underline flex items-center gap-1"
                        >
                          <Plus className="w-3 h-3" />
                          <span>+ Add Bank Details</span>
                        </button>
                      )}
                    </div>

                    {editShowBankDetails && (
                      <div className="space-y-2 text-xs pt-1">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <div>
                            <label className="text-[10px] font-semibold text-slate-500 mb-1 block">Bank Name</label>
                            <input
                              type="text"
                              value={editBankName}
                              onChange={(e) => setEditBankName(e.target.value)}
                              placeholder="e.g. HDFC Bank, SBI"
                              className="w-full h-8 rounded border border-slate-300 bg-white px-2 py-1 text-xs dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] font-semibold text-slate-500 mb-1 block">Person / Account Name</label>
                            <input
                              type="text"
                              value={editAccountName}
                              onChange={(e) => setEditAccountName(e.target.value)}
                              placeholder="e.g. Account Holder Name"
                              className="w-full h-8 rounded border border-slate-300 bg-white px-2 py-1 text-xs dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <div>
                            <label className="text-[10px] font-semibold text-slate-500 mb-1 block">Account Number</label>
                            <input
                              type="text"
                              value={editAccountNumber}
                              onChange={(e) => setEditAccountNumber(e.target.value)}
                              placeholder="e.g. 50200012345678"
                              className="w-full h-8 rounded border border-slate-300 bg-white px-2 py-1 text-xs dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] font-semibold text-slate-500 mb-1 block">IFSC Code</label>
                            <input
                              type="text"
                              value={editIfscCode}
                              onChange={(e) => setEditIfscCode(e.target.value.toUpperCase())}
                              placeholder="e.g. HDFC0001234"
                              className="w-full h-8 rounded border border-slate-300 bg-white px-2 py-1 text-xs uppercase dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="text-[10px] font-semibold text-slate-500 mb-1 block">Branch</label>
                          <input
                            type="text"
                            value={editBranch}
                            onChange={(e) => setEditBranch(e.target.value)}
                            placeholder="e.g. Vijay Nagar Branch, Indore"
                            className="w-full h-8 rounded border border-slate-300 bg-white px-2 py-1 text-xs dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Terms & Conditions */}
                  <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-800/40">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-1 font-bold text-xs text-[#6A1B21]">
                        <span>+</span>
                        <span>Terms & Conditions</span>
                      </div>
                      <button
                        type="button"
                        onClick={handleEditAddCondition}
                        className="text-xs font-semibold text-[#6A1B21] hover:underline flex items-center gap-1"
                      >
                        <Plus className="w-3 h-3" />
                        <span>Add Condition</span>
                      </button>
                    </div>

                    <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                      {editTermsList.map((term, index) => (
                        <div key={index} className="flex items-center gap-2">
                          <span className="w-4 text-right text-[11px] font-semibold text-slate-400 select-none">
                            {index + 1}.
                          </span>
                          <input
                            type="text"
                            value={term}
                            onChange={(e) => handleEditUpdateCondition(index, e.target.value)}
                            placeholder="Enter condition..."
                            className="flex-1 h-8 rounded border border-slate-300 bg-white px-2 py-1 text-xs dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                          />
                          <button
                            type="button"
                            onClick={() => handleEditRemoveCondition(index)}
                            className="p-1 text-slate-400 hover:text-rose-600 rounded transition"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Authorized Signatory / Company Stamp */}
                <div className="rounded-lg border border-slate-200 dark:border-slate-800 p-3 bg-slate-50/50 dark:bg-slate-900/50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <span className="font-bold text-xs uppercase tracking-wider text-slate-800 dark:text-white block">
                      Authorized Signatory / Company Stamp
                    </span>
                    <span className="text-[11px] text-slate-400">Attach company stamp or signature</span>
                  </div>

                  <SignatureInput
                    signatureImage={editSignatureImage}
                    onChange={(data) => {
                      setEditSignatureImage(data.signatureImage);
                    }}
                  />
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
                  className="rounded bg-[#8B2424] px-5 py-2 text-xs font-semibold text-white hover:bg-primary disabled:opacity-50 shadow-sm"
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
                    Test Client View →
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
