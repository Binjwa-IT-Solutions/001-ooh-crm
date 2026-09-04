"use client";

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
                "PO Number",
                "Campaign",
                "Vendor",
                "Sites",
                "Total",
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
            {orders.map((order) => (
              <tr
                key={order._id}
                className="transition hover:bg-[#FFF8F8]"
              >
                <td className="px-5 py-4">
                  <button
                    type="button"
                    onClick={() => onView(order)}
                    className="font-bold text-[#8B2424] hover:underline"
                  >
                    {order.poNumber}
                  </button>
                </td>

                <td className="px-5 py-4 text-sm font-medium text-[#1F2937]">
                  {getCampaignName(order.campaignId)}
                </td>

                <td className="px-5 py-4 text-sm font-medium text-[#1F2937]">
                  {getVendorName(order.vendorId)}
                </td>

                <td className="px-5 py-4 text-sm text-[#667085]">
                  {order.lineItems?.length ?? 0}
                </td>

                <td className="px-5 py-4 text-sm font-bold text-[#1F2937]">
                  {formatAmount(order.totalAmount)}
                </td>

                <td className="px-5 py-4">
                  <Status status={order.status} />
                </td>

                <td className="px-5 py-4">
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => onView(order)}
                      className="rounded-lg bg-[#F9DADA] px-3 py-2 text-xs font-bold text-[#8B2424] hover:bg-[#8B2424] hover:text-white"
                    >
                      View
                    </button>

                    {order.status === "Draft" && (
                      <>
                        <button
                          type="button"
                          onClick={() => onEdit(order)}
                          className="rounded-lg border border-[#8B2424] px-3 py-2 text-xs font-bold text-[#8B2424] hover:bg-[#F9DADA]"
                        >
                          Edit
                        </button>

                        <button
                          type="button"
                          onClick={() => onIssue(order)}
                          className="rounded-lg bg-[#8B2424] px-3 py-2 text-xs font-bold text-white hover:bg-[#A8383B]"
                        >
                          Issue
                        </button>
                      </>
                    )}

                    {order.status === "Issued" && (
                      <button
                        type="button"
                        onClick={() => onCancel(order)}
                        className="rounded-lg bg-[#F9DADA] px-3 py-2 text-xs font-bold text-[#8B2424] hover:bg-[#8B2424] hover:text-white"
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
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
    Draft:
      "bg-gray-100 text-gray-700",
    Issued:
      "bg-[#F9DADA] text-[#8B2424]",
    Accepted:
      "bg-green-50 text-green-700",
    Cancelled:
      "bg-red-50 text-red-700",
  };

  return (
    <span
      className={`rounded-full px-3 py-1.5 text-xs font-bold ${classes[status]}`}
    >
      {status}
    </span>
  );
}