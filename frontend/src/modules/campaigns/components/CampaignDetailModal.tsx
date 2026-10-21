"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import type { Campaign } from "../types";

interface Props {
  campaign: Campaign | null;
  isOpen: boolean;
  onClose: () => void;
  onEdit?: (campaign: Campaign) => void;
  isPowUpdated?: boolean;
}

function formatDate(value?: string | Date | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatValue(value?: number | null) {
  if (value === undefined || value === null) return "₹0";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
}

function getDurationCount(startDateStr?: string, endDateStr?: string): string {
  if (!startDateStr || !endDateStr) return "—";
  const start = new Date(startDateStr);
  const end = new Date(endDateStr);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return "—";

  const oneDayMs = 24 * 60 * 60 * 1000;
  const startDay = Math.floor(start.getTime() / oneDayMs);
  const endDay = Math.floor(end.getTime() / oneDayMs);
  if (endDay < startDay) return "0 Days";
  const diffDays = endDay - startDay + 1;
  return `${diffDays} ${diffDays === 1 ? "Day" : "Days"}`;
}

function getLeadInfo(lead: Campaign["leadId"]) {
  if (!lead) return { primary: "—", secondary: "", email: "", phone: "", city: "" };
  if (typeof lead === "string") return { primary: `#${lead.slice(-6)}`, secondary: "", email: "", phone: "", city: "" };
  const company = lead.companyName || lead.company;
  const person = lead.contactPerson || lead.name;
  return {
    primary: company || person || "—",
    secondary: company && person && company !== person ? person : "",
    email: lead.email || "",
    phone: lead.phone || lead.mobile || "",
    city: lead.city || "",
  };
}

function getManagerInfo(manager: Campaign["assignedManager"]) {
  if (!manager) return { name: "Unassigned", email: "" };
  if (typeof manager === "string") return { name: `#${manager.slice(-6)}`, email: "" };
  return {
    name: manager.name || manager.email || "Unassigned",
    email: manager.email || "",
  };
}

function getCleanLocation(city?: string | null, state?: string | null): string {
  const c = city?.trim() || "";
  const s = state?.trim() || "";
  if (!c && !s) return "—";
  if (!s || !c || c.toLowerCase() === s.toLowerCase() || c.toLowerCase().includes(s.toLowerCase())) {
    return c || s;
  }
  return `${c}, ${s}`;
}

export default function CampaignDetailModal({
  campaign,
  isOpen,
  onClose,
  onEdit,
  isPowUpdated = false,
}: Props) {
  const [copiedCode, setCopiedCode] = useState(false);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !campaign) return null;

  const lead = getLeadInfo(campaign.leadId);
  const manager = getManagerInfo(campaign.assignedManager);
  const duration = getDurationCount(campaign.startDate, campaign.endDate);
  const location = getCleanLocation(campaign.city, campaign.state);

  const status = (campaign.status || "").trim();
  const normalizedStatus = (() => {
    const s = status.toLowerCase();
    if (s === "complete" || s === "completed" || s === "campaign end") return "Campaign End";
    if (s === "in progress" || s === "inprogress" || s === "draft" || s === "approved") return "In Progress";
    if (s === "campaign live") return "Campaign Live";
    if (s === "rejected" || s === "cancelled" || s === "campaign rejected") return "Rejected";
    return status || "In Progress";
  })();

  const isLocked =
    normalizedStatus === "Campaign End" || normalizedStatus === "Rejected";

  const powDone = isPowUpdated || Boolean(campaign.isPowUpdated);

  function copyCodeToClipboard() {
    if (!campaign?.campaignCode) return;
    navigator.clipboard.writeText(campaign.campaignCode).then(() => {
      setCopiedCode(true);
      setTimeout(() => setCopiedCode(false), 2000);
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/60 p-4 backdrop-blur-xs transition-opacity animate-in fade-in duration-200"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="relative w-full max-w-3xl overflow-hidden rounded-2xl bg-white shadow-2xl transition-all"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Accent Header */}
        <div className="flex items-center justify-between border-b border-gray-100 bg-linear-to-r from-gray-50 via-white to-gray-50 px-6 py-4">
          <div className="flex items-center gap-3">
            {/* Code Badge */}
            <button
              type="button"
              onClick={copyCodeToClipboard}
              className="group inline-flex items-center gap-1.5 rounded-lg border border-[#8B2424]/30 bg-[#FFF5F5] px-3 py-1 font-mono text-xs font-bold text-[#8B2424] shadow-xs transition hover:bg-[#8B2424] hover:text-white"
              title="Click to copy Campaign Code"
            >
              <span>{campaign.campaignCode}</span>
              <span className="text-[10px] opacity-70 group-hover:opacity-100">
                {copiedCode ? "✓ Copied" : "📋"}
              </span>
            </button>

            {/* Status Pill */}
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-0.5 text-xs font-semibold ring-1 ring-inset ${
                normalizedStatus === "Campaign Live"
                  ? "bg-emerald-50 text-emerald-800 ring-emerald-600/20"
                  : normalizedStatus === "Campaign End"
                  ? "bg-purple-50 text-purple-800 ring-purple-600/20"
                  : normalizedStatus === "Rejected"
                  ? "bg-rose-50 text-rose-800 ring-rose-600/20"
                  : "bg-blue-50 text-blue-800 ring-blue-600/20"
              }`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  normalizedStatus === "Campaign Live"
                    ? "bg-emerald-500"
                    : normalizedStatus === "Campaign End"
                    ? "bg-purple-500"
                    : normalizedStatus === "Rejected"
                    ? "bg-rose-500"
                    : "bg-blue-500"
                }`}
              />
              {normalizedStatus}
            </span>
          </div>

          {/* Close button */}
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-lg font-bold text-gray-400 transition hover:bg-gray-100 hover:text-gray-700"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Modal Body */}
        <div className="max-h-[75vh] overflow-y-auto p-6 space-y-5">
          {/* Campaign Title & Headline */}
          <div>
            <h2 className="text-xl font-bold text-gray-900 leading-snug">
              {campaign.name}
            </h2>
            <p className="mt-1 text-xs text-gray-500">
              Created on {formatDate(campaign.createdAt)} • Location:{" "}
              <span className="font-semibold text-gray-700">{location}</span>
            </p>
          </div>

          {/* Rejection Alert Box (if rejected) */}
          {normalizedStatus === "Rejected" && (
            <div className="rounded-xl border border-rose-200 bg-rose-50/80 p-4 text-rose-900">
              <div className="flex items-center gap-2">
                <span className="text-base">⚠️</span>
                <h4 className="text-xs font-bold uppercase tracking-wider text-rose-800">
                  Rejection Reason / Note
                </h4>
              </div>
              <p className="mt-1.5 text-sm font-medium text-rose-950">
                {campaign.rejectionReason || "No rejection note was recorded."}
              </p>
            </div>
          )}

          {/* 3-Column Info Cards */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {/* Card 1: Client Information */}
            <div className="rounded-xl border border-gray-100 bg-gray-50/70 p-4 space-y-2">
              <div className="text-[11px] font-bold uppercase tracking-wider text-gray-400">
                Client / Lead
              </div>
              <div className="text-sm font-semibold text-gray-900">
                {lead.primary}
              </div>
              {lead.secondary && (
                <div className="text-xs text-gray-600">
                  👤 {lead.secondary}
                </div>
              )}
              {lead.email && (
                <div className="truncate text-xs text-gray-500" title={lead.email}>
                  ✉️ {lead.email}
                </div>
              )}
              {lead.phone && (
                <div className="text-xs text-gray-500">
                  📞 {lead.phone}
                </div>
              )}
            </div>

            {/* Card 2: Quotation & Financials */}
            <div className="rounded-xl border border-gray-100 bg-gray-50/70 p-4 space-y-2">
              <div className="text-[11px] font-bold uppercase tracking-wider text-gray-400">
                Quotation & Value
              </div>
              <div className="text-base font-bold text-gray-900">
                {formatValue(campaign.contractedValue)}
              </div>
              {campaign.quotationName && (
                <div className="truncate text-xs font-medium text-gray-700" title={campaign.quotationName}>
                  {campaign.quotationName}
                </div>
              )}
              <div className="flex flex-wrap gap-2 text-[11px] text-gray-500">
                {campaign.quotationNo && (
                  <span className="rounded bg-white px-1.5 py-0.5 border border-gray-200 font-medium">
                    Q: {campaign.quotationNo}
                  </span>
                )}
                {campaign.piNo && (
                  <span className="rounded bg-white px-1.5 py-0.5 border border-gray-200 font-medium">
                    PI: {campaign.piNo}
                  </span>
                )}
              </div>
            </div>

            {/* Card 3: Manager & Duration */}
            <div className="rounded-xl border border-gray-100 bg-gray-50/70 p-4 space-y-2">
              <div className="text-[11px] font-bold uppercase tracking-wider text-gray-400">
                Manager & Duration
              </div>
              <div className="text-sm font-semibold text-gray-900">
                👤 {manager.name}
              </div>
              {manager.email && (
                <div className="truncate text-xs text-gray-500" title={manager.email}>
                  {manager.email}
                </div>
              )}
              <div className="pt-1 text-xs text-gray-600">
                <span className="font-semibold text-gray-900">{duration}</span>
                <span className="text-gray-400"> • </span>
                <span>{campaign.siteIds?.length || 0} sites</span>
              </div>
            </div>
          </div>

          {/* Dates & Timeline Box */}
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wider text-gray-500">
                Campaign Schedule
              </span>
              <span className="rounded-md bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-700">
                Duration: {duration}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-4 rounded-lg bg-gray-50 p-3 sm:grid-cols-2">
              <div>
                <div className="text-[11px] font-medium text-gray-500">Start Date</div>
                <div className="mt-0.5 text-sm font-semibold text-gray-900">
                  {formatDate(campaign.startDate)}
                </div>
              </div>
              <div>
                <div className="text-[11px] font-medium text-gray-500">End Date</div>
                <div className="mt-0.5 text-sm font-semibold text-gray-900">
                  {formatDate(campaign.endDate)}
                </div>
              </div>
            </div>
          </div>

          {/* Proof of Work (POW) Card */}
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-xs font-bold uppercase tracking-wider text-gray-500">
                  Proof of Work (POW)
                </div>
                <div className="mt-1 flex items-center gap-2">
                  {powDone ? (
                    <span className="inline-flex items-center gap-1 rounded-md border border-emerald-300 bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-700">
                      ✓ POW Updated
                      {campaign.powUpdatedAt && (
                        <span className="font-normal text-emerald-600">
                          ({formatDate(campaign.powUpdatedAt)})
                        </span>
                      )}
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-md border border-amber-300 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-800">
                      ⏳ POW Not Updated Yet
                    </span>
                  )}
                </div>
              </div>

              <Link
                href={`/proofs?campaignId=${campaign._id}#campaign-pow`}
                onClick={onClose}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[#8B2424] bg-white px-3.5 py-1.5 text-xs font-semibold text-[#8B2424] shadow-xs transition hover:bg-[#8B2424] hover:text-white"
              >
                <span>📸</span>
                <span>View POW In Proofs</span>
              </Link>
            </div>
          </div>

          {/* Sites Summary */}
          {campaign.siteIds && campaign.siteIds.length > 0 && (
            <div className="rounded-xl border border-gray-200 bg-white p-4">
              <div className="mb-2 text-xs font-bold uppercase tracking-wider text-gray-500">
                Assigned Sites ({campaign.siteIds.length})
              </div>
              <div className="flex flex-wrap gap-1.5">
                {campaign.siteIds.map((site: any, idx: number) => {
                  const sName =
                    typeof site === "object" && site
                      ? site.name || site.code || `Site ${idx + 1}`
                      : `#${String(site).slice(-6)}`;
                  return (
                    <span
                      key={typeof site === "object" ? site._id || idx : site}
                      className="inline-flex items-center rounded-md border border-gray-200 bg-gray-50 px-2.5 py-1 text-xs font-medium text-gray-700"
                    >
                      📍 {sName}
                    </span>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between border-t border-gray-100 bg-gray-50/80 px-6 py-3.5">
          <div className="text-xs text-gray-500">
            Last updated: {formatDate(campaign.updatedAt || campaign.createdAt)}
          </div>

          <div className="flex items-center gap-2">
            {!isLocked && onEdit && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onEdit(campaign);
                }}
                className="rounded-lg border border-[#8B2424] bg-[#8B2424] px-4 py-1.5 text-xs font-semibold text-white shadow-xs transition hover:bg-[#A8383B]"
              >
                Edit Campaign
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-gray-300 bg-white px-4 py-1.5 text-xs font-semibold text-gray-700 shadow-xs transition hover:bg-gray-100"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
