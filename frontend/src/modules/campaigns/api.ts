import type {
  CampaignFilters,
  CampaignListResponse,
  CampaignResponse,
  CampaignStatus,
  CreateCampaignPayload,
} from "./types";

import { api } from "@/shared/api/client";

function buildQuery(filters: CampaignFilters): string {
  const params = new URLSearchParams();

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