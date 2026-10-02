import type {
  VendorFormData,
  VendorResponse,
  VendorSitesResponse,
  VendorsResponse,
} from "./types";

import { api } from "@/shared/api/client";

export interface VendorFilters {
  search?: string;
  city?: string;
  status?: "Active" | "Inactive";
  registrationStatus?: "Registered" | "Unregistered" | "Pending";
  vendorType?: "Individual" | "Partnership" | "Company" | "MSME" | "Others";
}

export interface VendorFilterOptionsResponse {
  data: {
    cities: string[];
    registrationStatuses: string[];
    vendorTypes: string[];
    statuses: string[];
  };
}

export async function getVendors(
  filters?: VendorFilters
): Promise<VendorsResponse> {
  const params = new URLSearchParams();

  Object.entries(filters || {}).forEach(([key, value]) => {
    if (value) params.set(key, value);
  });

  const query = params.toString();

  return api.get<VendorsResponse>(
    query ? `/api/vendors?${query}` : "/api/vendors"
  );
}

export async function getVendorFilters() {
  return api.get<VendorFilterOptionsResponse>("/api/vendors/filters");
}

export async function getVendor(id: string) {
  return api.get<VendorResponse>(`/api/vendors/${id}`);
}

export async function createVendor(data: VendorFormData) {
  return api.post<VendorResponse>("/api/vendors", data);
}

export async function updateVendor(
  id: string,
  data: Partial<VendorFormData>
) {
  return api.patch<VendorResponse>(`/api/vendors/${id}`, data);
}

export async function deactivateVendor(id: string) {
  return api.patch<VendorResponse>(`/api/vendors/${id}/deactivate`);
}

export async function getVendorSites(id: string) {
  return api.get<VendorSitesResponse>(`/api/vendors/${id}/sites`);
}

export const vendorsApi = {
  getVendors,
};