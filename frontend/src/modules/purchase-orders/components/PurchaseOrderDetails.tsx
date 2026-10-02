"use client";

import type { PurchaseOrder } from "../types";
import {
  formatDate,
  getCampaignName,
  getVendorName,
} from "../format";
import {
  Building2,
  MapPin,
  Layers,
  CalendarDays,
  TrendingUp,
  Clock,
  FileText,
} from "lucide-react";

interface Props {
  order: PurchaseOrder;
  onClose: () => void;
}

export default function PurchaseOrderDetails({
  order,
  onClose,
}: Props) {
  const cardRate = order.cardRate || 0;
  const negotiatedRate = order.negotiatedRate || order.totalAmount || 0;
  const discountGiven = order.discountGiven ?? Math.max(0, cardRate - negotiatedRate);
  const discountPercent =
    order.discountPercent ??
    (cardRate > 0 ? Number(((discountGiven / cardRate) * 100).toFixed(2)) : 0);

  const cost = order.companyCostPrice || negotiatedRate;
  const sell = order.companySellingPrice || 0;
  const profit = order.profitPerUnit ?? (sell - cost);
  const margin =
    order.profitMarginPercent ??
    (cost > 0 ? Number(((profit / cost) * 100).toFixed(2)) : 0);

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40 backdrop-blur-xs">
      <div className="flex h-full w-full max-w-2xl flex-col overflow-hidden bg-white shadow-2xl">
        {/* HEADER */}
        <div className="flex items-center justify-between border-b border-[#EEEEF3] bg-white px-6 py-5">
          <div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1 rounded-full bg-[#8B2424]/10 px-2.5 py-0.5 text-xs font-semibold text-[#8B2424]">
                <FileText className="h-3 w-3" />
                PO & Pricing Sheet
              </span>
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-700">
                {order.status}
              </span>
            </div>

            <h2 className="mt-2 text-xl font-bold text-[#1F2937]">
              {order.pricingId || order.poNumber}
            </h2>

            <p className="mt-0.5 text-sm font-medium text-[#667085]">
              {getVendorName(order.vendorId)}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-700 transition"
          >
            ✕
          </button>
        </div>

        {/* CONTENT */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* KPI HIGHLIGHT CARDS */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 rounded-xl border border-[#E8E8EC] bg-[#FAFAFB] p-3.5">
            <div className="rounded-lg bg-white p-3 border border-gray-100 shadow-xs">
              <div className="text-[10px] font-bold uppercase text-gray-400">Card Rate</div>
              <div className="mt-1 text-base font-bold text-gray-800">
                ₹{cardRate.toLocaleString("en-IN")}
              </div>
            </div>

            <div className="rounded-lg bg-white p-3 border border-gray-100 shadow-xs">
              <div className="text-[10px] font-bold uppercase text-gray-400">Negotiated Rate</div>
              <div className="mt-1 text-base font-bold text-[#8B2424]">
                ₹{negotiatedRate.toLocaleString("en-IN")}
              </div>
            </div>

            <div className="rounded-lg bg-white p-3 border border-gray-100 shadow-xs">
              <div className="text-[10px] font-bold uppercase text-gray-400">Discount</div>
              <div className="mt-1 text-base font-bold text-emerald-600">
                {discountPercent}%
              </div>
              <div className="text-[10px] text-emerald-700 font-medium">
                -₹{discountGiven.toLocaleString("en-IN")}
              </div>
            </div>

            <div className="rounded-lg bg-white p-3 border border-gray-100 shadow-xs">
              <div className="text-[10px] font-bold uppercase text-gray-400">Profit Margin</div>
              <div className={`mt-1 text-base font-bold ${profit >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                {margin}%
              </div>
              <div className="text-[10px] text-gray-500 font-medium">
                ₹{profit.toLocaleString("en-IN")}
              </div>
            </div>
          </div>

          {/* 1. BASIC IDENTIFIERS & VENDOR */}
          <section className="rounded-xl border border-[#E8E8EC] bg-white p-5 shadow-xs">
            <h3 className="mb-4 flex items-center gap-2 text-sm font-bold text-[#1F2937]">
              <Building2 className="h-4 w-4 text-[#8B2424]" />
              Vendor & Space Specification
            </h3>

            <div className="grid grid-cols-2 gap-4">
              <Item label="Pricing ID" value={order.pricingId || "—"} />
              <Item label="PO Number" value={order.poNumber} />
              <Item label="Vendor" value={getVendorName(order.vendorId)} />
              <Item label="City / Location" value={order.city || "—"} />
              <Item label="Space Type" value={order.spaceType || "Billboard"} />
              <Item label="Campaign" value={getCampaignName(order.campaignId) || "—"} />
            </div>
          </section>

          {/* 2. RATE NEGOTIATION */}
          <section className="rounded-xl border border-[#E8E8EC] bg-white p-5 shadow-xs">
            <h3 className="mb-4 flex items-center gap-2 text-sm font-bold text-[#1F2937]">
              <TrendingUp className="h-4 w-4 text-[#8B2424]" />
              Rate Negotiation Breakdown
            </h3>

            <div className="grid grid-cols-2 gap-4">
              <Item
                label="Card Rate (Initial Quoted Rate)"
                value={cardRate > 0 ? `₹${cardRate.toLocaleString("en-IN")}` : "—"}
              />
              <Item
                label="Negotiated Rate (Final Rate)"
                value={`₹${negotiatedRate.toLocaleString("en-IN")}`}
                highlight
              />
              <Item
                label="Discount Given"
                value={`₹${discountGiven.toLocaleString("en-IN")}`}
              />
              <Item
                label="Discount %"
                value={`${discountPercent}%`}
              />
              <Item
                label="Negotiation Rounds"
                value={order.negotiationRounds ? `${order.negotiationRounds} round(s)` : "1 round"}
              />
              <Item
                label="Approved By"
                value={order.approvedBy || "—"}
              />
            </div>
          </section>

          {/* 3. PROFITABILITY & PRICING */}
          <section className="rounded-xl border border-[#E8E8EC] bg-white p-5 shadow-xs">
            <h3 className="mb-4 flex items-center gap-2 text-sm font-bold text-[#1F2937]">
              <TrendingUp className="h-4 w-4 text-[#8B2424]" />
              Company Pricing & Margins
            </h3>

            <div className="grid grid-cols-2 gap-4">
              <Item
                label="Company Cost Price"
                value={cost > 0 ? `₹${cost.toLocaleString("en-IN")}` : "—"}
              />
              <Item
                label="Company Selling Price"
                value={sell > 0 ? `₹${sell.toLocaleString("en-IN")}` : "—"}
              />
              <Item
                label="Profit Per Unit"
                value={`₹${profit.toLocaleString("en-IN")}`}
              />
              <Item
                label="Profit Margin %"
                value={`${margin}%`}
              />
            </div>
          </section>

          {/* 4. VALIDITY & DURATION */}
          <section className="rounded-xl border border-[#E8E8EC] bg-white p-5 shadow-xs">
            <h3 className="mb-4 flex items-center gap-2 text-sm font-bold text-[#1F2937]">
              <CalendarDays className="h-4 w-4 text-[#8B2424]" />
              Validity Period & Duration
            </h3>

            <div className="grid grid-cols-3 gap-4">
              <Item
                label="Duration"
                value={order.durationDays ? `${order.durationDays} Days` : "30 Days"}
              />
              <Item
                label="Valid From"
                value={order.validityFrom ? formatDate(order.validityFrom) : "—"}
              />
              <Item
                label="Valid Till"
                value={order.validityTo ? formatDate(order.validityTo) : "—"}
              />
              <Item
                label="Created Date"
                value={formatDate(order.createdAt)}
              />
              <Item
                label="Issued At"
                value={order.issuedAt ? formatDate(order.issuedAt) : "—"}
              />
            </div>
          </section>

          {/* 5. NEGOTIATION NOTES */}
          {order.negotiationNotes && (
            <section className="rounded-xl border border-[#E8E8EC] bg-white p-5 shadow-xs">
              <h3 className="mb-2 flex items-center gap-2 text-sm font-bold text-[#1F2937]">
                <FileText className="h-4 w-4 text-[#8B2424]" />
                Negotiation Notes
              </h3>
              <p className="whitespace-pre-wrap rounded-lg bg-gray-50 p-3.5 text-xs text-gray-700 leading-relaxed">
                {order.negotiationNotes}
              </p>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

function Item({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div>
      <span className="block text-[11px] font-semibold uppercase tracking-wider text-[#667085]">
        {label}
      </span>
      <span
        className={`mt-1 block text-sm font-medium ${
          highlight ? "font-bold text-[#8B2424]" : "text-[#1F2937]"
        }`}
      >
        {value}
      </span>
    </div>
  );
}