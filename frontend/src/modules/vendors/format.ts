import type { Vendor, VendorFormData } from "./types";

export function getEmptyVendorForm(): VendorFormData {
  return {
    name: "",
    vendorType: "Company",
    registrationStatus: "Pending",

    gstNumber: "",
    panNumber: "",

    msmeRegistered: false,
    msmeNumber: "",
    udyamRegistration: "",

    city: "",
    state: "",
    citiesServed: [],

    primaryContact: {
      name: "",
      email: "",
      phone: "",
    },

    secondaryContacts: [],

    paymentTerms: "Net 30",
    manualPaymentTerms: "",

    bankDetails: {
      accountHolder: "",
      bankName: "",
      accountNumber: "",
      ifsc: "",
      branch: "",
    },

    vendorRating: undefined,

    documents: [],

    status: "Active",
  };
}

export function vendorToForm(vendor: Vendor): VendorFormData {
  return {
    name: vendor.name || "",
    vendorType: vendor.vendorType || "Company",
    registrationStatus: vendor.registrationStatus || "Pending",

    gstNumber: vendor.gstNumber || "",
    panNumber: vendor.panNumber || "",

    msmeRegistered: vendor.msmeRegistered || false,
    msmeNumber: vendor.msmeNumber || "",
    udyamRegistration: vendor.udyamRegistration || "",

    city: vendor.city || vendor.citiesServed?.[0] || "",
    state: vendor.state || "",
    citiesServed: vendor.citiesServed || [],

    primaryContact: vendor.primaryContact || {
      name: "",
      email: "",
      phone: "",
    },

    secondaryContacts: vendor.secondaryContacts || [],

    paymentTerms: vendor.paymentTerms || "Net 30",
    manualPaymentTerms: vendor.manualPaymentTerms || "",

    bankDetails: vendor.bankDetails || {
      accountHolder: "",
      bankName: "",
      accountNumber: "",
      ifsc: "",
      branch: "",
    },

    vendorRating: vendor.vendorRating,

    documents: vendor.documents || [],

    status: vendor.status || "Active",
  };
}

export function formatValue(value?: string) {
  return value?.trim() || "—";
}

export function formatGST(value?: string) {
  return value?.trim().toUpperCase() || "—";
}

export function formatPAN(value?: string) {
  return value?.trim().toUpperCase() || "—";
}

export function formatMSME(value?: string) {
  return value?.trim().toUpperCase() || "—";
}