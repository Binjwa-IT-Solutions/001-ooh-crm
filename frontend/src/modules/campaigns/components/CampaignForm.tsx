"use client";

import { useEffect, useRef, useState } from "react";
import { getCampaignLeadOptions, getCampaignManagers } from "../api";

import type {
  Campaign,
  CampaignStatus,
  CreateCampaignPayload,
  LeadOption,
  ManagerOption,
} from "../types";

interface CampaignFormData {
  name: string;
  leadId: string;
  quotationId: string;
  city: string;
  startDate: string;
  endDate: string;
  siteIds: string;
  contractedValue: string;
  status: CampaignStatus;
  assignedManager: string;
}

interface Props {
  campaign?: Campaign | null;
  onClose: () => void;
  onSuccess: (
    data: CreateCampaignPayload,
  ) => Promise<void>;
}

function toFormData(
  campaign?: Campaign | null,
): CampaignFormData {
  if (!campaign) {
    return {
      name: "",
      leadId: "",
      quotationId: "",
      city: "",
      startDate: "",
      endDate: "",
      siteIds: "",
      contractedValue: "",
      status: "Draft",
      assignedManager: "",
    };
  }

  return {
    name: campaign.name,

    leadId:
      typeof campaign.leadId === "string"
        ? campaign.leadId
        : campaign.leadId?._id ?? "",

    quotationId:
      !campaign.quotationId
        ? ""
        : typeof campaign.quotationId ===
            "string"
          ? campaign.quotationId
          : campaign.quotationId._id,

    city: campaign.city,

    startDate: campaign.startDate.slice(0, 10),

    endDate: campaign.endDate.slice(0, 10),

    siteIds: campaign.siteIds
      .map((site) =>
        typeof site === "string"
          ? site
          : site._id,
      )
      .join(", "),

    contractedValue: String(
      campaign.contractedValue / 100,
    ),

    status: campaign.status,

    assignedManager:
      typeof campaign.assignedManager ===
        "string"
        ? campaign.assignedManager
        : campaign.assignedManager?._id ?? "",
  };
}

export default function CampaignForm({
  campaign,
  onClose,
  onSuccess,
}: Props) {
  const [form, setForm] =
    useState<CampaignFormData>(
      toFormData(campaign),
    );

  const [error, setError] = useState("");
  const [leads, setLeads] = useState<LeadOption[]>([]);
  const [managers, setManagers] = useState<ManagerOption[]>([]);

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

  function updateField(
    field: keyof CampaignFormData,
    value: string,
  ) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
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
      !form.siteIds.trim() ||
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

    const siteIds = form.siteIds
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean);

    const invalidField = [
      ["Client / Lead", form.leadId],
      ...(form.quotationId.trim()
        ? [["Quotation ID", form.quotationId.trim()]]
        : []),
      ...siteIds.map((id, index) => [
        `Site ID ${index + 1}`,
        id,
      ]),
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
        ...(form.quotationId.trim()
          ? { quotationId: form.quotationId.trim() }
          : {}),
        city: form.city.trim(),
        startDate: form.startDate,
        endDate: form.endDate,
        siteIds,
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

              {/* Campaign Name */}
              <Input
                label="Campaign Name"
                value={form.name}
                required
                placeholder="Enter campaign name"
                onChange={(value) =>
                  updateField("name", value)
                }
              />

              {/* City */}
              <Input
                label="City"
                value={form.city}
                required
                placeholder="Enter city"
                onChange={(value) =>
                  updateField("city", value)
                }
              />

              {/* Lead Selector */}
              <LeadSelector
                value={form.leadId}
                leads={leads}
                required
                onChange={(value) =>
                  updateField("leadId", value)
                }
              />

              {/* Site IDs */}
              <Input
                label="Site IDs"
                value={form.siteIds}
                required
                placeholder="siteId1, siteId2"
                onChange={(value) =>
                  updateField(
                    "siteIds",
                    value,
                  )
                }
              />

              {/* Start Date */}
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

              {/* End Date */}
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

              {/* Status */}
              <StatusDropdown
                value={form.status}
                onChange={(value) =>
                  updateField("status", value)
                }
              />

              {/* Contracted Value */}
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

              {/* Assigned Manager Selector */}
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
    "Approved",
    "InProgress",
    "Completed",
    "Cancelled",
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
          {value === "InProgress"
            ? "In Progress"
            : value}
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
                {option === "InProgress"
                  ? "In Progress"
                  : option}
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
        <span className="text-gray-500">▾</span>
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
        <span className="text-gray-500">▾</span>
      </button>

      {open && (
        <div className="absolute left-0 right-0 z-50 mt-1 max-h-56 overflow-y-auto rounded-xl border border-gray-200 bg-white shadow-xl">
          <button
            type="button"
            onClick={() => {
              onChange("");
              setOpen(false);
            }}
            className="block w-full cursor-pointer px-4 py-2.5 text-left text-sm text-gray-500 transition hover:bg-[#F9DADA] hover:text-[#8B2424]"
          >
            None (Unassigned)
          </button>

          {managers.map((m) => {
            const isSelected = m._id === value;
            return (
              <button
                key={m._id}
                type="button"
                onClick={() => {
                  onChange(m._id);
                  setOpen(false);
                }}
                className={`block w-full cursor-pointer px-4 py-2.5 text-left transition ${
                  isSelected
                    ? "bg-[#FFF5F5] text-[#8B2424] font-medium"
                    : "hover:bg-[#F9DADA] hover:text-[#8B2424] text-gray-900"
                }`}
              >
                <div className="text-sm">{m.name}</div>
                <div className="text-xs text-gray-400">{m.role || m.email || ""}</div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}