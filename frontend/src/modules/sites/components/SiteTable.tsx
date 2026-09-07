"use client";

import { useState } from "react";

import type { Site } from "../types";

import {
  formatCost,
  formatDate,
} from "../format";

interface SiteTableProps {
  sites: Site[];
  loading?: boolean;
  onEdit: (site: Site) => void;
}

/* ----------------------------------
   STATUS BADGE
----------------------------------- */

function StatusBadge({
  status,
}: {
  status: Site["status"];
}) {
  if (status === "Active") {
    return (
      <span className="inline-flex whitespace-nowrap rounded-full bg-[#ECF8EF] px-2 py-1 text-[11px] font-medium text-[#2E7D4F]">
        Active
      </span>
    );
  }

  if (status === "Maintenance") {
    return (
      <span className="inline-flex whitespace-nowrap rounded-full bg-[#FFF4E5] px-2 py-1 text-[11px] font-medium text-[#A15C00]">
        Maintenance
      </span>
    );
  }

  return (
    <span className="inline-flex whitespace-nowrap rounded-full bg-[#F2F4F7] px-2 py-1 text-[11px] font-medium text-[#667085]">
      Inactive
    </span>
  );
}

/* ----------------------------------
   SITE TABLE
----------------------------------- */

export default function SiteTable({
  sites,
  loading,
  onEdit,
}: SiteTableProps) {
  const [selectedImage, setSelectedImage] =
    useState<string | null>(null);

  /* ----------------------------------
     LOADING
  ----------------------------------- */

  if (loading) {
    return (
      <div className="rounded-xl border border-[#E8E8EC] bg-white p-10 text-center">
        <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-[#E8E8EC] border-t-[#A8383B]" />

        <p className="mt-3 text-xs text-[#667085]">
          Loading sites...
        </p>
      </div>
    );
  }

  /* ----------------------------------
     EMPTY
  ----------------------------------- */

  if (!sites.length) {
    return (
      <div className="rounded-xl border border-[#E8E8EC] bg-white p-10 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#F9DADA] text-xl text-[#A8383B]">
          +
        </div>

        <h3 className="mt-4 text-sm font-semibold text-[#1F2937]">
          No sites found
        </h3>

        <p className="mt-1 text-xs text-[#667085]">
          Try changing your filters or add a new site.
        </p>
      </div>
    );
  }

  return (
    <>
      {/* =========================================
          TABLE
      ========================================== */}

      <div className="overflow-hidden rounded-xl border border-[#E8E8EC] bg-white">
        <div className="overflow-x-auto">
          <table className="min-w-[1650px] w-full table-auto">
            <thead>
              <tr className="border-b border-[#E8E8EC] bg-[#F7F8FA]">

                {/* IMAGE */}

                <th className="w-[100px] px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-[#667085]">
                  Image
                </th>

                {/* SITE ID */}

                <th className="w-[280px] px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-[#667085]">
                  Site ID
                </th>

                {/* CODE */}

                <th className="w-[110px] px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-[#667085]">
                  Code
                </th>

                {/* CITY */}

                <th className="w-[120px] px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-[#667085]">
                  City
                </th>

                {/* TYPE */}

                <th className="w-[120px] px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-[#667085]">
                  Type
                </th>

                {/* ADDRESS */}

                <th className="w-[250px] px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-[#667085]">
                  Address
                </th>

                {/* SIZE */}

                <th className="w-[120px] px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-[#667085]">
                  Size
                </th>

                {/* COST */}

                <th className="w-[130px] px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-[#667085]">
                  Cost / Day
                </th>

                {/* START DATE */}

                <th className="w-[120px] px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-[#667085]">
                  Start Date
                </th>

                {/* END DATE */}

                <th className="w-[120px] px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-[#667085]">
                  End Date
                </th>

                {/* STATUS */}

                <th className="w-[130px] px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wide text-[#667085]">
                  Status
                </th>

                {/* ACTION */}

                <th className="w-[90px] px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wide text-[#667085]">
                  Action
                </th>
              </tr>
            </thead>

            <tbody>
              {sites.map((site) => {
                const imageUrl =
                  site.photos?.[0];

                return (
                  <tr
                    key={site._id}
                    className="border-b border-[#E8E8EC] last:border-0 hover:bg-[#FCFCFD]"
                  >

                    {/* =================================
                        IMAGE
                    ================================== */}

                    <td className="px-4 py-3">
                      {imageUrl ? (
                        <button
                          type="button"
                          onClick={() =>
                            setSelectedImage(
                              imageUrl
                            )
                          }
                          className="group relative block h-12 w-16 overflow-hidden rounded-lg border border-[#E8E8EC] bg-[#F7F8FA]"
                          title="Click to view image"
                        >
                          <img
                            src={imageUrl}
                            alt={`${site.code} site`}
                            className="h-full w-full object-cover transition duration-200 group-hover:scale-110"
                            onError={(
                              event
                            ) => {
                              event.currentTarget.style.display =
                                "none";

                              const parent =
                                event.currentTarget
                                  .parentElement;

                              if (
                                parent
                              ) {
                                parent.innerHTML =
                                  `<span class="flex h-full w-full items-center justify-center text-[10px] font-medium text-[#8B2424]">No Image</span>`;
                              }
                            }}
                          />

                          {/* Hover overlay */}

                          <span className="absolute inset-0 flex items-center justify-center bg-black/0 text-[9px] font-medium text-white opacity-0 transition group-hover:bg-black/35 group-hover:opacity-100">
                            View
                          </span>
                        </button>
                      ) : (
                        <div className="flex h-12 w-16 items-center justify-center rounded-lg bg-[#F9DADA] text-[10px] font-medium text-[#8B2424]">
                          No Image
                        </div>
                      )}
                    </td>

                    {/* =================================
                        SITE ID
                    ================================== */}

                    <td className="px-4 py-3">
                      <span
                        className="whitespace-nowrap font-mono text-[11px] font-medium text-[#667085]"
                        title={site._id}
                      >
                        {site._id}
                      </span>
                    </td>

                    {/* =================================
                        CODE
                    ================================== */}

                    <td className="px-4 py-3">
                      <span className="whitespace-nowrap text-xs font-semibold text-[#A8383B]">
                        {site.code ||
                          site.siteCode ||
                          "—"}
                      </span>
                    </td>

                    {/* =================================
                        CITY
                    ================================== */}

                    <td className="px-4 py-3 text-xs text-[#1F2937]">
                      {site.city || "—"}
                    </td>

                    {/* =================================
                        TYPE
                    ================================== */}

                    <td className="px-4 py-3">
                      <span className="whitespace-nowrap rounded-md bg-[#F9DADA] px-2 py-1 text-[11px] font-medium text-[#8B2424]">
                        {site.type}
                      </span>
                    </td>

                    {/* =================================
                        ADDRESS
                    ================================== */}

                    <td className="px-4 py-3">
                      <p
                        className="max-w-[230px] truncate text-xs text-[#667085]"
                        title={site.address}
                      >
                        {site.address ||
                          "—"}
                      </p>
                    </td>

                    {/* =================================
                        SIZE
                    ================================== */}

                    <td className="whitespace-nowrap px-4 py-3 text-xs text-[#1F2937]">
                      {site.sizeWidth} ×{" "}
                      {site.sizeHeight} ft
                    </td>

                    {/* =================================
                        COST
                    ================================== */}

                    <td className="whitespace-nowrap px-4 py-3 text-xs font-medium text-[#1F2937]">
                      {formatCost(
                        site.baseCostPerDay
                      )}
                    </td>

                    {/* =================================
                        START DATE
                    ================================== */}

                    <td className="whitespace-nowrap px-4 py-3 text-xs text-[#1F2937]">
                      {formatDate(
                        site.startDate
                      )}
                    </td>

                    {/* =================================
                        END DATE
                    ================================== */}

                    <td className="whitespace-nowrap px-4 py-3 text-xs text-[#1F2937]">
                      {formatDate(
                        site.endDate
                      )}
                    </td>

                    {/* =================================
                        STATUS
                    ================================== */}

                    <td className="px-4 py-3">
                      <StatusBadge
                        status={
                          site.status
                        }
                      />
                    </td>

                    {/* =================================
                        ACTION
                    ================================== */}

                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() =>
                          onEdit(site)
                        }
                        className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-[#A8383B] transition hover:bg-[#F9DADA]"
                      >
                        Edit
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* =========================================
          IMAGE PREVIEW MODAL
      ========================================== */}

      {selectedImage && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-6"
          onClick={() =>
            setSelectedImage(null)
          }
        >
          <div
            className="relative max-h-[92vh] max-w-[92vw] rounded-xl bg-white p-3 shadow-2xl"
            onClick={(event) =>
              event.stopPropagation()
            }
          >

            {/* CLOSE BUTTON */}

            <button
              type="button"
              onClick={() =>
                setSelectedImage(null)
              }
              className="absolute right-2 top-2 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-[#8B2424] text-lg font-semibold text-white transition hover:bg-[#F9DADA] hover:text-[#8B2424]"
              aria-label="Close image"
            >
              ×
            </button>

            {/* LARGE IMAGE */}

            <img
              src={selectedImage}
              alt="Site preview"
              className="max-h-[85vh] max-w-[85vw] rounded-lg object-contain"
            />
          </div>
        </div>
      )}
    </>
  );
}