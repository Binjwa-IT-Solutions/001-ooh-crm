/* eslint-disable react-hooks/set-state-in-effect */
import { useState, useEffect, useCallback } from 'react';
import { leaveApi, holidayApi } from '../api';
import { LeaveType, LeaveRequest, LeaveBalance, Holiday } from '../types';
import { employeesApi } from '@/modules/employees/api';

export function useLeaveTypes() {
  const [data, setData] = useState<LeaveType[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const res = await leaveApi.getLeaveTypes();
      setData(res);
      setError(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  return { data, isLoading, error, mutate: fetchData };
}

export function useLeaveBalance() {
  const [data, setData] = useState<LeaveBalance[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true);
      const employee = await employeesApi.getMine().catch(() => null);
      const res = await leaveApi.getBalance(employee?.id);
      setData(res);
      setError(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  return { data, isLoading, error, mutate: fetchData };
}

export function useMyLeaveRequests(status?: string) {
  const [data, setData] = useState<LeaveRequest[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await leaveApi.getMyRequests(status);
      setData(res);
      setError(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setIsLoading(false);
    }
  }, [status]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  return { data, isLoading, error, mutate: fetchData };
}

export function useTeamLeaveRequests(status?: string) {
  const [data, setData] = useState<LeaveRequest[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await leaveApi.getTeamRequests(status);
      setData(res);
      setError(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setIsLoading(false);
    }
  }, [status]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  return { data, isLoading, error, mutate: fetchData };
}

export function useHolidays() {
  const [data, setData] = useState<Holiday[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const res = await holidayApi.getHolidays();
      setData(res);
      setError(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  return { data, isLoading, error, mutate: fetchData };
}

export function useCalendarLeaves(year?: number, month?: number) {
  const [data, setData] = useState<LeaveRequest[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await leaveApi.getCalendarLeaves(year, month);
      setData(res);
      setError(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setIsLoading(false);
    }
  }, [year, month]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  return { data, isLoading, error, mutate: fetchData };
}


