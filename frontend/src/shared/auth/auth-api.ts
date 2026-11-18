import { api } from '../api/client';
import type {
  AuthSessionResponse,
  AuthUser,
  LoginChallengeResponse,
  LoginStartResponse,
  LoginApprovalStatusResponse,
  LoginVerificationResponse,
  LoginLocation,
} from './types';

const DEVICE_ID_KEY = 'mo.loginDeviceId';

function getLoginDeviceId(): string | undefined {
  if (typeof window === 'undefined') return undefined;
  let deviceId = window.localStorage.getItem(DEVICE_ID_KEY);
  if (!deviceId) {
    deviceId = window.crypto.randomUUID();
    window.localStorage.setItem(DEVICE_ID_KEY, deviceId);
  }
  return deviceId;
}

/**
 * The auth endpoints. Sign-in is two steps:
 *   1. startLogin(email, password)  -> a challenge
 *   2. verifyOtp(challengeId, code) -> enrollment or a session
 */
export const authApi = {
  /** Sends a reset link if the account exists. Always resolves with the same message. */
  forgotPassword: (email: string) =>
    api.post<{ message: string; devResetUrl?: string }>(
      '/api/auth/forgot-password',
      { email },
      { skipAuth: true },
    ),

  /** Is this reset link still usable? */
  checkResetToken: (token: string) =>
    api.get<{ valid: boolean; email?: string }>(
      `/api/auth/reset-password/${encodeURIComponent(token)}`,
      { skipAuth: true },
    ),

  resetPassword: (token: string, password: string) =>
    api.post<{ message: string }>('/api/auth/reset-password', { token, password }, { skipAuth: true }),

  startLogin: (email: string, password: string, location: LoginLocation | null) =>
    api.post<LoginStartResponse>(
      '/api/auth/login',
      { email, password, deviceId: getLoginDeviceId(), location },
      { skipAuth: true },
    ),

  loginApprovalStatus: (approvalRequestId: string, pollToken: string) =>
    api.post<LoginApprovalStatusResponse>(
      `/api/auth/security/login-approvals/${approvalRequestId}/status`,
      { pollToken },
      { skipAuth: true },
    ),

  resendOtp: (challengeId: string) =>
    api.post<LoginChallengeResponse>('/api/auth/resend-otp', { challengeId }, { skipAuth: true }),

  verifyOtp: (challengeId: string, code: string) =>
    api.post<LoginVerificationResponse>(
      '/api/auth/verify-otp',
      { challengeId, code },
      { skipAuth: true },
    ),

  requestEmailFallback: (challengeId: string) =>
    api.post<LoginChallengeResponse>(
      '/api/auth/email-fallback',
      { challengeId },
      { skipAuth: true },
    ),

  completeMfaEnrollment: (enrollmentToken: string, code: string) =>
    api.post<AuthSessionResponse>(
      '/api/auth/complete-mfa-enrollment',
      { enrollmentToken, code },
      { skipAuth: true },
    ),

  me: () => api.get<{ user: AuthUser }>('/api/auth/me'),

  logout: (refreshToken: string | null) =>
    api.post<{ message: string }>('/api/auth/logout', refreshToken ? { refreshToken } : {}),
};
