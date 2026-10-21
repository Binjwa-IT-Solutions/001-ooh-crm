"use client";

import {
  CreditCard,
  FileText,
  Calendar,
  MapPin,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import type { PurchaseOrder } from "../types";
import {
  formatAmount,
  formatDate,
  getCampaignName,
  getVendorName,
} from "../format";

interface Props {
  orders: PurchaseOrder[];
  onView: (order: PurchaseOrder) => void;
  onTrack?: (order: PurchaseOrder) => void;
  onDocument?: (order: PurchaseOrder) => void;
  onEdit: (order: PurchaseOrder) => void;
  onIssue: (order: PurchaseOrder) => void;
  onCancel: (order: PurchaseOrder) => void;

  // Pagination props
  currentPage?: number;
  pageSize?: number;
  totalItems?: number;
  totalPages?: number;
  onPageChange?: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
}

export default function PurchaseOrderTable({
  orders,
  onView,
  onTrack,
  onDocument,
  onEdit,
  onIssue,
  onCancel,
  currentPage,
  pageSize = 25,
  totalItems,
  totalPages,
  onPageChange,
  onPageSizeChange,
}: Props) {
  if (!orders.length) {
    return (
      <div className="rounded-2xl border border-dashed border-gray-300 bg-white p-14 text-center shadow-xs">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#FFF8F8] text-[#A8333B] mb-3">
          <FileText className="h-7 w-7" />
        </div>
        <p className="font-bold text-gray-900 text-base">
          No purchase orders found
        </p>
        <p className="mt-1 text-xs text-gray-500 max-w-sm mx-auto">
          No orders match your selected filters. Create a new purchase order or adjust your search.
        </p>
      </div>
    );
  }

  const showPagination =
    totalItems !== undefined &&
    totalPages !== undefined &&
    currentPage !== undefined &&
    onPageChange !== undefined;

  const currentSize = pageSize || 25;
  const startIndex = (currentPage! - 1) * currentSize;
  const endIndex = Math.min(startIndex + currentSize, totalItems || 0);

  function getPageNumbers(current: number, total: number): (number | "...")[] {
    if (total <= 5) {
      return Array.from({ length: total }, (_, i) => i + 1);
    }
    if (current <= 3) {
      return [1, 2, 3, 4, "...", total];
    }
    if (current >= total - 2) {
      return [1, "...", total - 3, total - 2, total - 1, total];
    }
    return [1, "...", current - 1, current, current + 1, "...", total];
  }

  const pageNumbers = showPagination ? getPageNumbers(currentPage!, totalPages!) : [];

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-xs">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="border-b border-gray-200 bg-gray-50/80">
            <tr>
              <th className="px-5 py-3.5 text-[11px] font-bold uppercase tracking-wider text-gray-500">
                PO Number &amp; Date
              </th>
              <th className="px-5 py-3.5 text-[11px] font-bold uppercase tracking-wider text-gray-500">
                Campaign
              </th>
              <th className="px-5 py-3.5 text-[11px] font-bold uppercase tracking-wider text-gray-500">
                Vendor
              </th>
              <th className="px-5 py-3.5 text-[11px] font-bold uppercase tracking-wider text-gray-500">
                PO Value
              </th>
              <th className="px-5 py-3.5 text-[11px] font-bold uppercase tracking-wider text-gray-500">
                Payment Tracking
              </th>
              <th className="px-5 py-3.5 text-[11px] font-bold uppercase tracking-wider text-gray-500">
                Status
              </th>
              <th className="px-5 py-3.5 text-[11px] font-bold uppercase tracking-wider text-gray-500 text-right">
                Actions
              </th>
            </tr>
          </thead>

          <tbody className="divide-y divide-gray-100">
            {orders.map((order) => {
              const totalAmount = order.totalAmount || order.negotiatedRate || 0;
              const paidAmount = order.paidAmount || 0;
              const percentPaid = totalAmount > 0 ? Math.min(100, Math.round((paidAmount / totalAmount) * 100)) : 0;

              const paymentStatus = order.paymentStatus || (
                paidAmount >= totalAmount && totalAmount > 0
                  ? "Paid"
                  : paidAmount > 0
                    ? "Partial"
                    : "Pending"
              );

              const sitesCount = order.lineItems?.length || 0;
              const vendorCity = typeof order.vendorId === "object" && order.vendorId ? order.vendorId.city : order.city;

              return (
                <tr
                  key={order._id}
                  className="transition hover:bg-gray-50/60 group"
                >
                  {/* PO NUMBER & DATE */}
                  <td className="px-5 py-4">
                    <button
                      type="button"
                      onClick={() => onView(order)}
                      className="font-bold text-[#A8333B] hover:text-[#8B2424] hover:underline font-mono text-xs block text-left cursor-pointer"
                    >
                      {order.poNumber || order.pricingId || "MO-PO"}
                    </button>
                    <div className="flex items-center gap-1 text-[11px] text-gray-400 mt-0.5">
                      <Calendar className="h-3 w-3 shrink-0" />
                      <span>{order.createdAt ? formatDate(order.createdAt) : formatDate(new Date().toISOString())}</span>
                    </div>
                  </td>

                  {/* CAMPAIGN */}
                  <td className="px-5 py-4">
                    <div className="font-semibold text-gray-900 truncate max-w-[180px]">
                      {getCampaignName(order.campaignId, order.campaignName)}
                    </div>
                    <div className="text-[11px] text-gray-400 mt-0.5">
                      {sitesCount} {sitesCount === 1 ? "media site" : "media sites"}
                    </div>
                  </td>

                  {/* VENDOR */}
                  <td className="px-5 py-4">
                    <div className="font-semibold text-gray-900 truncate max-w-[180px]">
                      {getVendorName(order.vendorId, order.vendorName)}
                    </div>
                    {vendorCity && (
                      <div className="flex items-center gap-1 text-[11px] text-gray-400 mt-0.5">
                        <MapPin className="h-3 w-3 shrink-0 text-gray-300" />
                        <span>{vendorCity}</span>
                      </div>
                    )}
                  </td>

                  {/* PO VALUE */}
                  <td className="px-5 py-4">
                    <div className="font-bold text-gray-900 text-xs">
                      {formatAmount(totalAmount)}
                    </div>
                    {order.gstAmount ? (
                      <div className="text-[10px] text-gray-400">
                        Incl. GST ₹{order.gstAmount.toLocaleString("en-IN")}
                      </div>
                    ) : null}
                  </td>

                  {/* PAYMENT TRACKING */}
                  <td className="px-5 py-4">
                    <div className="space-y-1.5 min-w-[140px]">
                      <div className="flex items-center justify-between text-[11px]">
                        <span
                          className={`rounded-full px-2 py-0.5 font-bold text-[10px] border ${
                            paymentStatus === "Paid"
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                              : paymentStatus === "Partial"
                                ? "bg-blue-50 text-blue-700 border-blue-200"
                                : "bg-amber-50 text-amber-700 border-amber-200"
                          }`}
                        >
                          {paymentStatus === "Paid"
                            ? "Fully Paid"
                            : paymentStatus === "Partial"
                              ? "Partial"
                              : "Pending"}
                        </span>
                        <span className="font-bold text-gray-700 text-[11px]">
                          {percentPaid}%
                        </span>
                      </div>

                      {/* Mini Progress Bar */}
                      <div className="h-1.5 w-full rounded-full bg-gray-100 overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            paymentStatus === "Paid"
                              ? "bg-emerald-500"
                              : paymentStatus === "Partial"
                                ? "bg-blue-500"
                                : "bg-amber-400"
                          }`}
                          style={{ width: `${percentPaid}%` }}
                        />
                      </div>

                      <div className="text-[10px] text-gray-400">
                        Paid: <span className="font-semibold text-gray-700">{formatAmount(paidAmount)}</span>
                      </div>
                    </div>
                  </td>

                  {/* STATUS */}
                  <td className="px-5 py-4">
                    <StatusBadge status={order.status} />
                  </td>

                  {/* ACTIONS */}
                  <td className="px-5 py-4 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      {/* Track Payment Jump (Step 5) */}
                      {onTrack && (
                        <button
                          type="button"
                          onClick={() => onTrack(order)}
                          title="Payment & Invoice Tracking (Step 5)"
                          className="flex items-center gap-1 rounded-lg bg-emerald-50 px-2.5 py-1.5 text-[11px] font-bold text-emerald-700 border border-emerald-200 hover:bg-emerald-600 hover:text-white transition shadow-2xs cursor-pointer"
                        >
                          <CreditCard className="h-3 w-3 shrink-0" />
                          <span>Track</span>
                        </button>
                      )}

                      {/* Document PDF Jump (Step 4) */}
                      {onDocument && (
                        <button
                          type="button"
                          onClick={() => onDocument(order)}
                          title="View PDF Document (Step 4)"
                          className="flex items-center gap-1 rounded-lg bg-gray-100 px-2.5 py-1.5 text-[11px] font-bold text-gray-700 hover:bg-gray-200 transition shadow-2xs cursor-pointer"
                        >
                          <FileText className="h-3 w-3 shrink-0 text-gray-500" />
                          <span>PDF</span>
                        </button>
                      )}

                      {/* View Details (Step 3) */}
                      <button
                        type="button"
                        onClick={() => onView(order)}
                        title="View PO Details"
                        className="rounded-lg bg-[#FDE8E8] px-2.5 py-1.5 text-[11px] font-bold text-[#A8333B] hover:bg-[#A8333B] hover:text-white transition shadow-2xs cursor-pointer"
                      >
                        View
                      </button>

                      {order.status === "Draft" && (
                        <>
                          <button
                            type="button"
                            onClick={() => onEdit(order)}
                            title="Edit Draft"
                            className="rounded-lg border border-gray-300 px-2.5 py-1.5 text-[11px] font-bold text-gray-700 hover:bg-gray-100 transition shadow-2xs cursor-pointer"
                          >
                            Edit
                          </button>

                          <button
                            type="button"
                            onClick={() => onIssue(order)}
                            title="Issue Purchase Order"
                            className="rounded-lg bg-[#A8333B] px-2.5 py-1.5 text-[11px] font-bold text-white hover:bg-[#8B2424] transition shadow-2xs cursor-pointer"
                          >
                            Issue
                          </button>
                        </>
                      )}

                      {order.status === "Issued" && (
                        <button
                          type="button"
                          onClick={() => onCancel(order)}
                          title="Cancel Order"
                          className="rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-[11px] font-bold text-rose-700 hover:bg-rose-600 hover:text-white transition shadow-2xs cursor-pointer"
                        >
                          Cancel
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer (25 items per page default) */}
      {showPagination && totalItems! > 0 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 border-t border-gray-200 bg-white px-5 py-3 text-xs text-gray-600">
          <div className="flex flex-wrap items-center gap-3">
            <span>
              Showing <strong className="font-bold text-gray-900">{totalItems! > 0 ? startIndex + 1 : 0}</strong> to{" "}
              <strong className="font-bold text-gray-900">{endIndex}</strong> of{" "}
              <strong className="font-bold text-gray-900">{totalItems}</strong> purchase orders
            </span>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={currentPage! <= 1}
              onClick={() => onPageChange!(currentPage! - 1)}
              className="flex items-center gap-1 rounded-lg border border-gray-200 px-2.5 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
              title="Previous Page"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              <span>Prev</span>
            </button>

            {/* Page number buttons */}
            <div className="flex items-center gap-1 px-1">
              {pageNumbers.map((p, idx) =>
                p === "..." ? (
                  <span key={`dots-${idx}`} className="px-1 text-gray-400">
                    ...
                  </span>
                ) : (
                  <button
                    key={`page-${p}`}
                    type="button"
                    onClick={() => onPageChange!(Number(p))}
                    className={`min-w-[28px] h-7 rounded-lg px-2 text-xs font-bold transition cursor-pointer ${
                      currentPage === p
                        ? "bg-[#A8333B] text-white shadow-2xs"
                        : "text-gray-700 hover:bg-gray-100"
                    }`}
                  >
                    {p}
                  </button>
                )
              )}
            </div>

            <button
              type="button"
              disabled={currentPage! >= totalPages!}
              onClick={() => onPageChange!(currentPage! + 1)}
              className="flex items-center gap-1 rounded-lg border border-gray-200 px-2.5 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
              title="Next Page"
            >
              <span>Next</span>
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function StatusBadge({
  status,
}: {
  status: PurchaseOrder["status"];
}) {
  const classes: Record<string, string> = {
    Draft: "bg-gray-100 text-gray-700 border-gray-200",
    Issued: "bg-[#FDE8E8] text-[#A8333B] border-[#F9DADA]",
    Accepted: "bg-emerald-50 text-emerald-700 border-emerald-200",
    Cancelled: "bg-rose-50 text-rose-700 border-rose-200",
  };

  return (
    <span
      className={`inline-block rounded-full px-2.5 py-0.5 text-[11px] font-bold border ${
        classes[status] || "bg-gray-100 text-gray-700 border-gray-200"
      }`}
    >
      {status}
    </span>
  );
}