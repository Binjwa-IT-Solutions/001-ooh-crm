"use client";

import type { Campaign } from "../types";

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
            found
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
            {campaigns.map((campaign) => (
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
                </td>

                <td className="max-w-[220px] px-5 py-4">
                  <span className="block truncate text-sm font-medium text-gray-900">
                    {campaign.name}
                  </span>
                </td>

                <td className="whitespace-nowrap px-5 py-4">
                  <span className="text-sm text-gray-700">
                    {campaign.city}
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
                  <div className="flex justify-end gap-2">
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

                    {campaign.status === "Draft" && (
                      <ActionButton
                        label="Approve"
                        onClick={() =>
                          onStatusChange(
                            campaign,
                            "Approved",
                          )
                        }
                      />
                    )}

                    {campaign.status === "Approved" && (
                      <ActionButton
                        label="Start"
                        onClick={() =>
                          onStatusChange(
                            campaign,
                            "InProgress",
                          )
                        }
                      />
                    )}

                    {campaign.status === "InProgress" && (
                      <ActionButton
                        label="Complete"
                        onClick={() =>
                          onStatusChange(
                            campaign,
                            "Completed",
                          )
                        }
                      />
                    )}

                    {campaign.status !== "Completed" &&
                      campaign.status !== "Cancelled" && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onStatusChange(
                              campaign,
                              "Cancelled",
                            );
                          }}
                          className="rounded-lg border border-gray-300 bg-white px-3.5 py-2 text-sm font-medium text-gray-700 transition hover:border-[#8B2424] hover:bg-[#8B2424] hover:text-[#F9DADA]"
                        >
                          Cancel
                        </button>
                      )}
                  </div>
                </td>
              </tr>
            ))}

            {campaigns.length === 0 && (
              <tr>
                <td
                  colSpan={8}
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
      "bg-[#F9DADA] text-[#8B2424] ring-[#8B2424]/20",

    Cancelled:
      "bg-gray-100 text-gray-600 ring-gray-500/20",
  };

  const dots: Record<
    Campaign["status"],
    string
  > = {
    Draft: "bg-gray-400",
    Approved: "bg-[#8B2424]",
    InProgress: "bg-[#A8333B]",
    Completed: "bg-[#8B2424]",
    Cancelled: "bg-gray-400",
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${styles[status]}`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${dots[status]}`}
      />

      {status === "InProgress"
        ? "In Progress"
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