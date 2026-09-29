import { useCallback, useEffect, useState } from "react";
import {
  getVendors,
  getVendor,
  getVendorFilters,
  createVendor,
  updateVendor,
  deactivateVendor,
  getVendorSites,
  type VendorFilters,
} from "../api";

import type { Vendor, VendorFormData, VendorSite } from "../types";

export const useVendors = () => {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [filters, setFilters] = useState<VendorFilters>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sites, setSites] = useState<VendorSite[]>([]);

  const loadVendors = useCallback(async (currentFilters: VendorFilters = filters) => {
    setLoading(true);
    setError(null);

    try {
      const res = await getVendors(currentFilters);
      setVendors(res.data || []);
    } catch (err: any) {
      setError(err?.message || "Failed to load vendors");
    } finally {
      setLoading(false);
    }
  }, [filters]);

  const loadFilters = async () => {
    return getVendorFilters();
  };

  const addVendor = async (data: VendorFormData): Promise<boolean> => {
    setSaving(true);
    setError(null);
    try {
      await createVendor(data);
      await loadVendors();
      return true;
    } catch (err: any) {
      setError(err?.message || "Failed to create vendor");
      return false;
    } finally {
      setSaving(false);
    }
  };

  const editVendor = async (id: string, data: Partial<VendorFormData>): Promise<boolean> => {
    setSaving(true);
    setError(null);
    try {
      await updateVendor(id, data);
      await loadVendors();
      return true;
    } catch (err: any) {
      setError(err?.message || "Failed to update vendor");
      return false;
    } finally {
      setSaving(false);
    }
  };

  const deactivate = async (id: string) => {
    setSaving(true);
    setError(null);
    try {
      await deactivateVendor(id);
      await loadVendors();
    } catch (err: any) {
      setError(err?.message || "Failed to deactivate vendor");
    } finally {
      setSaving(false);
    }
  };

  const getSites = async (id: string) => {
    const res = await getVendorSites(id);
    setSites(res.data || []);
    return res.data || [];
  };

  const applyFilters = async (newFilters: VendorFilters) => {
    setFilters(newFilters);
    await loadVendors(newFilters);
  };

  const clearFilters = async () => {
    setFilters({});
    await loadVendors({});
  };

  useEffect(() => {
    loadVendors({});
  }, []);

  return {
    vendors,
    filters,
    loading,
    saving,
    error,
    sites,
    loadVendors,
    loadFilters,
    addVendor,
    editVendor,
    deactivate,
    getSites,
    applyFilters,
    clearFilters,
  };
};

export const useVendor = (id: string) => {
  const [vendor, setVendor] = useState<Vendor | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchVendor = useCallback(async () => {
    if (!id) return;
    setIsLoading(true);
    setError(null);
    try {
      const res = await getVendor(id);
      setVendor(res.data || null);
    } catch (err: any) {
      setError(err?.message || "Failed to load vendor");
    } finally {
      setIsLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchVendor();
  }, [fetchVendor]);

  return { vendor, isLoading, error, refetch: fetchVendor };
};