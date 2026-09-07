"use client";

import { useEffect, useRef, useState } from "react";

import type {
  CampaignOption,
  PurchaseOrder,
  PurchaseOrderFormData,
  PurchaseOrderLineItem,
  VendorOption,
} from "../types";

import {
  getCampaignOptionsForPO,
  getVendorOptionsForPO,
} from "../api";
import { getVendors } from "@/modules/vendors/api";

interface Props {
  order: PurchaseOrder | null;
  saving: boolean;
  onClose: () => void;
  onSuccess: () => void;
  onSubmit: (
    data: PurchaseOrderFormData,
  ) => Promise<boolean>;
}

const emptyItem = (): PurchaseOrderLineItem => ({
  siteId: "",
  from: "",
  to: "",
  negotiatedRatePerDay: 0,
  days: 0,
  amount: 0,
});

export default function PurchaseOrderForm({
  order,
  saving,
  onClose,
  onSuccess,
  onSubmit,
}: Props) {
  const [campaignId, setCampaignId] =
    useState("");

  const [campaigns, setCampaigns] =
    useState<CampaignOption[]>([]);

  const [loadingCampaigns, setLoadingCampaigns] =
    useState(false);

  const [vendorId, setVendorId] =
    useState("");

  const [vendors, setVendors] =
    useState<VendorOption[]>([]);

  const [loadingVendors, setLoadingVendors] =
    useState(false);

  const [lineItems, setLineItems] =
    useState<PurchaseOrderLineItem[]>([
      emptyItem(),
    ]);

  const [error, setError] = useState("");

  /**
   * Load campaigns and active vendors
   */
  useEffect(() => {
    let mounted = true;

    async function loadOptions() {
      try {
        setLoadingCampaigns(true);
        setLoadingVendors(true);

        const [campaignRes, vendorRes] = await Promise.allSettled([
          getCampaignOptionsForPO(),
          getVendorOptionsForPO().catch(() =>
            getVendors({ status: "Active" }),
          ),
        ]);

        if (!mounted) return;

        if (campaignRes.status === "fulfilled" && campaignRes.value?.data) {
          const rawCampaigns = Array.isArray(campaignRes.value.data)
            ? campaignRes.value.data
            : [];
          setCampaigns(rawCampaigns);
        }

        if (vendorRes.status === "fulfilled" && vendorRes.value?.data) {
          const rawVendors = Array.isArray(vendorRes.value.data)
            ? vendorRes.value.data
            : [];

          const activeVendors: VendorOption[] = rawVendors
            .filter(
              (vendor: any) =>
                !vendor.status || vendor.status === "Active",
            )
            .map((vendor: any) => ({
              _id: String(vendor._id),
              name: vendor.name || "Unnamed Vendor",
              state: vendor.state,
              city: vendor.city,
              status: vendor.status || "Active",
              contactPerson: vendor.contactPerson,
              mobile: vendor.mobile,
            }));

          setVendors(activeVendors);
        }
      } catch (err) {
        console.error(
          "Failed to load options for PO:",
          err,
        );
      } finally {
        if (mounted) {
          setLoadingCampaigns(false);
          setLoadingVendors(false);
        }
      }
    }

    loadOptions();

    return () => {
      mounted = false;
    };
  }, []);

  /**
   * Populate form when editing
   */
  useEffect(() => {
    if (!order) {
      setCampaignId("");
      setVendorId("");
      setLineItems([emptyItem()]);
      setError("");
      return;
    }

    const resolvedCampaignId =
      !order.campaignId
        ? ""
        : typeof order.campaignId === "string"
          ? order.campaignId
          : String((order.campaignId as any)._id || "");

    const resolvedVendorId =
      !order.vendorId
        ? ""
        : typeof order.vendorId === "string"
          ? order.vendorId
          : String((order.vendorId as any)._id || "");

    setCampaignId(resolvedCampaignId);
    setVendorId(resolvedVendorId);

    const rawLineItems = Array.isArray(order.lineItems) ? order.lineItems : [];
    const formattedLineItems =
      rawLineItems.length > 0
        ? rawLineItems.map((item: any) => ({
            ...item,
            siteId:
              typeof item.siteId === "string"
                ? item.siteId
                : String(item.siteId?._id || ""),
            from: item.from ? String(item.from).slice(0, 10) : "",
            to: item.to ? String(item.to).slice(0, 10) : "",
            negotiatedRatePerDay: Number(item.negotiatedRatePerDay) || 0,
            days: Number(item.days) || 0,
            amount: Number(item.amount) || 0,
          }))
        : [emptyItem()];

    setLineItems(formattedLineItems);

    setError("");
  }, [order]);

  /**
   * Update line item
   */
  function updateItem(
    index: number,
    field: keyof PurchaseOrderLineItem,
    value: string | number,
  ) {
    setLineItems((items) =>
      items.map((item, i) => {
        if (i !== index) {
          return item;
        }

        const updated = {
          ...item,
          [field]: value,
        };

        const from = new Date(updated.from);
        const to = new Date(updated.to);

        const days =
          updated.from &&
          updated.to &&
          !Number.isNaN(from.getTime()) &&
          !Number.isNaN(to.getTime()) &&
          to >= from
            ? Math.floor(
                (to.getTime() -
                  from.getTime()) /
                  86400000,
              ) + 1
            : 0;

        return {
          ...updated,
          days,
          amount:
            days *
            Number(
              updated.negotiatedRatePerDay || 0,
            ),
        };
      }),
    );
  }

  /**
   * Add new site line item
   */
  function addItem() {
    setLineItems((items) => [
      ...items,
      emptyItem(),
    ]);
  }

  /**
   * Remove site line item
   */
  function removeItem(index: number) {
    setLineItems((items) =>
      items.length === 1
        ? items
        : items.filter(
            (_, i) => i !== index,
          ),
    );
  }

  /**
   * Submit form
   */
  async function handleSubmit(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    setError("");

    if (!campaignId.trim()) {
      setError("Campaign is required");
      return;
    }

    if (!vendorId.trim()) {
      setError("Vendor is required");
      return;
    }

    if (
      lineItems.some(
        (item) =>
          !item.siteId ||
          !item.from ||
          !item.to ||
          item.days <= 0 ||
          item.negotiatedRatePerDay <= 0,
      )
    ) {
      setError(
        "Please complete all site line items",
      );
      return;
    }

    const success = await onSubmit({
      campaignId,
      vendorId,
      lineItems: lineItems.map(
        ({
          siteId,
          from,
          to,
          negotiatedRatePerDay,
        }) => ({
          siteId,
          from,
          to,
          negotiatedRatePerDay,
        }),
      ),
    });

    if (success) {
      onSuccess();
    }
  }

  /**
   * Calculate total
   */
  const total = lineItems.reduce(
    (sum, item) => sum + item.amount,
    0,
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[#EEEEF3] px-6 py-5">
          <div>
            <h2 className="text-xl font-bold text-[#1F2937]">
              {order
                ? "Edit Purchase Order"
                : "Create Purchase Order"}
            </h2>

            <p className="mt-1 text-sm text-[#667085]">
              Add vendor sites and negotiated rates
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-lg px-3 py-1 text-2xl font-bold text-gray-500 hover:bg-[#F9DADA] hover:text-[#8B2424] disabled:opacity-50"
          >
            ×
          </button>
        </div>

        {/* Form */}
        <form
          onSubmit={handleSubmit}
          className="flex-1 overflow-y-auto"
        >
          <div className="space-y-6 p-6">
            {/* Error */}
            {error && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-4">
                <p className="text-sm font-semibold text-red-700">
                  {error}
                </p>
              </div>
            )}

            {/* Purchase Order Information */}
            <section className="rounded-2xl border border-[#E8E8EC] p-5">
              <h3 className="mb-4 text-sm font-bold text-[#1F2937]">
                Purchase Order Information
              </h3>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {/* Campaign Selector */}
                <CampaignSelector
                  value={campaignId}
                  campaigns={campaigns}
                  loading={loadingCampaigns}
                  disabled={saving}
                  fallbackName={
                    typeof order?.campaignId === "object"
                      ? order.campaignId?.name
                      : undefined
                  }
                  onChange={setCampaignId}
                />

                {/* Vendor Selector */}
                <VendorSelector
                  value={vendorId}
                  vendors={vendors}
                  loading={loadingVendors}
                  disabled={saving}
                  fallbackName={
                    typeof order?.vendorId === "object"
                      ? order.vendorId?.name
                      : undefined
                  }
                  onChange={setVendorId}
                />
              </div>
            </section>

            {/* Site Line Items */}
            <section className="rounded-2xl border border-[#E8E8EC] p-5">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-[#1F2937]">
                    Site Line Items
                  </h3>

                  <p className="mt-1 text-xs text-[#667085]">
                    Add site, date range and negotiated
                    daily rate.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={addItem}
                  disabled={saving}
                  className="rounded-lg bg-[#F9DADA] px-4 py-2 text-xs font-bold text-[#8B2424] hover:bg-[#8B2424] hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                >
                  + Add Site
                </button>
              </div>

              <div className="space-y-4">
                {lineItems.map((item, index) => (
                  <div
                    key={`${item.siteId || "new-site"}-${index}`}
                    className="rounded-xl border border-[#E8E8EC] bg-[#FAFAFB] p-4"
                  >
                    <div className="mb-4 flex items-center justify-between">
                      <p className="text-sm font-bold text-[#1F2937]">
                        Site {index + 1}
                      </p>

                      {lineItems.length > 1 && (
                        <button
                          type="button"
                          onClick={() =>
                            removeItem(index)
                          }
                          disabled={saving}
                          className="text-xs font-bold text-[#8B2424] hover:underline disabled:opacity-50"
                        >
                          Remove
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 gap-4 md:grid-cols-5">
                      {/* Site ID */}
                      <Field
                        label="Site ID"
                        value={item.siteId}
                        placeholder="Site ID"
                        onChange={(value) =>
                          updateItem(
                            index,
                            "siteId",
                            value,
                          )
                        }
                      />

                      {/* From */}
                      <Field
                        label="From Date"
                        type="date"
                        value={item.from}
                        onChange={(value) =>
                          updateItem(
                            index,
                            "from",
                            value,
                          )
                        }
                      />

                      {/* To */}
                      <Field
                        label="To Date"
                        type="date"
                        value={item.to}
                        onChange={(value) =>
                          updateItem(
                            index,
                            "to",
                            value,
                          )
                        }
                      />

                      {/* Rate */}
                      <Field
                        label="Rate / Day"
                        type="number"
                        value={String(
                          item.negotiatedRatePerDay ||
                            "",
                        )}
                        placeholder="0"
                        onChange={(value) =>
                          updateItem(
                            index,
                            "negotiatedRatePerDay",
                            Number(value),
                          )
                        }
                      />

                      {/* Amount */}
                      <div>
                        <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-[#667085]">
                          Amount
                        </label>

                        <div className="rounded-xl border border-[#E8E8EC] bg-white px-4 py-3 text-sm font-bold text-[#8B2424]">
                          ₹
                          {item.amount.toLocaleString(
                            "en-IN",
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Days calculation */}
                    {item.days > 0 && (
                      <p className="mt-3 text-xs font-semibold text-[#667085]">
                        {item.days} day
                        {item.days !== 1
                          ? "s"
                          : ""}{" "}
                        × ₹
                        {item.negotiatedRatePerDay.toLocaleString(
                          "en-IN",
                        )}
                      </p>
                    )}
                  </div>
                ))}
              </div>

              {/* Total */}
              <div className="mt-5 flex items-center justify-between border-t border-[#EEEEF3] pt-5">
                <span className="text-sm font-bold text-[#1F2937]">
                  Total Amount
                </span>

                <span className="text-xl font-bold text-[#8B2424]">
                  ₹
                  {total.toLocaleString(
                    "en-IN",
                  )}
                </span>
              </div>
            </section>
          </div>

          {/* Footer */}
          <div className="flex justify-end gap-3 border-t border-[#EEEEF3] bg-[#FAFAFB] px-6 py-4">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="rounded-xl border border-[#8B2424] bg-[#F9DADA] px-5 py-2.5 text-sm font-bold text-[#8B2424] hover:bg-[#8B2424] hover:text-white disabled:opacity-50"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={
                saving ||
                loadingVendors ||
                loadingCampaigns ||
                !campaignId ||
                !vendorId
              }
              className="rounded-xl bg-[#8B2424] px-6 py-2.5 text-sm font-bold text-white hover:bg-[#A8383B] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving
                ? "Saving..."
                : order
                  ? "Update Draft"
                  : "Create Draft"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/**
 * Searchable Campaign Selector Component
 */
function CampaignSelector({
  value,
  campaigns,
  loading,
  disabled,
  fallbackName,
  onChange,
}: {
  value: string;
  campaigns: CampaignOption[];
  loading?: boolean;
  disabled?: boolean;
  fallbackName?: string;
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

  const selectedCampaign = campaigns.find((c) => c._id === value);

  const filteredCampaigns = campaigns.filter((c) => {
    if (!search.trim()) return true;
    const term = search.toLowerCase();
    return (
      (c.name || "").toLowerCase().includes(term) ||
      (c.campaignCode || "").toLowerCase().includes(term) ||
      (c.city || "").toLowerCase().includes(term)
    );
  });

  return (
    <div ref={dropdownRef} className="relative">
      <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-[#667085]">
        Campaign <span className="text-[#8B2424]">*</span>
      </label>

      <button
        type="button"
        disabled={disabled || loading}
        onClick={() => setOpen((prev) => !prev)}
        className="flex w-full items-center justify-between rounded-xl border border-gray-300 bg-white px-4 py-3 text-left text-sm font-medium text-gray-900 outline-none transition focus:border-[#8B2424] focus:ring-2 focus:ring-[#F9DADA] disabled:cursor-not-allowed disabled:bg-[#F7F8FA]"
      >
        <div className="truncate">
          {selectedCampaign ? (
            <div>
              <span className="font-bold text-[#1F2937]">{selectedCampaign.name}</span>
              {selectedCampaign.campaignCode && (
                <span className="ml-2 text-xs font-semibold text-[#8B2424]">
                  ({selectedCampaign.campaignCode})
                </span>
              )}
              {selectedCampaign.city && (
                <span className="ml-2 text-xs text-[#667085]">
                  • {selectedCampaign.city}
                </span>
              )}
            </div>
          ) : fallbackName ? (
            <span className="font-semibold text-gray-900">{fallbackName}</span>
          ) : value ? (
            <span className="text-gray-700">Campaign #{value.slice(-6)}</span>
          ) : (
            <span className="text-gray-400">
              {loading ? "Loading campaigns..." : "Select Campaign"}
            </span>
          )}
        </div>
        <span className="ml-2 text-xs text-[#667085]">▾</span>
      </button>

      {open && (
        <div className="absolute left-0 right-0 z-50 mt-1 max-h-64 overflow-hidden rounded-xl border border-[#E8E8EC] bg-white shadow-xl">
          <div className="border-b border-gray-100 p-2">
            <input
              type="text"
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search campaign by name, code or city..."
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-xs text-gray-900 placeholder:text-gray-400 outline-none focus:border-[#8B2424] focus:ring-1 focus:ring-[#F9DADA]"
            />
          </div>

          <div className="max-h-48 overflow-y-auto divide-y divide-gray-50">
            {filteredCampaigns.map((c) => {
              const isSelected = c._id === value;
              return (
                <button
                  key={c._id}
                  type="button"
                  onClick={() => {
                    onChange(c._id);
                    setOpen(false);
                    setSearch("");
                  }}
                  className={`block w-full px-4 py-2.5 text-left transition ${
                    isSelected
                      ? "bg-[#FFF5F5] text-[#8B2424]"
                      : "hover:bg-[#F9DADA] hover:text-[#8B2424] text-gray-900"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold">{c.name}</span>
                    {c.campaignCode && (
                      <span className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-semibold text-gray-600">
                        {c.campaignCode}
                      </span>
                    )}
                  </div>
                  <div className="mt-0.5 text-xs text-[#667085]">
                    {c.city || "No city specified"}
                    {c.status ? ` • ${c.status}` : ""}
                  </div>
                </button>
              );
            })}

            {filteredCampaigns.length === 0 && (
              <div className="px-4 py-4 text-center text-xs text-gray-500">
                {campaigns.length === 0
                  ? "No campaigns found"
                  : "No matching campaigns found"}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Searchable Vendor Selector Component
 */
function VendorSelector({
  value,
  vendors,
  loading,
  disabled,
  fallbackName,
  onChange,
}: {
  value: string;
  vendors: VendorOption[];
  loading?: boolean;
  disabled?: boolean;
  fallbackName?: string;
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

  const selectedVendor = vendors.find((v) => v._id === value);

  const filteredVendors = vendors.filter((v) => {
    if (!search.trim()) return true;
    const term = search.toLowerCase();
    return (
      (v.name || "").toLowerCase().includes(term) ||
      (v.city || "").toLowerCase().includes(term) ||
      (v.state || "").toLowerCase().includes(term) ||
      (v.contactPerson || "").toLowerCase().includes(term)
    );
  });

  return (
    <div ref={dropdownRef} className="relative">
      <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-[#667085]">
        Vendor <span className="text-[#8B2424]">*</span>
      </label>

      <button
        type="button"
        disabled={disabled || loading}
        onClick={() => setOpen((prev) => !prev)}
        className="flex w-full items-center justify-between rounded-xl border border-gray-300 bg-white px-4 py-3 text-left text-sm font-medium text-gray-900 outline-none transition focus:border-[#8B2424] focus:ring-2 focus:ring-[#F9DADA] disabled:cursor-not-allowed disabled:bg-[#F7F8FA]"
      >
        <div className="truncate">
          {selectedVendor ? (
            <div>
              <span className="font-bold text-[#1F2937]">{selectedVendor.name}</span>
              {selectedVendor.city && (
                <span className="ml-2 text-xs text-[#667085]">
                  — {selectedVendor.city}
                  {selectedVendor.state ? `, ${selectedVendor.state}` : ""}
                </span>
              )}
            </div>
          ) : fallbackName ? (
            <span className="font-semibold text-gray-900">{fallbackName}</span>
          ) : value ? (
            <span className="text-gray-700">Vendor #{value.slice(-6)}</span>
          ) : (
            <span className="text-gray-400">
              {loading ? "Loading vendors..." : "Select Active Vendor"}
            </span>
          )}
        </div>
        <span className="ml-2 text-xs text-[#667085]">▾</span>
      </button>

      {open && (
        <div className="absolute left-0 right-0 z-50 mt-1 max-h-64 overflow-hidden rounded-xl border border-[#E8E8EC] bg-white shadow-xl">
          <div className="border-b border-gray-100 p-2">
            <input
              type="text"
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search vendor by name, city, or contact..."
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-xs text-gray-900 placeholder:text-gray-400 outline-none focus:border-[#8B2424] focus:ring-1 focus:ring-[#F9DADA]"
            />
          </div>

          <div className="max-h-48 overflow-y-auto divide-y divide-gray-50">
            {filteredVendors.map((v) => {
              const isSelected = v._id === value;
              return (
                <button
                  key={v._id}
                  type="button"
                  onClick={() => {
                    onChange(v._id);
                    setOpen(false);
                    setSearch("");
                  }}
                  className={`block w-full px-4 py-2.5 text-left transition ${
                    isSelected
                      ? "bg-[#FFF5F5] text-[#8B2424]"
                      : "hover:bg-[#F9DADA] hover:text-[#8B2424] text-gray-900"
                  }`}
                >
                  <div className="text-sm font-bold">{v.name}</div>
                  <div className="mt-0.5 text-xs text-[#667085]">
                    {v.contactPerson ? `${v.contactPerson} • ` : ""}
                    {v.city ? `${v.city}${v.state ? `, ${v.state}` : ""}` : "No location"}
                  </div>
                </button>
              );
            })}

            {filteredVendors.length === 0 && (
              <div className="px-4 py-4 text-center text-xs text-gray-500">
                {vendors.length === 0
                  ? "No active vendors found"
                  : "No matching vendors found"}
              </div>
            )}
          </div>
        </div>
      )}

      {!loading && vendors.length > 0 && (
        <p className="mt-1 text-xs text-[#667085]">
          Only active vendors are shown.
        </p>
      )}
    </div>
  );
}

/**
 * Reusable Field component
 */
function Field({
  label,
  value,
  placeholder,
  type = "text",
  onChange,
}: {
  label: string;
  value: string;
  placeholder?: string;
  type?: string;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-[#667085]">
        {label}
      </label>

      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) =>
          onChange(e.target.value)
        }
        className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm font-medium text-gray-900 outline-none transition focus:border-[#8B2424] focus:ring-2 focus:ring-[#F9DADA]"
      />
    </div>
  );
}