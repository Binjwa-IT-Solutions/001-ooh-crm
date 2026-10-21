import { api } from '../api/client';

export interface PendingLoginApproval {
  id: string;
  expiresAt: string;
  requestedAt: string;
  user: { id: string; name: string; email: string; role: string } | null;
  login: {
    location: { latitude: number; longitude: number; accuracyMeters: number } | null;
    distanceFromBaselineMeters: number | null;
    userAgent: string;
    riskReasons: string[];
    createdAt: string;
    deviceTag: string | null;
  } | null;
}

export interface LoginSecurityEvent {
  id: string;
  email: string;
  user: { name: string; email: string; role: string } | null;
  location: { latitude: number; longitude: number; accuracyMeters: number } | null;
  distanceFromBaselineMeters: number | null;
  userAgent: string;
  hasDeviceId: boolean;
  deviceTag: string | null;
  riskLevel: 'low' | 'high';
  riskReasons: string[];
  outcome: 'pending' | 'approved' | 'denied' | 'verified' | 'failed';
  createdAt: string;
}

export const securityApi = {
  listLoginEvents: () =>
    api.get<{ events: LoginSecurityEvent[] }>('/api/auth/security/login-events'),

  listLoginApprovals: () =>
    api.get<{ approvals: PendingLoginApproval[] }>('/api/auth/security/login-approvals'),

  decideLoginApproval: (
    id: string,
    input: {
      decision: 'approve' | 'deny';
      totpCode: string;
      note: string;
    },
  ) => api.post<{ message: string }>(`/api/auth/security/login-approvals/${id}/decision`, input),
};
