"use client";

import { useCallback, useEffect, useState } from "react";

import {
  getSites,
  createSite,
  updateSite,
} from "../api";

import type {
  CreateSiteData,
  Site,
  SiteFilters,
} from "../types";

export function useSites(
  filters?: SiteFilters
) {
  const [sites, setSites] = useState<Site[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadSites = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const data = await getSites();

      setSites(data);
    } catch (err: any) {
      setSites([]);

      setError(
        err?.message ||
          "Failed to load sites."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSites();
  }, [loadSites]);

  const addSite = async (
    data: CreateSiteData
  ) => {
    try {
      setError("");

      await createSite(data);

      await loadSites();
    } catch (err: any) {
      const message =
        err?.message ||
        "Failed to create site.";

      setError(message);
      throw err;
    }
  };

  const editSite = async (
    id: string,
    data: Partial<CreateSiteData>
  ) => {
    try {
      setError("");

      await updateSite(id, data);

      await loadSites();
    } catch (err: any) {
      const message =
        err?.message ||
        "Failed to update site.";

      setError(message);
      throw err;
    }
  };

  return {
    sites,
    loading,
    error,
    loadSites,
    addSite,
    editSite,
  };
}