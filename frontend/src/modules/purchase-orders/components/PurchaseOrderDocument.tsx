"use client";

import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Download,
  Check,
  Upload,
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

function ShareIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="18" cy="5" r="3" />
      <circle cx="6" cy="12" r="3" />
      <circle cx="18" cy="19" r="3" />
      <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
      <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
    </svg>
  );
}

import type { PurchaseOrder } from "../types";
import {
  formatDate,
  getCampaignName,
  getVendorName,
} from "../format";

interface Props {
  order: PurchaseOrder;
  onBack: () => void;
  onNext: () => void;
}

function numberToWordsINR(num: number): string {
  const a = [
    "",
    "One ",
    "Two ",
    "Three ",
    "Four ",
    "Five ",
    "Six ",
    "Seven ",
    "Eight ",
    "Nine ",
    "Ten ",
    "Eleven ",
    "Twelve ",
    "Thirteen ",
    "Fourteen ",
    "Fifteen ",
    "Sixteen ",
    "Seventeen ",
    "Eighteen ",
    "Nineteen ",
  ];
  const b = [
    "",
    "",
    "Twenty",
    "Thirty",
    "Forty",
    "Fifty",
    "Sixty",
    "Seventy",
    "Eighty",
    "Ninety",
  ];

  if ((num = Math.floor(num)) === 0) return "Zero Only";

  function convertGroup(n: number): string {
    let str = "";
    if (n > 99) {
      str += a[Math.floor(n / 100)] + "Hundred ";
      n %= 100;
    }
    if (n > 19) {
      str += b[Math.floor(n / 10)] + " " + a[n % 10];
    } else if (n > 0) {
      str += a[n];
    }
    return str;
  }

  let words = "";
  const crore = Math.floor(num / 10000000);
  num %= 10000000;
  const lakh = Math.floor(num / 100000);
  num %= 100000;
  const thousand = Math.floor(num / 1000);
  num %= 1000;
  const rest = num;

  if (crore > 0) words += convertGroup(crore) + "Crore ";
  if (lakh > 0) words += convertGroup(lakh) + "Lakh ";
  if (thousand > 0) words += convertGroup(thousand) + "Thousand ";
  if (rest > 0) words += convertGroup(rest);

  return (words.trim() + " Only").replace(/\s+/g, " ");
}

