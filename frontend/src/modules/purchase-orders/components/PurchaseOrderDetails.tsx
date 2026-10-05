"use client";

import { useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Pencil,
  CheckCircle2,
  FileText,
} from "lucide-react";

function PrinterIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="6 9 6 2 18 2 18 9" />
      <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
      <rect x="6" y="14" width="12" height="8" />
    </svg>
  );
}

function MoreVerticalIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="1" />
      <circle cx="12" cy="5" r="1" />
      <circle cx="12" cy="19" r="1" />
    </svg>
  );
}

import type { PurchaseOrder } from "../types";
import {
  formatAmount,
  formatDate,
  getCampaignName,
  getVendorName,
} from "../format";

interface Props {
  order: PurchaseOrder;
  onBack: () => void;
  onEdit: () => void;
  onIssue: () => void;
  onNext: () => void;
}

export default function PurchaseOrderDetails({
  order,
  onBack,
  onEdit,
  onIssue,
  onNext,
}: Props) {
  const [menuOpen, setMenuOpen] = useState(false);

  // Line items
  const items =
    order.lineItems && order.lineItems.length > 0
      ? order.lineItems
      : [
          {
            item: order.spaceType || "Hoarding",
            service: order.spaceType || "Hoarding",
            description: order.city || "Indore - Vijay Nagar",
            hsn: "998361",
            qty: 1,
            unit: "PCS",
            rate: order.cardRate || order.negotiatedRate || order.totalAmount || 2500,
            discount: order.discountGiven || 0,
            tax: 18,
            amount: order.negotiatedRate || order.totalAmount || 2500,
          },
        ];

  const subtotal =
    order.subtotal ??
    items.reduce(
      (sum, it) =>
        sum +
        (it.amount ??
          Math.max(
            0,
            (it.qty || 1) * (it.rate || it.ratePerDay || 0) - (it.discount || 0),
          )),
      0,
    );

  const gstRate = order.gstRate ?? (items[0]?.tax || 18);
  const gstAmount = order.gstAmount ?? Math.round((subtotal * gstRate) / 100);
  const totalAmount = order.totalAmount || subtotal + gstAmount;

  const vendorName = getVendorName(order.vendorId, order.vendorName);
  const campaignName = getCampaignName(order.campaignId, order.campaignName);

  const vendorAddress =
    order.vendorAddress ||
    (typeof order.vendorId === "object" && (order.vendorId as any)?.address) ||
    "";

  const vendorGstin =
    order.vendorGstin ||
    (typeof order.vendorId === "object" && (order.vendorId as any)?.gstin) ||
    "";

  const placeOfSupply =
    order.placeOfSupply ||
    (typeof order.vendorId === "object" && (order.vendorId as any)?.state) ||
    "";

  const terms =
    order.termsAndConditions && order.termsAndConditions.length > 0
      ? order.termsAndConditions
      : [
          "Payment within 30 days.",
          "Installation as per agreed timeline.",
          "Any damage will be vendor responsibility.",
        ];

  return (
    <div className="space-y-6">
      {/* Top Action Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-gray-200 pb-5">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-700 shadow-xs hover:bg-gray-50 transition"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>

          <div className="flex items-center gap-3">
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
              Purchase Order #{order.poNumber || order.pricingId}
            </h1>
            <span
              className={`rounded-full px-3 py-0.5 text-xs font-bold ${
                order.status === "Draft"
                  ? "bg-gray-100 text-gray-700 border border-gray-200"
                  : order.status === "Issued"
                    ? "bg-[#FDE8E8] text-[#A8333B] border border-[#F9DADA]"
                    : "bg-emerald-50 text-emerald-700 border border-emerald-200"
              }`}
            >
              {order.status}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          {order.status === "Draft" && (
            <>
              <button
                type="button"
                onClick={onEdit}
                className="flex items-center gap-1.5 rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 shadow-xs hover:bg-gray-50 transition"
              >
                <Pencil className="h-3.5 w-3.5" />
                Edit
              </button>

              <button
                type="button"
                onClick={onIssue}
                className="flex items-center gap-1.5 rounded-xl bg-[#A8333B] px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-[#8B2424] transition"
              >
                <CheckCircle2 className="h-4 w-4" />
                Issue Purchase Order
              </button>
            </>
          )}

          <button
            type="button"
            onClick={onNext}
            className="flex items-center gap-1.5 rounded-xl bg-[#A8333B] px-5 py-2 text-sm font-bold text-white shadow-sm hover:bg-[#8B2424] transition"
          >
            View Document (PDF)
            <ArrowRight className="h-4 w-4" />
          </button>

          <div className="relative">
            <button
              type="button"
              onClick={() => setMenuOpen(!menuOpen)}
              className="rounded-xl border border-gray-200 bg-white p-2 text-gray-500 hover:bg-gray-50"
            >
              <MoreVerticalIcon className="h-4 w-4" />
            </button>
            {menuOpen && (
              <div className="absolute right-0 mt-1 w-44 rounded-xl border border-gray-100 bg-white py-1 shadow-lg z-20">
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    onNext();
                  }}
                  className="flex w-full items-center gap-2 px-4 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                >
                  <FileText className="h-3.5 w-3.5" />
                  Generate PDF
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    window.print();
                  }}
                  className="flex w-full items-center gap-2 px-4 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                >
                  <PrinterIcon className="h-3.5 w-3.5" />
                  Print Details
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 3 Info Cards Grid */}
      <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
        {/* Bill From */}
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-xs">
          <p className="text-xs font-bold uppercase tracking-wider text-gray-400">
            Bill From
          </p>
          <h2 className="mt-2 text-base font-bold text-gray-900">
            {order.companyName || "Your Company"}
          </h2>
          <p className="mt-1 text-xs text-gray-600 leading-relaxed whitespace-pre-line">
            {order.companyAddress || "—"}
          </p>
          {order.companyGstin && (
            <p className="mt-2 text-xs font-medium text-gray-500">
              <span className="font-semibold text-gray-700">GSTIN :</span> {order.companyGstin}
            </p>
          )}
          {order.companyEmail && (
            <p className="text-xs text-gray-500">
              <span className="font-semibold text-gray-700">Email :</span> {order.companyEmail}
            </p>
          )}
        </div>

        {/* Ship From */}
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-xs">
          <p className="text-xs font-bold uppercase tracking-wider text-gray-400">
            Ship From
          </p>
          <h2 className="mt-2 text-base font-bold text-gray-900">
            {vendorName}
          </h2>
          <p className="mt-1 text-xs text-gray-600 leading-relaxed">
            {vendorAddress || <span className="text-gray-400 italic">No address specified</span>}
          </p>
          <div className="mt-3 space-y-1 text-xs text-gray-500">
            {vendorGstin && (
              <p>
                <span className="font-semibold text-gray-700">GSTIN :</span> {vendorGstin}
              </p>
            )}
            {placeOfSupply && (
              <p>
                <span className="font-semibold text-gray-700">Place of Supply :</span> {placeOfSupply}
              </p>
            )}
          </div>
        </div>

        {/* PO Details */}
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-xs">
          <p className="text-xs font-bold uppercase tracking-wider text-gray-400">
            PO Details
          </p>

          <div className="mt-3 space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-gray-500 font-medium">PO Number</span>
              <span className="font-bold text-gray-900 font-mono">
                {order.poNumber || order.pricingId}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-gray-500 font-medium">PO Date</span>
              <span className="font-semibold text-gray-900">
                {order.poDate ? formatDate(order.poDate) : formatDate(order.createdAt)}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-gray-500 font-medium">Campaign</span>
              <span className="font-semibold text-gray-900">
                {campaignName}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-gray-500 font-medium">Vendor</span>
              <span className="font-semibold text-gray-900">
                {vendorName}
              </span>
            </div>

            <div className="flex items-center justify-between pt-1 border-t border-gray-100">
              <span className="text-gray-500 font-medium">Status</span>
              <span className="font-bold text-[#A8333B]">
                {order.status}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Items / Media Services Table */}
      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-xs">
        <div className="border-b border-gray-100 p-5">
          <h2 className="text-base font-bold text-gray-900">
            Items / Media Services
          </h2>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="border-b border-gray-200 bg-gray-50/80 text-[11px] font-bold uppercase tracking-wider text-gray-500">
              <tr>
                <th className="px-5 py-3 text-center w-14">S.No.</th>
                <th className="px-5 py-3 min-w-[200px]">Item / Service</th>
                <th className="px-5 py-3">HSN</th>
                <th className="px-5 py-3">Qty</th>
                <th className="px-5 py-3">Rate (₹)</th>
                <th className="px-5 py-3">Discount</th>
                <th className="px-5 py-3">Tax</th>
                <th className="px-5 py-3 text-right">Amount (₹)</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-100 text-sm">
              {items.map((item, idx) => {
                const qty = item.qty || item.days || 1;
                const unit = item.unit || "PCS";
                const rate = item.rate || item.ratePerDay || 0;
                const disc = item.discount || 0;
                const tax = item.tax || 18;
                const amount =
                  item.amount ?? Math.max(0, qty * rate - disc);

                return (
                  <tr key={idx} className="transition hover:bg-gray-50/50">
                    <td className="px-5 py-3.5 text-center font-bold text-gray-500">
                      {idx + 1}
                    </td>

                    <td className="px-5 py-3.5">
                      <div className="font-bold text-gray-900">
                        {item.item || item.service || "Media Service"}
                      </div>
                      {(item.description || item.city) && (
                        <div className="text-xs text-gray-500">
                          {item.description || item.city}
                        </div>
                      )}
                    </td>

                    <td className="px-5 py-3.5 text-xs text-gray-600">
                      {item.hsn || "-"}
                    </td>

                    <td className="px-5 py-3.5 text-xs font-semibold text-gray-800">
                      {qty} {unit}
                    </td>

                    <td className="px-5 py-3.5 text-xs font-semibold text-gray-800">
                      {rate.toLocaleString("en-IN")}
                    </td>

                    <td className="px-5 py-3.5 text-xs text-gray-600">
                      {disc > 0 ? disc.toLocaleString("en-IN") : "0"}
                    </td>

                    <td className="px-5 py-3.5 text-xs font-semibold text-gray-800">
                      {tax}%
                    </td>

                    <td className="px-5 py-3.5 text-right font-bold text-gray-900">
                      {amount.toLocaleString("en-IN")}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Bottom Section: Bank Details & Terms on Left, Totals on Right */}
        <div className="grid grid-cols-1 gap-6 border-t border-gray-200 p-6 md:grid-cols-2">
          {/* Bank Details & Terms */}
          <div className="space-y-4">
            {order.bankDetails && (order.bankDetails.bankName || order.bankDetails.accountNumber) && (
              <div className="rounded-xl border border-gray-200 p-3.5 bg-gray-50/70">
                <h3 className="text-xs font-bold text-gray-900 uppercase tracking-wider">
                  Bank Details
                </h3>
                <div className="mt-2 grid grid-cols-2 gap-2.5 text-xs">
                  {order.bankDetails.bankName && (
                    <div>
                      <span className="block text-[10px] uppercase font-bold text-gray-400">
                        Bank Name
                      </span>
                      <span className="font-semibold text-gray-800">
                        {order.bankDetails.bankName}
                      </span>
                    </div>
                  )}
                  {order.bankDetails.personName && (
                    <div>
                      <span className="block text-[10px] uppercase font-bold text-gray-400">
                        A/C Holder Name
                      </span>
                      <span className="font-semibold text-gray-800">
                        {order.bankDetails.personName}
                      </span>
                    </div>
                  )}
                  {order.bankDetails.accountNumber && (
                    <div>
                      <span className="block text-[10px] uppercase font-bold text-gray-400">
                        Account Number
                      </span>
                      <span className="font-bold text-gray-900 font-mono">
                        {order.bankDetails.accountNumber}
                      </span>
                    </div>
                  )}
                  {order.bankDetails.ifsc && (
                    <div>
                      <span className="block text-[10px] uppercase font-bold text-gray-400">
                        IFSC Code
                      </span>
                      <span className="font-bold text-gray-900 font-mono">
                        {order.bankDetails.ifsc}
                      </span>
                    </div>
                  )}
                  {order.bankDetails.branch && (
                    <div className="col-span-2">
                      <span className="block text-[10px] uppercase font-bold text-gray-400">
                        Branch
                      </span>
                      <span className="font-medium text-gray-700">
                        {order.bankDetails.branch}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div>
              <h3 className="text-xs font-bold text-gray-900">
                Terms & Conditions
              </h3>
              <ol className="mt-1.5 list-decimal list-inside space-y-1 text-xs text-gray-600 leading-relaxed bg-gray-50 p-3 rounded-xl border border-gray-100">
                {terms.map((term, i) => (
                  <li key={i}>{term}</li>
                ))}
              </ol>
            </div>
          </div>

          {/* Right Summary Box */}
          <div className="flex flex-col justify-end items-end">
            <div className="w-full max-w-xs space-y-2.5 rounded-xl bg-gray-50/70 p-4 border border-gray-200">
              <div className="flex items-center justify-between text-xs text-gray-600">
                <span className="font-medium">Subtotal</span>
                <span className="font-semibold text-gray-900">
                  ₹ {subtotal.toLocaleString("en-IN")}
                </span>
              </div>

              <div className="flex items-center justify-between text-xs text-gray-600">
                <span className="font-medium">GST (18%)</span>
                <span className="font-semibold text-gray-900">
                  ₹ {gstAmount.toLocaleString("en-IN")}
                </span>
              </div>

              <div className="border-t border-gray-200 pt-2 flex items-center justify-between">
                <span className="text-sm font-bold text-gray-900">
                  Total Amount
                </span>
                <span className="text-base font-bold text-[#A8333B]">
                  ₹ {totalAmount.toLocaleString("en-IN")}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Navigation */}
      <div className="flex items-center justify-between pt-2">
        <button
          type="button"
          onClick={onBack}
          className="text-xs font-bold text-gray-500 hover:text-gray-800"
        >
          ← Back to Purchase Orders
        </button>

        <button
          type="button"
          onClick={onNext}
          className="flex items-center gap-1.5 rounded-xl bg-[#A8333B] px-6 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-[#8B2424] transition"
        >
          Generate PO Document (PDF)
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}