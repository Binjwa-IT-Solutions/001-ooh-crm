import { api } from "@/shared/api/client";

import type {
  CampaignOption,
  PurchaseOrderFilters,
  PurchaseOrderFormData,
  PurchaseOrderResponse,
  PurchaseOrdersResponse,
  VendorOption,
} from "./types";

/**
 * Get all purchase orders with optional search and filters
 */
export async function getPurchaseOrders(
  filters?: PurchaseOrderFilters,
): Promise<PurchaseOrdersResponse> {
  const params = new URLSearchParams();

  if (filters?.search?.trim()) {
    params.set("search", filters.search.trim());
  }

  if (filters?.status?.trim()) {
    params.set("status", filters.status.trim());
  }

  if (filters?.campaignId?.trim()) {
    params.set("campaignId", filters.campaignId.trim());
  }

  if (filters?.vendorId?.trim()) {
    params.set("vendorId", filters.vendorId.trim());
  }

  const queryString = params.toString();
  const url = queryString
    ? `/api/purchase-orders?${queryString}`
    : "/api/purchase-orders";

  return api.get<PurchaseOrdersResponse>(url);
}

/**
 * Get available campaigns for Purchase Order selection
 */
export async function getCampaignOptionsForPO(): Promise<{
  success: boolean;
  data: CampaignOption[];
}> {
  return api.get<{
    success: boolean;
    data: CampaignOption[];
  }>("/api/purchase-orders/campaign-options");
}

/**
 * Get available vendors for Purchase Order selection
 */
export async function getVendorOptionsForPO(): Promise<{
  success: boolean;
  data: VendorOption[];
}> {
  return api.get<{
    success: boolean;
    data: VendorOption[];
  }>("/api/purchase-orders/vendor-options");
}

/**
 * Get single purchase order
 */
export async function getPurchaseOrder(
  id: string,
): Promise<PurchaseOrderResponse> {
  return api.get<PurchaseOrderResponse>(
    `/api/purchase-orders/${id}`,
  );
}

/**
 * Create purchase order
 */
export async function createPurchaseOrder(
  data: PurchaseOrderFormData,
): Promise<PurchaseOrderResponse> {
  return api.post<PurchaseOrderResponse>(
    "/api/purchase-orders",
    data,
  );
}

/**
 * Update purchase order
 */
export async function updatePurchaseOrder(
  id: string,
  data: Partial<PurchaseOrderFormData>,
): Promise<PurchaseOrderResponse> {
  return api.patch<PurchaseOrderResponse>(
    `/api/purchase-orders/${id}`,
    data,
  );
}

/**
 * Issue purchase order
 */
export async function issuePurchaseOrder(
  id: string,
): Promise<PurchaseOrderResponse> {
  return api.post<PurchaseOrderResponse>(
    `/api/purchase-orders/${id}/issue`,
  );
}

/**
 * Cancel purchase order
 */
export async function cancelPurchaseOrder(
  id: string,
): Promise<PurchaseOrderResponse> {
  return api.post<PurchaseOrderResponse>(
    `/api/purchase-orders/${id}/cancel`,
  );
}

export const purchaseOrdersApi = {
  list: getPurchaseOrders,
  get: getPurchaseOrder,
  create: createPurchaseOrder,
  update: updatePurchaseOrder,
  issue: issuePurchaseOrder,
  cancel: cancelPurchaseOrder,
  campaignOptions: getCampaignOptionsForPO,
  vendorOptions: getVendorOptionsForPO,
  updateStatus: async (id: string, status: "Issued" | "Accepted" | "Cancelled") => {
    if (status === "Issued") return issuePurchaseOrder(id);
    if (status === "Cancelled") return cancelPurchaseOrder(id);
    return updatePurchaseOrder(id, { status } as any);
  },
  downloadPDF: async (id: string) => {
    const token = typeof window !== "undefined" ? localStorage.getItem("mo.accessToken") : "";
    const res = await fetch(`/api/purchase-orders/${id}/pdf`, {
      headers: {
        Authorization: token ? `Bearer ${token}` : "",
      },
    });
    if (!res.ok) throw new Error("Failed to download PO PDF");
    return res.blob();
  },
};
