"use client";

import React, { useEffect, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Download,
  Check,
  Building2,
  Calendar,
  CreditCard,
  MapPin,
  ExternalLink,
} from "lucide-react";
import type { Quotation } from "../types";
import { quotationsApi } from "../api";
import ShareProposalModal from "./ShareProposalModal";

function PrinterIcon({ className = "h-3.5 w-3.5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="6 9 6 2 18 2 18 9" />
      <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
      <rect x="6" y="14" width="12" height="8" />
    </svg>
  );
}

function ShareIcon({ className = "h-3.5 w-3.5" }: { className?: string }) {
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

interface Props {
  quotation: Quotation;
  onBack: () => void;
  onNext?: () => void;
  onRefresh?: (updated: Quotation) => void;
}

function formatDate(dateStr?: string | null) {
  if (!dateStr) return "-";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "-";
  return d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function formatRupees(paise: number): string {
  const rupees = (paise || 0) / 100;
  return `₹${rupees.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function numberToWordsINR(amountInPaise: number): string {
  const amount = Math.floor((amountInPaise || 0) / 100);
  if (amount === 0) return "Zero Rupees Only";

  const a = [
    "", "One ", "Two ", "Three ", "Four ", "Five ", "Six ", "Seven ", "Eight ", "Nine ",
    "Ten ", "Eleven ", "Twelve ", "Thirteen ", "Fourteen ", "Fifteen ", "Sixteen ", "Seventeen ", "Eighteen ", "Nineteen "
  ];
  const b = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

  function inWords(num: number): string {
    if (num < 20) return a[num];
    const digit = num % 10;
    return b[Math.floor(num / 10)] + (digit ? " " + a[digit] : " ");
  }

  let str = "";
  const crore = Math.floor(amount / 10000000);
  const lakh = Math.floor((amount % 10000000) / 100000);
  const thousand = Math.floor((amount % 100000) / 1000);
  const hundred = Math.floor((amount % 1000) / 100);
  const rem = amount % 100;

  if (crore) str += inWords(crore) + "Crore ";
  if (lakh) str += inWords(lakh) + "Lakh ";
  if (thousand) str += inWords(thousand) + "Thousand ";
  if (hundred) str += inWords(hundred) + "Hundred ";
  if (rem) str += inWords(rem);

  return str.trim() + " Rupees Only";
}

export default function QuotationDocument({ quotation, onBack, onNext, onRefresh }: Props) {
  const [downloading, setDownloading] = useState(false);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);

  const quoteId = quotation._id || quotation.id;

  useEffect(() => {
    if (quoteId) {
      quotationsApi.getPdfUrl(quoteId)
        .then((res) => {
          if (res?.pdfUrl) setPdfUrl(res.pdfUrl);
        })
        .catch(() => {});
    }
  }, [quoteId]);

  const handleDownload = async () => {
    if (!quoteId) return;
    try {
      setDownloading(true);
      const res = await quotationsApi.generatePdf(quoteId);
      const url = res.pdfUrl;
      if (url) {
        await quotationsApi.downloadPdf(url, `${quotation.quoteNumber || "Quotation"}.pdf`);
      }
    } catch (err: any) {
      alert(err.message || "Failed to download PDF");
    } finally {
      setDownloading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const leadObj: any = typeof quotation.leadId === "object" ? quotation.leadId : null;
  const clientName = quotation.clientName || leadObj?.companyName || "Client Name";
  const contactPerson = quotation.clientContactPerson || leadObj?.contactPerson || leadObj?.name || "-";
  const phone = quotation.clientPhone || leadObj?.mobile || "-";
  const email = quotation.clientEmail || leadObj?.email || "-";
  const gstin = quotation.clientGstin || "URP (Unregistered)";
  const address = quotation.clientAddress || quotation.clientCity || "-";

  return (
    <div className="space-y-4 pb-12">
      {/* Top Action Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 rounded-2xl border border-gray-200 bg-white p-3.5 shadow-xs dark:border-slate-800 dark:bg-slate-900 print:hidden">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 dark:border-slate-800 dark:bg-slate-900 dark:text-gray-300 dark:hover:bg-slate-800 transition cursor-pointer"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Back to Details</span>
        </button>

        <div className="flex flex-wrap items-center gap-2">
          {/* Public Share & Dispatch Modal */}
          <button
            type="button"
            onClick={() => setShareModalOpen(true)}
            className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 dark:border-slate-800 dark:bg-slate-900 dark:text-gray-300 dark:hover:bg-slate-800 transition cursor-pointer"
            title="Dispatch Proposal via Email, WhatsApp, or Direct Link"
          >
            <ShareIcon className="h-3.5 w-3.5" />
            <span>Share Proposal</span>
          </button>

          {/* Print */}
          <button
            type="button"
            onClick={handlePrint}
            className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 dark:border-slate-800 dark:bg-slate-900 dark:text-gray-300 dark:hover:bg-slate-800 transition cursor-pointer"
          >
            <PrinterIcon className="h-3.5 w-3.5" />
            <span>Print</span>
          </button>

          {/* Download PDF */}
          <button
            type="button"
            disabled={downloading}
            onClick={handleDownload}
            className="inline-flex items-center gap-1.5 rounded-xl bg-[#8B2424] px-4 py-2 text-xs font-bold text-white shadow-xs hover:bg-[#721c1c] disabled:opacity-50 transition cursor-pointer"
          >
            <Download className="h-3.5 w-3.5" />
            <span>{downloading ? "Generating PDF..." : "Download PDF"}</span>
          </button>

          {/* Next to Tracking */}
          {onNext && (
            <button
              type="button"
              onClick={onNext}
              className="inline-flex items-center gap-1.5 rounded-xl bg-gray-900 px-3.5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-black dark:bg-slate-800 dark:hover:bg-slate-700 transition cursor-pointer"
            >
              <span>Next: Tracking</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Official Branded Quotation Document Card */}
      <div className="mx-auto max-w-4xl rounded-2xl border border-gray-200 bg-white p-6 sm:p-10 shadow-xs dark:border-slate-800 dark:bg-slate-900 print:border-none print:shadow-none print:p-0">
        {/* Document Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start gap-4 border-b-2 border-[#8B2424] pb-6">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-2xl font-black tracking-tight text-[#8B2424]">MEDIA OCTUS</span>
              <span className="rounded-full bg-rose-50 px-2.5 py-0.5 text-[10px] font-bold text-[#8B2424] uppercase tracking-wider border border-rose-200">
                OOH Media Proposal
              </span>
            </div>
            <div className="mt-1 text-xs text-gray-500">
              Media Octus Private Limited &bull; Indore, Madhya Pradesh
            </div>
            <div className="text-[11px] text-gray-400">
              Web: www.mediaoctus.com &bull; Email: sales@mediaoctus.com
            </div>
          </div>

          <div className="text-left sm:text-right">
            <div className="text-xl font-bold font-mono text-gray-900 dark:text-white">
              {quotation.quoteNumber}
            </div>
            <div className="mt-1 flex items-center sm:justify-end gap-1.5 text-xs text-gray-500">
              <span className="font-semibold text-gray-700 dark:text-gray-300">Quote Date:</span>
              <span>{formatDate(quotation.createdAt)}</span>
            </div>
            <div className="flex items-center sm:justify-end gap-1.5 text-xs text-gray-500">
              <span className="font-semibold text-gray-700 dark:text-gray-300">Valid Until:</span>
              <span className="text-amber-700 font-medium">{formatDate(quotation.validUntil)}</span>
            </div>
            <div className="mt-1.5">
              <span className="rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-rose-50 text-[#8B2424] border-rose-200">
                Status: {quotation.status}
              </span>
            </div>
          </div>
        </div>

        {/* Client & Billing Info */}
        <div className="my-6 grid grid-cols-1 sm:grid-cols-2 gap-6 rounded-xl bg-gray-50/70 p-4 border border-gray-100 dark:bg-slate-950/60 dark:border-slate-800 text-xs">
          <div>
            <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
              Proposal Prepared For:
            </div>
            <div className="mt-1 text-sm font-bold text-gray-900 dark:text-white">
              {clientName}
            </div>
            <div className="mt-0.5 text-gray-600 dark:text-gray-300">
              Attention: <span className="font-semibold">{contactPerson}</span>
            </div>
            <div className="text-gray-500 dark:text-gray-400">
              Phone: {phone} &bull; Email: {email}
            </div>
            <div className="mt-1 text-gray-500">
              Address: {address}
            </div>
          </div>

          <div className="sm:border-l sm:border-gray-200 sm:pl-6 dark:border-slate-800">
            <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
              Tax &amp; Supply Information:
            </div>
            <div className="mt-1 text-gray-700 dark:text-gray-300">
              <span className="font-semibold text-gray-900 dark:text-white">Client GSTIN:</span> {gstin}
            </div>
            <div className="text-gray-600 dark:text-gray-400">
              <span className="font-semibold">Place of Supply:</span> {quotation.clientState || "Madhya Pradesh"}
            </div>
            <div className="text-gray-600 dark:text-gray-400">
              <span className="font-semibold">Billing Type:</span> {quotation.isInterState ? "Inter-State (IGST 18%)" : "Intra-State (CGST 9% + SGST 9%)"}
            </div>
          </div>
        </div>

        {/* Line Items Table */}
        <div className="my-6 overflow-hidden rounded-xl border border-gray-200 dark:border-slate-800">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-gray-100/80 border-b border-gray-200 text-[10px] font-bold uppercase tracking-wider text-gray-600 dark:bg-slate-950 dark:border-slate-800 dark:text-gray-400">
                <th className="py-2.5 pl-3 pr-2">NO.</th>
                <th className="px-3 py-2.5">SITE / ITEM DETAILS</th>
                <th className="px-3 py-2.5 text-center">DURATION (QTY)</th>
                <th className="px-3 py-2.5 text-right">RATE (₹)</th>
                <th className="px-3 py-2.5 text-right">DISCOUNT</th>
                <th className="px-3 py-2.5 text-center">TAX</th>
                <th className="py-2.5 pl-2 pr-3 text-right">AMOUNT (₹)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-slate-800/60">
              {(quotation.sites || []).map((item, idx) => {
                const siteObj: any = typeof item.siteId === "object" ? item.siteId : null;
                const siteLabel = item.description || siteObj?.name || siteObj?.location || siteObj?.siteCode || "Media Site";
                const city = siteObj?.city ? ` (${siteObj.city})` : "";

                return (
                  <tr key={idx} className="hover:bg-gray-50/50 dark:hover:bg-slate-800/30">
                    <td className="py-3 pl-3 pr-2 text-gray-400 font-mono">{idx + 1}</td>
                    <td className="px-3 py-3">
                      <div className="font-semibold text-gray-900 dark:text-white">
                        {siteLabel}{city}
                      </div>
                      {siteObj?.code && (
                        <div className="text-[10px] font-mono text-gray-400">Code: {siteObj.code}</div>
                      )}
                    </td>
                    <td className="px-3 py-3 text-center text-gray-600 dark:text-gray-300 whitespace-nowrap">
                      <span className="font-bold text-gray-800 dark:text-gray-200">{item.days} Days</span>
                      {item.startDate && item.endDate && (
                        <div className="text-[10px] text-gray-400">
                          {formatDate(item.startDate)} - {formatDate(item.endDate)}
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-3 text-right font-mono text-gray-700 dark:text-gray-300 whitespace-nowrap">
                      {formatRupees(item.ratePerDay)}/d
                    </td>
                    <td className="px-3 py-3 text-right text-gray-500 whitespace-nowrap">
                      {item.discountPercent ? `${item.discountPercent}%` : "-"}
                    </td>
                    <td className="px-3 py-3 text-center text-gray-600 dark:text-gray-300 whitespace-nowrap font-medium">
                      {item.taxPercent !== undefined ? `${item.taxPercent}% GST` : "18% GST"}
                    </td>
                    <td className="py-3 pl-2 pr-3 text-right font-bold text-gray-900 dark:text-white whitespace-nowrap">
                      {formatRupees(item.amount)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Financial Summary & Amount in Words */}
        <div className="my-6 grid grid-cols-1 sm:grid-cols-2 gap-6 items-start">
          <div className="rounded-xl border border-gray-200 bg-gray-50/50 p-4 dark:border-slate-800 dark:bg-slate-950/40">
            <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
              Total Amount in Words:
            </div>
            <div className="mt-1 text-xs font-semibold text-gray-800 dark:text-gray-200 italic">
              {numberToWordsINR(quotation.total)}
            </div>
            {quotation.notes && (
              <div className="mt-3 border-t border-gray-200 pt-2 text-[11px] text-gray-500 dark:border-slate-800">
                <span className="font-bold text-gray-700 dark:text-gray-300">Special Notes:</span> {quotation.notes}
              </div>
            )}
          </div>

          <div className="space-y-2 rounded-xl border border-gray-200 p-4 dark:border-slate-800 text-xs">
            <div className="flex justify-between text-gray-600 dark:text-gray-400">
              <span>Subtotal:</span>
              <span className="font-semibold text-gray-900 dark:text-white">{formatRupees(quotation.subtotal)}</span>
            </div>
            <div className="flex justify-between text-gray-600 dark:text-gray-400">
              <span>GST ({quotation.taxPercent || 18}%):</span>
              <span className="font-semibold text-gray-900 dark:text-white">{formatRupees(quotation.taxAmount)}</span>
            </div>
            <div className="border-t border-gray-200 pt-2 flex justify-between text-sm font-bold text-[#8B2424] dark:text-rose-400">
              <span>Grand Total:</span>
              <span>{formatRupees(quotation.total)}</span>
            </div>
          </div>
        </div>

        {/* Terms & Conditions and Bank Details */}
        <div className="my-6 grid grid-cols-1 sm:grid-cols-2 gap-6 text-xs">
          {/* Terms */}
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300 mb-2">
              Terms &amp; Conditions:
            </div>
            <ul className="space-y-1 text-[11px] text-gray-600 dark:text-gray-400 list-disc pl-4">
              {(quotation.terms || [
                "100% Payment in Advance.",
                "GST applicable as per statutory norms.",
                "Display is subject to municipal approval and weather conditions.",
                "Please visit https://www.mediaoctus.com for policies."
              ]).map((term, i) => (
                <li key={i}>{term}</li>
              ))}
            </ul>
          </div>

          {/* Bank Details */}
          <div className="rounded-xl border border-gray-200 bg-gray-50/50 p-3.5 dark:border-slate-800 dark:bg-slate-950/40">
            <div className="text-xs font-bold uppercase tracking-wider text-gray-700 dark:text-gray-300 mb-1.5 flex items-center gap-1.5">
              <CreditCard className="h-3.5 w-3.5 text-[#8B2424]" />
              <span>Bank Payment Details:</span>
            </div>
            <div className="space-y-0.5 text-[11px] text-gray-600 dark:text-gray-400 font-mono">
              <div>Bank: <span className="font-bold text-gray-800 dark:text-gray-200">{quotation.bankDetails?.bankName || "HDFC Bank"}</span></div>
              <div>A/C Name: {quotation.bankDetails?.accountName || "Media Octus Private Limited"}</div>
              <div>A/C Number: <span className="font-bold text-gray-900 dark:text-white">{quotation.bankDetails?.accountNumber || "50200012345678"}</span></div>
              <div>IFSC Code: <span className="font-bold text-gray-900 dark:text-white">{quotation.bankDetails?.ifscCode || "HDFC0001234"}</span></div>
              <div>Branch: {quotation.bankDetails?.branch || "Indore Branch, M.P."}</div>
            </div>
          </div>
        </div>

        {/* Signatures */}
        <div className="mt-8 pt-6 border-t border-gray-200 dark:border-slate-800 flex justify-between items-end text-xs">
          <div>
            <div className="text-gray-400 text-[10px] uppercase font-bold tracking-wider">Client Acceptance:</div>
            <div className="mt-8 border-t border-gray-300 dark:border-slate-700 w-44 pt-1 text-[11px] text-gray-500 text-center">
              Authorized Signatory &amp; Stamp
            </div>
          </div>

          <div className="text-right">
            <div className="text-gray-400 text-[10px] uppercase font-bold tracking-wider">For Media Octus Pvt. Ltd.:</div>
            {quotation.signatureImage ? (
              <img src={quotation.signatureImage} alt="Signature" className="h-12 ml-auto my-1 object-contain" />
            ) : (
              <div className="h-10"></div>
            )}
            <div className="border-t border-gray-300 dark:border-slate-700 w-48 pt-1 text-[11px] text-gray-700 dark:text-gray-300 font-semibold text-center ml-auto">
              {quotation.signatoryName || "Authorized Signatory"}
            </div>
          </div>
        </div>
      </div>

      {/* Unified Share & Dispatch Proposal Modal */}
      <ShareProposalModal
        quotation={quotation}
        isOpen={shareModalOpen}
        onClose={() => setShareModalOpen(false)}
        onSent={(updated) => onRefresh?.(updated)}
      />
    </div>
  );
}