export default function PurchaseOrderDocument({
  order,
  onBack,
  onNext,
}: Props) {
  const [copied, setCopied] = useState(false);
  const [signatureUrl, setSignatureUrl] = useState<string | null>(null);
  const printRef = useRef<HTMLDivElement>(null);
  const sigInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    try {
      const orderSig = order?._id ? localStorage.getItem(`mo_po_signature_${order._id}`) : null;
      const defaultSig = localStorage.getItem("mo_po_default_signature");
      if (orderSig) {
        setSignatureUrl(orderSig);
      } else if (defaultSig) {
        setSignatureUrl(defaultSig);
      }
    } catch (err) {
      console.error("Failed to load signature from local storage", err);
    }
  }, [order?._id]);

  const handleSignatureUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      if (dataUrl) {
        setSignatureUrl(dataUrl);
        try {
          localStorage.setItem("mo_po_default_signature", dataUrl);
          if (order?._id) {
            localStorage.setItem(`mo_po_signature_${order._id}`, dataUrl);
          }
        } catch (err) {
          console.error("Failed to save signature", err);
        }
      }
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveSignature = () => {
    setSignatureUrl(null);
    try {
      if (order?._id) {
        localStorage.removeItem(`mo_po_signature_${order._id}`);
      }
      localStorage.removeItem("mo_po_default_signature");
    } catch (err) {
      console.error("Failed to remove signature", err);
    }
    if (sigInputRef.current) {
      sigInputRef.current.value = "";
    }
  };

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

  const handlePrint = () => {
    window.print();
  };

  const handleShare = () => {
    if (typeof window !== "undefined") {
      navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Action Bar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-gray-200 pb-5 print:hidden">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-semibold text-gray-700 shadow-xs hover:bg-gray-50 transition"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to PO Details
          </button>

          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
              Purchase Order Document (PDF)
            </h1>
            <p className="text-xs text-gray-500">
              Generated PO ready to download, print and share
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={handlePrint}
            className="flex items-center gap-1.5 rounded-xl border border-gray-300 bg-white px-3.5 py-2 text-xs font-semibold text-gray-700 shadow-xs hover:bg-gray-50 transition"
          >
            <Download className="h-3.5 w-3.5 text-gray-500" />
            Download PDF
          </button>

          <button
            type="button"
            onClick={handlePrint}
            className="flex items-center gap-1.5 rounded-xl border border-gray-300 bg-white px-3.5 py-2 text-xs font-semibold text-gray-700 shadow-xs hover:bg-gray-50 transition"
          >
            <PrinterIcon className="h-3.5 w-3.5 text-gray-500" />
            Print PDF
          </button>

          <button
            type="button"
            onClick={handleShare}
            className="flex items-center gap-1.5 rounded-xl border border-gray-300 bg-white px-3.5 py-2 text-xs font-semibold text-gray-700 shadow-xs hover:bg-gray-50 transition"
          >
            {copied ? (
              <>
                <Check className="h-3.5 w-3.5 text-emerald-600" />
                Copied!
              </>
            ) : (
              <>
                <ShareIcon className="h-3.5 w-3.5 text-gray-500" />
                Share
              </>
            )}
          </button>

          <button
            type="button"
            onClick={onNext}
            className="flex items-center gap-1.5 rounded-xl bg-[#A8333B] px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-[#8B2424] transition"
          >
            Proceed to Payment & Invoice Tracking
            <ArrowRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {/* Hidden Signature File Input */}
      <input
        type="file"
        ref={sigInputRef}
        accept="image/*"
        onChange={handleSignatureUpload}
        className="hidden"
      />

      {/* Printable PO Document Sheet */}
      <div className="mx-auto max-w-4xl">
        <div
          ref={printRef}
          className="rounded-2xl border border-gray-200 bg-white p-8 sm:p-12 shadow-md print:shadow-none print:border-none print:p-0 print:m-0"
        >
          {/* Header Row */}
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between border-b border-gray-800 pb-6 gap-6">
            {/* Logo */}
            <div className="flex items-center">
              <img
                src="/logo.png"
                alt="Logo"
                className="h-12 w-auto max-w-[200px] object-contain"
              />
            </div>

            {/* Company Info */}
            <div className="text-xs text-gray-600 sm:text-center space-y-0.5 leading-relaxed">
              {order.companyAddress ? (
                <p className="font-semibold text-gray-800 whitespace-pre-line">
                  {order.companyAddress}
                </p>
              ) : null}
              {order.companyGstin && <p>GSTIN : {order.companyGstin}</p>}
              {order.companyEmail && (
                <p className="text-gray-500">Email : {order.companyEmail}</p>
              )}
            </div>

            {/* PO Meta */}
            <div className="text-xs text-gray-800 sm:text-right space-y-1">
              <div className="flex sm:justify-end gap-2">
                <span className="font-bold text-gray-500">PO No. :</span>
                <span className="font-bold font-mono text-gray-900">
                  {order.poNumber || order.pricingId}
                </span>
              </div>
              <div className="flex sm:justify-end gap-2">
                <span className="font-bold text-gray-500">PO Date :</span>
                <span>
                  {order.poDate ? formatDate(order.poDate) : formatDate(order.createdAt)}
                </span>
              </div>
              <div className="flex sm:justify-end gap-2">
                <span className="font-bold text-gray-500">Campaign :</span>
                <span className="font-semibold">{campaignName}</span>
              </div>
            </div>
          </div>

          {/* Bill From / Ship From Box Grid */}
          <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4 border border-gray-800 rounded-xl p-4 bg-gray-50/50">
            {/* Bill From */}
            <div className="text-xs space-y-1 sm:border-r sm:border-gray-300 sm:pr-4">
              <p className="font-bold uppercase tracking-wider text-gray-900">
                BILL FROM
              </p>
              <p className="font-bold text-gray-800 text-sm">
                {order.companyName || "MEDIA OCTUS"}
              </p>
              <p className="text-gray-600 leading-relaxed whitespace-pre-line">
                {order.companyAddress ||
                  "4th floor Gargi Aura Building, Indore,\nMadhya Pradesh, 452010"}
              </p>
              <p className="pt-1 text-gray-700">
                <span className="font-semibold">GSTIN :</span>{" "}
                {order.companyGstin || "230RHPS3516P1ZZ"}
              </p>
            </div>

            {/* Ship From */}
            <div className="text-xs space-y-1 sm:pl-4">
              <p className="font-bold uppercase tracking-wider text-gray-900">
                SHIP FROM
              </p>
              <p className="font-bold text-gray-800 text-sm">{vendorName}</p>
              {vendorAddress && <p className="text-gray-600 leading-relaxed">{vendorAddress}</p>}
              {vendorGstin && (
                <p className="pt-1 text-gray-700">
                  <span className="font-semibold">GSTIN :</span> {vendorGstin}
                </p>
              )}
              {placeOfSupply && (
                <p className="text-gray-700">
                  <span className="font-semibold">Place of Supply :</span> {placeOfSupply}
                </p>
              )}
            </div>
          </div>

          {/* Table */}
          <div className="mt-6 overflow-hidden rounded-xl border border-gray-800">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-gray-800 bg-gray-100 font-bold uppercase tracking-wider text-gray-900">
                <tr>
                  <th className="px-3.5 py-2.5 text-center w-12 border-r border-gray-300">
                    S.NO.
                  </th>
                  <th className="px-3.5 py-2.5 min-w-[200px] border-r border-gray-300">
                    ITEMS / SERVICES
                  </th>
                  <th className="px-3.5 py-2.5 text-center w-20 border-r border-gray-300">
                    QTY.
                  </th>
                  <th className="px-3.5 py-2.5 text-right w-24 border-r border-gray-300">
                    RATE (₹)
                  </th>
                  <th className="px-3.5 py-2.5 text-right w-20 border-r border-gray-300">
                    DISC.
                  </th>
                  <th className="px-3.5 py-2.5 text-center w-16 border-r border-gray-300">
                    TAX
                  </th>
                  <th className="px-3.5 py-2.5 text-right w-28">
                    AMOUNT (₹)
                  </th>
                </tr>
              </thead>

              <tbody className="divide-y divide-gray-200">
                {items.map((item, idx) => {
                  const qty = item.qty || item.days || 1;
                  const unit = item.unit || "PCS";
                  const rate = item.rate || item.ratePerDay || 0;
                  const disc = item.discount || 0;
                  const tax = item.tax || 18;
                  const amount =
                    item.amount ?? Math.max(0, qty * rate - disc);

                  return (
                    <tr key={idx} className="divide-x divide-gray-200">
                      <td className="px-3.5 py-2.5 text-center font-semibold text-gray-600">
                        {idx + 1}
                      </td>

                      <td className="px-3.5 py-2.5">
                        <span className="font-bold text-gray-900">
                          {item.item || item.service || "Media Service"}
                        </span>
                        {(item.description || item.city) && (
                          <div className="text-[11px] text-gray-500">
                            {item.description || item.city}
                          </div>
                        )}
                      </td>

                      <td className="px-3.5 py-2.5 text-center">
                        {qty} {unit}
                      </td>

                      <td className="px-3.5 py-2.5 text-right font-medium">
                        {rate.toLocaleString("en-IN")}
                      </td>

                      <td className="px-3.5 py-2.5 text-right text-gray-600">
                        {disc}
                      </td>

                      <td className="px-3.5 py-2.5 text-center text-gray-700">
                        {tax}%
                      </td>

                      <td className="px-3.5 py-2.5 text-right font-bold text-gray-900">
                        {amount.toLocaleString("en-IN")}
                      </td>
                    </tr>
                  );
                })}
              </tbody>

              {/* Totals inside table footer */}
              <tfoot className="border-t-2 border-gray-800 text-xs font-semibold">
                <tr className="border-b border-gray-200">
                  <td colSpan={5} className="border-r border-gray-200"></td>
                  <td className="px-3 py-2 text-right border-r border-gray-200 font-bold">
                    Subtotal
                  </td>
                  <td className="px-3 py-2 text-right font-bold text-gray-900">
                    {subtotal.toLocaleString("en-IN")}
                  </td>
                </tr>
                <tr className="border-b border-gray-200">
                  <td colSpan={5} className="border-r border-gray-200"></td>
                  <td className="px-3 py-2 text-right border-r border-gray-200 font-bold">
                    GST (18%)
                  </td>
                  <td className="px-3 py-2 text-right font-bold text-gray-900">
                    {gstAmount.toLocaleString("en-IN")}
                  </td>
                </tr>
                <tr className="bg-gray-100 font-bold text-sm">
                  <td colSpan={5} className="border-r border-gray-200"></td>
                  <td className="px-3 py-2 text-right border-r border-gray-200">
                    Total Amount
                  </td>
                  <td className="px-3 py-2 text-right text-gray-900">
                    {totalAmount.toLocaleString("en-IN")}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Amount in words */}
          <div className="mt-4 rounded-lg bg-gray-50 px-4 py-2 text-xs font-semibold text-gray-800 border border-gray-200">
            <span className="font-bold text-gray-500">Amount in Words :</span>{" "}
            <span className="italic">{numberToWordsINR(totalAmount)}</span>
          </div>

          {/* Bank Details (if provided) */}
          {order.bankDetails && (
            <div className="mt-4 rounded-lg bg-gray-50 p-3.5 border border-gray-200 text-xs">
              <p className="font-bold text-gray-800 uppercase tracking-wider text-[11px] mb-2">
                Bank Details for Payment
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-gray-800">
                <div>
                  <span className="text-[10px] text-gray-500 block uppercase">Bank Name</span>
                  <span className="font-semibold text-xs">{order.bankDetails.bankName || "—"}</span>
                </div>
                <div>
                  <span className="text-[10px] text-gray-500 block uppercase">A/C Holder</span>
                  <span className="font-semibold text-xs">{order.bankDetails.personName || "—"}</span>
                </div>
                <div>
                  <span className="text-[10px] text-gray-500 block uppercase">Account No.</span>
                  <span className="font-semibold font-mono text-xs">{order.bankDetails.accountNumber || "—"}</span>
                </div>
                <div>
                  <span className="text-[10px] text-gray-500 block uppercase">IFSC Code</span>
                  <span className="font-semibold font-mono text-xs">{order.bankDetails.ifsc || "—"}</span>
                </div>
                <div>
                  <span className="text-[10px] text-gray-500 block uppercase">Branch</span>
                  <span className="font-semibold text-xs">{order.bankDetails.branch || "—"}</span>
                </div>
              </div>
            </div>
          )}

          {/* Terms & Conditions & Signatory */}
          <div className="mt-8 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-6 pt-4 border-t border-gray-200">
            {/* Left: Terms */}
            <div className="text-xs text-gray-600 max-w-md space-y-1">
              <p className="font-bold uppercase tracking-wider text-gray-900">
                Terms & Conditions:
              </p>
              <ol className="list-decimal list-inside space-y-0.5 leading-relaxed text-[11px]">
                {terms.map((t, idx) => (
                  <li key={idx}>{t}</li>
                ))}
              </ol>
            </div>

            {/* Right: Signature */}
            <div className="text-center sm:text-right space-y-1">
              <p className="text-xs font-bold tracking-wider text-gray-900">
                {order.companyName || "MEDIA OCTUS"}
              </p>

              {/* Signature display or upload button */}
              <div className="min-h-[56px] flex flex-col items-center sm:items-end justify-center">
                {signatureUrl ? (
                  <div className="flex flex-col items-center sm:items-end">
                    <img
                      src={signatureUrl}
                      alt="Authorised Signature"
                      className="h-12 max-w-[180px] object-contain"
                    />
                    <div className="print:hidden mt-1 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => sigInputRef.current?.click()}
                        className="text-[10px] font-semibold text-gray-500 hover:text-[#A8333B] underline cursor-pointer"
                      >
                        Change
                      </button>
                      <span className="text-[10px] text-gray-300">·</span>
                      <button
                        type="button"
                        onClick={handleRemoveSignature}
                        className="text-[10px] font-semibold text-gray-400 hover:text-red-600 underline cursor-pointer"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center sm:items-end">
                    <div className="h-10 flex items-center justify-center sm:justify-end">
                      <svg
                        className="h-8 text-gray-400 opacity-50"
                        viewBox="0 0 200 60"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                      >
                        <path d="M 20 45 C 50 10, 70 50, 90 20 C 110 -5, 130 50, 160 30 C 170 25, 180 35, 190 40" />
                      </svg>
                    </div>
                    <button
                      type="button"
                      onClick={() => sigInputRef.current?.click()}
                      className="print:hidden mt-1 inline-flex items-center gap-1.5 rounded-lg border border-dashed border-[#A8333B] bg-red-50/50 px-2.5 py-1 text-[11px] font-semibold text-[#A8333B] hover:bg-red-100/60 transition cursor-pointer"
                    >
                      <Upload className="h-3 w-3" />
                      Upload Signature
                    </button>
                  </div>
                )}
              </div>

              <p className="text-[11px] font-semibold text-gray-600 border-t border-gray-300 pt-1">
                Authorised Signatory
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Navigation */}
      <div className="flex items-center justify-between pt-2 print:hidden">
        <button
          type="button"
          onClick={onBack}
          className="text-xs font-bold text-gray-500 hover:text-gray-800"
        >
          ← Back to PO Details
        </button>

        <button
          type="button"
          onClick={onNext}
          className="flex items-center gap-1.5 rounded-xl bg-[#A8333B] px-6 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-[#8B2424] transition"
        >
          Proceed to Payment & Invoice Tracking
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
