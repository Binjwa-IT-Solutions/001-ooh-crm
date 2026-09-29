import { api } from "@/shared/api/client";

import type {
  CreateSiteData,
  Site,
  SiteFilters,
  UpdateSiteData,
} from "./types";

interface SitesResponse {
  success: boolean;
  count?: number;
  data: Site[];
  message?: string;
}

interface SiteResponse {
  success: boolean;
  data: Site;
  message?: string;
}

function buildQuery(filters: SiteFilters): string {
  const params = new URLSearchParams();

  if (filters.search?.trim()) {
    params.set(
      "search",
      filters.search.trim()
    );
  }

  if (filters.state?.trim()) {
    params.set(
      "state",
      filters.state.trim()
    );
  }

  if (filters.city?.trim()) {
    params.set(
      "city",
      filters.city.trim()
    );
  }

  if (filters.vendorName?.trim()) {
    params.set(
      "vendorName",
      filters.vendorName.trim()
    );
  }

  if (filters.salesPersonName?.trim()) {
    params.set(
      "salesPersonName",
      filters.salesPersonName.trim()
    );
  }

  if (filters.mediaType) {
    params.set(
      "mediaType",
      filters.mediaType
    );
  }

  if (filters.availability) {
    params.set(
      "availability",
      filters.availability
    );
  }

  if (filters.status) {
    params.set(
      "status",
      filters.status
    );
  }

  const query = params.toString();

  return query ? `?${query}` : "";
}

export async function getSites(
  filters: SiteFilters = {}
): Promise<Site[]> {
  const result =
    await api.get<SitesResponse>(
      `/api/sites${buildQuery(filters)}`
    );

  return result.data || [];
}

export async function getSite(
  id: string
): Promise<Site> {
  const result =
    await api.get<SiteResponse>(
      `/api/sites/${id}`
    );

  return result.data;
}

export async function createSite(
  data: CreateSiteData
): Promise<Site> {
  const result =
    await api.post<SiteResponse>(
      "/api/sites",
      data
    );

  return result.data;
}

export async function updateSite(
  id: string,
  data: UpdateSiteData
): Promise<Site> {
  const result =
    await api.patch<SiteResponse>(
      `/api/sites/${id}`,
      data
    );

  return result.data;
}

export async function importSites(
  csv: string
) {
  return api.post<{
    success: boolean;
    message: string;
    count?: number;
  }>("/api/sites/import", { csv });
}

export async function bulkImport(
  payload: CreateSiteData[]
) {
  try {
    return await api.post<{
      imported: number;
      errors: string[];
    }>("/api/sites/bulk", {
      items: payload,
    });
  } catch (error) {
    return {
      imported: 0,
      errors: [
        error instanceof Error
          ? error.message
          : "Failed to import",
      ],
    };
  }
}

export const sitesApi = {
  getSites,
  getSite,
  createSite,
  updateSite,
  importSites,
  bulkImport,
};