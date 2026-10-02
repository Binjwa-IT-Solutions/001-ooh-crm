"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { getCampaignLeadOptions, getCampaignManagers } from "../api";
import { quotationsApi } from "@/modules/quotations/api";

import type {
  Campaign,
  CampaignStatus,
  CreateCampaignPayload,
  LeadOption,
  ManagerOption,
} from "../types";

interface CampaignFormData {
  leadId: string;
  name: string;
  state: string;
  city: string;
  quotationName: string;
  quotationNo: string;
  quotationId: string;
  piNo: string;
  startDate: string;
  endDate: string;
  contractedValue: string;
  status: CampaignStatus;
  assignedManager: string;
}

interface Props {
  campaign?: Campaign | null;
  defaultLeadId?: string;
  onClose: () => void;
  onSuccess: (
    data: CreateCampaignPayload,
  ) => Promise<void>;
}

function getQuotationDisplayName(q: any): string {
  const client = q.clientName?.trim();
  const leadObj = typeof q.leadId === "object" ? q.leadId : null;
  const leadName = leadObj?.companyName || leadObj?.name || "";
  const desc = q.sites?.[0]?.description?.trim();
  if (client) return client;
  if (desc) return desc;
  if (leadName) return `${leadName} Quotation`;
  return `Quotation ${q.quoteNumber || ""}`;
}

function toFormData(
  campaign?: Campaign | null,
  defaultLeadId?: string,
): CampaignFormData {
  if (!campaign) {
    return {
      leadId: defaultLeadId || "",
      name: "",
      state: "",
      city: "",
      quotationName: "",
      quotationNo: "",
      quotationId: "",
      piNo: "",
      startDate: "",
      endDate: "",
      contractedValue: "",
      status: "Draft",
      assignedManager: "",
    };
  }

  return {
    leadId:
      typeof campaign.leadId === "string"
        ? campaign.leadId
        : campaign.leadId?._id ?? "",

    name: campaign.name,

    state: campaign.state || "",

    city: campaign.city,

    quotationName: campaign.quotationName || "",

    quotationNo:
      campaign.quotationNo ||
      (typeof campaign.quotationId === "object"
        ? campaign.quotationId?.quoteNumber
        : "") ||
      "",

    quotationId:
      !campaign.quotationId
        ? ""
        : typeof campaign.quotationId === "string"
          ? campaign.quotationId
          : campaign.quotationId._id,

    piNo: campaign.piNo || "",

    startDate: campaign.startDate ? campaign.startDate.slice(0, 10) : "",

    endDate: campaign.endDate ? campaign.endDate.slice(0, 10) : "",

    contractedValue: String(
      (campaign.contractedValue || 0) / 100,
    ),

    status:
      campaign.status === "InProgress"
        ? "In Progress"
        : campaign.status === "Completed"
          ? "Campaign End"
          : campaign.status === "Cancelled"
            ? "Rejected"
            : campaign.status,

    assignedManager:
      typeof campaign.assignedManager === "string"
        ? campaign.assignedManager
        : campaign.assignedManager?._id ?? "",
  };
}

