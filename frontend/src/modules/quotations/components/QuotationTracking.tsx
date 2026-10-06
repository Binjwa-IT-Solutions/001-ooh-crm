"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  XCircle,
  Sparkles,
  ExternalLink,
  Check,
  Calendar,
  Building2,
} from "lucide-react";
import type { Quotation } from "../types";
import { quotationsApi } from "../api";
import { api } from "@/shared/api/client";

function SendIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="22" y1="2" x2="11" y2="13" />
      <polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
  );
}

function EyeIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function CopyIcon({ className = "h-3.5 w-3.5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
      <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
    </svg>
  );
}

interface Props {
  quotation: Quotation;
  onBack: () => void;
  onRefresh?: () => void;
}

function formatDate(dateStr?: string | null) {
  if (!dateStr) return "-";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "-";
  return d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatRupees(paise: number): string {
  const rupees = (paise || 0) / 100;
  return `₹${rupees.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export default function QuotationTracking({ quotation, onBack, onRefresh }: Props) {
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const [converting, setConverting] = useState(false);
  const [accepting, setAccepting] = useState(false);

  const quoteId = quotation._id || quotation.id;
  const isAccepted = quotation.status === "Accepted";
  const isRejected = quotation.status === "Rejected";
  const isSent = quotation.status === "Sent" || Boolean(quotation.sentAt);

  const leadObj: any = typeof quotation.leadId === "object" ? quotation.leadId : null;
  const clientName = quotation.clientName || leadObj?.companyName || "Client";
  const leadIdStr = leadObj?._id || (typeof quotation.leadId === "string" ? quotation.leadId : "");

  const handleCopyLink = () => {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const token = quotation.trackingToken || quotation._id || quoteId;
    const link = `${origin}/q/${token}`;
    navigator.clipboard.writeText(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleManualAccept = async () => {
    if (!confirm("Are you sure you want to mark this proposal as Accepted? This will update the Lead status to Won.")) return;
    try {
      setAccepting(true);
      await quotationsApi.acceptInternal(quoteId);
      alert("Proposal marked as Accepted! Lead status updated to Won.");
      onRefresh?.();
    } catch (err: any) {
      alert(err?.message || "Failed to mark proposal as Accepted");
    } finally {
      setAccepting(false);
    }
  };

  const handleConvertToCampaign = async () => {
    try {
      setConverting(true);
      const res: any = await api.post("/api/campaigns/from-quotation", { quotationId: quoteId });
      const createdCampaignId = res?.data?._id || res?._id;
      if (createdCampaignId) {
        alert("Campaign created successfully from quotation!");
        router.push(`/campaigns/${createdCampaignId}`);
      } else {
        router.push("/campaigns");
      }
    } catch (err: any) {
      alert(err?.message || "Failed to convert proposal to live campaign");
    } finally {
      setConverting(false);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Top Action Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 rounded-2xl border border-gray-200 bg-white p-3.5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 dark:border-slate-800 dark:bg-slate-900 dark:text-gray-300 dark:hover:bg-slate-800 transition cursor-pointer"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Back to Proposal</span>
        </button>

        <div className="flex flex-wrap items-center gap-2">
          {!isAccepted && !isRejected && (
            <button
              type="button"
              disabled={accepting}
              onClick={handleManualAccept}
              className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-xs font-bold text-white shadow-xs hover:bg-emerald-700 transition cursor-pointer disabled:opacity-50"
            >
              <Check className="h-3.5 w-3.5" />
              <span>{accepting ? "Accepting..." : "Mark as Accepted (Manual)"}</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleCopyLink}
            className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3.5 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 dark:border-slate-800 dark:bg-slate-900 dark:text-gray-300 dark:hover:bg-slate-800 transition cursor-pointer"
          >
            {copied ? (
              <>
                <Check className="h-3.5 w-3.5 text-emerald-600" />
                <span className="text-emerald-600">Copied Link!</span>
              </>
            ) : (
              <>
                <CopyIcon className="h-3.5 w-3.5" />
                <span>Copy Public Link</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Main Tracking Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Proposal Lifecycle Audit Timeline */}
        <div className="lg:col-span-2 space-y-6">
          <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900">
            <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Clock className="h-4 w-4 text-[#8B2424]" />
              <span>Proposal Lifecycle &amp; Conversion Audit</span>
            </h3>
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Real-time audit trail of client interactions, approvals, and campaign progression.
            </p>

            <div className="mt-6 space-y-6 relative before:absolute before:left-4 before:top-2 before:bottom-2 before:w-0.5 before:bg-gray-200 dark:before:bg-slate-800">
              {/* Event 1: Created */}
              <div className="flex items-start gap-4 relative">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400 z-10">
                  <CheckCircle2 className="h-4 w-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-gray-900 dark:text-white">
                    Proposal Created ({quotation.quoteNumber})
                  </div>
                  <div className="text-[11px] text-gray-500">
                    Drafted on {formatDate(quotation.createdAt)} &bull; {quotation.sites?.length || 0} Sites included
                  </div>
                </div>
              </div>

              {/* Event 2: Sent */}
              <div className="flex items-start gap-4 relative">
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-full z-10 ${
                    isSent
                      ? "bg-blue-100 text-blue-600 dark:bg-blue-950/60 dark:text-blue-400"
                      : "bg-gray-100 text-gray-400 dark:bg-slate-800"
                  }`}
                >
                  <SendIcon className="h-4 w-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-gray-900 dark:text-white">
                    {isSent ? "Sent to Client" : "Awaiting Dispatch"}
                  </div>
                  <div className="text-[11px] text-gray-500">
                    {quotation.sentAt ? `Dispatched on ${formatDate(quotation.sentAt)} to ${quotation.sentTo || "client"}` : "Proposal is still in draft state"}
                  </div>
                </div>
              </div>

              {/* Event 3: Viewed */}
              <div className="flex items-start gap-4 relative">
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-full z-10 ${
                    quotation.viewedAt
                      ? "bg-purple-100 text-purple-600 dark:bg-purple-950/60 dark:text-purple-400"
                      : "bg-gray-100 text-gray-400 dark:bg-slate-800"
                  }`}
                >
                  <EyeIcon className="h-4 w-4" />
                </div>
                <div>
                  <div className="text-xs font-bold text-gray-900 dark:text-white">
                    {quotation.viewedAt ? "Viewed by Client" : "Not Viewed Yet"}
                  </div>
                  <div className="text-[11px] text-gray-500">
                    {quotation.viewedAt
                      ? `Client opened proposal via link on ${formatDate(quotation.viewedAt)}`
                      : "Client has not yet opened the public proposal link"}
                  </div>
                </div>
              </div>

              {/* Event 4: Decision */}
              <div className="flex items-start gap-4 relative">
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-full z-10 ${
                    isAccepted
                      ? "bg-emerald-100 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400"
                      : isRejected
                        ? "bg-rose-100 text-rose-600 dark:bg-rose-950/60 dark:text-rose-400"
                        : "bg-amber-100 text-amber-600 dark:bg-amber-950/60 dark:text-amber-400"
                  }`}
                >
                  {isAccepted ? (
                    <CheckCircle2 className="h-4 w-4" />
                  ) : isRejected ? (
                    <XCircle className="h-4 w-4" />
                  ) : (
                    <Clock className="h-4 w-4" />
                  )}
                </div>
                <div>
                  <div className="text-xs font-bold text-gray-900 dark:text-white">
                    {isAccepted
                      ? "Proposal Accepted!"
                      : isRejected
                        ? "Proposal Rejected by Client"
                        : "Awaiting Client Decision"}
                  </div>
                  <div className="text-[11px] text-gray-500">
                    {isAccepted
                      ? `Accepted on ${formatDate(quotation.acceptedAt)}`
                      : isRejected
                        ? `Rejected on ${formatDate(quotation.rejectedAt)} ${quotation.rejectionReason ? `• Reason: ${quotation.rejectionReason}` : ""}`
                        : `Decision pending. Valid until ${formatDate(quotation.validUntil)}`}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Campaign Conversion Card */}
          {isAccepted ? (
            <div className="rounded-2xl border-2 border-emerald-300 bg-emerald-50/60 p-6 shadow-xs dark:border-emerald-800 dark:bg-emerald-950/30">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-600 text-white text-xs font-bold">
                      ✓
                    </span>
                    <h4 className="text-sm font-bold text-emerald-950 dark:text-emerald-200">
                      Ready for Campaign Conversion!
                    </h4>
                  </div>
                  <p className="mt-1 text-xs text-emerald-800 dark:text-emerald-300">
                    This proposal is officially accepted. You can now convert it directly into a live campaign with the contracted billing value of{" "}
                    <span className="font-bold">{formatRupees(quotation.total)}</span>.
                  </p>
                </div>

                <button
                  type="button"
                  disabled={converting}
                  onClick={handleConvertToCampaign}
                  className="shrink-0 inline-flex items-center gap-2 rounded-xl bg-emerald-700 px-4 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-emerald-800 disabled:opacity-50 transition cursor-pointer"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>{converting ? "Converting to Campaign..." : "Convert to Campaign"}</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-gray-200 bg-gray-50/70 p-6 dark:border-slate-800 dark:bg-slate-900/50">
              <h4 className="text-xs font-bold text-gray-800 dark:text-gray-200">
                Campaign Conversion Prerequisite
              </h4>
              <p className="mt-1 text-[11px] text-gray-500 dark:text-gray-400">
                To prevent financial mismatches in audit and billing reconciliation, campaigns can only be created once the quotation is officially accepted by the client.
              </p>
            </div>
          )}
        </div>

        {/* Right Col: Contract Summary Card */}
        <div className="space-y-4">
          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-xs dark:border-slate-800 dark:bg-slate-900 text-xs">
            <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-4">
              Contract Summary
            </h4>

            <div className="space-y-3">
              <div className="flex justify-between items-baseline border-b border-gray-100 pb-2 dark:border-slate-800">
                <span className="text-gray-500">Contract Total:</span>
                <span className="text-base font-bold text-gray-900 dark:text-white">
                  {formatRupees(quotation.total)}
                </span>
              </div>

              <div className="flex justify-between border-b border-gray-100 pb-2 dark:border-slate-800">
                <span className="text-gray-500">Client:</span>
                <span className="font-semibold text-gray-900 dark:text-white truncate max-w-[150px]">
                  {clientName}
                </span>
              </div>

              <div className="flex justify-between border-b border-gray-100 pb-2 dark:border-slate-800">
                <span className="text-gray-500">Sites Booked:</span>
                <span className="font-semibold text-gray-800 dark:text-gray-200">
                  {quotation.sites?.length || 0} Media Sites
                </span>
              </div>

              <div className="flex justify-between border-b border-gray-100 pb-2 dark:border-slate-800">
                <span className="text-gray-500">Tax Type:</span>
                <span className="font-semibold text-gray-800 dark:text-gray-200">
                  {quotation.isInterState ? "IGST (18%)" : "CGST+SGST (18%)"}
                </span>
              </div>

              <div className="flex justify-between">
                <span className="text-gray-500">Proposal Status:</span>
                <span className="font-bold text-[#8B2424] dark:text-rose-400">
                  {quotation.status}
                </span>
              </div>
            </div>

            <div className="mt-5 pt-4 border-t border-gray-100 dark:border-slate-800">
              <a
                href={`/q/${quotation.trackingToken || quoteId}`}
                target="_blank"
                rel="noreferrer"
                className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-100 dark:border-slate-800 dark:bg-slate-800 dark:text-gray-300 dark:hover:bg-slate-700 transition"
              >
                <span>Open Public Proposal Link</span>
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
