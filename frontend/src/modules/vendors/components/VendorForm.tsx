"use client";

import { useEffect, useRef, useState } from "react";

import type {
  Vendor,
  VendorFormData,
} from "../types";

import {
  getEmptyVendorForm,
  vendorToForm,
} from "../format";

const GST_PATTERN =
  /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

const IFSC_PATTERN =
  /^[A-Z]{4}0[A-Z0-9]{6}$/;

const PAN_PATTERN =
  /^[A-Z]{5}[0-9]{4}[A-Z]$/;

interface Props {
  vendor: Vendor | null;
  saving: boolean;
  onClose: () => void;
  onSubmit: (
    data: VendorFormData,
  ) => Promise<boolean>;
}

export default function VendorForm({
  vendor,
  saving,
  onClose,
  onSubmit,
}: Props) {
  const [form, setForm] =
    useState<VendorFormData>(
      getEmptyVendorForm(),
    );

  const [error, setError] =
    useState("");

  const [statusOpen, setStatusOpen] =
    useState(false);

  const statusRef =
    useRef<HTMLDivElement>(null);

  /* ----------------------------------
     LOAD FORM DATA
  ----------------------------------- */

  useEffect(() => {
    setForm(
      vendor
        ? vendorToForm(vendor)
        : getEmptyVendorForm(),
    );

    setError("");
  }, [vendor]);

  /* ----------------------------------
     CLOSE STATUS DROPDOWN
  ----------------------------------- */

  useEffect(() => {
    function handleOutsideClick(
      event: MouseEvent,
    ) {
      if (
        statusRef.current &&
        !statusRef.current.contains(
          event.target as Node,
        )
      ) {
        setStatusOpen(false);
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

  /* ----------------------------------
     UPDATE FIELD
  ----------------------------------- */

  function update(
    field: keyof VendorFormData,
    value: string,
  ) {
    setForm((previous) => ({
      ...previous,
      [field]: value,
    }));
  }

  /* ----------------------------------
     SUBMIT
  ----------------------------------- */

  async function submit(
    event: React.FormEvent,
  ) {
    event.preventDefault();

    /* Vendor name */

    if (!form.name.trim()) {
      setError(
        "Vendor name is required.",
      );
      return;
    }

    /* State */

    if (!form.state.trim()) {
      setError(
        "State is required.",
      );
      return;
    }

    /* City */

    if (!form.city.trim()) {
      setError(
        "City is required.",
      );
      return;
    }

    /* PAN */

    if (
      form.panNumber &&
      !PAN_PATTERN.test(
        form.panNumber
          .trim()
          .toUpperCase(),
      )
    ) {
      setError(
        "Enter a valid PAN number.",
      );
      return;
    }

    /* GST */

    if (
      form.gstNumber &&
      !GST_PATTERN.test(
        form.gstNumber
          .trim()
          .toUpperCase(),
      )
    ) {
      setError(
        "Enter a valid GST number.",
      );
      return;
    }

    /* IFSC */

    if (
      form.ifsc &&
      !IFSC_PATTERN.test(
        form.ifsc
          .trim()
          .toUpperCase(),
      )
    ) {
      setError(
        "Enter a valid IFSC code.",
      );
      return;
    }

    setError("");

    const success =
      await onSubmit(form);

    if (!success) {
      setError(
        "Unable to save vendor.",
      );
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">

        {/* ================= HEADER ================= */}

        <div className="flex items-center justify-between border-b border-[#EEEEF3] bg-white px-6 py-5">
          <div>
            <h2 className="text-xl font-bold text-[#1F2937]">
              {vendor
                ? "Edit Vendor"
                : "Add Vendor"}
            </h2>

            <p className="mt-1 text-sm text-[#667085]">
              Manage vendor information
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="
              rounded-lg
              px-3 py-1
              text-2xl
              font-bold
              text-gray-500
              transition
              hover:bg-[#F9DADA]
              hover:text-[#8B2424]
              focus:outline-none
              focus:ring-2
              focus:ring-[#F9DADA]
              disabled:opacity-50
            "
          >
            ×
          </button>
        </div>

        {/* ================= FORM ================= */}

        <form
          onSubmit={submit}
          className="overflow-y-auto"
        >
          <div className="grid grid-cols-1 gap-5 p-6 md:grid-cols-2">

            {/* ERROR */}

            {error && (
              <div className="md:col-span-2 rounded-xl border border-red-200 bg-red-50 p-4">
                <p className="text-sm font-semibold text-red-700">
                  {error}
                </p>
              </div>
            )}

            {/* VENDOR NAME */}

            <Input
              label="Vendor Name"
              required
              value={form.name}
              onChange={(value) =>
                update(
                  "name",
                  value,
                )
              }
            />

            {/* STATE */}

            <Input
              label="State"
              required
              value={form.state}
              onChange={(value) =>
                update(
                  "state",
                  value,
                )
              }
            />

            {/* CITY */}

            <Input
              label="City"
              required
              value={form.city}
              onChange={(value) =>
                update(
                  "city",
                  value,
                )
              }
            />

            {/* CONTACT PERSON */}

            <Input
              label="Contact Person"
              value={
                form.contactPerson
              }
              onChange={(value) =>
                update(
                  "contactPerson",
                  value,
                )
              }
            />

            {/* MOBILE */}

            <Input
              label="Mobile"
              value={form.mobile}
              onChange={(value) =>
                update(
                  "mobile",
                  value,
                )
              }
            />

            {/* EMAIL */}

            <Input
              label="Email"
              type="email"
              value={form.email}
              onChange={(value) =>
                update(
                  "email",
                  value,
                )
              }
            />

            {/* PAN */}

            <Input
              label="PAN Number"
              value={
                form.panNumber
              }
              onChange={(value) =>
                update(
                  "panNumber",
                  value.toUpperCase(),
                )
              }
            />

            {/* MSME */}

            <Input
              label="MSME Number"
              value={
                form.msmeNumber
              }
              onChange={(value) =>
                update(
                  "msmeNumber",
                  value.toUpperCase(),
                )
              }
            />

            {/* GST */}

            <Input
              label="GST Number"
              value={
                form.gstNumber
              }
              onChange={(value) =>
                update(
                  "gstNumber",
                  value.toUpperCase(),
                )
              }
            />

            {/* PAYMENT TERMS */}

            <Input
              label="Payment Terms"
              value={
                form.paymentTerms
              }
              onChange={(value) =>
                update(
                  "paymentTerms",
                  value,
                )
              }
            />

            {/* BANK ACCOUNT */}

            <Input
              label="Bank Account Number"
              value={
                form.bankAccountNumber
              }
              onChange={(value) =>
                update(
                  "bankAccountNumber",
                  value,
                )
              }
            />

            {/* IFSC */}

            <Input
              label="IFSC"
              value={form.ifsc}
              onChange={(value) =>
                update(
                  "ifsc",
                  value.toUpperCase(),
                )
              }
            />

            {/* ADDRESS */}

            <div className="md:col-span-2">
              <label className="mb-2 block text-sm font-bold text-[#1F2937]">
                Address
              </label>

              <textarea
                rows={3}
                value={form.address}
                onChange={(event) =>
                  update(
                    "address",
                    event.target.value,
                  )
                }
                className="
                  w-full
                  rounded-xl
                  border border-gray-300
                  bg-white
                  px-4 py-3
                  text-sm
                  text-gray-900
                  placeholder:text-gray-400
                  outline-none
                  transition
                  hover:border-[#8B2424]
                  focus:border-[#8B2424]
                  focus:ring-2
                  focus:ring-[#F9DADA]
                "
                placeholder="Enter address"
              />
            </div>

            {/* STATUS */}

            <div
              ref={statusRef}
              className="relative"
            >
              <label className="mb-2 block text-sm font-bold text-[#1F2937]">
                Status
              </label>

              <button
                type="button"
                disabled={saving}
                onClick={() =>
                  setStatusOpen(
                    !statusOpen,
                  )
                }
                className="flex w-full cursor-pointer items-center justify-between rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-left text-sm text-gray-900 outline-none transition hover:border-[#8B2424] focus:border-[#8B2424] focus:ring-2 focus:ring-[#F9DADA] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <span>
                  {form.status}
                </span>

                <span className="text-gray-500">
                  ▾
                </span>
              </button>

              {statusOpen && (
                <div className="absolute left-0 right-0 z-40 mt-1 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg">

                  {/* ACTIVE */}
                  <button
                    type="button"
                    onClick={() => {
                      update("status", "Active");
                      setStatusOpen(false);
                    }}
                    className={`block w-full cursor-pointer px-4 py-2.5 text-left text-sm transition hover:bg-[#F9DADA] hover:text-[#8B2424] ${
                      form.status === "Active"
                        ? "bg-[#FFF5F5] font-semibold text-[#8B2424]"
                        : "text-gray-900"
                    }`}
                  >
                    Active
                  </button>

                  {/* INACTIVE */}
                  <button
                    type="button"
                    onClick={() => {
                      update("status", "Inactive");
                      setStatusOpen(false);
                    }}
                    className={`block w-full cursor-pointer px-4 py-2.5 text-left text-sm transition hover:bg-[#F9DADA] hover:text-[#8B2424] ${
                      form.status === "Inactive"
                        ? "bg-[#FFF5F5] font-semibold text-[#8B2424]"
                        : "text-gray-900"
                    }`}
                  >
                    Inactive
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* ================= FOOTER ================= */}

          <div className="flex justify-end gap-3 border-t border-[#EEEEF3] bg-[#FAFAFB] px-6 py-4">

            {/* CANCEL */}

            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="
                rounded-xl
                border border-[#8B2424]
                bg-[#F9DADA]
                px-5 py-2.5
                text-sm
                font-bold
                text-[#8B2424]
                transition
                hover:bg-[#8B2424]
                hover:text-white
                focus:outline-none
                focus:ring-2
                focus:ring-[#F9DADA]
                focus:ring-offset-2
                disabled:opacity-50
              "
            >
              Cancel
            </button>

            {/* SAVE */}

            <button
              type="submit"
              disabled={saving}
              className="
                rounded-xl
                bg-[#8B2424]
                px-6 py-2.5
                text-sm
                font-bold
                text-white
                shadow-sm
                transition
                hover:bg-[#A8383B]
                focus:outline-none
                focus:ring-2
                focus:ring-[#F9DADA]
                focus:ring-offset-2
                disabled:cursor-not-allowed
                disabled:opacity-50
              "
            >
              {saving
                ? "Saving..."
                : vendor
                  ? "Update Vendor"
                  : "Save Vendor"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* =========================
   INPUT
========================= */

function Input({
  label,
  value,
  onChange,
  required = false,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (
    value: string,
  ) => void;
  required?: boolean;
  type?: string;
}) {
  return (
    <div>
      <label className="mb-2 block text-sm font-bold text-[#1F2937]">
        {label}

        {required && (
          <span className="ml-1 text-red-500">
            *
          </span>
        )}
      </label>

      <input
        type={type}
        required={required}
        value={value}
        onChange={(event) =>
          onChange(
            event.target.value,
          )
        }
        className="
          w-full
          rounded-xl
          border border-gray-300
          bg-white
          px-4 py-3
          text-sm
          text-gray-900
          placeholder:text-gray-400
          outline-none
          transition
          hover:border-[#8B2424]
          focus:border-[#8B2424]
          focus:ring-2
          focus:ring-[#F9DADA]
        "
        placeholder={`Enter ${label.toLowerCase()}`}
      />
    </div>
  );
}