export default function CampaignForm({
  campaign,
  defaultLeadId,
  onClose,
  onSuccess,
}: Props) {
  const [form, setForm] =
    useState<CampaignFormData>(
      toFormData(campaign, defaultLeadId),
    );

  const [error, setError] = useState("");
  const [leads, setLeads] = useState<LeadOption[]>([]);
  const [managers, setManagers] = useState<ManagerOption[]>([]);
  const [quotations, setQuotations] = useState<Array<{
    _id?: string;
    id?: string;
    quoteNumber: string;
    clientName?: string;
    leadId?: any;
    total?: number;
    sites?: any[];
  }>>([]);
  const [loadingQuotations, setLoadingQuotations] = useState(false);
  const [selectedSites, setSelectedSites] = useState<string[]>(() => {
    if (!campaign?.siteIds) return [];
    return campaign.siteIds.map((s) => (typeof s === "string" ? s : s._id));
  });

  useEffect(() => {
    let mounted = true;
    Promise.all([
      getCampaignLeadOptions().catch(() => ({ data: [] })),
      getCampaignManagers().catch(() => ({ data: [] })),
    ]).then(([leadsRes, managersRes]) => {
      if (mounted) {
        if (leadsRes?.data) setLeads(leadsRes.data);
        if (managersRes?.data) setManagers(managersRes.data);
      }
    });

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    setLoadingQuotations(true);

    quotationsApi
      .list({ limit: 100 })
      .then((res) => {
        if (active && res.quotations) {
          setQuotations(res.quotations);
        }
      })
      .catch(() => {
        if (active) setQuotations([]);
      })
      .finally(() => {
        if (active) setLoadingQuotations(false);
      });

    return () => {
      active = false;
    };
  }, []);

  function updateField(
    field: keyof CampaignFormData,
    value: string,
  ) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function handleLeadChange(leadId: string) {
    updateField("leadId", leadId);
    const lead = leads.find((l) => l._id === leadId);
    if (lead?.city && !form.city.trim()) {
      updateField("city", lead.city);
    }
  }

  function handleSelectQuotation(q: any) {
    const dispName = getQuotationDisplayName(q);
    updateField("quotationName", dispName);
    updateField("quotationNo", q.quoteNumber);
    updateField("quotationId", q._id || q.id || "");
    if (q.sites && Array.isArray(q.sites) && q.sites.length > 0) {
      const siteIdsFromQ = q.sites
        .map((s: any) => (typeof s.siteId === "object" ? s.siteId?._id : s.siteId))
        .filter(Boolean);
      if (siteIdsFromQ.length > 0) {
        setSelectedSites(siteIdsFromQ);
      }
    }
  }

  function handleQuotationNameChange(name: string) {
    updateField("quotationName", name);

    if (!name.trim()) return;
    const term = name.trim().toLowerCase();

    const matching = quotations.filter((q) => {
      const dispName = getQuotationDisplayName(q).toLowerCase();
      const client = (q.clientName || "").toLowerCase();
      const qNum = (q.quoteNumber || "").toLowerCase();
      const leadObj = typeof q.leadId === "object" ? q.leadId : null;
      const leadName = (leadObj?.companyName || "").toLowerCase();
      return (
        dispName.includes(term) ||
        client.includes(term) ||
        qNum.includes(term) ||
        leadName.includes(term)
      );
    });

    if (matching.length === 1) {
      // Exactly one matching quotation -> automatically fill quotation no!
      handleSelectQuotation(matching[0]);
    }
  }



  async function handleSubmit(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    setError("");

    if (
      !form.name.trim() ||
      !form.leadId.trim() ||
      !form.city.trim() ||
      !form.startDate ||
      !form.endDate ||
      !form.contractedValue
    ) {
      setError(
        "Please fill all required fields.",
      );
      return;
    }

    if (
      new Date(form.endDate) <=
      new Date(form.startDate)
    ) {
      setError(
        "End date must be after start date.",
      );
      return;
    }

    const invalidField = [
      ["Client / Lead", form.leadId],
      ...(form.quotationId.trim() && isObjectId(form.quotationId.trim())
        ? [["Quotation ID", form.quotationId.trim()]]
        : []),
      ...(form.assignedManager.trim()
        ? [["Assigned Manager", form.assignedManager.trim()]]
        : []),
    ].find(([, value]) => !isObjectId(value));

    if (invalidField) {
      setError(
        `${invalidField[0]} must be selected or be a valid ObjectId.`,
      );
      return;
    }

    try {
      await onSuccess({
        name: form.name.trim(),
        leadId: form.leadId.trim(),
        state: form.state.trim() || undefined,
        city: form.city.trim(),
        quotationName: form.quotationName.trim() || undefined,
        quotationNo: form.quotationNo.trim() || undefined,
        ...(form.quotationId.trim() && isObjectId(form.quotationId.trim())
          ? { quotationId: form.quotationId.trim() }
          : {}),
        piNo: form.piNo.trim() || undefined,
        startDate: form.startDate,
        endDate: form.endDate,
        siteIds: selectedSites.length > 0 ? selectedSites : undefined,
        contractedValue: Math.round(
          Number(form.contractedValue) * 100,
        ),
        status: form.status,
        ...(form.assignedManager.trim()
          ? {
              assignedManager:
                form.assignedManager.trim(),
            }
          : {}),
      });
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Failed to save campaign.",
      );
    }
  }

  function isObjectId(value: string) {
    return /^[0-9a-fA-F]{24}$/.test(
      value.trim(),
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-3xl overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl">

        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              {campaign
                ? "Edit Campaign"
                : "Create Campaign"}
            </h2>

            <p className="mt-1 text-sm text-gray-500">
              {campaign
                ? "Update campaign information"
                : "Create a new campaign"}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-xl text-gray-500 transition hover:bg-[#F9DADA] hover:text-[#8B2424]"
          >
            ×
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="max-h-[70vh] overflow-y-auto p-6">

            {error && (
              <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-5 py-4">
                <p className="text-sm font-semibold text-red-800">
                  Validation Error
                </p>

                <p className="mt-1 text-sm text-red-600">
                  {error}
                </p>
              </div>
            )}

            <div className="grid grid-cols-1 gap-5 md:grid-cols-2">

              {/* 1. Client / Lead Selector */}
              <LeadSelector
                value={form.leadId}
                leads={leads}
                required
                onChange={handleLeadChange}
              />

              {/* 2. Campaign Name */}
              <Input
                label="Campaign Name"
                value={form.name}
                required
                placeholder="Enter campaign name"
                onChange={(value) =>
                  updateField("name", value)
                }
              />

              {/* 3. State */}
              <Input
                label="State"
                value={form.state}
                placeholder="Enter state"
                onChange={(value) =>
                  updateField("state", value)
                }
              />

              {/* 4. City */}
              <Input
                label="City"
                value={form.city}
                required
                placeholder="Enter city"
                onChange={(value) =>
                  updateField("city", value)
                }
              />

              {/* 5. Quotation Name */}
              <QuotationNameSelector
                value={form.quotationName}
                quotations={quotations}
                loading={loadingQuotations}
                onChange={handleQuotationNameChange}
                onSelectQuotation={handleSelectQuotation}
              />

              {/* 6. Quotation No */}
              <QuotationNoInput
                value={form.quotationNo}
                quotations={quotations}
                onChange={(value) => {
                  updateField("quotationNo", value);
                  const matched = quotations.find(
                    (q) => (q.quoteNumber || "").toLowerCase() === value.trim().toLowerCase(),
                  );
                  if (matched) {
                    handleSelectQuotation(matched);
                  } else {
                    updateField("quotationId", "");
                  }
                }}
                onSelectQuotation={handleSelectQuotation}
              />

              {/* 7. PI No */}
              <Input
                label="PI No"
                value={form.piNo}
                placeholder="Enter PI number (e.g. PI-2026-001)"
                onChange={(value) =>
                  updateField("piNo", value)
                }
              />

              {/* 8. Contracted Value */}
              <Input
                label="Contracted Value"
                type="number"
                value={form.contractedValue}
                required
                placeholder="Enter amount"
                onChange={(value) =>
                  updateField(
                    "contractedValue",
                    value,
                  )
                }
              />

              {/* 9. Start Date */}
              <DatePicker
                label="Start Date"
                value={form.startDate}
                required
                onChange={(value) =>
                  updateField(
                    "startDate",
                    value,
                  )
                }
              />

              {/* 10. End Date */}
              <DatePicker
                label="End Date"
                value={form.endDate}
                required
                onChange={(value) =>
                  updateField(
                    "endDate",
                    value,
                  )
                }
              />

              {/* 11. Status */}
              <StatusDropdown
                value={form.status}
                onChange={(value) =>
                  updateField("status", value)
                }
              />

              {/* 12. Assigned Manager Selector */}
              <ManagerSelector
                value={form.assignedManager}
                managers={managers}
                onChange={(value) =>
                  updateField(
                    "assignedManager",
                    value,
                  )
                }
              />

            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 border-t border-gray-200 bg-gray-50 px-6 py-4">

            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-gray-300 bg-white px-5 py-2.5 text-sm font-semibold text-gray-700 transition hover:border-[#8B2424] hover:bg-[#8B2424] hover:text-[#F9DADA]"
            >
              Cancel
            </button>

            <button
              type="submit"
              className="rounded-lg border border-[#8B2424] bg-[#8B2424] px-5 py-2.5 text-sm font-semibold text-[#F9DADA] shadow-sm transition hover:border-[#A8383B] hover:bg-[#A8383B] hover:text-white focus:outline-none focus:ring-2 focus:ring-[#A8383B] focus:ring-offset-2"
            >
              {campaign
                ? "Update Campaign"
                : "Save Campaign"}
            </button>

          </div>
        </form>
      </div>
    </div>
  );
}

/* =========================
   Custom Date Picker
========================= */

function DatePicker({
  label,
  value,
  onChange,
  required = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
}) {
  const [open, setOpen] = useState(false);

  const pickerRef =
    useRef<HTMLDivElement>(null);

  const [currentMonth, setCurrentMonth] =
    useState(() => {
      if (value) {
        const [year, month] = value
          .split("-")
          .map(Number);

        return new Date(
          year,
          month - 1,
          1,
        );
      }

      const today = new Date();

      return new Date(
        today.getFullYear(),
        today.getMonth(),
        1,
      );
    });

  useEffect(() => {
    function handleOutsideClick(
      event: MouseEvent,
    ) {
      if (
        pickerRef.current &&
        !pickerRef.current.contains(
          event.target as Node,
        )
      ) {
        setOpen(false);
      }
    }

    document.addEventListener(
      "mousedown",
      handleOutsideClick,
    );

    return () => {
      document.removeEventListener(
        "mousedown",
        handleOutsideClick,
      );
    };
  }, []);

  const year =
    currentMonth.getFullYear();

  const month =
    currentMonth.getMonth();

  const firstDay = new Date(
    year,
    month,
    1,
  ).getDay();

  const daysInMonth = new Date(
    year,
    month + 1,
    0,
  ).getDate();

  const days: (number | null)[] = [];

  for (let i = 0; i < firstDay; i++) {
    days.push(null);
  }

  for (
    let day = 1;
    day <= daysInMonth;
    day++
  ) {
    days.push(day);
  }

  const monthName =
    currentMonth.toLocaleString(
      "en-IN",
      {
        month: "long",
        year: "numeric",
      },
    );

  function formatDate(day: number) {
    return `${year}-${String(
      month + 1,
    ).padStart(2, "0")}-${String(
      day,
    ).padStart(2, "0")}`;
  }

  function previousMonth() {
    setCurrentMonth(
      new Date(
        year,
        month - 1,
        1,
      ),
    );
  }

  function nextMonth() {
    setCurrentMonth(
      new Date(
        year,
        month + 1,
        1,
      ),
    );
  }

  return (
    <div
      ref={pickerRef}
      className="relative"
    >
      <label className="mb-1.5 block text-sm font-medium text-gray-900">
        {label}

        {required && (
          <span className="ml-1 text-[#8B2424]">
            *
          </span>
        )}
      </label>

      {/* Date Input */}
      <button
        type="button"
        onClick={() =>
          setOpen((previous) => !previous)
        }
        className="flex w-full cursor-pointer items-center justify-between rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-left text-gray-900 outline-none transition hover:border-[#8B2424] focus:border-[#8B2424] focus:ring-2 focus:ring-[#F9DADA]"
      >
        <span
          className={
            value
              ? "text-gray-900"
              : "text-gray-500"
          }
        >
          {value || "Select date"}
        </span>

        <span className="text-[#8B2424]">
          📅
        </span>
      </button>

      {/* Calendar */}
      {open && (
        <div className="absolute left-0 top-full z-50 mt-2 w-[240px] rounded-xl border border-gray-200 bg-white p-2.5 shadow-xl">

          {/* Calendar Header */}
          <div className="mb-2 flex items-center justify-between">
            <button
              type="button"
              onClick={previousMonth}
              className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg text-sm text-[#8B2424] transition hover:bg-[#F9DADA] hover:text-[#8B2424]"
            >
              ‹
            </button>

            <span className="text-xs font-bold text-gray-900">
              {monthName}
            </span>

            <button
              type="button"
              onClick={nextMonth}
              className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg text-sm text-[#8B2424] transition hover:bg-[#F9DADA] hover:text-[#8B2424]"
            >
              ›
            </button>
          </div>

          {/* Week Days */}
          <div className="mb-1 grid grid-cols-7 gap-1">
            {[
              "Su",
              "Mo",
              "Tu",
              "We",
              "Th",
              "Fr",
              "Sa",
            ].map((day) => (
              <div
                key={day}
                className="py-1 text-center text-xs font-semibold text-gray-500"
              >
                {day}
              </div>
            ))}
          </div>

          {/* Dates */}
          <div className="grid grid-cols-7 gap-1">
            {days.map((day, index) => {
              if (day === null) {
                return (
                  <div
                    key={`empty-${index}`}
                    className="h-7"
                  />
                );
              }

              const selected =
                value === formatDate(day);

              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => {
                    onChange(
                      formatDate(day),
                    );
                    setOpen(false);
                  }}
                  className={`h-7 cursor-pointer rounded-md text-xs font-medium transition ${
                    selected
                      ? "bg-[#A8333B] text-[#F9DADA]"
                      : "text-gray-700 hover:bg-[#F9DADA] hover:text-[#8B2424]"
                  }`}
                >
                  {day}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

/* =========================
   Status Dropdown
========================= */

function StatusDropdown({
  value,
  onChange,
}: {
  value: CampaignStatus;
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);

  const options: CampaignStatus[] = [
    "Draft",
    "Campaign Live",
    "Campaign End",
    "Rejected",
  ];

  return (
    <div className="relative">
      <label className="mb-1.5 block text-sm font-medium text-gray-900">
        Status
      </label>

      <button
        type="button"
        onClick={() =>
          setOpen((previous) => !previous)
        }
        className="flex w-full cursor-pointer items-center justify-between rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-left text-gray-900 outline-none transition hover:border-[#8B2424] focus:border-[#8B2424] focus:ring-2 focus:ring-[#F9DADA]"
      >
        <span>
          {value}
        </span>

        <span className="text-gray-500">
          ▾
        </span>
      </button>

      {open && (
        <div className="absolute left-0 right-0 z-50 mt-1 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg">
          {options.map((option) => {
            const selected =
              value === option;

            return (
              <button
                key={option}
                type="button"
                onClick={() => {
                  onChange(option);
                  setOpen(false);
                }}
                className={`block w-full cursor-pointer px-4 py-2.5 text-left text-sm transition ${
                  selected
                    ? "bg-[#A8333B] text-[#F9DADA]"
                    : "bg-white text-gray-900 hover:bg-[#F9DADA] hover:text-[#8B2424]"
                }`}
              >
                {option}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* =========================
   Input
========================= */

interface InputProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
  required?: boolean;
}

function Input({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  required = false,
}: InputProps) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-gray-900">
        {label}

        {required && (
          <span className="ml-1 text-[#8B2424]">
            *
          </span>
        )}
      </label>

      <input
        type={type}
        value={value}
        required={required}
        placeholder={placeholder}
        onChange={(event) =>
          onChange(event.target.value)
        }
        className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-gray-900 placeholder:text-gray-500 outline-none transition hover:border-[#8B2424] focus:border-[#8B2424] focus:ring-2 focus:ring-[#F9DADA]"
      />
    </div>
  );
}

/* =========================
   Quotation Name Selector Dropdown (with Search & Filter)
========================= */

function QuotationNameSelector({
  value,
  quotations,
  loading,
  onChange,
  onSelectQuotation,
}: {
  value: string;
  quotations: any[];
  loading?: boolean;
  onChange: (value: string) => void;
  onSelectQuotation: (quotation: any) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  const filtered = quotations.filter((q) => {
    if (!search.trim()) return true;
    const term = search.toLowerCase().trim();
    const dispName = getQuotationDisplayName(q).toLowerCase();
    const client = (q.clientName || "").toLowerCase();
    const qNum = (q.quoteNumber || "").toLowerCase();
    const leadObj = typeof q.leadId === "object" ? q.leadId : null;
    const leadName = (leadObj?.companyName || "").toLowerCase();
    return (
      dispName.includes(term) ||
      client.includes(term) ||
      qNum.includes(term) ||
      leadName.includes(term)
    );
  });

  return (
    <div ref={dropdownRef} className="relative">
      <div className="mb-1.5 flex items-center justify-between">
        <label className="block text-sm font-medium text-gray-900">
          Quotation Name
        </label>
        {quotations.length > 0 && (
          <span className="text-xs text-gray-500">
            {quotations.length} available
          </span>
        )}
      </div>

      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex w-full cursor-pointer items-center justify-between rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-left text-gray-900 outline-none transition hover:border-[#8B2424] focus:border-[#8B2424] focus:ring-2 focus:ring-[#F9DADA]"
      >
        <div className="truncate">
          {value ? (
            <span className="font-medium text-gray-900">{value}</span>
          ) : (
            <span className="text-gray-400">Select or search quotation name</span>
          )}
        </div>
        <div className="flex items-center gap-1.5 text-gray-400">
          {value && (
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => {
                e.stopPropagation();
                onChange("");
              }}
              className="hover:text-red-600 text-sm p-0.5 cursor-pointer font-bold leading-none"
              title="Clear quotation name"
            >
              ×
            </span>
          )}
          <span>▾</span>
        </div>
      </button>

      {open && (
        <div className="absolute left-0 right-0 z-50 mt-1 max-h-60 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl">
          <div className="border-b border-gray-100 p-2">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search quotation by name, quote #, client..."
              className="w-full rounded-lg border border-gray-200 px-3 py-1.5 text-xs text-gray-900 placeholder:text-gray-400 outline-none focus:border-[#8B2424]"
              autoFocus
            />
          </div>

          <div className="max-h-48 overflow-y-auto divide-y divide-gray-50">
            {search.trim() && (
              <div className="p-2 bg-gray-50 border-b border-gray-100">
                <button
                  type="button"
                  onClick={() => {
                    onChange(search.trim());
                    setOpen(false);
                    setSearch("");
                  }}
                  className="w-full rounded-md border border-dashed border-[#8B2424] bg-white px-2.5 py-1.5 text-left text-xs font-medium text-[#8B2424] hover:bg-[#FFF5F5] cursor-pointer"
                >
                  + Use custom name: &ldquo;{search.trim()}&rdquo;
                </button>
              </div>
            )}

            {filtered.map((q) => {
              const dispName = getQuotationDisplayName(q);
              const isSelected = value.trim().toLowerCase() === dispName.trim().toLowerCase();
              const formattedVal = q.total
                ? `₹${(q.total / 100).toLocaleString("en-IN")}`
                : "";
              const siteCount = q.sites?.length
                ? `${q.sites.length} ${q.sites.length === 1 ? "site" : "sites"}`
                : "";

              return (
                <button
                  key={q._id || q.id || q.quoteNumber}
                  type="button"
                  onClick={() => {
                    onSelectQuotation(q);
                    setOpen(false);
                    setSearch("");
                  }}
                  className={`block w-full cursor-pointer px-4 py-2.5 text-left transition ${
                    isSelected
                      ? "bg-[#FFF5F5] text-[#8B2424]"
                      : "hover:bg-[#F9DADA] hover:text-[#8B2424] text-gray-900"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold">{dispName}</span>
                    {formattedVal && (
                      <span className="text-xs font-semibold text-emerald-700">
                        {formattedVal}
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-gray-500">
                    Quote #{q.quoteNumber} {siteCount ? `• ${siteCount}` : ""}
                  </div>
                </button>
              );
            })}

            {filtered.length === 0 && (
              <div className="px-4 py-3 text-center text-xs text-gray-500">
                {search.trim()
                  ? `No matching quotations. Click "+ Use custom name" above.`
                  : "No quotations available."}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* =========================
   Quotation No Input & Suggestions
========================= */

function QuotationNoInput({
  value,
  quotations,
  onChange,
  onSelectQuotation,
}: {
  value: string;
  quotations: Array<{
    id?: string;
    _id?: string;
    quoteNumber: string;
    total?: number;
    sites?: any[];
  }>;
  onChange: (value: string) => void;
  onSelectQuotation: (quotation: any) => void;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleOutsideClick(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleOutsideClick);
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
    };
  }, []);

  const filtered = quotations.filter((q) => {
    if (!value.trim()) return true;
    return (q.quoteNumber || "")
      .toLowerCase()
      .includes(value.toLowerCase().trim());
  });

  return (
    <div ref={containerRef} className="relative">
      <div className="mb-1.5 flex items-center justify-between">
        <label className="block text-sm font-medium text-gray-900">
          Quotation No
        </label>
        {value && (
          <span className="text-xs font-medium text-emerald-600">
            Selected
          </span>
        )}
      </div>

      <div className="relative">
        <input
          type="text"
          value={value}
          placeholder="Enter or select quotation no"
          onChange={(e) => {
            onChange(e.target.value);
            if (quotations.length > 0) {
              setOpen(true);
            }
          }}
          onFocus={() => {
            if (quotations.length > 0) {
              setOpen(true);
            }
          }}
          className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 pr-14 text-gray-900 placeholder:text-gray-400 outline-none transition hover:border-[#8B2424] focus:border-[#8B2424] focus:ring-2 focus:ring-[#F9DADA]"
        />

        <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1 text-gray-400">
          {value && (
            <button
              type="button"
              onClick={() => onChange("")}
              className="p-0.5 text-gray-400 hover:text-red-600 transition text-sm font-bold cursor-pointer leading-none"
              title="Clear quotation no"
            >
              ×
            </button>
          )}

          {quotations.length > 0 && (
            <button
              type="button"
              onClick={() => setOpen((prev) => !prev)}
              className="p-1 text-gray-400 transition hover:text-[#8B2424] cursor-pointer"
              title="Toggle quotation list"
            >
              ▾
            </button>
          )}
        </div>
      </div>

      {open && quotations.length > 0 && (
        <div className="absolute left-0 right-0 z-50 mt-1 max-h-56 overflow-y-auto rounded-xl border border-gray-200 bg-white shadow-xl">
          <div className="border-b border-gray-100 bg-gray-50 px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-gray-500">
            Available Quotations ({quotations.length})
          </div>
          {filtered.length === 0 ? (
            <div className="px-4 py-3 text-xs text-gray-500">
              No matching quotation found. You can keep typing custom number.
            </div>
          ) : (
            filtered.map((q) => {
              const qId = q._id || q.id || q.quoteNumber;
              const formattedVal = q.total
                ? `₹${(q.total / 100).toLocaleString("en-IN")}`
                : "";
              const siteCount = q.sites?.length
                ? `${q.sites.length} ${q.sites.length === 1 ? "site" : "sites"}`
                : "";
              const isSelected = value === q.quoteNumber;

              return (
                <button
                  key={qId}
                  type="button"
                  onClick={() => {
                    onChange(q.quoteNumber);
                    onSelectQuotation(q);
                    setOpen(false);
                  }}
                  className={`flex w-full cursor-pointer items-center justify-between px-4 py-2.5 text-left text-sm transition ${
                    isSelected
                      ? "bg-[#FFF5F5] text-[#8B2424]"
                      : "hover:bg-[#F9DADA] hover:text-[#8B2424] text-gray-900"
                  }`}
                >
                  <div>
                    <span className="font-semibold">{q.quoteNumber}</span>
                    {siteCount && (
                      <span className="ml-2 text-xs text-gray-500">
                        ({siteCount})
                      </span>
                    )}
                  </div>
                  {formattedVal && (
                    <span className="text-xs font-semibold text-emerald-700">
                      {formattedVal}
                    </span>
                  )}
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

/* =========================
   Lead Selector Dropdown
========================= */

function LeadSelector({
  value,
  leads,
  onChange,
  required,
}: {
  value: string;
  leads: LeadOption[];
  onChange: (value: string) => void;
  required?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  const selectedLead = leads.find((l) => l._id === value);

  const filteredLeads = leads.filter((l) => {
    if (!search.trim()) return true;
    const term = search.toLowerCase();
    return (
      (l.companyName || "").toLowerCase().includes(term) ||
      (l.contactPerson || "").toLowerCase().includes(term) ||
      (l.city || "").toLowerCase().includes(term)
    );
  });

  return (
    <div ref={dropdownRef} className="relative">
      <label className="mb-1.5 block text-sm font-medium text-gray-900">
        Client / Lead {required && <span className="ml-1 text-[#8B2424]">*</span>}
      </label>

      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex w-full cursor-pointer items-center justify-between rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-left text-gray-900 outline-none transition hover:border-[#8B2424] focus:border-[#8B2424] focus:ring-2 focus:ring-[#F9DADA]"
      >
        <div className="truncate">
          {selectedLead ? (
            <div>
              <span className="font-medium text-gray-900">{selectedLead.companyName}</span>
              {selectedLead.contactPerson && (
                <span className="ml-2 text-xs text-gray-500">({selectedLead.contactPerson})</span>
              )}
            </div>
          ) : value ? (
            <span className="text-gray-700">ID: #{value.slice(-6)}</span>
          ) : (
            <span className="text-gray-400">Select client / lead</span>
          )}
        </div>
        <div className="flex items-center gap-1.5 text-gray-400">
          {value && (
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => {
                e.stopPropagation();
                onChange("");
              }}
              className="hover:text-red-600 text-sm p-0.5 cursor-pointer font-bold leading-none"
              title="Clear client"
            >
              ×
            </span>
          )}
          <span>▾</span>
        </div>
      </button>

      {open && (
        <div className="absolute left-0 right-0 z-50 mt-1 max-h-60 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl">
          <div className="border-b border-gray-100 p-2">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search leads by name or city..."
              className="w-full rounded-lg border border-gray-200 px-3 py-1.5 text-xs text-gray-900 placeholder:text-gray-400 outline-none focus:border-[#8B2424]"
            />
          </div>

          <div className="max-h-48 overflow-y-auto divide-y divide-gray-50">
            {filteredLeads.map((l) => {
              const isSelected = l._id === value;
              return (
                <button
                  key={l._id}
                  type="button"
                  onClick={() => {
                    onChange(l._id);
                    setOpen(false);
                    setSearch("");
                  }}
                  className={`block w-full cursor-pointer px-4 py-2 text-left transition ${
                    isSelected
                      ? "bg-[#FFF5F5] text-[#8B2424]"
                      : "hover:bg-[#F9DADA] hover:text-[#8B2424] text-gray-900"
                  }`}
                >
                  <div className="text-sm font-medium">{l.companyName}</div>
                  <div className="text-xs text-gray-500">
                    {l.contactPerson ? `${l.contactPerson} • ` : ""}{l.city || "No city"}
                  </div>
                </button>
              );
            })}

            {filteredLeads.length === 0 && (
              <div className="px-4 py-3 text-center text-xs text-gray-500">
                No matching leads found
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* =========================
   Manager Selector Dropdown
========================= */

function ManagerSelector({
  value,
  managers,
  onChange,
}: {
  value: string;
  managers: ManagerOption[];
  onChange: (value: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  const selectedManager = managers.find((m) => m._id === value);

  const filteredManagers = managers.filter((m) => {
    if (!search.trim()) return true;
    const term = search.toLowerCase();
    return (
      (m.name || "").toLowerCase().includes(term) ||
      (m.role || "").toLowerCase().includes(term) ||
      (m.email || "").toLowerCase().includes(term)
    );
  });

  return (
    <div ref={dropdownRef} className="relative">
      <label className="mb-1.5 block text-sm font-medium text-gray-900">
        Assigned Manager
      </label>

      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex w-full cursor-pointer items-center justify-between rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-left text-gray-900 outline-none transition hover:border-[#8B2424] focus:border-[#8B2424] focus:ring-2 focus:ring-[#F9DADA]"
      >
        <div className="truncate">
          {selectedManager ? (
            <div>
              <span className="font-medium text-gray-900">{selectedManager.name}</span>
              {selectedManager.role && (
                <span className="ml-2 text-xs text-gray-500">({selectedManager.role})</span>
              )}
            </div>
          ) : value ? (
            <span className="text-gray-700">ID: #{value.slice(-6)}</span>
          ) : (
            <span className="text-gray-400">Select manager (optional)</span>
          )}
        </div>
        <div className="flex items-center gap-1.5 text-gray-400">
          {value && (
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => {
                e.stopPropagation();
                onChange("");
              }}
              className="hover:text-red-600 text-sm p-0.5 cursor-pointer font-bold leading-none"
              title="Clear manager"
            >
              ×
            </span>
          )}
          <span>▾</span>
        </div>
      </button>

      {open && (
        <div className="absolute left-0 right-0 z-50 mt-1 max-h-60 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-xl">
          <div className="border-b border-gray-100 p-2">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search manager by name, role or email..."
              className="w-full rounded-lg border border-gray-200 px-3 py-1.5 text-xs text-gray-900 placeholder:text-gray-400 outline-none focus:border-[#8B2424]"
              autoFocus
            />
          </div>

          <div className="max-h-48 overflow-y-auto divide-y divide-gray-50">
            <button
              type="button"
              onClick={() => {
                onChange("");
                setOpen(false);
                setSearch("");
              }}
              className="block w-full cursor-pointer px-4 py-2.5 text-left text-sm text-gray-500 transition hover:bg-[#F9DADA] hover:text-[#8B2424]"
            >
              None (Unassigned)
            </button>

            {filteredManagers.map((m) => {
              const isSelected = m._id === value;
              return (
                <button
                  key={m._id}
                  type="button"
                  onClick={() => {
                    onChange(m._id);
                    setOpen(false);
                    setSearch("");
                  }}
                  className={`block w-full cursor-pointer px-4 py-2.5 text-left transition ${
                    isSelected
                      ? "bg-[#FFF5F5] text-[#8B2424] font-medium"
                      : "hover:bg-[#F9DADA] hover:text-[#8B2424] text-gray-900"
                  }`}
                >
                  <div className="text-sm font-medium">{m.name}</div>
                  <div className="text-xs text-gray-500">{m.role || m.email || ""}</div>
                </button>
              );
            })}

            {filteredManagers.length === 0 && (
              <div className="px-4 py-3 text-center text-xs text-gray-500">
                No matching managers found
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}