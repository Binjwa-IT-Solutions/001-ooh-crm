"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { syncCampaignPow, getAllCampaignPows } from "@/modules/proofs/api";
import CampaignDetailModal from "./CampaignDetailModal";
import type { Campaign } from "../types";

const ITEMS_PER_PAGE = 25;

export function isCampaignLocked(status?: string | null): boolean {
  if (!status) return false;
  const s = status.trim().toLowerCase();
  return (
    s === "campaign end" ||
    s === "completed" ||
    s === "complete" ||
    s === "rejected" ||
    s === "campaign rejected" ||
    s === "cancelled"
  );
}

interface Props {
  campaigns: Campaign[];
  selectedCampaignId?: string | null;
  onSelectCampaign?: (campaign: Campaign) => void;
  onEdit: (campaign: Campaign) => void;
  onStatusChange: (
    campaign: Campaign,
    status: Campaign["status"],
    reason?: string,
  ) => void;
  canManageCampaigns?: boolean;
}

export default function CampaignTable({
  campaigns,
  selectedCampaignId,
  onSelectCampaign,
  onEdit,
  onStatusChange,
  canManageCampaigns = true,
}: Props) {
  const [currentPage, setCurrentPage] = useState(1);
  const [detailCampaign, setDetailCampaign] = useState<Campaign | null>(null);
  const [rejectingCampaign, setRejectingCampaign] = useState<Campaign | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [rejectionError, setRejectionError] = useState("");

  const [powUpdatedCampaignIds, setPowUpdatedCampaignIds] = useState<Set<string>>(new Set());
  const [updatingPowId, setUpdatingPowId] = useState<string | null>(null);
  const [powToast, setPowToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  useEffect(() => {
    getAllCampaignPows()
      .then((pows) => {
        if (Array.isArray(pows)) {
          const ids = new Set<string>();
          pows.forEach((p) => {
            if (p.campaignId) ids.add(String(p.campaignId));
          });
          setPowUpdatedCampaignIds((prev) => {
            const merged = new Set(prev);
            ids.forEach((id) => merged.add(id));
            return merged;
          });
        }
      })
      .catch(() => {});
  }, []);

  async function handleUpdatePow(campaign: Campaign) {
    if (!campaign._id || updatingPowId === campaign._id) return;
    try {
      setUpdatingPowId(campaign._id);
      await syncCampaignPow(campaign._id);
      campaign.isPowUpdated = true;
      setPowUpdatedCampaignIds((prev) => {
        const next = new Set(prev);
        next.add(campaign._id);
        return next;
      });
      setPowToast({
        message: `POW updated successfully for ${campaign.campaignCode ? `(${campaign.campaignCode}) ` : ""}${campaign.name}!`,
        type: "success",
      });
      setTimeout(() => {
        setPowToast((curr) => (curr?.message.includes(campaign.name) ? null : curr));
      }, 5000);
    } catch (err: any) {
      setPowToast({
        message: err?.message || "Failed to update POW. Please try again.",
        type: "error",
      });
      setTimeout(() => setPowToast(null), 5000);
    } finally {
      setUpdatingPowId(null);
    }
  }

  function handleConfirmReject() {
    if (!rejectionReason.trim()) {
      setRejectionError("Please enter a note / reason for rejecting this campaign.");
      return;
    }
    if (rejectingCampaign) {
      onStatusChange(rejectingCampaign, "Rejected", rejectionReason.trim());
      setRejectingCampaign(null);
      setRejectionReason("");
      setRejectionError("");
    }
  }

  const totalPages = Math.max(1, Math.ceil(campaigns.length / ITEMS_PER_PAGE));

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(1);
    }
  }, [totalPages, currentPage]);

  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = Math.min(startIndex + ITEMS_PER_PAGE, campaigns.length);
  const visibleCampaigns = campaigns.slice(startIndex, endIndex);

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-200 px-5 py-4">
        <div>
          <h2 className="text-base font-semibold text-gray-900">
            Campaigns
          </h2>

          <p className="mt-1 text-sm text-gray-500">
            {campaigns.length}{" "}
            {campaigns.length === 1
              ? "campaign"
              : "campaigns"}{" "}
            found {totalPages > 1 && `(Page ${currentPage} of ${totalPages} • 25 per page)`}
          </p>
        </div>
      </div>

      {/* POW Feedback Notification */}
      {powToast && (
        <div
          className={`flex items-center justify-between border-b px-5 py-2.5 text-xs font-medium transition-all ${
            powToast.type === "success"
              ? "bg-emerald-50 border-emerald-200 text-emerald-800"
              : "bg-rose-50 border-rose-200 text-rose-800"
          }`}
        >
          <div className="flex items-center gap-2">
            <span className="font-bold">{powToast.type === "success" ? "✓" : "⚠️"}</span>
            <span>{powToast.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setPowToast(null)}
            className="text-xs font-semibold opacity-70 hover:opacity-100"
          >
            ✕
          </button>
        </div>
      )}

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50/90">
            <tr>
              <th className="whitespace-nowrap px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                Code
              </th>

              <th className="whitespace-nowrap px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                Campaign Name
              </th>

              <th className="whitespace-nowrap px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                Client Name
              </th>

              <th className="whitespace-nowrap px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                Quotation
              </th>

              <th className="whitespace-nowrap px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                State & City
              </th>

              <th className="whitespace-nowrap px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                Manager
              </th>

              <th className="whitespace-nowrap px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                Duration
              </th>

              <th className="whitespace-nowrap px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                Duration Count
              </th>

              <th className="whitespace-nowrap px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                Site
              </th>

              <th className="whitespace-nowrap px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                Value
              </th>

              <th className="whitespace-nowrap px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                Status
              </th>

              <th className="whitespace-nowrap px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-gray-500">
                Action
              </th>
            </tr>
          </thead>

          <tbody className="divide-y divide-gray-100 bg-white">
            {visibleCampaigns.map((campaign) => {
              const leadInfo = getLeadDisplayName(campaign.leadId);
              const managerName = getManagerDisplayName(campaign.assignedManager);
              const durationCount = getDurationCount(campaign.startDate, campaign.endDate);

              return (
                <tr
                  key={campaign._id}
                  onClick={() => onSelectCampaign?.(campaign)}
                  className={`cursor-pointer transition-colors ${
                    selectedCampaignId === campaign._id
                      ? "bg-[#FFF5F5] ring-1 ring-inset ring-[#8B2424]/30"
                      : "hover:bg-gray-50/80"
                  }`}
                >
                  {/* Code - Compact touch/click button to show full details */}
                  <td className="whitespace-nowrap px-4 py-3">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDetailCampaign(campaign);
                      }}
                      className="group inline-flex items-center gap-1.5 rounded-md border border-gray-200 bg-gray-50 px-2 py-0.5 font-mono text-[11px] font-semibold text-gray-800 shadow-2xs transition hover:border-[#8B2424] hover:bg-[#FFF5F5] hover:text-[#8B2424] active:scale-95 cursor-pointer"
                      title="Touch or click to view full campaign details"
                    >
                      <span>{campaign.campaignCode}</span>
                      <span className="text-[10px] text-gray-400 group-hover:text-[#8B2424]">ℹ️</span>
                    </button>
                  </td>

                  {/* Campaign Name */}
                  <td className="max-w-[200px] px-4 py-3">
                    <span className="block truncate text-xs font-semibold text-gray-900" title={campaign.name}>
                      {campaign.name}
                    </span>
                  </td>

                  {/* Client Name */}
                  <td className="max-w-[190px] px-4 py-3">
                    <div className="truncate text-xs font-medium text-gray-900" title={leadInfo.primary}>
                      {leadInfo.primary}
                    </div>
                    {leadInfo.secondary && (
                      <div className="truncate text-[11px] text-gray-500" title={leadInfo.secondary}>
                        {leadInfo.secondary}
                      </div>
                    )}
                  </td>

                  {/* Quotation (Quotation Name, Quotation No, PI No) */}
                  <td className="max-w-[180px] px-4 py-3">
                    {campaign.quotationName || campaign.quotationNo || campaign.piNo ? (
                      <div className="space-y-0.5">
                        {campaign.quotationName && (
                          <div className="truncate text-xs font-medium text-gray-900" title={campaign.quotationName}>
                            {campaign.quotationName}
                          </div>
                        )}
                        {campaign.quotationNo && (
                          <div className="text-[10px] font-medium text-gray-500">
                            Q: {campaign.quotationNo}
                          </div>
                        )}
                        {campaign.piNo && (
                          <div className="text-[10px] font-medium text-gray-500">
                            PI: {campaign.piNo}
                          </div>
                        )}
                      </div>
                    ) : (
                      <span className="text-xs text-gray-400">—</span>
                    )}
                  </td>

                  {/* State & City */}
                  <td className="whitespace-nowrap px-4 py-3">
                    {renderStateCity(campaign.city, campaign.state)}
                  </td>

                  {/* Manager */}
                  <td className="whitespace-nowrap px-4 py-3">
                    <span className="inline-flex items-center gap-1 rounded-md bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">
                      <span className="text-[11px] text-gray-400">👤</span>
                      {managerName}
                    </span>
                  </td>

                  {/* Duration */}
                  <td className="whitespace-nowrap px-4 py-3">
                    <div className="text-xs text-gray-700 leading-tight">
                      <div>
                        {formatDate(campaign.startDate)}
                      </div>

                      <div className="my-0.5 text-[10px] text-gray-400">
                        to
                      </div>

                      <div>
                        {formatDate(campaign.endDate)}
                      </div>
                    </div>
                  </td>

                  {/* Duration Count */}
                  <td className="whitespace-nowrap px-4 py-3">
                    <span className="inline-flex items-center rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700">
                      {durationCount}
                    </span>
                  </td>

                  {/* Site */}
                  <td className="whitespace-nowrap px-4 py-3">
                    <span className="rounded-md bg-[#F9DADA] px-2 py-0.5 text-[11px] font-semibold text-[#8B2424]">
                      {campaign.siteIds.length}{" "}
                      {campaign.siteIds.length === 1
                        ? "site"
                        : "sites"}
                    </span>
                  </td>

                  {/* Value */}
                  <td className="whitespace-nowrap px-4 py-3">
                    <span className="text-xs font-semibold text-gray-900">
                      {formatValue(
                        campaign.contractedValue,
                      )}
                    </span>
                  </td>

                  {/* Status */}
                  <td className="whitespace-nowrap px-4 py-3">
                    <StatusBadge status={campaign.status} />
                  </td>

                  <td className="whitespace-nowrap px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      {!canManageCampaigns ? (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setDetailCampaign(campaign);
                          }}
                          className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 shadow-2xs transition hover:border-[#8B2424] hover:bg-[#F9DADA] hover:text-[#8B2424]"
                        >
                          View Details
                        </button>
                      ) : (() => {
                        const isPowDone =
                          Boolean(campaign.isPowUpdated) ||
                          powUpdatedCampaignIds.has(campaign._id);

                        if (isPowDone) {
                          return (
                            <div className="flex items-center justify-end gap-1.5">
                              {!isCampaignLocked(campaign.status) && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onEdit(campaign);
                                  }}
                                  className="rounded-lg border border-[#8B2424] bg-[#8B2424] px-2.5 py-1 text-xs font-semibold text-[#F9DADA] transition hover:border-[#A8383B] hover:bg-[#A8383B] hover:text-white"
                                >
                                  Edit
                                </button>
                              )}
                              <span
                                className="inline-flex items-center gap-1.5 rounded-md border border-emerald-300 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 shadow-xs cursor-default select-none"
                                title={`POW has already been updated for this campaign${campaign.powUpdatedAt ? ` on ${formatDate(campaign.powUpdatedAt)}` : ""}`}
                              >
                                <span className="text-xs font-bold text-emerald-600">✓</span>
                                <span>POW Updated</span>
                              </span>
                              <Link
                                href={`/proofs?campaignId=${campaign._id}#campaign-pow`}
                                onClick={(e) => e.stopPropagation()}
                                className="text-[11px] font-medium text-gray-500 hover:text-[#8B2424] underline"
                                title="View Proof of Work in Proofs"
                              >
                                View
                              </Link>
                            </div>
                          );
                        }

                        if (!isCampaignLocked(campaign.status)) {
                          return (
                            <>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onEdit(campaign);
                                }}
                                className="rounded-lg border border-[#8B2424] bg-[#8B2424] px-3 py-1.5 text-xs font-semibold text-[#F9DADA] transition hover:border-[#A8383B] hover:bg-[#A8383B] hover:text-white"
                              >
                                Edit
                              </button>

                              <ActionStatusDropdown
                                currentStatus={campaign.status}
                                onSelect={(newStatus) => {
                                  if (newStatus === "Rejected") {
                                    setRejectingCampaign(campaign);
                                    setRejectionReason("");
                                    setRejectionError("");
                                  } else {
                                    onStatusChange(campaign, newStatus);
                                  }
                                }}
                              />
                            </>
                          );
                        }

                        return (
                          <button
                            type="button"
                            disabled={updatingPowId === campaign._id}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleUpdatePow(campaign);
                            }}
                            className="inline-flex items-center gap-1.5 rounded-lg border border-[#8B2424] bg-white px-3 py-1.5 text-xs font-semibold text-[#8B2424] shadow-xs transition hover:bg-[#8B2424] hover:text-[#F9DADA] disabled:cursor-not-allowed disabled:opacity-60"
                            title="Update Proof of Work (cannot be re-updated once submitted)"
                          >
                            {updatingPowId === campaign._id ? (
                              <>
                                <span className="inline-block animate-spin">⏳</span>
                                <span>Updating...</span>
                              </>
                            ) : (
                              <>
                                <span>📸</span>
                                <span>Update POW</span>
                              </>
                            )}
                          </button>
                        );
                      })()}
                    </div>
                  </td>
              </tr>
            );
          })}

            {campaigns.length === 0 && (
              <tr>
                <td
                  colSpan={12}
                  className="px-5 py-16 text-center"
                >
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#F9DADA]">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={1.5}
                      stroke="currentColor"
                      className="h-6 w-6 text-[#8B2424]"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5"
                      />
                    </svg>
                  </div>

                  <h3 className="mt-4 text-sm font-semibold text-gray-900">
                    No campaigns found
                  </h3>

                  <p className="mt-1 text-sm text-gray-500">
                    There are no campaigns matching
                    the current filters.
                  </p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Controls (25 per page) */}
      <div className="flex flex-col items-center justify-between gap-3 border-t border-gray-200 bg-white px-5 py-3.5 sm:flex-row">
        <p className="text-sm text-gray-600">
          Showing <span className="font-semibold text-gray-900">{campaigns.length === 0 ? 0 : startIndex + 1}</span> to{" "}
          <span className="font-semibold text-gray-900">{endIndex}</span> of{" "}
          <span className="font-semibold text-gray-900">{campaigns.length}</span> campaigns
          <span className="ml-1 text-xs text-gray-400">(25 per page)</span>
        </p>

        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={currentPage <= 1}
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            className="flex items-center gap-1 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 transition hover:border-[#8B2424] hover:bg-[#F9DADA] hover:text-[#8B2424] disabled:cursor-not-allowed disabled:border-gray-200 disabled:bg-gray-50 disabled:text-gray-400"
          >
            <span>‹</span>
            <span>Previous</span>
          </button>

          <div className="flex items-center gap-1">
            {Array.from({ length: Math.max(1, totalPages) }, (_, idx) => idx + 1)
              .filter((page) => {
                if (page === 1 || page === totalPages) return true;
                if (Math.abs(page - currentPage) <= 1) return true;
                return false;
              })
              .reduce<(number | string)[]>((acc, page, idx, arr) => {
                if (idx > 0 && page - (arr[idx - 1] as number) > 1) {
                  acc.push("...");
                }
                acc.push(page);
                return acc;
              }, [])
              .map((item, idx) => {
                if (item === "...") {
                  return (
                    <span key={`dots-${idx}`} className="px-1 text-xs text-gray-400">
                      …
                    </span>
                  );
                }
                const pageNum = item as number;
                const isActive = pageNum === currentPage;
                return (
                  <button
                    key={pageNum}
                    type="button"
                    onClick={() => setCurrentPage(pageNum)}
                    className={`h-7 min-w-[28px] rounded-lg px-2 text-xs font-semibold transition ${
                      isActive
                        ? "bg-[#8B2424] text-[#F9DADA] shadow-sm"
                        : "border border-gray-200 bg-white text-gray-700 hover:border-[#8B2424] hover:bg-[#F9DADA] hover:text-[#8B2424]"
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}
          </div>

          <button
            type="button"
            disabled={currentPage >= totalPages}
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            className="flex items-center gap-1 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 transition hover:border-[#8B2424] hover:bg-[#F9DADA] hover:text-[#8B2424] disabled:cursor-not-allowed disabled:border-gray-200 disabled:bg-gray-50 disabled:text-gray-400"
          >
            <span>Next</span>
            <span>›</span>
          </button>
        </div>
      </div>

      {/* Rejection Note Modal */}
      {rejectingCampaign && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs"
          onClick={() => {
            setRejectingCampaign(null);
            setRejectionReason("");
            setRejectionError("");
          }}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl ring-1 ring-black/5"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-rose-100 text-rose-600">
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>

              <div className="flex-1">
                <h3 className="text-base font-bold text-gray-900">
                  Reject Campaign
                </h3>
                <p className="mt-0.5 text-xs text-gray-500">
                  <span className="font-semibold text-gray-700">{rejectingCampaign.campaignCode}</span> • {rejectingCampaign.name}
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  setRejectingCampaign(null);
                  setRejectionReason("");
                  setRejectionError("");
                }}
                className="text-gray-400 hover:text-gray-600 text-lg leading-none"
              >
                ✕
              </button>
            </div>

            {/* Note prompt */}
            <div className="mt-4">
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-700">
                Rejection Note / Reason <span className="text-rose-600">*</span>
              </label>
              <p className="mt-1 text-xs text-gray-500">
                Please enter a reason or note explaining why this campaign is being rejected.
              </p>

              <textarea
                value={rejectionReason}
                onChange={(e) => {
                  setRejectionReason(e.target.value);
                  if (rejectionError) setRejectionError("");
                }}
                rows={3}
                placeholder="Write rejection note here (mandatory)..."
                autoFocus
                className={`mt-2 w-full rounded-xl border p-3 text-xs text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 ${
                  rejectionError
                    ? "border-rose-400 focus:border-rose-500 focus:ring-rose-200"
                    : "border-gray-300 focus:border-rose-500 focus:ring-rose-100"
                }`}
              />

              {rejectionError && (
                <p className="mt-1 text-xs font-medium text-rose-600">
                  {rejectionError}
                </p>
              )}
            </div>

            {/* Actions */}
            <div className="mt-5 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => {
                  setRejectingCampaign(null);
                  setRejectionReason("");
                  setRejectionError("");
                }}
                className="rounded-lg border border-gray-300 px-4 py-2 text-xs font-semibold text-gray-700 transition hover:bg-gray-50"
              >
                Cancel
              </button>

              <button
                type="button"
                onClick={handleConfirmReject}
                className="rounded-lg bg-rose-600 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-rose-700 focus:outline-none focus:ring-2 focus:ring-rose-500 focus:ring-offset-2"
              >
                Confirm Reject
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Campaign Detail Modal (shown when code is touched/clicked) */}
      <CampaignDetailModal
        campaign={detailCampaign}
        isOpen={Boolean(detailCampaign)}
        onClose={() => setDetailCampaign(null)}
        onEdit={onEdit}
        isPowUpdated={
          detailCampaign
            ? Boolean(detailCampaign.isPowUpdated) ||
              powUpdatedCampaignIds.has(detailCampaign._id)
            : false
        }
      />
    </div>
  );
}

function ActionStatusDropdown({
  currentStatus,
  onSelect,
}: {
  currentStatus: Campaign["status"];
  onSelect: (status: Campaign["status"]) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const STATUS_CHOICES: {
    label: string;
    value: Campaign["status"];
    badgeClass: string;
  }[] = [
    {
      label: "In Progress",
      value: "In Progress",
      badgeClass: "hover:bg-blue-50 text-blue-800",
    },
    {
      label: "Campaign Live",
      value: "Campaign Live",
      badgeClass: "hover:bg-emerald-50 text-emerald-800",
    },
    {
      label: "Campaign End",
      value: "Campaign End",
      badgeClass: "hover:bg-purple-50 text-purple-800",
    },
    {
      label: "Rejected",
      value: "Rejected",
      badgeClass: "hover:bg-rose-50 text-rose-800",
    },
  ];

  return (
    <div ref={ref} className="relative inline-block text-left">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen((prev) => !prev);
        }}
        className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold shadow-xs transition ${
          open
            ? "border-[#8B2424] bg-[#FFF5F5] text-[#8B2424] ring-2 ring-[#F9DADA]"
            : "border-gray-300 bg-white text-gray-700 hover:border-[#8B2424] hover:bg-[#FFF5F5] hover:text-[#8B2424]"
        }`}
      >
        <span>Action</span>
        <span className="text-[10px] text-gray-500">▾</span>
      </button>

      {open && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="absolute right-0 z-50 mt-1.5 w-44 origin-top-right rounded-xl border border-gray-200 bg-white py-1.5 shadow-xl ring-1 ring-black/5"
        >
          <div className="border-b border-gray-100 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-gray-400">
            Set Status
          </div>
          {STATUS_CHOICES.map((choice) => {
            const current = (currentStatus || "").trim().toLowerCase();
            const choiceVal = choice.value.trim().toLowerCase();
            const isSelected =
              choiceVal === "campaign end"
                ? current === "campaign end" || current === "complete" || current === "completed"
                : choiceVal === "in progress"
                ? current === "in progress" || current === "inprogress" || current === "draft" || current === "approved"
                : choiceVal === "campaign live"
                ? current === "campaign live"
                : choiceVal === "rejected"
                ? current === "rejected" || current === "cancelled" || current === "campaign rejected"
                : current === choiceVal;

            return (
              <button
                key={choice.value}
                type="button"
                onClick={() => {
                  onSelect(choice.value);
                  setOpen(false);
                }}
                className={`flex w-full items-center justify-between px-3 py-2 text-left text-xs font-medium transition ${
                  choice.badgeClass
                } ${
                  isSelected ? "bg-[#FFF5F5] font-bold text-[#8B2424]" : ""
                }`}
              >
                <span>{choice.label}</span>
                {isSelected && (
                  <span className="text-[11px] font-bold text-[#8B2424]">✓</span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function StatusBadge({
  status,
}: {
  status: Campaign["status"];
}) {
  const styles: Record<string, string> = {
    "In Progress": "bg-blue-50 text-blue-800 ring-blue-600/20",
    "Campaign Live": "bg-emerald-50 text-emerald-800 ring-emerald-600/20",
    "Campaign End": "bg-purple-50 text-purple-800 ring-purple-600/20",
    Rejected: "bg-rose-50 text-rose-800 ring-rose-600/20",
  };

  const dots: Record<string, string> = {
    "In Progress": "bg-blue-500",
    "Campaign Live": "bg-emerald-500",
    "Campaign End": "bg-purple-500",
    Rejected: "bg-rose-500",
  };

  // Only 4 statuses: "In Progress", "Campaign Live", "Campaign End", "Rejected"
  // "campiagn end hi complete hai"
  const normalizedLabel = (() => {
    const s = (status || "").trim().toLowerCase();
    if (s === "complete" || s === "completed" || s === "campaign end") {
      return "Campaign End";
    }
    if (s === "in progress" || s === "inprogress" || s === "draft" || s === "approved") {
      return "In Progress";
    }
    if (s === "campaign live") {
      return "Campaign Live";
    }
    if (s === "rejected" || s === "cancelled" || s === "campaign rejected") {
      return "Rejected";
    }
    return status || "In Progress";
  })();

  const styleClass = styles[normalizedLabel] || "bg-gray-100 text-gray-700 ring-gray-500/20";
  const dotClass = dots[normalizedLabel] || "bg-gray-400";

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-medium ring-1 ring-inset ${styleClass}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${dotClass}`} />
      {normalizedLabel}
    </span>
  );
}

function formatDate(value: string) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "—";
  }

  return date.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatValue(value: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(value);
}

function getLeadDisplayName(lead: Campaign["leadId"]): {
  primary: string;
  secondary?: string;
} {
  if (!lead) return { primary: "—" };
  if (typeof lead === "string") return { primary: `#${lead.slice(-6)}` };
  const company = lead.companyName || lead.company;
  const person = lead.contactPerson || lead.name;
  if (company && person && company !== person) {
    return { primary: company, secondary: person };
  }
  return { primary: company || person || lead.email || "—" };
}

function getManagerDisplayName(
  manager: Campaign["assignedManager"],
): string {
  if (!manager) return "Unassigned";
  if (typeof manager === "string") return `#${manager.slice(-6)}`;
  return manager.name || manager.email || "Unassigned";
}

function getDurationCount(startDateStr?: string, endDateStr?: string): string {
  if (!startDateStr || !endDateStr) return "—";
  const start = new Date(startDateStr);
  const end = new Date(endDateStr);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return "—";
  }

  const oneDayMs = 24 * 60 * 60 * 1000;
  const startDay = Math.floor(start.getTime() / oneDayMs);
  const endDay = Math.floor(end.getTime() / oneDayMs);
  if (endDay < startDay) return "0 Days";
  const diffDays = endDay - startDay + 1;
  return `${diffDays} ${diffDays === 1 ? "Day" : "Days"}`;
}

function renderStateCity(city?: string | null, state?: string | null) {
  let c = city?.trim() || "";
  let s = state?.trim() || "";

  // If city contains repeated comma-separated parts like "Delhi, Delhi"
  if (c.includes(",")) {
    const parts = c.split(",").map((p) => p.trim()).filter(Boolean);
    const uniqueParts = Array.from(new Set(parts.map((p) => p.toLowerCase())))
      .map((lower) => parts.find((p) => p.toLowerCase() === lower)!);
    c = uniqueParts.join(", ");
  }

  // If state contains repeated comma-separated parts
  if (s.includes(",")) {
    const parts = s.split(",").map((p) => p.trim()).filter(Boolean);
    const uniqueParts = Array.from(new Set(parts.map((p) => p.toLowerCase())))
      .map((lower) => parts.find((p) => p.toLowerCase() === lower)!);
    s = uniqueParts.join(", ");
  }

  if (!c && !s) {
    return <span className="text-xs text-gray-400">—</span>;
  }

  // Check if city and state are identical or one contains the other (e.g. "Delhi" / "Delhi")
  const isDuplicate =
    Boolean(c && s) &&
    (c.toLowerCase() === s.toLowerCase() ||
      c.toLowerCase().includes(s.toLowerCase()) ||
      s.toLowerCase().includes(c.toLowerCase()));

  if (!s || !c || isDuplicate) {
    return (
      <div className="text-xs font-medium text-gray-900">
        {c || s}
      </div>
    );
  }

  return (
    <div>
      <div className="text-xs font-medium text-gray-900">
        {c}
      </div>
      <div className="text-[11px] text-gray-500">
        {s}
      </div>
    </div>
  );
}