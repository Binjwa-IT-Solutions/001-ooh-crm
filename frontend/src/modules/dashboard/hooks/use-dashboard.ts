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

/** Generic loader for the role dashboards (my day / HR / ops). */
export function useDashboardData<T>(loader: () => Promise<T>) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let ignore = false;
    loader()
      .then((result) => {
        if (!ignore) {
          setData(result);
          setError(null);
        }
      })
      .catch((err: unknown) => {
        if (!ignore) setError(err instanceof Error ? err.message : 'Could not load this section.');
      });
    return () => {
      ignore = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `loader` is a stable module function
  }, [version]);

  return { data, error, reload: useCallback(() => setVersion((v) => v + 1), []) };
}
