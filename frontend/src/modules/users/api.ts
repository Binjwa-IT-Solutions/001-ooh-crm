import { api } from '@/shared/api/client';

import type {
  User,
  UserDeviceAndSessions,
  UserFormValues,
  UserListQuery,
  UserListResponse,
} from './types';

function buildQuery(query: UserListQuery): string {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(query)) {
    if (value === undefined || value === null || value === '') continue;
    params.set(key, String(value));
  }

  const queryString = params.toString();
  return queryString ? `?${queryString}` : '';
}

export const usersApi = {
  list: (query: UserListQuery = {}) =>
    api.get<UserListResponse>(`/api/auth/users${buildQuery(query)}`),

  getById: (id: string) => api.get<{ user: User }>(`/api/auth/users/${id}`).then((res) => res.user),

  create: (values: Omit<UserFormValues, 'confirmPassword'>) =>
    api
      .post<{ message: string; user: User }>('/api/auth/users', {
        name: values.name.trim(),
        email: values.email.trim().toLowerCase(),
        password: values.password,
        role: values.role,
        status: values.status,
        reportingManagerId: values.reportingManagerId || undefined,
      })
      .then((res) => res.user),

  update: (
    id: string,
    values: Partial<{
      name: string;
      role: string;
      status: string;
      password?: string;
      reportingManagerId?: string | null;
    }>,
  ) =>
    api
      .patch<{ message: string; user: User }>(`/api/auth/users/${id}`, values)
      .then((res) => res.user),

  resetPassword: (id: string, password: string) =>
    api
      .patch<{ message: string; user: User }>(`/api/auth/users/${id}`, { password })
      .then((res) => res.user),

  resetMfa: (
    id: string,
    input: {
      password: string;
      totpCode: string;
      reason: string;
      secondAdmin?: { email: string; password: string; totpCode: string };
    },
  ) =>
    api.post<{ message: string; user: User; revokedSessions: number }>(
      `/api/auth/users/${id}/reset-mfa`,
      input,
    ),

  setStatus: (id: string, status: 'Active' | 'Inactive') =>
    api
      .patch<{ message: string; user: User }>(`/api/auth/users/${id}`, { status })
      .then((res) => res.user),

  deactivate: (id: string) => api.delete<{ message: string; id: string }>(`/api/auth/users/${id}`),

  getDeviceAndSessions: (id: string) =>
    api.get<UserDeviceAndSessions>(`/api/auth/users/${id}/security`),

  revokeSessions: (id: string) =>
    api.post<{ message: string; revokedSessions: number }>(
      `/api/auth/users/${id}/revoke-sessions`,
      {},
    ),

  removeDevice: (id: string) =>
    api.post<{ message: string; removedDevices: number; revokedSessions: number }>(
      `/api/auth/users/${id}/remove-device`,
      {},
    ),
};
