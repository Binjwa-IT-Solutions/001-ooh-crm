"use client";

import { useEffect, useState } from "react";

import type {
  PurchaseOrder,
  PurchaseOrderFormData,
  PurchaseOrderLineItem,
} from "../types";

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

interface VendorOption {
  _id: string;
  name: string;
  state?: string;
  city?: string;
  status?: "Active" | "Inactive";
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
   * Load active vendors
   */
  useEffect(() => {
    let mounted = true;

    async function loadVendors() {
      try {
        setLoadingVendors(true);

        const response = await getVendors({
          status: "Active",
        });

        if (!mounted) return;

        const data = Array.isArray(response.data)
          ? response.data
          : [];

        const activeVendors: VendorOption[] =
          data
            .filter(
              (vendor: any) =>
                vendor?.status === "Active",
            )
            .map((vendor: any) => ({
              _id: String(vendor._id),
              name: vendor.name || "Unnamed Vendor",
              state: vendor.state,
              city: vendor.city,
              status: vendor.status,
            }));

        setVendors(activeVendors);
      } catch (err) {
        console.error(
          "Failed to load vendors:",
          err,
        );

        if (mounted) {
          setVendors([]);
        }
      } finally {
        if (mounted) {
          setLoadingVendors(false);
        }
      }
    }

    loadVendors();

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
                {/* Campaign ID */}
                <Field
                  label="Campaign ID"
                  value={campaignId}
                  placeholder="Enter campaign ID"
                  onChange={setCampaignId}
                />

                {/* Vendor */}
                <div>
                  <label className="mb-2 block text-xs font-bold uppercase tracking-wide text-[#667085]">
                    Vendor
                  </label>

                  <select
                    value={vendorId}
                    onChange={(e) =>
                      setVendorId(e.target.value)
                    }
                    disabled={
                      loadingVendors || saving
                    }
                    className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm font-medium text-gray-900 outline-none transition focus:border-[#8B2424] focus:ring-2 focus:ring-[#F9DADA] disabled:cursor-not-allowed disabled:bg-[#F7F8FA]"
                  >
                    <option value="">
                      {loadingVendors
                        ? "Loading vendors..."
                        : vendors.length === 0
                          ? "No active vendors found"
                          : "Select Active Vendor"}
                    </option>

                    {vendors.map((vendor) => (
                      <option
                        key={vendor._id}
                        value={vendor._id}
                      >
                        {vendor.name}
                        {vendor.city
                          ? ` — ${vendor.city}`
                          : ""}
                      </option>
                    ))}
                  </select>

                  {!loadingVendors &&
                    vendors.length > 0 && (
                      <p className="mt-1 text-xs text-[#667085]">
                        Only active vendors are shown.
                      </p>
                    )}
                </div>
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