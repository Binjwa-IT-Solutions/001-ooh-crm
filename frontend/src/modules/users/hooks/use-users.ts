'use client';

import { useCallback, useEffect, useState } from 'react';

import { toErrorMessage } from '@/shared/api/errors';

import { usersApi } from '../api';
import type { UserListQuery, UserListResponse } from '../types';

export function useUserList(query: UserListQuery = {}) {
  const [data, setData] = useState<UserListResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);

  const reload = useCallback(() => {
    setVersion((v) => v + 1);
  }, []);

  const search = query.search;
  const role = query.role;
  const status = query.status;
  const page = query.page;
  const pageSize = query.pageSize;

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setError(null);

    usersApi
      .list({ search, role, status, page, pageSize })
      .then((res) => {
        if (!cancelled) {
          setData(res);
          setIsLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setError(toErrorMessage(err));
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [search, role, status, page, pageSize, version]);

  return { data, isLoading, error, reload };
}
