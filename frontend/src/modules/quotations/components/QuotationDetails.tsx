"use client";

import React, { useState, useRef } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  Mail,
  Phone,
  MapPin,
  Calendar,
  CreditCard,
  CheckCircle2,
  XCircle,
  ExternalLink,
  Sparkles,
  Download,
  Pencil,
  Upload,
  FileText,
} from "lucide-react";
import type { Quotation } from "../types";
import { quotationsApi } from "../api";
import ShareProposalModal from "./ShareProposalModal";

function SendIcon({ className = "h-3.5 w-3.5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="22" y1="2" x2="11" y2="13" />
      <polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
  );
}

const STATUS_STYLES: Record<string, string> = {
  Draft: "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-300",
  Sent: "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-800 dark:bg-blue-950/50 dark:text-blue-300",
  Accepted: "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300 font-semibold",
  Rejected: "border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-800 dark:bg-rose-950/50 dark:text-rose-300",
  Expired: "border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300",
};

function formatDate(dateStr?: string | null) {
  if (!dateStr) return "-";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "-";
  return d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function formatRupees(paise: number): string {
  const rupees = (paise || 0) / 100;
  return `₹${rupees.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

interface Props {
  quotation: Quotation;
  onBack: () => void;
  onDocument: () => void;
  onTrack: () => void;
  onRefresh: (updatedQuote: Quotation) => void;
  onEdit?: () => void;
}

export default function QuotationDetails({
  quotation,
  onBack,
  onDocument,
  onTrack,
  onRefresh,
  onEdit,
}: Props) {
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [uploadingPdf, setUploadingPdf] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const quoteId = quotation._id || quotation.id;
  const leadObj: any = typeof quotation.leadId === "object" ? quotation.leadId : null;
  const clientName = quotation.clientName || leadObj?.companyName || "Direct Client";
  const contactPerson = quotation.clientContactPerson || leadObj?.contactPerson || leadObj?.name || "-";
  const phone = quotation.clientPhone || leadObj?.mobile || "-";
  const email = quotation.clientEmail || leadObj?.email || "-";
  const address = quotation.clientAddress || quotation.clientCity || "-";

  const handleUploadSignedPdf = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
      alert("Only PDF files are supported");
      return;
    }
    try {
      setUploadingPdf(true);
      await quotationsApi.uploadPdf(quoteId, file);
      alert("Signed PDF uploaded successfully!");
      const updated = await quotationsApi.getById(quoteId);
      onRefresh(updated);
    } catch (err: any) {
      alert(err.message || "Failed to upload signed PDF");
    } finally {
      setUploadingPdf(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Hidden PDF file input */}
      <input
        type="file"
        ref={fileInputRef}
        accept="application/pdf,.pdf"
        className="hidden"
        onChange={handleUploadSignedPdf}
      />

      {/* Top Action Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 rounded-2xl border border-gray-200 bg-white p-3.5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 dark:border-slate-800 dark:bg-slate-900 dark:text-gray-300 dark:hover:bg-slate-800 transition cursor-pointer"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Back to Quotations</span>
        </button>

        <div className="flex flex-wrap items-center gap-2">
          {/* Edit Proposal Button (Draft only) */}
          {quotation.status === "Draft" && onEdit && (
            <button
              type="button"
              onClick={onEdit}
              className="inline-flex items-center gap-1.5 rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800 hover:bg-amber-100 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-300 transition cursor-pointer"
              title="Edit Draft Proposal details, sites and rates"
            >
              <Pencil className="h-3.5 w-3.5" />
              <span>Edit Proposal</span>
            </button>
          )}

          {/* Upload Signed PDF Button */}
          <button
            type="button"
            disabled={uploadingPdf}
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 dark:border-slate-800 dark:bg-slate-900 dark:text-gray-300 dark:hover:bg-slate-800 transition cursor-pointer disabled:opacity-50"
            title="Upload client-signed or stamped PDF proposal"
          >
            <Upload className="h-3.5 w-3.5 text-gray-500" />
            <span>{uploadingPdf ? "Uploading PDF..." : "Upload Signed PDF"}</span>
          </button>

          {/* Send & Share Proposal Button */}
          <button
            type="button"
            onClick={() => setShareModalOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-xs font-semibold text-blue-700 hover:bg-blue-100 dark:border-blue-800 dark:bg-blue-950/40 dark:text-blue-300 transition cursor-pointer"
            title="Dispatch via Email, WhatsApp, or Direct Link"
          >
            <SendIcon className="h-3.5 w-3.5" />
            <span>Send &amp; Share Proposal</span>
          </button>

          {/* Document PDF Preview (Step 4) */}
          <button
            type="button"
            onClick={onDocument}
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#8B2424] px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-[#721c1c] transition cursor-pointer"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Document (PDF)</span>
          </button>

          {/* Track & Convert (Step 5) */}
          <button
            type="button"
            onClick={onTrack}
            className="inline-flex items-center gap-1.5 rounded-xl bg-gray-900 px-3.5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-black dark:bg-slate-800 dark:hover:bg-slate-700 transition cursor-pointer"
          >
            <span>Tracking &amp; Campaign</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Main Details Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Client, Sites & Financial Breakdown */}
        <div className="lg:col-span-2 space-y-6">
          {/* Header Card */}
          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900">
            <div className="flex flex-col sm:flex-row justify-between items-start gap-4">
              <div>
                <span className="font-mono text-xs font-bold text-[#8B2424] dark:text-rose-400">
                  {quotation.quoteNumber}
                </span>
                <h2 className="mt-1 text-lg font-bold text-gray-900 dark:text-white">
                  {clientName}
                </h2>
                <div className="mt-1 flex items-center gap-3 text-xs text-gray-500">
                  <span>Created: {formatDate(quotation.createdAt)}</span>
                  <span>&bull;</span>
                  <span>Valid Until: {formatDate(quotation.validUntil)}</span>
                </div>
              </div>

              <div className="text-left sm:text-right">
                <div className="flex flex-wrap items-center sm:justify-end gap-1.5">
                  <span
                    className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${
                      STATUS_STYLES[quotation.status] || STATUS_STYLES.Draft
                    }`}
                  >
                    {quotation.status}
                  </span>
                  {quotation.pdfKey && (
                    <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[10px] font-bold text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
                      <FileText className="h-3 w-3" />
                      <span>PDF Document Uploaded</span>
                    </span>
                  )}
                </div>
                <div className="mt-2 text-xl font-black text-gray-900 dark:text-white">
                  {formatRupees(quotation.total)}
                </div>
                <div className="text-[10px] text-gray-400">Total Contract Value (Incl. GST)</div>
              </div>
            </div>
          </div>

          {/* Line Items Table */}
          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900 space-y-4">
            <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Calendar className="h-4 w-4 text-[#8B2424]" />
              <span>Media Sites &amp; Rate Breakdown</span>
            </h3>

            <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-slate-800">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200 text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:bg-slate-950 dark:border-slate-800 dark:text-gray-400">
                    <th className="py-2.5 pl-3 pr-2">NO.</th>
                    <th className="px-3 py-2.5">SITE / ITEM DETAILS</th>
                    <th className="px-3 py-2.5 text-center">DURATION (QTY)</th>
                    <th className="px-3 py-2.5 text-right">RATE (₹)</th>
                    <th className="px-3 py-2.5 text-right">DISCOUNT</th>
                    <th className="px-3 py-2.5 text-center">TAX</th>
                    <th className="py-2.5 pl-2 pr-3 text-right">AMOUNT (₹)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-slate-800/60">
                  {(quotation.sites || []).map((item, idx) => {
                    const siteObj: any = typeof item.siteId === "object" ? item.siteId : null;
                    const siteLabel = item.description || siteObj?.name || siteObj?.siteCode || "Media Site";

                    return (
                      <tr key={idx} className="hover:bg-gray-50/50 dark:hover:bg-slate-800/30">
                        <td className="py-3 pl-3 pr-2 text-gray-400 font-mono">{idx + 1}</td>
                        <td className="px-3 py-3">
                          <div className="font-semibold text-gray-900 dark:text-white">{siteLabel}</div>
                          {siteObj?.city && <div className="text-[10px] text-gray-400">{siteObj.city}</div>}
                        </td>
                        <td className="px-3 py-3 text-center text-gray-600 dark:text-gray-300 whitespace-nowrap">
                          <span className="font-bold text-gray-800 dark:text-gray-200">{item.days} Days</span>
                          {item.startDate && item.endDate && (
                            <div className="text-[10px] text-gray-400">
                              {formatDate(item.startDate)} - {formatDate(item.endDate)}
                            </div>
                          )}
                        </td>
                        <td className="px-3 py-3 text-right font-mono text-gray-700 dark:text-gray-300 whitespace-nowrap">
                          {formatRupees(item.ratePerDay)}/d
                        </td>
                        <td className="px-3 py-3 text-right text-gray-500">
                          {item.discountPercent ? `${item.discountPercent}%` : "-"}
                        </td>
                        <td className="px-3 py-3 text-center text-gray-600 dark:text-gray-300 whitespace-nowrap font-medium">
                          {item.taxPercent !== undefined ? `${item.taxPercent}% GST` : "18% GST"}
                        </td>
                        <td className="py-3 pl-2 pr-3 text-right font-bold text-gray-900 dark:text-white whitespace-nowrap">
                          {formatRupees(item.amount)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right Col: Client Overview & Financials */}
        <div className="space-y-6">
          {/* Client Details Card */}
          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900 text-xs space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400">
              Client &amp; Contact Info
            </h4>

            <div className="space-y-2">
              <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                <Building2 className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                <span className="font-semibold">{clientName}</span>
              </div>
              <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                <span className="text-[10px] font-bold text-gray-400 uppercase">Attn:</span>
                <span>{contactPerson}</span>
              </div>
              <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                <Phone className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                <span>{phone}</span>
              </div>
              <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                <Mail className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                <span>{email}</span>
              </div>
              <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                <MapPin className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                <span>{address}</span>
              </div>
            </div>
          </div>

          {/* Financial Breakdown Card */}
          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900 text-xs space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400">
              Financial Summary
            </h4>

            <div className="space-y-2">
              <div className="flex justify-between text-gray-600 dark:text-gray-400">
                <span>Subtotal:</span>
                <span className="font-semibold text-gray-900 dark:text-white">{formatRupees(quotation.subtotal)}</span>
              </div>
              <div className="flex justify-between text-gray-600 dark:text-gray-400">
                <span>GST ({quotation.taxPercent || 18}%):</span>
                <span className="font-semibold text-gray-900 dark:text-white">{formatRupees(quotation.taxAmount)}</span>
              </div>
              <div className="border-t border-gray-100 pt-2 flex justify-between text-sm font-bold text-[#8B2424] dark:text-rose-400">
                <span>Grand Total:</span>
                <span>{formatRupees(quotation.total)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Unified Share & Dispatch Proposal Modal */}
      <ShareProposalModal
        quotation={quotation}
        isOpen={shareModalOpen}
        onClose={() => setShareModalOpen(false)}
        onSent={(updated) => onRefresh(updated)}
      />
    </div>
  );
}
