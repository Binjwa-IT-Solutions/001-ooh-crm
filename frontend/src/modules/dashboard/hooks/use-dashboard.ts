'use client';

import { useState, useEffect, useCallback } from 'react';
import { dashboardApi } from '../api';
import type { AdminDashboardData } from '../types';

export function useAdminDashboard() {
  const [data, setData] = useState<AdminDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchOverview = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await dashboardApi.getOverview();
      setData(result);
    } catch (err: unknown) {
      console.error('Failed to load admin dashboard overview:', err);
      const message = err instanceof Error ? err.message : 'Failed to load dashboard data. Please try again.';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let ignore = false;
    async function load() {
      try {
        const result = await dashboardApi.getOverview();
        if (!ignore) {
          setData(result);
          setLoading(false);
        }
      } catch (err: unknown) {
        if (!ignore) {
          console.error('Failed to load admin dashboard overview:', err);
          const message = err instanceof Error ? err.message : 'Failed to load dashboard data.';
          setError(message);
          setLoading(false);
        }
      }
    }
    load();
    return () => {
      ignore = true;
    };
  }, []);

  return {
    data,
    loading,
    error,
    refresh: fetchOverview,
  };
}
