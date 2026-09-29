import { api } from '../api/client';
import type { AuthUser } from '../auth/types';

export interface UpdateProfileInput {
  name?: string;
  phone?: string;
  designation?: string;
  gender?: 'Male' | 'Female';
}

export const profileApi = {
  getProfile: () => api.get<{ user: AuthUser }>('/api/profile/me'),
  updateProfile: (data: UpdateProfileInput) =>
    api.patch<{ message: string; user: AuthUser }>('/api/profile/me', data),
};
