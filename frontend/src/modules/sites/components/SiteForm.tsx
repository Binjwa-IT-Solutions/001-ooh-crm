"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Check, X } from "lucide-react";
import { getVendors } from "@/modules/vendors/api";
import type { Vendor } from "@/modules/vendors/types";
import { DatePicker } from "@/shared/ui";

import type {
  AvailabilityStatus,
  CreateSiteData,
  MediaPlanStatus,
  MediaType,
  Site,
} from "../types";

interface SiteFormProps {
  site: Site | null;
  onClose: () => void;
  onSuccess: () => void;
  onSubmit: (data: CreateSiteData) => Promise<void>;
}

const MEDIA_TYPES: MediaType[] = [
  "Billboard",
  "Hoarding",
  "Transit",
  "Metro",
  "Airport",
  "Mall",
  "Digital",
  "Other",
];

const AVAILABILITY_OPTIONS: AvailabilityStatus[] = [
  "Plan Received",
  "On Boarding",
  "Media Booking",
  "Negotiation",
  "Available",
  "Request Send",
];

const FOLLOW_UP_OPTIONS: MediaPlanStatus[] = [
  "On Call",
  "On Mail",
  "WhatsApp",
  "Manual",
];

const inputClass =
  "w-full rounded-lg border border-[#E8E8EC] bg-white px-3 py-2.5 text-sm text-[#1F2937] outline-none transition focus:border-[#8B2424] focus:ring-1 focus:ring-[#8B2424]";

const selectClass =
  "w-full rounded-lg border border-[#E8E8EC] bg-white px-3 py-2.5 text-sm text-[#1F2937] outline-none transition focus:border-[#8B2424] focus:ring-1 focus:ring-[#8B2424]";

