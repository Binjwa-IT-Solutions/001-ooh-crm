"use client";

import type { PurchaseOrder } from "../types";
import {
  formatAmount,
  getVendorName,
} from "../format";

interface Props {
  orders: PurchaseOrder[];
  onView: (order: PurchaseOrder) => void;
  onEdit: (order: PurchaseOrder) => void;
  onIssue: (order: PurchaseOrder) => void;
  onCancel: (order: PurchaseOrder) => void;
}

export default function PurchaseOrderTable({
  orders,
  onView,
  onEdit,
  onIssue,
  onCancel,
}: Props) {
  if (!orders.length) {
    return (
      <div className="rounded-2xl border border-[#E8E8EC] bg-white p-12 text-center shadow-sm">
        <p className="font-bold text-[#1F2937]">
          No purchase orders found
        </p>
        <p className="mt-1 text-sm text-[#667085]">
          Create a purchase order to get started.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-[#E8E8EC] bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead className="border-b border-[#EEEEF3] bg-[#FAFAFB]">
            <tr>
              {[
                "PO / Pricing ID",
                "Vendor",
                "City & Type",
                "Card Rate",
                "Negotiated Rate",
                "Discount",
                "Profit & Margin",
                "Duration",
                "Status",
                "Actions",
              ].map((heading) => (
                <th
                  key={heading}
                  className="px-5 py-4 text-xs font-bold uppercase tracking-wide text-[#667085]"
                >
                  {heading}
                </th>
              ))}
            </tr>
          </thead>

          <tbody className="divide-y divide-[#EEEEF3]">
            {orders.map((order) => {
              const cardRate = order.cardRate || 0;
              const negotiatedRate = order.negotiatedRate || order.totalAmount || 0;
              const discountGiven = order.discountGiven ?? Math.max(0, cardRate - negotiatedRate);
              const discountPercent =
                order.discountPercent ??
                (cardRate > 0 ? Number(((discountGiven / cardRate) * 100).toFixed(1)) : 0);

              const profitPerUnit = order.profitPerUnit ?? 0;
              const profitMarginPercent = order.profitMarginPercent ?? 0;

              return (
                <tr
                  key={order._id}
                  className="transition hover:bg-[#FFF8F8]"
                >
                  {/* ID */}
                  <td className="px-5 py-4">
                    <button
                      type="button"
                      onClick={() => onView(order)}
                      className="font-bold text-[#8B2424] hover:underline"
                    >
                      {order.pricingId || order.poNumber}
                    </button>
                    {order.pricingId && order.poNumber && order.pricingId !== order.poNumber && (
                      <div className="text-[10px] text-gray-400 font-mono">
                        {order.poNumber}
                      </div>
                    )}
                  </td>

                  {/* VENDOR */}
                  <td className="px-5 py-4 text-sm font-semibold text-[#1F2937]">
                    {getVendorName(order.vendorId)}
                  </td>

                  {/* CITY & SPACE TYPE */}
                  <td className="px-5 py-4 text-sm text-[#1F2937]">
                    <div>{order.city || "—"}</div>
                    <div className="text-xs text-gray-400">{order.spaceType || "Billboard"}</div>
                  </td>

                  {/* CARD RATE */}
                  <td className="px-5 py-4 text-sm font-medium text-gray-500">
                    {cardRate > 0 ? `₹${cardRate.toLocaleString("en-IN")}` : "—"}
                  </td>

                  {/* NEGOTIATED RATE */}
                  <td className="px-5 py-4 text-sm font-bold text-[#8B2424]">
                    ₹{negotiatedRate.toLocaleString("en-IN")}
                  </td>

                  {/* DISCOUNT */}
                  <td className="px-5 py-4 text-sm">
                    {discountGiven > 0 ? (
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-emerald-600">
                          ₹{discountGiven.toLocaleString("en-IN")}
                        </span>
                        <span className="rounded bg-emerald-50 px-1 py-0.5 text-[10px] font-bold text-emerald-700">
                          {discountPercent}%
                        </span>
                      </div>
                    ) : (
                      <span className="text-gray-400 text-xs">—</span>
                    )}
                  </td>

                  {/* PROFIT & MARGIN */}
                  <td className="px-5 py-4 text-sm">
                    {order.companySellingPrice ? (
                      <div>
                        <div className={`font-semibold ${profitPerUnit >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                          ₹{profitPerUnit.toLocaleString("en-IN")}
                        </div>
                        <div className="text-[11px] text-gray-400">
                          Margin: {profitMarginPercent}%
                        </div>
                      </div>
                    ) : (
                      <span className="text-gray-400 text-xs">—</span>
                    )}
                  </td>

                  {/* DURATION */}
                  <td className="px-5 py-4 text-xs font-medium text-gray-600">
                    {order.durationDays ? `${order.durationDays} days` : "30 days"}
                  </td>

                  {/* STATUS */}
                  <td className="px-5 py-4">
                    <Status status={order.status} />
                  </td>

                  {/* ACTIONS */}
                  <td className="px-5 py-4">
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => onView(order)}
                        className="rounded-lg bg-[#F9DADA] px-3 py-1.5 text-xs font-bold text-[#8B2424] hover:bg-[#8B2424] hover:text-white transition"
                      >
                        View
                      </button>

                      {order.status === "Draft" && (
                        <>
                          <button
                            type="button"
                            onClick={() => onEdit(order)}
                            className="rounded-lg border border-[#8B2424] px-3 py-1.5 text-xs font-bold text-[#8B2424] hover:bg-[#F9DADA] transition"
                          >
                            Edit
                          </button>

                          <button
                            type="button"
                            onClick={() => onIssue(order)}
                            className="rounded-lg bg-[#8B2424] px-3 py-1.5 text-xs font-bold text-white hover:bg-[#A8383B] transition"
                          >
                            Issue
                          </button>
                        </>
                      )}

                      {order.status === "Issued" && (
                        <button
                          type="button"
                          onClick={() => onCancel(order)}
                          className="rounded-lg bg-[#F9DADA] px-3 py-1.5 text-xs font-bold text-[#8B2424] hover:bg-[#8B2424] hover:text-white transition"
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
    </div>
  );
}

function Status({
  status,
}: {
  status: PurchaseOrder["status"];
}) {
  const classes = {
    Draft: "bg-gray-100 text-gray-700",
    Issued: "bg-[#F9DADA] text-[#8B2424]",
    Accepted: "bg-green-50 text-green-700",
    Cancelled: "bg-red-50 text-red-700",
  };

  return (
    <span
      className={`rounded-full px-2.5 py-1 text-xs font-bold ${classes[status]}`}
    >
      {status}
    </span>
  );
}