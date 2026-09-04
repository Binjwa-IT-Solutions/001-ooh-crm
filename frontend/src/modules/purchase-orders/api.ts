import { api } from "@/shared/api/client";

import type {
  PurchaseOrderFormData,
  PurchaseOrderResponse,
  PurchaseOrdersResponse,
} from "./types";

/**
 * Get all purchase orders
 */
export async function getPurchaseOrders(): Promise<PurchaseOrdersResponse> {
  return api.get<PurchaseOrdersResponse>(
    "/api/purchase-orders",
  );
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
