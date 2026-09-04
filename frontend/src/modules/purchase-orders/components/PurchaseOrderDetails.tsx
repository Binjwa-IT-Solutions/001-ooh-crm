"use client";

import type { PurchaseOrder } from "../types";

import {
  formatAmount,
  formatDate,
  getCampaignName,
  getVendorName,
} from "../format";

interface Props {
  order: PurchaseOrder;
  onClose: () => void;
}

function getSiteName(site: unknown): string {
  if (typeof site === "string") {
    return site;
  }

  if (
    site &&
    typeof site === "object" &&
    "code" in site &&
    typeof site.code === "string"
  ) {
    return site.code;
  }

  return "Unknown Site";
}

export default function PurchaseOrderDetails({
  order,
  onClose,
}: Props) {
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40">
      <div className="flex h-full w-full max-w-2xl flex-col overflow-hidden bg-white shadow-2xl">
        {/* HEADER */}
        <div className="flex items-center justify-between border-b border-[#EEEEF3] bg-white px-6 py-5">
          <div>

            <h2 className="mt-3 text-xl font-bold text-[#1F2937]">
              {order.poNumber}
            </h2>

            <p className="mt-1 text-sm text-[#667085]">
              {getVendorName(order.vendorId)}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-3 py-1 text-2xl font-bold text-gray-500 transition hover:bg-[#F9DADA] hover:text-[#8B2424] focus:outline-none focus:ring-2 focus:ring-[#F9DADA]"
          >
            ×
          </button>
        </div>

        {/* CONTENT */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* BASIC INFORMATION */}
          <section className="mb-5 rounded-2xl border border-[#E8E8EC] bg-white p-5 shadow-sm">
            <h3 className="mb-4 flex items-center gap-2 text-sm font-bold text-[#1F2937]">
              <span className="h-5 w-1 rounded-full bg-[#8B2424]" />
              Purchase Order Information
            </h3>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Item
                label="PO Number"
                value={order.poNumber}
              />

              <Item
                label="Campaign"
                value={getCampaignName(order.campaignId)}
              />

              <Item
                label="Vendor"
                value={getVendorName(order.vendorId)}
              />

              <Item
                label="Status"
                value={order.status}
              />

              <Item
                label="Issued At"
                value={formatDate(order.issuedAt)}
              />

              <Item
                label="Created At"
                value={formatDate(order.createdAt)}
              />
            </div>
          </section>

          {/* LINE ITEMS */}
          <section className="rounded-2xl border border-[#E8E8EC] bg-white p-5 shadow-sm">
            <h3 className="mb-4 flex items-center gap-2 text-sm font-bold text-[#1F2937]">
              <span className="h-5 w-1 rounded-full bg-[#8B2424]" />
              Site Line Items
            </h3>

            <div className="space-y-3">
              {(order.lineItems || []).map((item, index) => (
                <div
                  key={item._id || index}
                  className="rounded-xl border border-[#E8E8EC] bg-[#FAFAFB] p-4 transition hover:border-[#F0C7C7] hover:bg-[#FFF8F8]"
                >
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-bold text-[#1F2937]">
                      Site {index + 1}
                    </p>

                    <p className="text-sm font-bold text-[#8B2424]">
                      {formatAmount(item.amount)}
                    </p>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-4">
                    <Item
                      label="Site ID"
                      value={getSiteName(item.siteId)}
                    />

                    <Item
                      label="Days"
                      value={String(item.days)}
                    />

                    <Item
                      label="From Date"
                      value={formatDate(item.from)}
                    />

                    <Item
                      label="To Date"
                      value={formatDate(item.to)}
                    />

                    <Item
                      label="Rate / Day"
                      value={formatAmount(
                        item.negotiatedRatePerDay,
                      )}
                    />

                    <Item
                      label="Amount"
                      value={formatAmount(item.amount)}
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* TOTAL */}
            <div className="mt-5 flex items-center justify-between border-t border-[#EEEEF3] pt-5">
              <span className="text-sm font-bold text-[#1F2937]">
                Total Amount
              </span>

              <span className="text-xl font-bold text-[#8B2424]">
                {formatAmount(order.totalAmount)}
              </span>
            </div>
          </section>
        </div>

        {/* FOOTER */}
        <div className="border-t border-[#EEEEF3] bg-[#FAFAFB] p-5">
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-xl border border-[#8B2424] bg-[#F9DADA] px-5 py-3 text-sm font-bold text-[#8B2424] transition hover:bg-[#8B2424] hover:text-white focus:outline-none focus:ring-2 focus:ring-[#F9DADA] focus:ring-offset-2"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function Item({
  label,
  value,
}: {
  label: string;
  value?: string;
}) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-[#667085]">
        {label}
      </p>

      <p className="mt-1 break-words text-sm font-semibold text-[#1F2937]">
        {value || "—"}
      </p>
    </div>
  );
}