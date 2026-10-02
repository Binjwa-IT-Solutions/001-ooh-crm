"use client";

import { useEffect, useState } from "react";
import type { Campaign } from "../types";

const ITEMS_PER_PAGE = 25;

interface Props {
  campaigns: Campaign[];
  selectedCampaignId?: string | null;
  onSelectCampaign?: (campaign: Campaign) => void;
  onEdit: (campaign: Campaign) => void;
  onStatusChange: (
    campaign: Campaign,
    status: Campaign["status"],
  ) => void;
}

export default function CampaignTable({
  campaigns,
  selectedCampaignId,
  onSelectCampaign,
  onEdit,
  onStatusChange,
}: Props) {
  const [currentPage, setCurrentPage] = useState(1);

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

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="min-w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="whitespace-nowrap px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">
                Code
              </th>

              <th className="whitespace-nowrap px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">
                Campaign
              </th>

              <th className="whitespace-nowrap px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">
                Client / Lead
              </th>

              <th className="whitespace-nowrap px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">
                Manager
              </th>

              <th className="whitespace-nowrap px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">
                City
              </th>

              <th className="whitespace-nowrap px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">
                Duration
              </th>

              <th className="whitespace-nowrap px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">
                Sites
              </th>

              <th className="whitespace-nowrap px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">
                Value
              </th>

              <th className="whitespace-nowrap px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wide text-gray-600">
                Status
              </th>

              <th className="whitespace-nowrap px-5 py-3.5 text-right text-xs font-semibold uppercase tracking-wide text-gray-600">
                Action
              </th>
            </tr>
          </thead>

          <tbody className="divide-y divide-gray-100">
            {visibleCampaigns.map((campaign) => {
              const leadInfo = getLeadDisplayName(campaign.leadId);
              const managerName = getManagerDisplayName(campaign.assignedManager);

              return (
                <tr
                  key={campaign._id}
                  onClick={() => onSelectCampaign?.(campaign)}
                  className={`cursor-pointer transition-colors ${
                    selectedCampaignId === campaign._id
                      ? "bg-[#FFF5F5] ring-2 ring-inset ring-[#8B2424]/30"
                      : "hover:bg-gray-50"
                  }`}
                >
                  <td className="whitespace-nowrap px-5 py-4">
                    <span className="font-semibold text-gray-900">
                      {campaign.campaignCode}
                    </span>
                    {campaign.quotationNo && (
                      <div className="text-[11px] font-normal text-gray-500">
                        Q: {campaign.quotationNo}
                      </div>
                    )}
                    {campaign.piNo && (
                      <div className="text-[11px] font-normal text-gray-500">
                        PI: {campaign.piNo}
                      </div>
                    )}
                  </td>

                  <td className="max-w-50 px-5 py-4">
                    <span className="block truncate text-sm font-medium text-gray-900">
                      {campaign.name}
                    </span>
                  </td>

                  <td className="max-w-[200px] px-5 py-4">
                    <div className="truncate text-sm font-medium text-gray-900">
                      {leadInfo.primary}
                    </div>
                    {leadInfo.secondary && (
                      <div className="truncate text-xs text-gray-500">
                        {leadInfo.secondary}
                      </div>
                    )}
                  </td>

                  <td className="whitespace-nowrap px-5 py-4">
                    <span className="inline-flex items-center gap-1.5 rounded-md bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-800">
                      <span className="text-gray-500">👤</span>
                      {managerName}
                    </span>
                  </td>

                  <td className="whitespace-nowrap px-5 py-4">
                    <span className="text-sm text-gray-700">
                      {campaign.city}
                      {campaign.state && (
                        <span className="text-gray-400">, {campaign.state}</span>
                      )}
                    </span>
                  </td>

                  <td className="whitespace-nowrap px-5 py-4">
                    <div className="text-sm text-gray-700">
                      <div>
                        {formatDate(campaign.startDate)}
                      </div>

                      <div className="my-0.5 text-xs text-gray-400">
                        to
                      </div>

                      <div>
                        {formatDate(campaign.endDate)}
                      </div>
                    </div>
                  </td>

                  <td className="whitespace-nowrap px-5 py-4">
                    <span className="rounded-md bg-[#F9DADA] px-2.5 py-1 text-xs font-medium text-[#8B2424]">
                      {campaign.siteIds.length}{" "}
                      {campaign.siteIds.length === 1
                        ? "site"
                        : "sites"}
                    </span>
                  </td>

                  <td className="whitespace-nowrap px-5 py-4">
                    <span className="text-sm font-medium text-gray-900">
                      {formatValue(
                        campaign.contractedValue,
                      )}
                    </span>
                  </td>

                  <td className="whitespace-nowrap px-5 py-4">
                    <StatusBadge status={campaign.status} />
                  </td>

                  <td className="whitespace-nowrap px-5 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {campaign.status !== "Campaign End" &&
                        campaign.status !== "Rejected" &&
                        campaign.status !== "Completed" &&
                        campaign.status !== "Cancelled" && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onEdit(campaign);
                            }}
                            className="rounded-lg border border-[#8B2424] bg-[#8B2424] px-3.5 py-2 text-sm font-medium text-[#F9DADA] transition hover:border-[#A8383B] hover:bg-[#A8383B] hover:text-white"
                          >
                            Edit
                          </button>
                        )}

                      {campaign.status === "Draft" && (
                        <ActionButton
                          label="Go Live"
                          onClick={() =>
                            onStatusChange(
                              campaign,
                              "Campaign Live",
                            )
                          }
                        />
                      )}

                      {campaign.status === "Approved" && (
                        <ActionButton
                          label="Go Live"
                          onClick={() =>
                            onStatusChange(
                              campaign,
                              "Campaign Live",
                            )
                          }
                        />
                      )}

                      {(campaign.status === "Campaign Live" ||
                        campaign.status === "InProgress" ||
                        campaign.status === "In Progress") && (
                        <ActionButton
                          label="End Campaign"
                          onClick={() =>
                            onStatusChange(
                              campaign,
                              "Campaign End",
                            )
                          }
                        />
                      )}

                      {campaign.status !== "Campaign End" &&
                        campaign.status !== "Completed" &&
                        campaign.status !== "Rejected" &&
                        campaign.status !== "Cancelled" && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onStatusChange(
                                campaign,
                                "Rejected",
                              );
                            }}
                            className="rounded-lg border border-gray-300 bg-white px-3.5 py-2 text-sm font-medium text-gray-700 transition hover:border-[#8B2424] hover:bg-[#8B2424] hover:text-[#F9DADA]"
                          >
                            Reject
                          </button>
                        )}

                      {(campaign.status === "Campaign End" ||
                        campaign.status === "Rejected" ||
                        campaign.status === "Completed" ||
                        campaign.status === "Cancelled") && (
                        <span className="text-sm text-gray-400 font-medium px-2">
                          —
                        </span>
                      )}
                    </div>
                </td>
              </tr>
            );
          })}

            {campaigns.length === 0 && (
              <tr>
                <td
                  colSpan={10}
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
    </div>
  );
}

