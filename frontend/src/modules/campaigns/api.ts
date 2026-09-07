import type {
  CampaignFilters,
  CampaignListResponse,
  CampaignResponse,
  CampaignStatus,
  CreateCampaignPayload,
  LeadOption,
  ManagerOption,
} from "./types";

import { api } from "@/shared/api/client";

function buildQuery(filters: CampaignFilters): string {
  const params = new URLSearchParams();

  if (filters.search?.trim()) {
    params.set("search", filters.search.trim());
  }

  if (filters.status) {
    params.set("status", filters.status);
  }

  if (filters.city?.trim()) {
    params.set("city", filters.city.trim());
  }

  if (filters.manager?.trim()) {
    params.set("manager", filters.manager.trim());
  }

  if (filters.startDate) {
    params.set("startDate", filters.startDate);
  }

  if (filters.endDate) {
    params.set("endDate", filters.endDate);
  }

  const query = params.toString();

  return query ? `?${query}` : "";
}

export async function getCampaigns(
  filters: CampaignFilters = {},
): Promise<CampaignListResponse> {
  return api.get<CampaignListResponse>(
    `/api/campaigns${buildQuery(filters)}`,
  );
}

export async function createCampaign(
  payload: CreateCampaignPayload,
): Promise<CampaignResponse> {
  return api.post<CampaignResponse>(
    "/api/campaigns",
    payload,
  );
}

export async function updateCampaign(
  id: string,
  payload: CreateCampaignPayload,
): Promise<CampaignResponse> {
  return api.put<CampaignResponse>(
    `/api/campaigns/${id}`,
    payload,
  );
}

export async function updateCampaignStatus(
  id: string,
  status: CampaignStatus,
): Promise<CampaignResponse> {
  return api.patch<CampaignResponse>(
    `/api/campaigns/${id}/status`,
    {
      status,
    },
  );
}

export async function getCampaignManagers(): Promise<{
  success: boolean;
  data: ManagerOption[];
}> {
  return api.get<{
    success: boolean;
    data: ManagerOption[];
  }>("/api/campaigns/managers");
}

export async function getCampaignLeadOptions(): Promise<{
  success: boolean;
  data: LeadOption[];
}> {
  return api.get<{
    success: boolean;
    data: LeadOption[];
  }>("/api/campaigns/lead-options");
}