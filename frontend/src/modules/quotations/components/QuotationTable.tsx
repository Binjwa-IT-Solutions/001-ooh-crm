"use client";

import React from "react";
import {
  FileText,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  MapPin,
  Download,
  Pencil,
} from "lucide-react";
import type { Quotation } from "../types";

function EyeIcon({ className = "h-3.5 w-3.5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
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
  quotations: Quotation[];
  totalItems: number;
  currentPage: number;
  totalPages: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  onView: (quotation: Quotation) => void;
  onDocument: (quotation: Quotation) => void;
  onTrack: (quotation: Quotation) => void;
  onEdit: (quotation: Quotation) => void;
}

export default function QuotationTable({
  quotations,
  totalItems,
  currentPage,
  totalPages,
  pageSize,
  onPageChange,
  onPageSizeChange,
  onView,
  onDocument,
  onTrack,
  onEdit,
}: Props) {
  if (quotations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-300 bg-white p-12 text-center dark:border-slate-800 dark:bg-slate-900">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-rose-50 text-[#8B2424] dark:bg-rose-950/40 dark:text-rose-400">
          <FileText className="h-6 w-6" />
        </div>
        <h3 className="mt-3 text-sm font-bold text-gray-900 dark:text-white">
          No quotations found
        </h3>
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400 max-w-sm">
          No matching quotations found for the current search and filters. Try adjusting your search query or reset filters.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xs dark:border-slate-800 dark:bg-slate-900">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50/80 text-[11px] font-bold uppercase tracking-wider text-gray-500 dark:border-slate-800 dark:bg-slate-950 dark:text-gray-400">
              <th className="py-3.5 pl-4 pr-3">Quote #</th>
              <th className="px-3 py-3.5">Client &amp; Lead</th>
              <th className="px-3 py-3.5">Location</th>
              <th className="px-3 py-3.5 text-center">Sites</th>
              <th className="px-3 py-3.5 text-right">Total (Incl. GST)</th>
              <th className="px-3 py-3.5 text-center">Status</th>
              <th className="px-3 py-3.5 text-center">Valid Until</th>
              <th className="py-3.5 pl-3 pr-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-slate-800/60">
            {quotations.map((q) => {
              const leadObj: any = typeof q.leadId === "object" ? q.leadId : null;
              const companyName = q.clientName || leadObj?.companyName || "Direct Client";
              const contactPerson =
                q.clientContactPerson || leadObj?.contactPerson || leadObj?.name || "-";
              const city = q.clientCity || leadObj?.city || "-";
              const sitesCount = (q.sites || []).length;
              const status = q.status || "Draft";
              const isAccepted = status === "Accepted";

              return (
                <tr
                  key={q._id}
                  className="group transition-colors hover:bg-rose-50/20 dark:hover:bg-slate-800/40"
                >
                  {/* Quote # */}
                  <td className="py-3.5 pl-4 pr-3 whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => onView(q)}
                      className="font-mono text-xs font-bold text-[#8B2424] hover:underline dark:text-rose-400 cursor-pointer"
                    >
                      {q.quoteNumber}
                    </button>
                    <div className="text-[10px] text-gray-400">
                      {formatDate(q.createdAt)}
                    </div>
                  </td>

                  {/* Client & Lead */}
                  <td className="px-3 py-3.5">
                    <div className="font-semibold text-gray-900 dark:text-white truncate max-w-[200px]">
                      {companyName}
                    </div>
                    <div className="text-[11px] text-gray-500 dark:text-gray-400 truncate max-w-[200px]">
                      {contactPerson}
                    </div>
                  </td>

                  {/* Location */}
                  <td className="px-3 py-3.5 whitespace-nowrap">
                    <div className="flex items-center gap-1 text-gray-600 dark:text-gray-300">
                      <MapPin className="h-3 w-3 text-gray-400 shrink-0" />
                      <span className="truncate max-w-[120px]">{city}</span>
                    </div>
                  </td>

                  {/* Sites Count */}
                  <td className="px-3 py-3.5 text-center whitespace-nowrap">
                    <span className="inline-flex items-center justify-center rounded-lg bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-700 dark:bg-slate-800 dark:text-gray-300">
                      {sitesCount} {sitesCount === 1 ? "Site" : "Sites"}
                    </span>
                  </td>

                  {/* Total Amount */}
                  <td className="px-3 py-3.5 text-right whitespace-nowrap">
                    <div className="font-bold text-gray-900 dark:text-white">
                      {formatRupees(q.total)}
                    </div>
                    <div className="text-[10px] text-gray-400">
                      Subtotal: {formatRupees(q.subtotal)}
                    </div>
                  </td>

                  {/* Status Badge */}
                  <td className="px-3 py-3.5 text-center whitespace-nowrap">
                    <span
                      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${
                        STATUS_STYLES[status] || STATUS_STYLES.Draft
                      }`}
                    >
                      {status}
                    </span>
                  </td>

                  {/* Valid Until */}
                  <td className="px-3 py-3.5 text-center whitespace-nowrap text-[11px] text-gray-500 dark:text-gray-400">
                    {formatDate(q.validUntil)}
                  </td>

                  {/* Actions */}
                  <td className="py-3.5 pl-3 pr-4 text-right whitespace-nowrap">
                    <div className="flex items-center justify-end gap-1.5">
                      {/* View Details */}
                      <button
                        type="button"
                        onClick={() => onView(q)}
                        className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-slate-800 dark:hover:text-white transition cursor-pointer"
                        title="View Proposal Details (Step 3)"
                      >
                        <EyeIcon className="h-3.5 w-3.5" />
                      </button>

                      {/* Edit Draft Proposal */}
                      {q.status === "Draft" && (
                        <button
                          type="button"
                          onClick={() => onEdit(q)}
                          className="rounded-lg p-1.5 text-amber-600 hover:bg-amber-50 dark:text-amber-400 dark:hover:bg-amber-950/40 transition cursor-pointer"
                          title="Edit Draft Proposal (Step 2)"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                      )}

                      {/* PDF Document Preview */}
                      <button
                        type="button"
                        onClick={() => onDocument(q)}
                        className="rounded-lg p-1.5 text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-950/40 transition cursor-pointer"
                        title="View Branded PDF (Step 4)"
                      >
                        <Download className="h-3.5 w-3.5" />
                      </button>

                      {/* Tracking / Convert */}
                      <button
                        type="button"
                        onClick={() => onTrack(q)}
                        className={`rounded-lg p-1.5 transition cursor-pointer ${
                          isAccepted
                            ? "text-emerald-700 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-950/40 dark:text-emerald-300"
                            : "text-amber-600 hover:bg-amber-50 dark:text-amber-400 dark:hover:bg-amber-950/40"
                        }`}
                        title={isAccepted ? "Convert to Campaign (Step 5)" : "Track Status (Step 5)"}
                      >
                        <ArrowUpRight className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-gray-200 px-4 py-3 text-xs text-gray-500 dark:border-slate-800 dark:text-gray-400">
        <div>
          Showing{" "}
          <span className="font-semibold text-gray-800 dark:text-gray-200">
            {Math.min(totalItems, (currentPage - 1) * pageSize + 1)}
          </span>{" "}
          to{" "}
          <span className="font-semibold text-gray-800 dark:text-gray-200">
            {Math.min(totalItems, currentPage * pageSize)}
          </span>{" "}
          of{" "}
          <span className="font-semibold text-gray-800 dark:text-gray-200">
            {totalItems}
          </span>{" "}
          quotations
        </div>

        <div className="flex items-center gap-2">
          <select
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            className="rounded-lg border border-gray-200 bg-white px-2 py-1 text-xs text-gray-700 outline-none dark:border-slate-800 dark:bg-slate-900 dark:text-gray-300"
          >
            <option value={10}>10 per page</option>
            <option value={25}>25 per page</option>
            <option value={50}>50 per page</option>
          </select>

          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={currentPage <= 1}
              onClick={() => onPageChange(currentPage - 1)}
              className="rounded-lg border border-gray-200 p-1 text-gray-600 hover:bg-gray-50 disabled:opacity-40 dark:border-slate-800 dark:text-gray-400 dark:hover:bg-slate-800"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>
            <span className="px-2 font-medium">
              Page {currentPage} of {totalPages}
            </span>
            <button
              type="button"
              disabled={currentPage >= totalPages}
              onClick={() => onPageChange(currentPage + 1)}
              className="rounded-lg border border-gray-200 p-1 text-gray-600 hover:bg-gray-50 disabled:opacity-40 dark:border-slate-800 dark:text-gray-400 dark:hover:bg-slate-800"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
