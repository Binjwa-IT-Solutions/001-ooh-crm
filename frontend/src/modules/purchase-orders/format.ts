import type { PurchaseOrder } from "./types";

export function formatAmount(value?: number) {
  return `₹${(value || 0).toLocaleString("en-IN")}`;
}

export function formatDate(value?: string) {
  if (!value) return "—";

  return new Date(value).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function getVendorName(
  vendor: PurchaseOrder["vendorId"],
) {
  if (typeof vendor === "string") {
    return vendor;
  }

  return vendor?.name ?? "Unknown Vendor";
}

export function getCampaignName(
  campaign: PurchaseOrder["campaignId"],
) {
  if (typeof campaign === "string") {
    return campaign;
  }

  return campaign?.name ?? "Unknown Campaign";
}