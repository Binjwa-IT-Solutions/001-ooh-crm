import 'dotenv/config';

/**
 * Single place where environment variables are read.
 * Nothing else in the codebase should touch `process.env` directly.
 */

function required(name: string, fallbackInDev?: string): string {
  const value = process.env[name];
  if (value && value.trim() !== '') return value;

  if (fallbackInDev !== undefined && process.env.NODE_ENV !== 'production') {
    return fallbackInDev;
  }

  throw new Error(
    `Missing required environment variable: ${name}. Copy .env.example to .env and fill it in.`,
  );
}

function num(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function bool(name: string, fallback: boolean): boolean {
  const raw = process.env[name];
  if (raw === undefined) return fallback;
  return raw.toLowerCase() === 'true' || raw === '1';
}

const nodeEnv = process.env.NODE_ENV ?? 'development';
const isProduction = nodeEnv === 'production';

export const config = {
  nodeEnv,
  isProduction,
  port: num('PORT', 5000),

  mongoUri: required('MONGO_URI', 'mongodb://localhost:27017/media-octus-crm?retryWrites=false'),

  cors: {
    // Comma-separated list. "*" allows everything (fine for local dev only).
    origins: (process.env.CORS_ORIGINS ?? 'http://localhost:3000')
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
  },

  jwt: {
    secret: required('JWT_SECRET', 'dev-only-jwt-secret-change-me'),
    // Short-lived access token; the refresh token carries the long session.
    accessTokenTtl: process.env.JWT_ACCESS_TTL ?? '15m',
    refreshTokenTtlDays: num('JWT_REFRESH_TTL_DAYS', 7),
  },

  otp: {
    length: num('OTP_LENGTH', 6),
    ttlMinutes: num('OTP_TTL_MINUTES', 10),
    maxAttempts: num('OTP_MAX_ATTEMPTS', 5),
    // Seconds a user must wait before asking for a new code.
    resendCooldownSeconds: num('OTP_RESEND_COOLDOWN_SECONDS', 30),

    /**
     * How the code reaches the user.
     *   console — printed to the server log (development default, no email account needed)
     *   email   — sent through the configured email provider (Phase 2, see core/notifications)
     */
    delivery: (process.env.OTP_DELIVERY ?? 'console') as 'console' | 'email',

    /**
     * DEVELOPMENT ONLY. Returns the OTP in the HTTP response so the login screen can
     * display it and nobody has to wait for an inbox. Force-disabled in production —
     * see the guard below, which is deliberately not overridable by env.
     */
    exposeInResponse: !isProduction && bool('OTP_EXPOSE_IN_RESPONSE', true),
  },

  email: {
    // Placeholders for the real provider (Resend / SES / Postmark). See §8 of the roadmap.
    provider: process.env.EMAIL_PROVIDER ?? '',
    apiKey: process.env.EMAIL_API_KEY ?? '',
    from: process.env.EMAIL_FROM ?? 'Media Octus CRM <no-reply@example.com>',
  },

  storage: {
    /**
     * local — a folder on disk (development only)
     * s3    — Cloudflare R2 / Backblaze B2 (production; see core/files/s3-adapter.ts)
     *
     * Proof photos must never live on the VPS disk in production: it fills up,
     * and disk-based backups of a growing photo library become unmanageable.
     */
    driver: (process.env.STORAGE_DRIVER ?? 'local') as 'local' | 's3',
    localDir: process.env.STORAGE_LOCAL_DIR ?? 'storage',
    /** Where the API is reachable, used to build local file URLs. */
    publicBaseUrl: process.env.PUBLIC_BASE_URL ?? `http://localhost:${num('PORT', 5000)}`,
    maxUploadBytes: num('MAX_UPLOAD_MB', 15) * 1024 * 1024,

    bucket: process.env.STORAGE_BUCKET ?? '',
    region: process.env.STORAGE_REGION ?? '',
    endpoint: process.env.STORAGE_ENDPOINT ?? '',
    accessKeyId: process.env.STORAGE_ACCESS_KEY_ID ?? '',
    secretAccessKey: process.env.STORAGE_SECRET_ACCESS_KEY ?? '',
  },

  jobs: {
    /**
     * Off by default so seven developers running the app locally do not each
     * fire the nightly rollups. On in staging and production.
     */
    enabled: bool('JOBS_ENABLED', false),
    timezone: process.env.JOBS_TIMEZONE ?? 'Asia/Kolkata',
  },

  audit: {
    /** Turn the automatic mutation log off only for a specific debugging session. */
    enabled: bool('AUDIT_ENABLED', true),
  },

  pythonChatbot: {
    url: process.env.PYTHON_CHATBOT_URL ?? 'http://127.0.0.1:8000',
    timeoutMs: num('PYTHON_CHATBOT_TIMEOUT_MS', 60000),
  },
} as const;

export type AppConfig = typeof config;
