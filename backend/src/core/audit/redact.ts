/**
 * Fields that must never be written to the audit log in clear text.
 *
 * The audit log is read by more people than the records it describes, and it is
 * never deleted. Anything secret or statutory gets masked on the way in — add to
 * this list when your module introduces a new sensitive field.
 */
const REDACTED_KEYS = new Set([
  'password',
  'passwordplain',
  'passwordhash',
  'approverpassword',
  'currentpassword',
  'newpassword',
  'token',
  'accesstoken',
  'refreshtoken',
  'enrollmenttoken',
  'polltoken',
  'code',
  'totpcode',
  'approvertotpcode',
  'otp',
  'devotp',
  'secret',
  'totpsecret',
  'totpsecretencrypted',
  'otpauthurl',
  'mfaenrollmentidhash',
  'aadhaarnumber',
  'pannumber',
  'bankaccountnumber',
  'ifsc',
]);

const MASK = '[redacted]';
const MAX_DEPTH = 6;

/** Deep-copies a value, replacing sensitive fields with a mask. */
export function redact(value: unknown, depth = 0): unknown {
  if (depth > MAX_DEPTH) return '[truncated]';
  if (value === null || value === undefined) return value;

  if (Array.isArray(value)) {
    // Cap the array so one bulk import cannot write a megabyte per entry.
    return value.slice(0, 50).map((item) => redact(item, depth + 1));
  }

  if (value instanceof Date) return value;

  if (typeof value === 'object') {
    const result: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
      result[key] = REDACTED_KEYS.has(key.toLowerCase()) ? MASK : redact(child, depth + 1);
    }
    return result;
  }

  if (typeof value === 'string' && value.length > 2000) {
    return `${value.slice(0, 2000)}…[truncated]`;
  }

  return value;
}

export function isRedactedKey(key: string): boolean {
  return REDACTED_KEYS.has(key.toLowerCase());
}
