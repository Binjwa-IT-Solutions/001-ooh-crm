"use client";

import {
  useCallback,
  useEffect,
  useState,
} from "react";

import {
  createSite,
  getSites,
  updateSite,
} from "../api";

import type {
  CreateSiteData,
  Site,
  SiteFilters,
  UpdateSiteData,
} from "../types";

export function useSites(filters: SiteFilters = {}) {
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadSites = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const data = await getSites(filters);
      setSites(data);
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Failed to load ATR"
      );
    } finally {
      setLoading(false);
    }
  }, [
    filters.search,
    filters.state,
    filters.city,
    filters.vendorName,
    filters.salesPersonName,
    filters.mediaType,
    filters.availability,
    filters.status,
  ]);

  useEffect(() => {
    loadSites();
  }, [loadSites]);

  const addSite = async (data: CreateSiteData) => {
    try {
      setError("");
      await createSite(data);
      await loadSites();
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Failed to create ATR";

      setError(message);
      throw error;
    }
  };

  const editSite = async (
    id: string,
    data: UpdateSiteData
  ) => {
    try {
      setError("");

      await updateSite(id, data);
      await loadSites();
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Failed to update ATR";

      setError(message);
      throw error;
    }
  };

  return {
    sites,
    loading,
    error,
    reload: loadSites,
    addSite,
    editSite,
  };
}