function ActionButton({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className="rounded-lg border border-[#8B2424] bg-[#8B2424] px-3.5 py-2 text-sm font-medium text-[#F9DADA] transition hover:border-[#A8383B] hover:bg-[#A8383B] hover:text-white"
    >
      {label}
    </button>
  );
}

function StatusBadge({
  status,
}: {
  status: Campaign["status"];
}) {
  const styles: Record<
    Campaign["status"],
    string
  > = {
    Draft:
      "bg-gray-100 text-gray-600 ring-gray-500/20",

    Approved:
      "bg-[#F9DADA] text-[#8B2424] ring-[#8B2424]/20",

    InProgress:
      "bg-[#F9DADA] text-[#A8333B] ring-[#A8333B]/20",

    Completed:
      "bg-emerald-50 text-emerald-800 ring-emerald-600/20",

    Complete:
      "bg-emerald-50 text-emerald-800 ring-emerald-600/20",

    Cancelled:
      "bg-rose-50 text-rose-800 ring-rose-600/20",

    "In Progress":
      "bg-emerald-50 text-emerald-800 ring-emerald-600/20",

    "Campaign Live":
      "bg-emerald-50 text-emerald-800 ring-emerald-600/20",

    "Campaign End":
      "bg-purple-50 text-purple-800 ring-purple-600/20",

    Rejected:
      "bg-rose-50 text-rose-800 ring-rose-600/20",
  };

  const dots: Record<
    Campaign["status"],
    string
  > = {
    Draft: "bg-gray-400",
    Approved: "bg-[#8B2424]",
    InProgress: "bg-emerald-500",
    Completed: "bg-emerald-500",
    Complete: "bg-emerald-500",
    Cancelled: "bg-rose-500",
    "In Progress": "bg-emerald-500",
    "Campaign Live": "bg-emerald-500",
    "Campaign End": "bg-purple-500",
    Rejected: "bg-rose-500",
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${styles[status]}`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${dots[status]}`}
      />

      {status === "Completed" || status === "Complete" || status === "Campaign End"
        ? "Campaign End"
        : status === "Rejected" || status === "Cancelled"
        ? "Campaign Rejected"
        : status === "InProgress" || status === "In Progress"
        ? "Campaign Live"
        : status}
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