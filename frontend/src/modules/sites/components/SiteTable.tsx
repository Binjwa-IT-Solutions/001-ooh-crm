"use client";

import type { Site } from "../types";

interface Props {
  sites: Site[];
  onEdit: (site: Site) => void;
}

function formatDate(value: string | Date) {
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

function statusClass(status: Site["status"]) {
  switch (status) {
    case "Approved":
      return "bg-green-100 text-green-700";

    case "Pending":
      return "bg-yellow-100 text-yellow-700";

    case "Rejected":
      return "bg-red-100 text-red-700";

    default:
      return "bg-gray-100 text-gray-700";
  }
}

function availabilityClass(
  availability: Site["availability"]
) {
  return availability === "Available"
    ? "bg-green-100 text-green-700"
    : "bg-red-100 text-red-700";
}

function canEdit(site: Site) {
  if (!site.createdAt) {
    return false;
  }

  const created = new Date(
    site.createdAt
  ).getTime();

  if (Number.isNaN(created)) {
    return false;
  }

  return (
    Date.now() - created <
    48 * 60 * 60 * 1000
  );
}

export default function SiteTable({
  sites,
  onEdit,
}: Props) {
  if (!sites.length) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white px-6 py-14 text-center shadow-sm">
        <div className="text-3xl">📋</div>

        <h3 className="mt-3 text-base font-semibold text-gray-800">
          No ATR found
        </h3>

        <p className="mt-1 text-sm text-gray-500">
          Create an ATR or change the filters.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="min-w-[1500px] w-full border-collapse">

          {/* HEADER */}
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50 text-left">

              <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
                ATR No.
              </th>

              <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
                Client
              </th>

              <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
                Sales Person
              </th>

              <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
                Contact
              </th>

              <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
                State
              </th>

              <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
                City
              </th>

              <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
                Location
              </th>

              <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
                Media Type
              </th>

              <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
                Qty
              </th>

              <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
                Start
              </th>

              <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
                End
              </th>

              <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
                Duration
              </th>

              <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
                Vendor
              </th>

              <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
                Availability
              </th>

              <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
                Status
              </th>

              <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
                Action
              </th>

            </tr>
          </thead>

          {/* BODY */}
          <tbody>
            {sites.map((site) => {
              const editable = canEdit(site);

              return (
                <tr
                  key={site._id}
                  className="border-b border-gray-100 last:border-0 hover:bg-gray-50"
                >

                  {/* ATR NO */}
                  <td className="px-4 py-4">
                    <span className="font-semibold text-[#8B2424]">
                      {site.atrNo || "—"}
                    </span>
                  </td>

                  {/* CLIENT */}
                  <td className="px-4 py-4 text-sm font-medium text-gray-800">
                    {site.clientName || "—"}
                  </td>

                  {/* SALES PERSON */}
                  <td className="px-4 py-4 text-sm text-gray-700">
                    {site.salesPersonName || "—"}
                  </td>

                  {/* CONTACT */}
                  <td className="px-4 py-4 text-sm text-gray-700">
                    {site.salesPersonContact || "—"}
                  </td>

                  {/* STATE */}
                  <td className="px-4 py-4 text-sm text-gray-700">
                    {site.state || "—"}
                  </td>

                  {/* CITY */}
                  <td className="px-4 py-4 text-sm text-gray-700">
                    {site.city || "—"}
                  </td>

                  {/* LOCATION */}
                  <td className="px-4 py-4 text-sm text-gray-700">
                    {site.location || "—"}
                  </td>

                  {/* MEDIA TYPE */}
                  <td className="px-4 py-4">
                    <span className="rounded-full bg-[#F9DADA] px-2.5 py-1 text-xs font-medium text-[#8B2424]">
                      {site.mediaType}
                    </span>
                  </td>

                  {/* QUANTITY */}
                  <td className="px-4 py-4 text-center text-sm font-semibold text-gray-800">
                    {site.quantity}
                  </td>

                  {/* START */}
                  <td className="whitespace-nowrap px-4 py-4 text-sm text-gray-600">
                    {formatDate(site.startDate)}
                  </td>

                  {/* END */}
                  <td className="whitespace-nowrap px-4 py-4 text-sm text-gray-600">
                    {formatDate(site.endDate)}
                  </td>

                  {/* DURATION */}
                  <td className="whitespace-nowrap px-4 py-4 text-sm font-medium text-gray-700">
                    {site.duration} Days
                  </td>

                  {/* VENDOR */}
                  <td className="px-4 py-4 text-sm text-gray-700">
                    {site.vendorName || "—"}
                  </td>

                  {/* AVAILABILITY */}
                  <td className="px-4 py-4">
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-medium ${availabilityClass(
                        site.availability
                      )}`}
                    >
                      {site.availability}
                    </span>
                  </td>

                  {/* STATUS */}
                  <td className="px-4 py-4">
                    <span
                      className={`rounded-full px-2.5 py-1 text-xs font-medium ${statusClass(
                        site.status
                      )}`}
                    >
                      {site.status}
                    </span>
                  </td>

                  {/* ACTION */}
                  <td className="px-4 py-4">
                    {editable ? (
                      <button
                        type="button"
                        onClick={() => onEdit(site)}
                        className="rounded-lg border border-[#8B2424] px-3 py-1.5 text-xs font-semibold text-[#8B2424] hover:bg-[#F9DADA]"
                      >
                        Edit
                      </button>
                    ) : (
                      <span className="text-xs text-gray-400">
                        Locked
                      </span>
                    )}
                  </td>

                </tr>
              );
            })}
          </tbody>

        </table>
      </div>
    </div>
  );
}