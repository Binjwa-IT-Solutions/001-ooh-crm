"use client";

import type { Vendor } from "../types";
import {
  formatGST,
  formatPAN,
  formatValue,
} from "../format";

interface Props {
  vendors: Vendor[];
  loading?: boolean;
  onView: (vendor: Vendor) => void;
  onEdit: (vendor: Vendor) => void;
  onSites: (vendor: Vendor) => void;
  onDeactivate: (vendor: Vendor) => void;
  onRatingChange?: (
    vendor: Vendor,
    rating: number
  ) => void | Promise<void>;
}

export default function VendorTable({
  vendors,
  loading = false,
  onView,
  onEdit,
  onSites,
  onDeactivate,
  onRatingChange,
}: Props) {
  return (
    <div className="overflow-hidden rounded-2xl border border-[#E8E8EC] bg-white shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#EEEEF3] px-5 py-4">
        <div>
          <h2 className="text-base font-bold text-[#1F2937]">
            Vendor List
          </h2>

          <p className="text-xs text-[#667085]">
            {vendors.length} vendor(s)
          </p>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="min-w-[1350px] w-full">
          <thead>
            <tr className="border-b border-[#EEEEF3] bg-[#FAFAFB]">
              {[
                "Vendor",
                "Type",
                "Registration",
                "State",
                "City",
                "Contact",
                "GST",
                "PAN",
                "Rating",
                "Status",
                "Actions",
              ].map((heading) => (
                <th
                  key={heading}
                  className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-[#667085]"
                >
                  {heading}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {loading ? (
              <tr>
                <td
                  colSpan={11}
                  className="px-4 py-12 text-center text-sm text-[#667085]"
                >
                  Loading vendors...
                </td>
              </tr>
            ) : (
              vendors.map((vendor) => (
                <tr
                  key={vendor._id}
                  className="border-b border-[#EEEEF3] last:border-0 hover:bg-[#FAFAFB]"
                >
                  {/* Vendor */}
                  <td className="px-4 py-4">
                    <p className="text-sm font-bold text-[#1F2937]">
                      {vendor.name}
                    </p>
                  </td>

                  {/* Type */}
                  <td className="px-4 py-4 text-sm text-[#344054]">
                    {vendor.vendorType}
                  </td>

                  {/* Registration */}
                  <td className="px-4 py-4">
                    <RegistrationBadge
                      status={vendor.registrationStatus}
                    />
                  </td>

                  {/* State */}
                  <td className="px-4 py-4 text-sm text-[#344054]">
                    {formatValue(vendor.state)}
                  </td>

                  {/* City */}
                  <td className="px-4 py-4 text-sm text-[#344054]">
                    {formatValue(
                      vendor.city ||
                        vendor.citiesServed?.join(", ")
                    )}
                  </td>

                  {/* Contact */}
                  <td className="px-4 py-4">
                    <p className="text-sm font-semibold text-[#344054]">
                      {vendor.primaryContact?.name}
                    </p>

                    <p className="text-xs text-[#667085]">
                      {vendor.primaryContact?.phone}
                    </p>
                  </td>

                  {/* GST */}
                  <td className="px-4 py-4 text-sm text-[#344054]">
                    {formatGST(vendor.gstNumber)}
                  </td>

                  {/* PAN */}
                  <td className="px-4 py-4 text-sm text-[#344054]">
                    {formatPAN(vendor.panNumber)}
                  </td>

                  {/* Rating */}
                  <td className="px-4 py-4">
                    <RatingStars
                      rating={vendor.vendorRating}
                      onChange={(rating) =>
                        onRatingChange?.(vendor, rating)
                      }
                    />
                  </td>

                  {/* Status */}
                  <td className="px-4 py-4">
                    <StatusBadge
                      status={vendor.status}
                    />
                  </td>

                  {/* Actions */}
                  <td className="px-4 py-4">
                    <div className="flex gap-2">
                      <ActionButton
                        text="View"
                        onClick={() =>
                          onView(vendor)
                        }
                      />

                      <ActionButton
                        text="Sites"
                        onClick={() =>
                          onSites(vendor)
                        }
                      />

                      <ActionButton
                        text="Edit"
                        onClick={() =>
                          onEdit(vendor)
                        }
                      />

                      {vendor.status === "Active" && (
                        <ActionButton
                          text="Deactivate"
                          danger
                          onClick={() =>
                            onDeactivate(vendor)
                          }
                        />
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}

            {!loading && !vendors.length && (
              <tr>
                <td
                  colSpan={11}
                  className="px-4 py-12 text-center text-sm text-[#667085]"
                >
                  No vendors found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* =========================
   RATING STARS
========================= */

function RatingStars({
  rating,
  onChange,
}: {
  rating?: number;
  onChange?: (rating: number) => void | Promise<void>;
}) {
  const value = rating ?? 0;

  return (
    <div className="flex items-center gap-1">
      <div className="flex">
        {[1, 2, 3, 4, 5].map((star) => {
          const active = star <= value;

          return (
            <button
              key={star}
              type="button"
              title={`Give ${star} star`}
              onClick={() => onChange?.(star)}
              className={`text-lg leading-none transition-transform hover:scale-110 ${
                active
                  ? "text-yellow-500"
                  : "text-gray-300 hover:text-yellow-400"
              }`}
            >
              ★
            </button>
          );
        })}
      </div>

      <span className="ml-1 text-xs font-semibold text-[#667085]">
        {rating ? `${rating}/5` : "—"}
      </span>
    </div>
  );
}

/* =========================
   ACTION BUTTON
========================= */

function ActionButton({
  text,
  onClick,
  danger = false,
}: {
  text: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        danger
          ? "rounded-lg px-2.5 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50"
          : "rounded-lg px-2.5 py-1.5 text-xs font-semibold text-[#8B2424] hover:bg-[#F9DADA]"
      }
    >
      {text}
    </button>
  );
}

/* =========================
   REGISTRATION BADGE
========================= */

function RegistrationBadge({
  status,
}: {
  status: string;
}) {
  const classes =
    status === "Registered"
      ? "bg-green-50 text-green-700"
      : status === "Unregistered"
        ? "bg-red-50 text-red-700"
        : "bg-yellow-50 text-yellow-700";

  return (
    <span
      className={`rounded-full px-2.5 py-1 text-xs font-semibold ${classes}`}
    >
      {status}
    </span>
  );
}

/* =========================
   STATUS BADGE
========================= */

function StatusBadge({
  status,
}: {
  status: string;
}) {
  const classes =
    status === "Active"
      ? "bg-green-50 text-green-700"
      : status === "Blacklist"
        ? "bg-red-100 text-red-800"
        : "bg-gray-100 text-gray-700";

  return (
    <span
      className={`rounded-full px-2.5 py-1 text-xs font-semibold ${classes}`}
    >
      {status}
    </span>
  );
}