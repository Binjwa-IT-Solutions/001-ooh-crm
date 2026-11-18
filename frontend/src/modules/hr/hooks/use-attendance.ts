import { useState, useEffect, useCallback } from 'react';
import { attendanceApi } from '../api';
import { Attendance } from '../types';

export function useMyAttendance(filters?: Record<string, any>) {
  const [data, setData] = useState<Attendance[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Refetch only when the filter values change — depending on `data` here caused an endless refetch loop.
  const filtersKey = JSON.stringify(filters ?? {});

  const fetchData = useCallback(async () => {
    try {
      const res = await attendanceApi.getMyAttendance(JSON.parse(filtersKey));
      setData(res);
      setError(null);
    } catch (err: any) {
      setError(err);
    } finally {
      setIsLoading(false);
    }
  }, [filtersKey]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  return {
    data,
    isLoading,
    error,
    mutate: fetchData,
  };
}

export function useMyAttendanceSummary(month: number, year: number) {
  const [data, setData] = useState<{
    records: (Attendance & { regularHours?: number; overtime?: number })[];
    stats: { presentCount: number; absentCount: number; leaveHalfCount: number; totalWorkHours: number; };
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await attendanceApi.getMyAttendanceSummary(month, year);
      setData(res);
      setError(null);
    } catch (err: any) {
      setError(err);
    } finally {
      setIsLoading(false);
    }
  }, [month, year]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  return {
    data,
    isLoading,
    error,
    mutate: fetchData,
  };
}

export function useTeamAttendance(filters?: Record<string, any>) {
  const [data, setData] = useState<Attendance[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  // Refetch only when the filter values actually change (not on every render / every response)
  const filtersKey = JSON.stringify(filters ?? {});

  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await attendanceApi.getTeamAttendance(JSON.parse(filtersKey));
      setData(res);
      setError(null);
    } catch (err: any) {
      setError(err);
    } finally {
      setIsLoading(false);
    }
  }, [filtersKey]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  return {
    data,
    isLoading,
    error,
    mutate: fetchData,
  };
}
