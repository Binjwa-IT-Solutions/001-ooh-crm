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