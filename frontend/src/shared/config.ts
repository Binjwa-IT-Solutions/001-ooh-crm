/**
 * Frontend configuration. Everything comes from NEXT_PUBLIC_* env vars —
 * see .env.example.
 *
 * In development, NEXT_PUBLIC_API_URL is left empty so all /api/* requests
 * go through the Next.js rewrite proxy defined in next.config.ts → backend:5000.
 * In production, set NEXT_PUBLIC_API_URL to the deployed backend URL.
 */
export const appConfig = {
  apiUrl: (process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:5000').replace(/\/$/, ''),
  appName: 'Media Octus CRM',
} as const;
