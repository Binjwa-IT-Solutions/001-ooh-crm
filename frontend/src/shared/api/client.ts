import { appConfig } from '../config';
import { sessionStore } from '../auth/session-store';
import { ApiError, type ApiErrorDetail } from './errors';

/**
 * The one HTTP client every module uses. Do not call `fetch` directly from a
 * component — go through here so you get the access token, the shared error
 * shape, and automatic refresh on an expired token.
 *
 *   const leads = await api.get<Lead[]>('/api/leads');
 */

interface RequestOptions {
  /** Skip the Authorization header (used by the login endpoints themselves). */
  skipAuth?: boolean;
  /** Internal: prevents an infinite refresh loop. */
  skipRefresh?: boolean;
  signal?: AbortSignal;
}

/** Called when the session is beyond saving, so the app can send the user to /login. */
let onSessionExpired: (() => void) | null = null;

export function setSessionExpiredHandler(handler: (() => void) | null) {
  onSessionExpired = handler;
}

// Concurrent 401s share a single refresh request instead of firing several.
let refreshInFlight: Promise<boolean> | null = null;

async function parseError(response: Response): Promise<ApiError> {
  let code = 'HTTP_ERROR';
  let message = `Request failed with status ${response.status}`;
  let details: ApiErrorDetail[] | undefined;

  try {
    const body = await response.json();
    if (body?.error) {
      code = body.error.code ?? code;
      message = body.error.message ?? message;
      details = body.error.details;
    } else if (body?.message) {
      message = body.message;
    }
  } catch {
    // Non-JSON response (a proxy error page, say) — keep the generic message.
  }

  return new ApiError(response.status, code, message, details);
}

async function refreshAccessToken(): Promise<boolean> {
  const refreshToken = sessionStore.getRefreshToken();
  if (!refreshToken) return false;

  try {
    const response = await fetch(`${appConfig.apiUrl}/api/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });

    if (!response.ok) return false;

    const session = await response.json();
    sessionStore.save({
      accessToken: session.accessToken,
      refreshToken: session.refreshToken,
      user: session.user,
    });
    return true;
  } catch {
    return false;
  }
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  options: RequestOptions = {},
): Promise<T> {
  const headers: Record<string, string> = {};
  const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;

  if (body !== undefined && !isFormData) {
    headers['Content-Type'] = 'application/json';
  }



  if (!options.skipAuth) {
    const accessToken = sessionStore.getAccessToken();
    if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  }

  const response = await fetch(`${appConfig.apiUrl}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : isFormData ? (body as BodyInit) : JSON.stringify(body),
    signal: options.signal,
  });

  // Access token expired — refresh once, then replay the request.
  if (response.status === 401 && !options.skipAuth && !options.skipRefresh) {
    refreshInFlight ??= refreshAccessToken().finally(() => {
      refreshInFlight = null;
    });

    const refreshed = await refreshInFlight;

    if (refreshed) {
      return request<T>(method, path, body, { ...options, skipRefresh: true });
    }

    sessionStore.clear();
    onSessionExpired?.();
    throw await parseError(response);
  }

  if (!response.ok) throw await parseError(response);

  if (response.status === 204) return undefined as T;

  return (await response.json()) as T;
}

export const api = {
  get: <T>(path: string, options?: RequestOptions) => request<T>('GET', path, undefined, options),
  getBlob: async (path: string, options?: RequestOptions): Promise<Blob> => {
    const headers: Record<string, string> = {};
    if (!options?.skipAuth) {
      const accessToken = sessionStore.getAccessToken();
      if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
    }
    const fullUrl = path.startsWith('http') ? path : `${appConfig.apiUrl}${path}`;
    const response = await fetch(fullUrl, {
      method: 'GET',
      headers,
      signal: options?.signal,
    });
    if (!response.ok) throw await parseError(response);
    return await response.blob();
  },
  post: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>('POST', path, body, options),
  patch: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>('PATCH', path, body, options),
  put: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>('PUT', path, body, options),
  delete: <T>(path: string, options?: RequestOptions) =>
    request<T>('DELETE', path, undefined, options),
};
