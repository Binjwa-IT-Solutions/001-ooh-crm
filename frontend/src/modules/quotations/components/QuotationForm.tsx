"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Plus,
  Trash2,
  CreditCard,
  Building2,
  Calendar,
  Sparkles,
  Clock,
} from "lucide-react";
import { quotationsApi } from "../api";
import { leadsApi } from "@/modules/leads/api";
import { api } from "@/shared/api/client";
import type { Lead } from "@/modules/leads/types";
import type { Quotation } from "../types";
import LeadCombobox from "./LeadCombobox";
import SiteCombobox, { SiteOption } from "./SiteCombobox";

interface QuotationLineForm {
  siteId: string;
  description: string;
  ratePerDay: number;
  days: number;
  hasCustomDates: boolean;
  startDate?: string;
  endDate?: string;
  discountPercent: number;
  taxPercent: number;
}

interface Props {
  initialLeadId?: string;
  initialQuote?: Quotation | null;
  onBack: () => void;
  onSuccess: (quotation: Quotation) => void;
}

export default function QuotationForm({ initialLeadId, initialQuote, onBack, onSuccess }: Props) {
  const router = useRouter();

  const [leads, setLeads] = useState<Lead[]>([]);
  const [sites, setSites] = useState<SiteOption[]>([]);
  const [selectedLeadId, setSelectedLeadId] = useState<string>(initialLeadId || "");
  const [clientName, setClientName] = useState<string>("");
  const [clientContactPerson, setClientContactPerson] = useState<string>("");
  const [clientEmail, setClientEmail] = useState<string>("");
  const [clientPhone, setClientPhone] = useState<string>("");
  const [clientGstin, setClientGstin] = useState<string>("");
  const [clientAddress, setClientAddress] = useState<string>("");
  const [clientCity, setClientCity] = useState<string>("");
  const [clientState, setClientState] = useState<string>("");
  const [isInterState, setIsInterState] = useState<boolean>(false);
  const [overallDiscount, setOverallDiscount] = useState<number>(0);
  const [overallTaxRate, setOverallTaxRate] = useState<number>(18);
  const [notes, setNotes] = useState<string>("");
  const [validUntil, setValidUntil] = useState<string>(
    new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  );

  // Bank Details State
  const [showBankDetails, setShowBankDetails] = useState<boolean>(true);
  const [bankName, setBankName] = useState<string>("HDFC Bank");
  const [accountName, setAccountName] = useState<string>("Media Octus Private Limited");
  const [accountNumber, setAccountNumber] = useState<string>("50200012345678");
  const [ifscCode, setIfscCode] = useState<string>("HDFC0001234");
  const [branch, setBranch] = useState<string>("Vijay Nagar Branch, Indore");

  // E-Signature / Authorized Signatory State
  const [showSignature, setShowSignature] = useState<boolean>(true);
  const [signatureImage, setSignatureImage] = useState<string | undefined>(undefined);
  const [signatoryName, setSignatoryName] = useState<string>("Rishabh Jain");
  const [signatoryDesignation, setSignatoryDesignation] = useState<string>("Authorized Signatory");

  // Terms & Conditions Dynamic List
  const [termsList, setTermsList] = useState<string[]>([
    "GST applicable as per statutory norms.",
    "For any query please feel free to call or message anytime.",
    "100% Payment in Advance.",
    "Please visit https://www.mediaoctus.com for policies.",
  ]);

  function handleAddCondition() {
    setTermsList((prev) => [...prev, ""]);
  }

  function handleUpdateCondition(index: number, value: string) {
    setTermsList((prev) => prev.map((term, i) => (i === index ? value : term)));
  }

  function handleRemoveCondition(index: number) {
    setTermsList((prev) => prev.filter((_, i) => i !== index));
  }

  const [lineItems, setLineItems] = useState<QuotationLineForm[]>([
    {
      siteId: "",
      description: "",
      ratePerDay: 0,
      days: 30,
      hasCustomDates: false,
      startDate: "",
      endDate: "",
      discountPercent: 0,
      taxPercent: 18,
    },
  ]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    leadsApi
      .list({ limit: 100 })
      .then((res) => {
        setLeads(res.data || []);
        if (initialLeadId) {
          const l = res.data.find((item) => item._id === initialLeadId);
          if (l) populateFromLead(l);
        }
      })
      .catch(() => {});

    api
      .get<{ data: SiteOption[] }>("/api/sites?limit=100")
      .then((res) => {
        setSites(res.data || []);
      })
      .catch(() => {});
  }, [initialLeadId]);

  useEffect(() => {
    if (initialQuote) {
      const q = initialQuote;
      const leadIdStr = typeof q.leadId === "object" ? (q.leadId as any)?._id : q.leadId;
      if (leadIdStr) setSelectedLeadId(leadIdStr);
      if (q.clientName) setClientName(q.clientName);
      if (q.clientContactPerson) setClientContactPerson(q.clientContactPerson);
      if (q.clientEmail) setClientEmail(q.clientEmail);
      if (q.clientPhone) setClientPhone(q.clientPhone);
      if (q.clientGstin) setClientGstin(q.clientGstin);
      if (q.clientAddress) setClientAddress(q.clientAddress);
      if (q.clientCity) setClientCity(q.clientCity);
      if (q.clientState) setClientState(q.clientState);
      if (q.isInterState !== undefined) setIsInterState(Boolean(q.isInterState));
      if (q.taxPercent !== undefined) setOverallTaxRate(q.taxPercent);
      if (q.notes) setNotes(q.notes);
      if (q.validUntil) {
        setValidUntil(new Date(q.validUntil).toISOString().slice(0, 10));
      }
      if (q.bankDetails) {
        setShowBankDetails(true);
        if (q.bankDetails.bankName) setBankName(q.bankDetails.bankName);
        if (q.bankDetails.accountName) setAccountName(q.bankDetails.accountName);
        if (q.bankDetails.accountNumber) setAccountNumber(q.bankDetails.accountNumber);
        if (q.bankDetails.ifscCode) setIfscCode(q.bankDetails.ifscCode);
        if (q.bankDetails.branch) setBranch(q.bankDetails.branch);
      }
      if (q.signatureImage || q.signatoryName) {
        setShowSignature(true);
        if (q.signatureImage) setSignatureImage(q.signatureImage);
        if (q.signatoryName) setSignatoryName(q.signatoryName);
        if (q.signatoryDesignation) setSignatoryDesignation(q.signatoryDesignation);
      }
      if (q.terms && q.terms.length > 0) {
        setTermsList(q.terms);
      }
      if (q.sites && q.sites.length > 0) {
        setLineItems(
          q.sites.map((item) => {
            const siteObj: any = typeof item.siteId === "object" ? item.siteId : null;
            return {
              siteId: siteObj?._id || String(item.siteId),
              description: item.description || siteObj?.location || siteObj?.name || "",
              ratePerDay: Number(item.ratePerDay ? item.ratePerDay / 100 : 1000),
              days: item.days || 30,
              hasCustomDates: Boolean(item.startDate && item.endDate),
              startDate: item.startDate ? new Date(item.startDate).toISOString().slice(0, 10) : "",
              endDate: item.endDate ? new Date(item.endDate).toISOString().slice(0, 10) : "",
              discountPercent: item.discountPercent || 0,
              taxPercent: item.taxPercent !== undefined ? item.taxPercent : 18,
            };
          })
        );
      }
    }
  }, [initialQuote]);

  function populateFromLead(lead: Lead) {
    const leadAny = lead as any;
    setSelectedLeadId(lead._id || "");
    setClientName(lead.companyName || "");
    setClientContactPerson(lead.contactPerson || leadAny.name || "");
    setClientEmail(lead.email || "");
    setClientPhone(lead.mobile || "");
    setClientAddress(lead.companyAddress || lead.companyLocation || "");
    setClientCity(lead.city || "");
    if (leadAny.state) {
      setClientState(leadAny.state);
      setIsInterState(leadAny.state.toLowerCase() !== "madhya pradesh" && leadAny.state.toLowerCase() !== "mp");
    }
  }

  function handleLeadChange(id: string) {
    setSelectedLeadId(id);
    const lead = leads.find((l) => l._id === id);
    if (lead) populateFromLead(lead);
  }

  function handleAddLineItem() {
    setLineItems((prev) => [
      ...prev,
      {
        siteId: "",
        description: "",
        ratePerDay: 0,
        days: 30,
        hasCustomDates: false,
        startDate: "",
        endDate: "",
        discountPercent: overallDiscount,
        taxPercent: overallTaxRate,
      },
    ]);
  }

  function handleRemoveLineItem(index: number) {
    setLineItems((prev) => prev.filter((_, i) => i !== index));
  }

  function handleLineItemChange(index: number, field: keyof QuotationLineForm, val: any) {
    setLineItems((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: val };

      if (field === "siteId") {
        const found = sites.find((s) => s._id === val);
        if (found) {
          const code = found.atrNo || found.siteCode || found.code || "SITE";
          const loc = found.location || found.name || "Media Site";
          const city = found.city || "Indore";
          const type = found.mediaType || found.type || "Hoarding";
          copy[index].description = `${code} - ${loc} (${type}, ${city})`;
          if (found.ratePerDay) {
            copy[index].ratePerDay = found.ratePerDay;
          } else if (found.baseCostPerDay) {
            copy[index].ratePerDay = found.baseCostPerDay / 100;
          }
        }
      }

      // Auto update days when custom dates change
      if ((field === "startDate" || field === "endDate") && copy[index].hasCustomDates) {
        const s = new Date(field === "startDate" ? val : copy[index].startDate || "");
        const e = new Date(field === "endDate" ? val : copy[index].endDate || "");
        if (!isNaN(s.getTime()) && !isNaN(e.getTime()) && e >= s) {
          copy[index].days = Math.max(1, Math.ceil((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)) + 1);
        }
      }

      return copy;
    });
  }

  // Calculate Totals based on days (no forced dates)
  const computedLines = lineItems.map((item) => {
    let days = Math.max(1, Number(item.days || 30));
    if (item.hasCustomDates && item.startDate && item.endDate) {
      const s = new Date(item.startDate);
      const e = new Date(item.endDate);
      if (!isNaN(s.getTime()) && !isNaN(e.getTime()) && e >= s) {
        days = Math.max(1, Math.ceil((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24)) + 1);
      }
    }
    const baseAmt = days * (item.ratePerDay || 0);
    const disc = baseAmt * ((item.discountPercent || 0) / 100);
    const taxableAmt = baseAmt - disc;
    return { days, baseAmt, disc, taxableAmt };
  });

  const grossTotal = computedLines.reduce((acc, curr) => acc + curr.baseAmt, 0);
  const totalDiscount = computedLines.reduce((acc, curr) => acc + curr.disc, 0);
  const subtotal = computedLines.reduce((acc, curr) => acc + curr.taxableAmt, 0);
  const taxAmount = subtotal * (overallTaxRate / 100);
  const total = subtotal + taxAmount;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!selectedLeadId) {
      setError("Please select a Lead to create this proposal.");
      return;
    }

    if (lineItems.length === 0 || lineItems.some((l) => !l.siteId)) {
      setError("Please select at least one Media Site for the quotation.");
      return;
    }

    try {
      setLoading(true);
      const payload: any = {
        leadId: selectedLeadId,
        clientName,
        clientContactPerson,
        clientEmail,
        clientPhone,
        clientGstin,
        clientAddress,
        clientCity,
        clientState,
        isInterState,
        notes,
        terms: termsList.filter((t) => t.trim().length > 0),
        bankDetails: showBankDetails
          ? {
              bankName,
              accountName,
              accountNumber,
              ifscCode,
              branch,
            }
          : undefined,
        signatureImage: showSignature ? signatureImage : undefined,
        signatoryName: showSignature ? signatoryName : undefined,
        signatoryDesignation: showSignature ? signatoryDesignation : undefined,
        validUntil,
        sites: lineItems.map((item, idx) => {
          const computed = computedLines[idx] || { days: 30 };
          return {
            siteId: item.siteId,
            description: item.description,
            ratePerDay: Number(item.ratePerDay || 0),
            days: computed.days,
            discountPercent: Number(item.discountPercent || 0),
            taxPercent: Number(overallTaxRate || 18),
            // Start and End dates are optional (sent only if specifically specified)
            startDate: item.hasCustomDates && item.startDate ? new Date(item.startDate).toISOString() : undefined,
            endDate: item.hasCustomDates && item.endDate ? new Date(item.endDate).toISOString() : undefined,
          };
        }),
      };

      let result: Quotation;
      if (initialQuote) {
        const quoteId = initialQuote._id || initialQuote.id;
        result = await quotationsApi.update(quoteId, payload);
      } else {
        result = await quotationsApi.create(payload);
      }
      onSuccess(result);
    } catch (err: any) {
      setError(err?.message || "Failed to save quotation. Please verify input fields.");
    } finally {
      setLoading(false);
    }
  }

  const isEditing = Boolean(initialQuote);

  return (
    <form onSubmit={handleSubmit} className="space-y-6 pb-12">
      {/* Top Bar */}
      <div className="flex items-center justify-between rounded-2xl border border-gray-200 bg-white p-3.5 shadow-xs dark:border-slate-800 dark:bg-slate-900">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50 dark:border-slate-800 dark:bg-slate-900 dark:text-gray-300 dark:hover:bg-slate-800 transition cursor-pointer"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>{isEditing ? "Cancel & Return" : "Back to Quotes"}</span>
        </button>

        {isEditing && (
          <div className="hidden sm:flex items-center gap-2">
            <span className="rounded-full bg-amber-50 border border-amber-200 px-3 py-1 text-xs font-bold text-amber-800 dark:bg-amber-950/40 dark:border-amber-700 dark:text-amber-300 font-mono">
              Editing: {initialQuote?.quoteNumber}
            </span>
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="inline-flex items-center gap-1.5 rounded-xl bg-[#8B2424] px-5 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-[#721c1c] disabled:opacity-50 transition cursor-pointer"
        >
          <Sparkles className="h-3.5 w-3.5" />
          <span>{loading ? (isEditing ? "Saving Changes..." : "Generating Quote...") : (isEditing ? "Save Changes" : "Generate Proposal (Next)")}</span>
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-3.5 text-xs font-bold text-[#8B2424]">
          {error}
        </div>
      )}

      {/* Section 1: Client & Lead Selection */}
      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900 space-y-4">
        <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <Building2 className="h-4 w-4 text-[#8B2424]" />
          <span>1. Client &amp; Lead Information</span>
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-500 mb-1">
              Select Lead / Company *
            </label>
            <LeadCombobox
              leads={leads}
              selectedLeadId={selectedLeadId}
              onSelect={handleLeadChange}
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-500 mb-1">
              Client / Company Name
            </label>
            <input
              type="text"
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              placeholder="Company name"
              className="w-full rounded-xl border border-gray-200 px-3 py-2 text-xs text-gray-900 outline-none focus:border-[#8B2424] dark:border-slate-800 dark:bg-slate-900 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-500 mb-1">
              Contact Person
            </label>
            <input
              type="text"
              value={clientContactPerson}
              onChange={(e) => setClientContactPerson(e.target.value)}
              placeholder="Contact Person"
              className="w-full rounded-xl border border-gray-200 px-3 py-2 text-xs text-gray-900 outline-none focus:border-[#8B2424] dark:border-slate-800 dark:bg-slate-900 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-500 mb-1">
              Mobile Number
            </label>
            <input
              type="text"
              value={clientPhone}
              onChange={(e) => setClientPhone(e.target.value)}
              placeholder="10-digit Mobile"
              className="w-full rounded-xl border border-gray-200 px-3 py-2 text-xs text-gray-900 outline-none focus:border-[#8B2424] dark:border-slate-800 dark:bg-slate-900 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-500 mb-1">
              Client Email
            </label>
            <input
              type="email"
              value={clientEmail}
              onChange={(e) => setClientEmail(e.target.value)}
              placeholder="client@example.com"
              className="w-full rounded-xl border border-gray-200 px-3 py-2 text-xs text-gray-900 outline-none focus:border-[#8B2424] dark:border-slate-800 dark:bg-slate-900 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-500 mb-1">
              Client GSTIN
            </label>
            <input
              type="text"
              value={clientGstin}
              onChange={(e) => setClientGstin(e.target.value)}
              placeholder="GST Number"
              className="w-full rounded-xl border border-gray-200 px-3 py-2 text-xs text-gray-900 outline-none focus:border-[#8B2424] dark:border-slate-800 dark:bg-slate-900 dark:text-white"
            />
          </div>
        </div>
      </div>

      {/* Section 2: Media Sites & Duration (Days Primary, Dates Optional) */}
      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <Calendar className="h-4 w-4 text-[#8B2424]" />
              <span>2. Media Sites &amp; Campaign Duration</span>
            </h3>
            <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
              Set campaign duration in days. Calendar execution dates are finalized when the proposal is accepted.
            </p>
          </div>

          <button
            type="button"
            onClick={handleAddLineItem}
            className="inline-flex items-center gap-1 rounded-xl bg-rose-50 px-3 py-1.5 text-xs font-bold text-[#8B2424] hover:bg-rose-100 dark:bg-rose-950/40 dark:text-rose-300 transition cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Add Site</span>
          </button>
        </div>

        <div className="space-y-4">
          {lineItems.map((item, index) => {
            const lineComputed = computedLines[index] || { days: 30, taxableAmt: 0 };

            return (
              <div
                key={index}
                className="rounded-xl border border-gray-200/90 p-3 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs space-y-2.5 transition hover:border-gray-300 dark:hover:border-slate-700"
              >
                {/* Header row with Site badge, summary & custom date toggle */}
                <div className="flex items-center justify-between gap-2 border-b border-gray-100 dark:border-slate-800/80 pb-2">
                  <div className="flex items-center gap-2 truncate">
                    <span className="rounded-md bg-rose-50 px-2 py-0.5 text-[11px] font-bold text-[#8B2424] dark:bg-rose-950/40 dark:text-rose-300 shrink-0">
                      Site #{index + 1}
                    </span>
                    {item.siteId && item.description && (
                      <span className="text-[11px] font-medium text-gray-500 dark:text-gray-400 truncate max-w-xs sm:max-w-md">
                        {item.description}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <label className="inline-flex items-center gap-1.5 cursor-pointer text-[11px] text-gray-500 hover:text-gray-700 dark:text-gray-400 select-none">
                      <input
                        type="checkbox"
                        checked={item.hasCustomDates}
                        onChange={(e) => handleLineItemChange(index, "hasCustomDates", e.target.checked)}
                        className="rounded border-gray-300 text-[#8B2424] focus:ring-[#8B2424]"
                      />
                      <span>Specify Dates</span>
                    </label>

                    {lineItems.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveLineItem(index)}
                        className="p-1 text-gray-400 hover:text-rose-600 transition cursor-pointer"
                        title="Remove Site"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* 5-Column Compact Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-2.5 text-xs">
                  {/* Site Picker with Searchable Combobox */}
                  <div className="lg:col-span-4">
                    <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">
                      Choose Hoarding / Media Site *
                    </label>
                    <SiteCombobox
                      sites={sites}
                      selectedSiteId={item.siteId}
                      onSelect={(val) => handleLineItemChange(index, "siteId", val)}
                    />
                  </div>

                  {/* Duration in Days (Primary Input) */}
                  <div className="lg:col-span-2">
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-[10px] font-bold text-gray-400 uppercase">
                        Duration *
                      </label>
                      <div className="flex gap-0.5">
                        {[15, 30, 60].map((d) => (
                          <button
                            key={d}
                            type="button"
                            onClick={() => handleLineItemChange(index, "days", d)}
                            className={`rounded px-1 text-[9px] font-bold transition cursor-pointer ${
                              item.days === d
                                ? "bg-[#8B2424] text-white"
                                : "bg-gray-100 text-gray-500 hover:bg-gray-200 dark:bg-slate-800 dark:text-gray-300"
                            }`}
                          >
                            {d}d
                          </button>
                        ))}
                      </div>
                    </div>
                    <input
                      type="number"
                      min={1}
                      value={item.days}
                      onChange={(e) => handleLineItemChange(index, "days", Math.max(1, Number(e.target.value)))}
                      className="h-9 w-full rounded-lg border border-gray-200 bg-white px-2.5 text-xs font-bold text-gray-900 outline-none focus:border-[#8B2424] dark:border-slate-800 dark:bg-slate-900 dark:text-white"
                    />
                  </div>

                  {/* Rate / Day */}
                  <div className="lg:col-span-2">
                    <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">
                      Rate / Day (₹)
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={item.ratePerDay}
                      onChange={(e) => handleLineItemChange(index, "ratePerDay", Number(e.target.value))}
                      className="h-9 w-full rounded-lg border border-gray-200 bg-white px-2.5 text-xs font-bold text-gray-900 outline-none focus:border-[#8B2424] dark:border-slate-800 dark:bg-slate-900 dark:text-white"
                    />
                  </div>

                  {/* Discount (%) */}
                  <div className="lg:col-span-2">
                    <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">
                      Discount (%)
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={item.discountPercent || 0}
                      onChange={(e) =>
                        handleLineItemChange(
                          index,
                          "discountPercent",
                          Math.min(100, Math.max(0, Number(e.target.value)))
                        )
                      }
                      className="h-9 w-full rounded-lg border border-gray-200 bg-white px-2.5 text-xs font-bold text-gray-900 outline-none focus:border-[#8B2424] dark:border-slate-800 dark:bg-slate-900 dark:text-white"
                    />
                  </div>

                  {/* Tax (% GST) */}
                  <div className="lg:col-span-2">
                    <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">
                      Tax (% GST)
                    </label>
                    <select
                      value={item.taxPercent ?? 18}
                      onChange={(e) => handleLineItemChange(index, "taxPercent", Number(e.target.value))}
                      className="h-9 w-full rounded-lg border border-gray-200 bg-white px-2 text-xs font-bold text-gray-900 outline-none focus:border-[#8B2424] dark:border-slate-800 dark:bg-slate-900 dark:text-white"
                    >
                      <option value={18}>18% GST</option>
                      <option value={12}>12% GST</option>
                      <option value={5}>5% GST</option>
                      <option value={0}>0% (Exempt)</option>
                    </select>
                  </div>
                </div>

                {/* Optional Calendar Dates (Expandable Drawer) */}
                {item.hasCustomDates && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-2.5 rounded-lg bg-gray-50/70 border border-gray-200/80 dark:bg-slate-950/60 dark:border-slate-800">
                    <div>
                      <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">
                        Estimated Start Date
                      </label>
                      <input
                        type="date"
                        value={item.startDate || ""}
                        onChange={(e) => handleLineItemChange(index, "startDate", e.target.value)}
                        className="h-8 w-full rounded-md border border-gray-200 px-2 text-xs text-gray-900 outline-none focus:border-[#8B2424] dark:border-slate-800 dark:bg-slate-900 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">
                        Estimated End Date
                      </label>
                      <input
                        type="date"
                        value={item.endDate || ""}
                        onChange={(e) => handleLineItemChange(index, "endDate", e.target.value)}
                        className="h-8 w-full rounded-md border border-gray-200 px-2 text-xs text-gray-900 outline-none focus:border-[#8B2424] dark:border-slate-800 dark:bg-slate-900 dark:text-white"
                      />
                    </div>
                  </div>
                )}

                {/* Compact Financial Indicator */}
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs pt-1.5 border-t border-gray-100 dark:border-slate-800">
                  <div className="flex flex-wrap items-center gap-2 text-gray-500 text-[11px]">
                    <span>
                      Duration: <strong className="text-gray-800 dark:text-gray-200">{lineComputed.days} Days</strong>
                    </span>
                    <span>&bull;</span>
                    <span>
                      Base: <strong className="text-gray-800 dark:text-gray-200">₹{lineComputed.baseAmt.toLocaleString("en-IN")}</strong>
                    </span>
                    {lineComputed.disc > 0 && (
                      <>
                        <span>&bull;</span>
                        <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                          Disc ({item.discountPercent}%): -₹{lineComputed.disc.toLocaleString("en-IN")}
                        </span>
                      </>
                    )}
                  </div>
                  <span className="font-bold text-[#8B2424] dark:text-rose-400 text-xs">
                    Line Total: ₹{lineComputed.taxableAmt.toLocaleString("en-IN")}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Pricing Summary */}
        <div className="flex justify-end pt-3">
          <div className="w-80 space-y-2 rounded-xl bg-gray-50 p-4 border border-gray-200 dark:bg-slate-950 dark:border-slate-800 text-xs">
            <div className="flex justify-between text-gray-600 dark:text-gray-400">
              <span>Gross Total:</span>
              <span className="font-semibold text-gray-900 dark:text-white">
                ₹{grossTotal.toLocaleString("en-IN")}
              </span>
            </div>
            {totalDiscount > 0 && (
              <div className="flex justify-between text-emerald-600 dark:text-emerald-400">
                <span>Total Discount:</span>
                <span className="font-semibold">
                  -₹{totalDiscount.toLocaleString("en-IN")}
                </span>
              </div>
            )}
            <div className="flex justify-between text-gray-600 dark:text-gray-400">
              <span>Taxable Subtotal:</span>
              <span className="font-semibold text-gray-900 dark:text-white">
                ₹{subtotal.toLocaleString("en-IN")}
              </span>
            </div>
            <div className="flex justify-between text-gray-600 dark:text-gray-400">
              <span>GST ({overallTaxRate}%):</span>
              <span className="font-semibold text-gray-900 dark:text-white">
                ₹{taxAmount.toLocaleString("en-IN")}
              </span>
            </div>
            <div className="border-t border-gray-200 pt-2 flex justify-between text-sm font-bold text-[#8B2424] dark:text-rose-400">
              <span>Total Quotation:</span>
              <span>₹{total.toLocaleString("en-IN")}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Section 3: Terms & Conditions and Bank Details */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Bank Details Card */}
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900 space-y-4">
          <div className="flex items-center justify-between border-b border-gray-100 pb-3 dark:border-slate-800">
            <div className="flex items-center gap-2 font-bold text-xs uppercase tracking-wider text-gray-800 dark:text-white">
              <CreditCard className="w-4 h-4 text-[#8B2424]" />
              <span>Bank Payment Details</span>
            </div>
            {showBankDetails ? (
              <button
                type="button"
                onClick={() => setShowBankDetails(false)}
                className="inline-flex items-center gap-1 text-xs font-semibold text-rose-600 hover:text-rose-700 transition cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Remove from Quote</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setShowBankDetails(true)}
                className="inline-flex items-center gap-1 text-xs font-semibold text-[#8B2424] hover:underline cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Include Bank Details</span>
              </button>
            )}
          </div>

          {showBankDetails ? (
            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">
                    Bank Name
                  </label>
                  <input
                    type="text"
                    value={bankName}
                    onChange={(e) => setBankName(e.target.value)}
                    placeholder="e.g. HDFC Bank"
                    className="w-full rounded-xl border border-gray-200 px-3 py-2 text-xs text-gray-900 outline-none focus:border-[#8B2424] dark:border-slate-800 dark:bg-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">
                    Beneficiary / Account Name
                  </label>
                  <input
                    type="text"
                    value={accountName}
                    onChange={(e) => setAccountName(e.target.value)}
                    placeholder="Media Octus Pvt Ltd"
                    className="w-full rounded-xl border border-gray-200 px-3 py-2 text-xs text-gray-900 outline-none focus:border-[#8B2424] dark:border-slate-800 dark:bg-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">
                    Account Number
                  </label>
                  <input
                    type="text"
                    value={accountNumber}
                    onChange={(e) => setAccountNumber(e.target.value)}
                    placeholder="Account Number"
                    className="w-full rounded-xl border border-gray-200 px-3 py-2 text-xs font-mono text-gray-900 outline-none focus:border-[#8B2424] dark:border-slate-800 dark:bg-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">
                    IFSC Code
                  </label>
                  <input
                    type="text"
                    value={ifscCode}
                    onChange={(e) => setIfscCode(e.target.value)}
                    placeholder="IFSC Code"
                    className="w-full rounded-xl border border-gray-200 px-3 py-2 text-xs font-mono text-gray-900 outline-none focus:border-[#8B2424] dark:border-slate-800 dark:bg-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">
                  Branch Location
                </label>
                <input
                  type="text"
                  value={branch}
                  onChange={(e) => setBranch(e.target.value)}
                  placeholder="e.g. Vijay Nagar Branch, Indore"
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-xs text-gray-900 outline-none focus:border-[#8B2424] dark:border-slate-800 dark:bg-slate-900 dark:text-white"
                />
              </div>
            </div>
          ) : (
            <div className="py-6 text-center text-xs text-gray-400">
              Bank details hidden from this proposal. Click &quot;+ Include Bank Details&quot; to show them.
            </div>
          )}
        </div>

        {/* Right: Terms & Conditions Card */}
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900 space-y-4">
          <div className="flex items-center justify-between border-b border-gray-100 pb-3 dark:border-slate-800">
            <div className="flex items-center gap-2 font-bold text-xs uppercase tracking-wider text-gray-800 dark:text-white">
              <span>Terms &amp; Conditions</span>
            </div>
            <button
              type="button"
              onClick={handleAddCondition}
              className="inline-flex items-center gap-1 text-xs font-bold text-[#8B2424] hover:underline cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Condition</span>
            </button>
          </div>

          <div className="space-y-2.5 max-h-60 overflow-y-auto pr-1">
            {termsList.length === 0 ? (
              <div className="py-6 text-center text-xs text-gray-400">
                No terms added. Click &quot;Add Condition&quot; to specify terms.
              </div>
            ) : (
              termsList.map((term, index) => (
                <div key={index} className="flex items-center gap-2">
                  <span className="w-5 text-right text-xs font-semibold text-gray-400 select-none">
                    {index + 1}.
                  </span>
                  <input
                    type="text"
                    value={term}
                    onChange={(e) => handleUpdateCondition(index, e.target.value)}
                    placeholder="Enter condition..."
                    className="flex-1 rounded-xl border border-gray-200 px-3 py-1.5 text-xs text-gray-900 outline-none focus:border-[#8B2424] dark:border-slate-800 dark:bg-slate-900 dark:text-white"
                  />
                  <button
                    type="button"
                    onClick={() => handleRemoveCondition(index)}
                    className="p-1 text-gray-400 hover:text-rose-600 transition cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Section 4: Signatory, Validity & Notes */}
      <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-xs dark:border-slate-800 dark:bg-slate-900 space-y-4">
        <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
          <span>4. Signatory, Validity &amp; Special Remarks</span>
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-500 mb-1">
              Authorized Signatory Name
            </label>
            <input
              type="text"
              value={signatoryName}
              onChange={(e) => setSignatoryName(e.target.value)}
              placeholder="e.g. Rishabh Jain"
              className="w-full rounded-xl border border-gray-200 px-3 py-2 text-xs text-gray-900 outline-none focus:border-[#8B2424] dark:border-slate-800 dark:bg-slate-900 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-500 mb-1">
              Signatory Designation
            </label>
            <input
              type="text"
              value={signatoryDesignation}
              onChange={(e) => setSignatoryDesignation(e.target.value)}
              placeholder="Authorized Signatory"
              className="w-full rounded-xl border border-gray-200 px-3 py-2 text-xs text-gray-900 outline-none focus:border-[#8B2424] dark:border-slate-800 dark:bg-slate-900 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-500 mb-1">
              Proposal Validity Date
            </label>
            <input
              type="date"
              value={validUntil}
              onChange={(e) => setValidUntil(e.target.value)}
              className="w-full rounded-xl border border-gray-200 px-3 py-2 text-xs text-gray-900 outline-none focus:border-[#8B2424] dark:border-slate-800 dark:bg-slate-900 dark:text-white"
            />
          </div>
        </div>

        <div>
          <label className="block text-[11px] font-bold uppercase tracking-wider text-gray-500 mb-1">
            Internal / Special Remarks
          </label>
          <textarea
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Any special remarks for client or billing..."
            className="w-full rounded-xl border border-gray-200 px-3 py-2 text-xs text-gray-900 outline-none focus:border-[#8B2424] dark:border-slate-800 dark:bg-slate-900 dark:text-white"
          />
        </div>
      </div>
    </form>
  );
}
