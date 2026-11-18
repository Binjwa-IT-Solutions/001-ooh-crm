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
  fallback?: string,
) {
  if (!vendor) return fallback || "—";
  if (typeof vendor === "string") {
    return vendor || fallback || "—";
  }

  return vendor?.name || fallback || "Unknown Vendor";
}

export function getCampaignName(
  campaign: PurchaseOrder["campaignId"],
  fallback?: string,
) {
  if (!campaign) return fallback || "—";
  if (typeof campaign === "string") {
    return campaign || fallback || "—";
  }

  return campaign?.name || fallback || "Unknown Campaign";
}