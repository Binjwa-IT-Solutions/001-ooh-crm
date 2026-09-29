"use client";

import { useEffect, useState } from "react";

import type {
  Vendor,
  VendorFormData,
  VendorDocument,
} from "../types";

import {
  getEmptyVendorForm,
  vendorToForm,
} from "../format";

interface Props {
  vendor: Vendor | null;
  saving?: boolean;
  loading?: boolean;
  onClose: () => void;
  onSubmit: (data: VendorFormData) => Promise<boolean>;
}

export default function VendorForm({
  vendor,
  saving,
  loading,
  onClose,
  onSubmit,
}: Props) {
  const isSubmitting = saving ?? loading ?? false;

  const [form, setForm] = useState<VendorFormData>(
    getEmptyVendorForm()
  );

  const [manualCity, setManualCity] = useState("");

  const [documents, setDocuments] = useState<VendorDocument[]>([]);

  useEffect(() => {
    if (vendor) {
      const data = vendorToForm(vendor);

      setForm(data);
      setDocuments(data.documents || []);
      setManualCity("");
    } else {
      setForm(getEmptyVendorForm());
      setDocuments([]);
      setManualCity("");
    }
  }, [vendor]);

  function update<K extends keyof VendorFormData>(
    key: K,
    value: VendorFormData[K]
  ) {
    setForm((prev) => ({
      ...prev,
      [key]: value,
    }));
  }

  function addCity() {
    const city = manualCity.trim();

    if (!city) {
      alert("Enter city name");
      return;
    }

    if (
      form.citiesServed.some(
        (item) => item.toLowerCase() === city.toLowerCase()
      )
    ) {
      alert("City already added");
      return;
    }

    update("citiesServed", [
      ...form.citiesServed,
      city,
    ]);

    setManualCity("");
  }

  function handlePaymentChange(
    value: VendorFormData["paymentTerms"]
  ) {
    update("paymentTerms", value);

    if (value !== "Manual") {
      update("manualPaymentTerms", "");
    }
  }

  async function handleSubmit(
    e: React.FormEvent
  ) {
    e.preventDefault();

    if (!form.name.trim()) {
      alert("Vendor name is required");
      return;
    }

    if (!form.primaryContact.name.trim()) {
      alert("Contact name is required");
      return;
    }

    if (
      form.paymentTerms === "Manual" &&
      !form.manualPaymentTerms?.trim()
    ) {
      alert("Enter manual payment terms");
      return;
    }

    // Automatically add manually typed city before saving.
    const typedCity = manualCity.trim();
    let citiesServed = [...form.citiesServed];

    if (typedCity) {
      const exists = citiesServed.some(
        (item) =>
          item.toLowerCase() === typedCity.toLowerCase()
      );

      if (!exists) {
        citiesServed.push(typedCity);
      }
    }

    const success = await onSubmit({
      ...form,
      citiesServed,
      documents,
    });

    if (success) {
      onClose();
    }
  }

  function addDocument(file: File) {
    const newDocument: VendorDocument = {
      type: "Other",
      name: file.name,
    };

    setDocuments((prev) => [
      ...prev,
      newDocument,
    ]);
  }

  function removeDocument(index: number) {
    setDocuments((prev) =>
      prev.filter((_, i) => i !== index)
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-[22px] bg-white shadow-2xl">

        {/* HEADER */}
        <div className="flex shrink-0 items-start justify-between border-b border-[#E8EAF0] px-7 py-5">
          <div>
            <h2 className="text-[22px] font-bold leading-7 text-[#172033]">
              {vendor ? "Edit Vendor" : "Add Vendor"}
            </h2>
            <p className="mt-1 text-[15px] text-[#667085]">
              {vendor
                ? "Update vendor information"
                : "Manage vendor information"}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="mt-1 text-[26px] font-bold leading-none text-[#667085] transition hover:text-[#172033]"
          >
            ×
          </button>
        </div>

        {/* FORM */}
        <form onSubmit={handleSubmit} className="min-h-0 flex-1 overflow-y-auto">
          <div className="grid grid-cols-1 gap-x-6 gap-y-5 px-7 py-7 md:grid-cols-2">

            {/* VENDOR NAME */}
            <Input
              label="Vendor Name *"
              value={form.name}
              placeholder="Enter vendor name"
              onChange={(value) => update("name", value)}
            />

           

            {/* VENDOR TYPE */}
            <Select
              label="Vendor Type"
              value={form.vendorType}
              options={[
                "Individual",
                "Partnership",
                "Company",
                "MSME",
                "Others",
              ]}
              onChange={(value) =>
                update(
                  "vendorType",
                  value as VendorFormData["vendorType"]
                )
              }
            />

            {/* REGISTRATION STATUS */}
            <Select
              label="Registration Status"
              value={form.registrationStatus}
              options={[
                "Registered",
                "Unregistered",
                "Pending",
              ]}
              onChange={(value) =>
                update(
                  "registrationStatus",
                  value as VendorFormData["registrationStatus"]
                )
              }
            />

             {/* STATE */}
            <Input
              label="State *"
              value={form.state}
              placeholder="Enter state"
              onChange={(value) => update("state", value)}
            />

            {/* CITY SERVED - SINGLE BOX */}
            <div>
              <label className="mb-2 block text-[15px] font-semibold text-[#344054]">
                City
              </label>

              <input
                value={manualCity}
                onChange={(e) => setManualCity(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addCity();
                  }
                }}
                onBlur={() => {
                  if (manualCity.trim()) addCity();
                }}
                placeholder="Enter city"
                className="w-full rounded-[14px] border border-[#D0D5DD] bg-white px-4 py-3 text-[15px] text-[#344054] outline-none placeholder:text-[#98A2B3] focus:border-[#8B2424] focus:ring-1 focus:ring-[#8B2424]"
              />
            </div>

            {/* CONTACT NAME */}
            <Input
              label="Person Name *"
              value={form.primaryContact.name}
              placeholder="Enter person name"
              onChange={(value) =>
                setForm((prev) => ({
                  ...prev,
                  primaryContact: {
                    ...prev.primaryContact,
                    name: value,
                  },
                }))
              }
            />

            {/* CONTACT EMAIL */}
            <Input
              label="Person Email"
              value={form.primaryContact.email}
              placeholder="Enter email"
              onChange={(value) =>
                setForm((prev) => ({
                  ...prev,
                  primaryContact: {
                    ...prev.primaryContact,
                    email: value,
                  },
                }))
              }
            />

            {/* CONTACT PHONE */}
            <Input
              label="Person Phone"
              value={form.primaryContact.phone}
              placeholder="Enter mobile"
              onChange={(value) =>
                setForm((prev) => ({
                  ...prev,
                  primaryContact: {
                    ...prev.primaryContact,
                    phone: value,
                  },
                }))
              }
            />

            {/* PAN */}
            <Input
              label="PAN Number"
              value={form.panNumber}
              placeholder="Enter pan number"
              onChange={(value) => update("panNumber", value)}
            />

            {/* MSME REGISTERED */}
            <div>
              <label className="mb-2 block text-[15px] font-semibold text-[#344054]">
                MSME Registered
              </label>
              <label className="flex min-h-[50px] items-center gap-3 rounded-[14px] border border-[#D0D5DD] px-4 py-3 text-[15px] text-[#344054]">
                <input
                  type="checkbox"
                  checked={form.msmeRegistered}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    update("msmeRegistered", checked);

                    if (!checked) {
                      update("msmeNumber", "");
                    }
                  }}
                  className="h-4 w-4 accent-[#8B2424]"
                />
                MSME Registered
              </label>
            </div>

            {/* MSME NUMBER - ONLY WHEN REGISTERED */}
            {form.msmeRegistered && (
              <Input
                label="MSME Number"
                value={form.msmeNumber}
                placeholder="Enter msme number"
                onChange={(value) => update("msmeNumber", value)}
              />
            )}

            {/* GST */}
            <Input
              label="GST Number"
              value={form.gstNumber}
              placeholder="Enter gst number"
              onChange={(value) => update("gstNumber", value)}
            />

            {/* UDYAM */}
            <Input
              label="UDYAM Registration"
              value={form.udyamRegistration}
              placeholder="Enter udyam registration"
              onChange={(value) => update("udyamRegistration", value)}
            />

            {/* PAYMENT TERMS */}
            <div>
              <label className="mb-2 block text-[15px] font-semibold text-[#344054]">
                Payment Terms
              </label>
              <div className="flex gap-2">
                <select
                  value={form.paymentTerms}
                  onChange={(e) =>
                    handlePaymentChange(
                      e.target.value as VendorFormData["paymentTerms"]
                    )
                  }
                  className="w-full rounded-[14px] border border-[#D0D5DD] bg-white px-4 py-3 text-[15px] text-[#344054] outline-none focus:border-[#8B2424] focus:ring-1 focus:ring-[#8B2424]"
                >
                  <option value="Net 30">Net 30</option>
                  <option value="Net 45">Net 45</option>
                  <option value="Manual">Manual</option>
                </select>
              </div>
            </div>

            {/* MANUAL PAYMENT TERMS */}
            {form.paymentTerms === "Manual" && (
              <Input
                label="Manual Payment Terms *"
                value={form.manualPaymentTerms || ""}
                placeholder="Enter payment terms"
                onChange={(value) =>
                  update("manualPaymentTerms", value)
                }
              />
            )}

            {/* ACCOUNT HOLDER */}
            <Input
              label="Account Holder"
              value={form.bankDetails.accountHolder}
              placeholder="Enter account holder"
              onChange={(value) =>
                setForm((prev) => ({
                  ...prev,
                  bankDetails: {
                    ...prev.bankDetails,
                    accountHolder: value,
                  },
                }))
              }
            />

            {/* BANK NAME */}
            <Input
              label="Bank Name"
              value={form.bankDetails.bankName}
              placeholder="Enter bank name"
              onChange={(value) =>
                setForm((prev) => ({
                  ...prev,
                  bankDetails: {
                    ...prev.bankDetails,
                    bankName: value,
                  },
                }))
              }
            />

            {/* ACCOUNT NUMBER */}
            <Input
              label="Bank Account Number"
              value={form.bankDetails.accountNumber}
              placeholder="Enter bank account number"
              onChange={(value) =>
                setForm((prev) => ({
                  ...prev,
                  bankDetails: {
                    ...prev.bankDetails,
                    accountNumber: value,
                  },
                }))
              }
            />

            {/* IFSC */}
            <Input
              label="IFSC"
              value={form.bankDetails.ifsc}
              placeholder="Enter ifsc"
              onChange={(value) =>
                setForm((prev) => ({
                  ...prev,
                  bankDetails: {
                    ...prev.bankDetails,
                    ifsc: value,
                  },
                }))
              }
            />

            {/* BRANCH */}
            <Input
              label="Branch"
              value={form.bankDetails.branch}
              placeholder="Enter branch"
              onChange={(value) =>
                setForm((prev) => ({
                  ...prev,
                  bankDetails: {
                    ...prev.bankDetails,
                    branch: value,
                  },
                }))
              }
            />

            {/* STATUS */}
            <div>
              <label className="mb-2 block text-[15px] font-semibold text-[#344054]">
                Status
              </label>
              <select
                value={form.status}
                onChange={(e) =>
                  update(
                    "status",
                    e.target.value as VendorFormData["status"]
                  )
                }
                className="w-full rounded-[14px] border border-[#D0D5DD] bg-white px-4 py-3 text-[15px] text-[#344054] outline-none focus:border-[#8B2424] focus:ring-1 focus:ring-[#8B2424]"
              >
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
                <option value="Blacklist">Blacklist</option>
              </select>
            </div>

            {/* DOCUMENTS */}
            <div className="md:col-span-2">
              <label className="mb-2 block text-[15px] font-semibold text-[#344054]">
                Upload Document
              </label>

              <input
                type="file"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) addDocument(file);
                  e.currentTarget.value = "";
                }}
                className="block w-full rounded-[14px] border border-[#D0D5DD] bg-white p-3 text-sm text-[#344054]"
              />

              {documents.length > 0 && (
                <div className="mt-3 space-y-2">
                  {documents.map((document, index) => (
                    <div
                      key={`${document.name}-${index}`}
                      className="flex items-center justify-between rounded-[14px] border border-[#E8EAF0] bg-[#FAFAFB] p-3"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-[#344054]">
                          {document.name}
                        </p>
                        <p className="text-xs text-[#667085]">
                          {document.type}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => removeDocument(index)}
                        className="ml-3 text-sm font-semibold text-red-600 hover:text-red-700"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>

          {/* FOOTER */}
          <div className="sticky bottom-0 flex shrink-0 justify-end gap-3 border-t border-[#E8EAF0] bg-white px-7 py-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-[12px] border border-[#D0D5DD] bg-white px-5 py-3 text-sm font-semibold text-[#344054] transition hover:bg-[#F9FAFB]"
            >
              Cancel
            </button>

            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-[12px] bg-[#8B2424] px-5 py-3 text-sm font-bold text-white transition hover:bg-[#A8383B] disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting
                ? "Saving..."
                : vendor
                ? "Update Vendor"
                : "Create Vendor"}
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
  placeholder,
  onChange,
}: {
  label: string;
  value: string;
  placeholder: string;
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-semibold text-[#344054]">
        {label}
      </label>

      <input
        value={value}
        placeholder={placeholder}
        onChange={(e) =>
          onChange(e.target.value)
        }
        className="w-full rounded-xl border border-[#D0D5DD] px-3 py-2.5 text-sm outline-none focus:border-[#8B2424]"
      />
    </div>
  );
}

/* =========================
   SELECT
========================= */

function Select({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-semibold text-[#344054]">
        {label}
      </label>

      <select
        value={value}
        onChange={(e) =>
          onChange(e.target.value)
        }
        className="w-full rounded-xl border border-[#D0D5DD] bg-white px-3 py-2.5 text-sm outline-none focus:border-[#8B2424]"
      >
        {options.map((option) => (
          <option
            key={option}
            value={option}
          >
            {option}
          </option>
        ))}
      </select>
    </div>
  );
}