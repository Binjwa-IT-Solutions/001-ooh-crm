"use client";

import type { Vendor } from "../types";
import { formatGST, formatPAN, formatValue } from "../format";

interface Props {
  vendor: Vendor;
  onClose: () => void;
  onEdit: () => void;
}

export default function VendorDetails({
  vendor,
  onClose,
  onEdit,
}: Props) {
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40">
      <div className="flex h-full w-full max-w-xl flex-col overflow-hidden bg-white shadow-2xl">

        <div className="flex items-center justify-between border-b border-[#EEEEF3] px-6 py-5">
          <div>
            <h2 className="text-xl font-bold text-[#1F2937]">
              Vendor Details
            </h2>
            <p className="mt-1 text-sm text-[#667085]">
              {vendor.name}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-3 py-1 text-2xl font-bold text-gray-500 hover:bg-[#F9DADA] hover:text-[#8B2424]"
          >
            ×
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          <div className="space-y-5 p-6">

            <Section title="Basic Information">
              <Item label="Vendor Name" value={vendor.name} />
              <Item label="Vendor Type" value={vendor.vendorType} />
              <Item label="Registration" value={vendor.registrationStatus} />
              <Item label="Status" value={vendor.status} />
              <Item
                label="Rating"
                value={vendor.vendorRating ? `${vendor.vendorRating}/5` : undefined}
              />
              <Item
                label="Cities Served"
                value={vendor.citiesServed?.join(", ")}
              />
            </Section>

            <Section title="Contact Information">
              <Item
                label="Primary Contact"
                value={vendor.primaryContact?.name}
              />
              <Item
                label="Email"
                value={vendor.primaryContact?.email}
              />
              <Item
                label="Phone"
                value={vendor.primaryContact?.phone}
              />
            </Section>

            <Section title="Business Documents">
              <Item label="PAN" value={formatPAN(vendor.panNumber)} />
              <Item label="GST" value={formatGST(vendor.gstNumber)} />
              <Item
                label="MSME Registered"
                value={vendor.msmeRegistered ? "Yes" : "No"}
              />
              <Item label="MSME Number" value={vendor.msmeNumber} />
              <Item
                label="UDYAM"
                value={vendor.udyamRegistration}
              />
            </Section>

            <Section title="Payment Information">
              <Item label="Payment Terms" value={vendor.paymentTerms} />
            </Section>

            <Section title="Bank Details">
              <Item
                label="Account Holder"
                value={vendor.bankDetails?.accountHolder}
              />
              <Item
                label="Bank Name"
                value={vendor.bankDetails?.bankName}
              />
              <Item
                label="Account Number"
                value={vendor.bankDetails?.accountNumber}
              />
              <Item label="IFSC" value={vendor.bankDetails?.ifsc} />
              <Item label="Branch" value={vendor.bankDetails?.branch} />
            </Section>

            <Section title="Documents">
              <Item
                label="Attached"
                value={
                  vendor.documents?.length
                    ? `${vendor.documents.length} document(s)`
                    : "No documents"
                }
              />
            </Section>
          </div>
        </div>

        <div className="border-t border-[#EEEEF3] bg-[#FAFAFB] p-5">
          <button
            type="button"
            onClick={onEdit}
            className="w-full rounded-xl bg-[#8B2424] px-5 py-3 text-sm font-bold text-white hover:bg-[#A8383B]"
          >
            Edit Vendor
          </button>
        </div>
      </div>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-[#E8E8EC] bg-white p-5 shadow-sm">
      <h3 className="mb-4 flex items-center gap-2 text-sm font-bold text-[#1F2937]">
        <span className="h-5 w-1 rounded-full bg-[#8B2424]" />
        {title}
      </h3>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        {children}
      </div>
    </section>
  );
}

function Item({
  label,
  value,
}: {
  label: string;
  value?: string;
}) {
  return (
    <div className="rounded-lg p-2 hover:bg-[#FFF8F8]">
      <p className="text-xs font-semibold uppercase tracking-wide text-[#667085]">
        {label}
      </p>

      <p className="mt-1 break-words text-sm font-semibold text-[#1F2937]">
        {formatValue(value)}
      </p>
    </div>
  );
}