function today() {
  const date = new Date();

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function toInputDate(value?: string) {
  if (!value) return "";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value.slice(0, 10);
  }

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function calculateDuration(
  start: string,
  end: string
) {
  if (!start || !end) return 0;

  const startDate = new Date(start);
  const endDate = new Date(end);

  const diff =
    endDate.getTime() -
    startDate.getTime();

  if (diff < 0) return 0;

  return (
    Math.floor(
      diff / (1000 * 60 * 60 * 24)
    ) + 1
  );
}

export default function SiteForm({
  site,
  onClose,
  onSuccess,
  onSubmit,
}: SiteFormProps) {
  /* =========================
     FORM STATE
  ========================= */

  const [clientName, setClientName] =
    useState("");

  const [salesPersonName, setSalesPersonName] =
    useState("");

  const [vendorName, setVendorName] =
    useState("");

  const [vendorContact, setVendorContact] =
    useState("");

  const [vendorId, setVendorId] =
    useState<string | undefined>(undefined);

  const [vendorsList, setVendorsList] =
    useState<Vendor[]>([]);

  const [loadingVendors, setLoadingVendors] =
    useState(false);

  const [vendorDropdownOpen, setVendorDropdownOpen] =
    useState(false);

  const vendorRef =
    useRef<HTMLDivElement>(null);

  const [state, setState] =
    useState("");

  const [city, setCity] =
    useState("");

  const [location, setLocation] =
    useState("");

  const [mediaType, setMediaType] =
    useState<MediaType>("Billboard");

  const [quantity, setQuantity] =
    useState<string>("");

  const [startDate, setStartDate] =
    useState("");

  const [endDate, setEndDate] =
    useState("");

  const [duration, setDuration] =
    useState(0);

  const [availability, setAvailability] =
    useState<AvailabilityStatus>(
      "Available"
    );

  const [status, setStatus] =
    useState<MediaPlanStatus>("On Call");

  const [manualFollowUp, setManualFollowUp] =
    useState("");

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState("");

  /* =========================
     FETCH VENDORS
  ========================= */

  useEffect(() => {
    let mounted = true;
    setLoadingVendors(true);

    getVendors()
      .then((res) => {
        if (mounted && res?.data) {
          setVendorsList(res.data);
        }
      })
      .catch((err) => {
        console.error("Failed to load vendors:", err);
      })
      .finally(() => {
        if (mounted) setLoadingVendors(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  /* =========================
     CLICK OUTSIDE DROPDOWN
  ========================= */

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        vendorRef.current &&
        !vendorRef.current.contains(event.target as Node)
      ) {
        setVendorDropdownOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  /* =========================
     FILTERED VENDORS
  ========================= */

  const filteredVendors = useMemo(() => {
    const q = vendorName.trim().toLowerCase();
    if (!q) return vendorsList;

    return vendorsList.filter((v) =>
      v.name?.toLowerCase().includes(q)
    );
  }, [vendorsList, vendorName]);

  function handleSelectVendor(vendor: Vendor) {
    setVendorName(vendor.name);
    setVendorId(vendor._id || vendor.id);
    setVendorDropdownOpen(false);
  }

  /* =========================
     EDIT DATA
  ========================= */

  useEffect(() => {
    if (!site) {
      setClientName("");
      setSalesPersonName("");
      setVendorName("");
      setVendorContact("");
      setVendorId(undefined);
      setVendorDropdownOpen(false);
      setState("");
      setCity("");
      setLocation("");
      setMediaType("Billboard");
      setQuantity("");
      setStartDate(today());
      setEndDate(today());
      setDuration(1);
      setAvailability("Available");
      setStatus("On Call");
      setManualFollowUp("");
      setError("");

      return;
    }

    setClientName(
      site.clientName || ""
    );

    setSalesPersonName(
      site.salesPersonName || ""
    );

    setVendorName(
      site.vendorName || ""
    );

    setVendorId(
      site.vendorId
    );

    setVendorContact(
      site.vendorContact ||
        site.salesPersonContact ||
        ""
    );

    setState(
      site.state || ""
    );

    setCity(
      site.city || ""
    );

    setLocation(
      site.location || ""
    );

    setMediaType(
      site.mediaType || "Billboard"
    );

    setQuantity(
      site.quantity !== undefined && site.quantity !== null
        ? String(site.quantity)
        : ""
    );

    const start =
      toInputDate(site.startDate);

    const end =
      toInputDate(site.endDate);

    setStartDate(start);
    setEndDate(end);

    setDuration(
      site.duration ||
        calculateDuration(start, end)
    );

    setAvailability(
      site.availability || "Available"
    );

    const currentStatus =
      site.status || "On Call";

    setStatus(currentStatus);

    if (
      !FOLLOW_UP_OPTIONS.includes(
        currentStatus as any
      ) &&
      currentStatus !== "Draft" &&
      currentStatus !== "Pending" &&
      currentStatus !== "Approved" &&
      currentStatus !== "Rejected"
    ) {
      setManualFollowUp(currentStatus);
    } else {
      setManualFollowUp("");
    }

    setError("");
  }, [site]);

  /* =========================
     DATE CHANGE
  ========================= */

  function handleStartDateChange(
    value: string
  ) {
    setStartDate(value);

    const calculated =
      calculateDuration(
        value,
        endDate
      );

    if (calculated > 0) {
      setDuration(calculated);
    }
  }

  function handleEndDateChange(
    value: string
  ) {
    setEndDate(value);

    const calculated =
      calculateDuration(
        startDate,
        value
      );

    if (calculated > 0) {
      setDuration(calculated);
    }
  }

  /* =========================
     VENDOR MOBILE
  ========================= */

  function handleVendorMobileChange(
    value: string
  ) {
    setVendorContact(
      value
        .replace(/\D/g, "")
        .slice(0, 10)
    );
  }

  /* =========================
     SUBMIT
  ========================= */

  async function handleSubmit(
    event: React.FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setError("");

    if (!clientName.trim()) {
      setError(
        "Client name is required."
      );
      return;
    }

    if (!salesPersonName.trim()) {
      setError(
        "Sales person name is required."
      );
      return;
    }

    if (!vendorName.trim()) {
      setError(
        "Vendor name is required."
      );
      return;
    }

    if (
      !/^[6-9]\d{9}$/.test(
        vendorContact
      )
    ) {
      setError(
        "Enter a valid 10 digit vendor mobile number."
      );
      return;
    }

    if (!state.trim()) {
      setError(
        "State is required."
      );
      return;
    }

    if (!city.trim()) {
      setError(
        "City is required."
      );
      return;
    }

    if (!location.trim()) {
      setError(
        "Location is required."
      );
      return;
    }

    const numQty =
      quantity === "" ? 0 : Number(quantity);

    if (isNaN(numQty) || numQty < 0) {
      setError(
        "Please enter a valid quantity (0 or greater)."
      );
      return;
    }

    if (!startDate || !endDate) {
      setError(
        "Start date and end date are required."
      );
      return;
    }

    const calculatedDuration =
      calculateDuration(
        startDate,
        endDate
      );

    if (calculatedDuration <= 0) {
      setError(
        "End date must be after or equal to start date."
      );
      return;
    }

    setLoading(true);

    try {
      const payload: CreateSiteData = {
        clientName:
          clientName.trim(),

        salesPersonName:
          salesPersonName.trim(),

        salesPersonContact:
          vendorContact.trim(),

        vendorContact:
          vendorContact.trim(),

        vendorName:
          vendorName.trim(),

        vendorId:
          vendorId || undefined,

        state:
          state.trim(),

        city:
          city.trim(),

        location:
          location.trim(),

        mediaType,

        quantity: numQty,

        startDate,

        endDate,

        duration:
          calculatedDuration,

        availability,

        status,
      };

      await onSubmit(payload);

      onSuccess();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to save ATR."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">

      <div className="max-h-[95vh] w-full max-w-3xl overflow-y-auto rounded-xl bg-white shadow-xl">

        {/* =========================
            HEADER
        ========================= */}

        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-[#E8E8EC] bg-white px-6 py-4">

          <div>
            <h2 className="text-lg font-semibold text-[#1F2937]">
              {site
                ? "Edit ATR"
                : "Add ATR"}
            </h2>

            <p className="mt-1 text-xs text-[#667085]">
              Manage ATR information and specifications
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="text-2xl leading-none text-[#667085] hover:text-[#8B2424]"
          >
            ×
          </button>
        </div>

        {/* =========================
            FORM
        ========================= */}

        <form
          onSubmit={handleSubmit}
          className="p-6"
        >

          {/* =========================
              BASIC INFORMATION
          ========================= */}

          <div className="mb-6">
            <h3 className="mb-4 text-sm font-semibold text-[#1F2937]">
              Basic Information
            </h3>

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">

              {/* CLIENT */}

              <Field label="Client Name *">
                <input
                  type="text"
                  value={clientName}
                  onChange={(e) =>
                    setClientName(
                      e.target.value
                    )
                  }
                  placeholder="Enter client name"
                  className={inputClass}
                />
              </Field>

              {/* SALES PERSON */}

              <Field label="Sales Person Name *">
                <input
                  type="text"
                  value={salesPersonName}
                  onChange={(e) =>
                    setSalesPersonName(
                      e.target.value
                    )
                  }
                  placeholder="Enter sales person name"
                  className={inputClass}
                />
              </Field>

              {/* VENDOR */}

              <div ref={vendorRef} className="relative min-w-0">
                <label className="mb-1.5 block text-xs font-medium text-[#344054]">
                  Vendor Name *
                </label>

                <div className="relative">
                  <input
                    type="text"
                    value={vendorName}
                    onChange={(e) => {
                      setVendorName(e.target.value);
                      setVendorDropdownOpen(true);
                    }}
                    onFocus={() => {
                      setVendorDropdownOpen(true);
                    }}
                    placeholder="Search or enter vendor name"
                    className={`${inputClass} pr-14`}
                  />

                  <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1 text-gray-400">
                    {vendorName && (
                      <button
                        type="button"
                        onClick={() => {
                          setVendorName("");
                          setVendorId(undefined);
                          setVendorDropdownOpen(true);
                        }}
                        className="p-1 hover:text-gray-600 rounded"
                        title="Clear"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setVendorDropdownOpen(!vendorDropdownOpen)}
                      className="p-1 hover:text-gray-600 rounded"
                      title="Toggle vendor list"
                    >
                      <ChevronDown
                        className={`h-4 w-4 transition-transform ${
                          vendorDropdownOpen ? "rotate-180" : ""
                        }`}
                      />
                    </button>
                  </div>
                </div>

                {/* Dropdown with Filtered Vendors */}
                {vendorDropdownOpen && (
                  <div className="absolute left-0 right-0 z-30 mt-1 max-h-56 overflow-y-auto rounded-xl border border-[#E8E8EC] bg-white p-1.5 shadow-xl">
                    {/* Header */}
                    <div className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-gray-400 flex items-center justify-between border-b border-gray-100">
                      <span>Vendors ({filteredVendors.length})</span>
                      {loadingVendors && <span>Loading...</span>}
                    </div>

                    {/* Vendor Items */}
                    {loadingVendors ? (
                      <div className="px-3 py-4 text-center text-xs text-gray-400">
                        Loading vendor list...
                      </div>
                    ) : filteredVendors.length === 0 ? (
                      <div className="px-3 py-3 text-center text-xs text-gray-500">
                        No matching vendor found.
                      </div>
                    ) : (
                      filteredVendors.map((vendor) => {
                        const isSelected =
                          vendorName.toLowerCase() ===
                          vendor.name.toLowerCase();

                        return (
                          <button
                            key={vendor._id || vendor.id || vendor.name}
                            type="button"
                            onClick={() => handleSelectVendor(vendor)}
                            className={`w-full flex items-center justify-between rounded-lg px-3 py-2 text-left text-xs transition ${
                              isSelected
                                ? "bg-red-50 text-[#8B2424] font-semibold"
                                : "text-gray-700 hover:bg-gray-50"
                            }`}
                          >
                            <span className="truncate font-medium text-gray-900">
                              {vendor.name}
                            </span>

                            {isSelected && (
                              <Check className="h-4 w-4 shrink-0 text-[#8B2424]" />
                            )}
                          </button>
                        );
                      })
                    )}
                  </div>
                )}
              </div>

              {/* VENDOR MOBILE */}

              <Field label="Vendor Mobile No *">
                <input
                  type="tel"
                  value={vendorContact}
                  onChange={(e) =>
                    handleVendorMobileChange(
                      e.target.value
                    )
                  }
                  placeholder="Enter vendor mobile number"
                  inputMode="numeric"
                  maxLength={10}
                  className={inputClass}
                />
              </Field>

              {/* STATE */}

              <Field label="State *">
                <input
                  type="text"
                  value={state}
                  onChange={(e) =>
                    setState(
                      e.target.value
                    )
                  }
                  placeholder="Enter state"
                  className={inputClass}
                />
              </Field>

              {/* CITY */}

              <Field label="City *">
                <input
                  type="text"
                  value={city}
                  onChange={(e) =>
                    setCity(
                      e.target.value
                    )
                  }
                  placeholder="Enter city"
                  className={inputClass}
                />
              </Field>

            </div>
          </div>

          {/* =========================
              LOCATION
          ========================= */}

          <div className="mb-6">
            <h3 className="mb-4 text-sm font-semibold text-[#1F2937]">
              Location
            </h3>

            <Field label="Location / Landmark *">
              <input
                type="text"
                value={location}
                onChange={(e) =>
                  setLocation(
                    e.target.value
                  )
                }
                placeholder="Enter location or landmark"
                className={inputClass}
              />
            </Field>
          </div>

          {/* =========================
              MEDIA DETAILS
          ========================= */}

          <div className="mb-6">
            <h3 className="mb-4 text-sm font-semibold text-[#1F2937]">
              Media Details
            </h3>

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">

              {/* MEDIA TYPE */}

              <Field label="Media Type *">
                <select
                  value={mediaType}
                  onChange={(e) =>
                    setMediaType(
                      e.target
                        .value as MediaType
                    )
                  }
                  className={selectClass}
                >
                  {MEDIA_TYPES.map(
                    (type) => (
                      <option
                        key={type}
                        value={type}
                      >
                        {type}
                      </option>
                    )
                  )}
                </select>
              </Field>

              {/* QUANTITY */}

              <Field label="Quantity *">
                <input
                  type="number"
                  min={0}
                  placeholder="0"
                  value={quantity}
                  onChange={(e) =>
                    setQuantity(
                      e.target.value
                    )
                  }
                  onFocus={(e) =>
                    e.target.select()
                  }
                  className={inputClass}
                />
              </Field>

            </div>
          </div>

          {/* =========================
              DURATION
          ========================= */}

          <div className="mb-6">
            <h3 className="mb-4 text-sm font-semibold text-[#1F2937]">
              Duration
            </h3>

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">

              {/* START */}

              <Field label="Start Date *">
                <DatePicker
                  value={startDate}
                  onChange={handleStartDateChange}
                  triggerClassName="px-3 py-2 text-sm"
                />
              </Field>

              {/* END */}

              <Field label="End Date *">
                <DatePicker
                  value={endDate}
                  min={startDate || undefined}
                  onChange={handleEndDateChange}
                  triggerClassName="px-3 py-2 text-sm"
                />
              </Field>

              {/* DURATION */}

              <Field label="Duration (Days)">
                <input
                  type="number"
                  min={1}
                  value={duration}
                  readOnly
                  className={`${inputClass} bg-[#F9FAFB]`}
                />
              </Field>

            </div>
          </div>

          {/* =========================
              STATUS
          ========================= */}

          <div className="mb-6">
            <h3 className="mb-4 text-sm font-semibold text-[#1F2937]">
              Status
            </h3>

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">

              {/* AVAILABILITY */}

              <Field label="Availability *">
                <select
                  value={availability}
                  onChange={(e) =>
                    setAvailability(
                      e.target
                        .value as AvailabilityStatus
                    )
                  }
                  className={selectClass}
                >
                  {AVAILABILITY_OPTIONS.map(
                    (item) => (
                      <option
                        key={item}
                        value={item}
                      >
                        {item}
                      </option>
                    )
                  )}
                </select>
              </Field>

              {/* FOLLOW UP */}

              <Field label="Follow Up *">
                <select
                  value={
                    FOLLOW_UP_OPTIONS.includes(status as any)
                      ? status
                      : "Manual"
                  }
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === "Manual") {
                      setStatus(
                        manualFollowUp.trim()
                          ? manualFollowUp.trim()
                          : "Manual"
                      );
                    } else {
                      setStatus(val);
                      setManualFollowUp("");
                    }
                  }}
                  className={selectClass}
                >
                  {FOLLOW_UP_OPTIONS.map(
                    (item) => (
                      <option
                        key={item}
                        value={item}
                      >
                        {item}
                      </option>
                    )
                  )}
                </select>

                {(status === "Manual" ||
                  (!FOLLOW_UP_OPTIONS.includes(status as any) &&
                    status !== "Draft" &&
                    status !== "Pending" &&
                    status !== "Approved" &&
                    status !== "Rejected")) && (
                  <input
                    type="text"
                    value={manualFollowUp}
                    onChange={(e) => {
                      setManualFollowUp(e.target.value);
                      setStatus(
                        e.target.value.trim()
                          ? e.target.value
                          : "Manual"
                      );
                    }}
                    placeholder="Enter manual follow up details"
                    className={`${inputClass} mt-2`}
                  />
                )}
              </Field>

            </div>
          </div>

          {/* =========================
              ERROR
          ========================= */}

          {error && (
            <div className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
              {error}
            </div>
          )}

          {/* =========================
              FOOTER
          ========================= */}

          <div className="flex justify-end gap-3 border-t border-[#E8E8EC] pt-5">

            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="rounded-lg border border-[#E8E8EC] px-5 py-2.5 text-sm font-medium text-[#667085] hover:bg-[#F9FAFB] disabled:opacity-50"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={loading}
              className="rounded-lg bg-[#8B2424] px-5 py-2.5 text-sm font-medium text-white hover:bg-[#741D1D] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading
                ? "Saving..."
                : site
                ? "Update ATR"
                : "Create ATR"}
            </button>

          </div>
        </form>
      </div>
    </div>
  );
}

/* =========================
   FIELD
========================= */

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-w-0">
      <label className="mb-1.5 block text-xs font-medium text-[#344054]">
        {label}
      </label>

      {children}
    </div>
  );
}