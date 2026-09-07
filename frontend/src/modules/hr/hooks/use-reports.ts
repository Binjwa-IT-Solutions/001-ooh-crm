import { useState, useCallback } from 'react';
import { reportsApi } from '../api';
import { Attendance, MonthlyRegisterRow, AbsenceRow } from '../types';

export function useDailySummary() {
  const [data, setData] = useState<Attendance[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchReport = useCallback(async (date: string) => {
    setIsLoading(true);
    try {
      const res = await reportsApi.getDailySummary(date);
      setData(res);
      setError(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err : new Error(String(err)));
      setData(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { data, isLoading, error, fetchReport };
}

export function useLateReport() {
  const [data, setData] = useState<Attendance[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchReport = useCallback(async (fromDate: string, toDate: string) => {
    setIsLoading(true);
    try {
      const res = await reportsApi.getLateReport(fromDate, toDate);
      setData(res);
      setError(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err : new Error(String(err)));
      setData(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { data, isLoading, error, fetchReport };
}

export function useMonthlyRegister() {
  const [data, setData] = useState<MonthlyRegisterRow[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchReport = useCallback(async (fromMonth: number, fromYear: number, toMonth?: number, toYear?: number) => {
    setIsLoading(true);
    try {
      const res = await reportsApi.getMonthlyRegister(fromMonth, fromYear, toMonth, toYear);
      setData(res as MonthlyRegisterRow[]);
      setError(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err : new Error(String(err)));
      setData(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { data, isLoading, error, fetchReport };
}

export function useAbsenceReport() {
  const [data, setData] = useState<AbsenceRow[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const fetchReport = useCallback(async (fromDate: string, toDate: string) => {
    setIsLoading(true);
    try {
      const res = await reportsApi.getAbsenceReport(fromDate, toDate);
      setData(res as AbsenceRow[]);
      setError(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err : new Error(String(err)));
      setData(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { data, isLoading, error, fetchReport };
}
