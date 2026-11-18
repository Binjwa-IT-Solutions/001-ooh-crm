import type { ILeaveType, QuotaPeriod } from '../models/leave.model.js';

/**
 * LEAVE BALANCE RULES — pure functions, no database.
 *
 *  Monthly  — quotaDays credited on the 1st of every month, from the month the
 *             person joined (or January) up to the month we're asking about.
 *  Yearly   — quotaDays for the year; someone joining mid-year gets the share for
 *             the months left (rounded to half days).
 *  Unlimited— no balance (always allowed).
 *
 *  Carry forward — unused days of last year (its full-year entitlement minus what
 *  was used), capped at maxCarryForward (0 = no cap). If carryForwardExpiryMonths
 *  is set, carried days can only be used until the end of that month of the new
 *  year; after that only the carried days used *before* that date still count
 *  (leave taken before the expiry is assumed to use carried days first).
 */

export interface LeavePolicy {
  quotaPeriod: QuotaPeriod;
  quotaDays: number;
  carryForward: boolean;
  maxCarryForward: number;
  carryForwardExpiryMonths: number | null;
}

export interface ComputedBalance {
  quotaPeriod: QuotaPeriod;
  quotaDays: number;
  /** Credited so far this year (as of the given date). null = unlimited. */
  accrued: number | null;
  /** What the year will add up to by December. null = unlimited. */
  yearEntitlement: number | null;
  carriedForward: number;
  /** Last day carried days can be used (ISO), or null when they don't expire / none carried. */
  carriedExpiresOn: string | null;
  carriedExpired: boolean;
  /** accrued + usable carried days. null = unlimited. */
  allocated: number | null;
  used: number;
  /** null = unlimited */
  balance: number | null;
}

/** Reads the policy from a leave type, filling in older documents created before monthly quotas existed. */
export function policyOf(type: Pick<ILeaveType, 'annualQuota' | 'carryForward' | 'maxCarryForward'> & Partial<ILeaveType>): LeavePolicy {
  const quotaPeriod: QuotaPeriod = type.quotaPeriod ?? (type.annualQuota == null ? 'Unlimited' : 'Yearly');
  return {
    quotaPeriod,
    quotaDays: type.quotaDays ?? type.annualQuota ?? 0,
    carryForward: Boolean(type.carryForward),
    maxCarryForward: type.maxCarryForward ?? 0,
    carryForwardExpiryMonths: type.carryForwardExpiryMonths ?? null,
  };
}

const halfDay = (n: number) => Math.round(n * 2) / 2;

/** Days credited in `year`, counting months up to and including `throughMonth` (0–11). */
export function entitlement(
  policy: LeavePolicy,
  year: number,
  joinedOn: Date | null | undefined,
  throughMonth = 11,
): number | null {
  if (policy.quotaPeriod === 'Unlimited') return null;

  let firstMonth = 0;
  if (joinedOn) {
    const jy = joinedOn.getFullYear();
    if (jy > year) return 0;
    if (jy === year) firstMonth = joinedOn.getMonth();
  }
  if (throughMonth < firstMonth) return 0;

  if (policy.quotaPeriod === 'Monthly') {
    return halfDay(policy.quotaDays * (throughMonth - firstMonth + 1));
  }
  // Yearly: full quota, prorated for a mid-year joiner. Not accrued — available up front.
  return halfDay((policy.quotaDays * (12 - firstMonth)) / 12);
}

export function computeBalance(params: {
  policy: LeavePolicy;
  year: number;
  /** Credit up to this date (defaults to today; future years credit through December). */
  asOf?: Date;
  joinedOn?: Date | null;
  usedThisYear: number;
  usedLastYear: number;
  /** Days taken this year on or before the carry-forward expiry date. Defaults to usedThisYear. */
  usedBeforeCarryExpiry?: number;
}): ComputedBalance {
  const { policy, year, joinedOn, usedThisYear, usedLastYear } = params;
  const usedBeforeExpiry = Math.min(params.usedBeforeCarryExpiry ?? usedThisYear, usedThisYear);
  const asOf = params.asOf ?? new Date();

  const throughMonth = asOf.getFullYear() > year ? 11 : asOf.getFullYear() < year ? -1 : asOf.getMonth();
  const accrued = throughMonth < 0 ? (policy.quotaPeriod === 'Unlimited' ? null : 0) : entitlement(policy, year, joinedOn, throughMonth);
  const yearEntitlement = entitlement(policy, year, joinedOn, 11);

  // Carry forward from last year
  let carried = 0;
  let expiresOn: Date | null = null;
  if (policy.carryForward && policy.quotaPeriod !== 'Unlimited') {
    const lastYear = entitlement(policy, year - 1, joinedOn, 11) ?? 0;
    carried = Math.max(0, lastYear - usedLastYear);
    if (policy.maxCarryForward > 0) carried = Math.min(carried, policy.maxCarryForward);
    if (carried > 0 && policy.carryForwardExpiryMonths) {
      expiresOn = new Date(year, policy.carryForwardExpiryMonths, 0); // last day of month N
    }
  }
  const expired = expiresOn != null && asOf > new Date(expiresOn.getFullYear(), expiresOn.getMonth(), expiresOn.getDate(), 23, 59, 59);
  const usableCarried = expired ? Math.min(carried, usedBeforeExpiry) : carried;

  if (accrued == null) {
    return {
      quotaPeriod: policy.quotaPeriod,
      quotaDays: policy.quotaDays,
      accrued: null,
      yearEntitlement: null,
      carriedForward: 0,
      carriedExpiresOn: null,
      carriedExpired: false,
      allocated: null,
      used: usedThisYear,
      balance: null,
    };
  }

  const allocated = halfDay(accrued + usableCarried);
  return {
    quotaPeriod: policy.quotaPeriod,
    quotaDays: policy.quotaDays,
    accrued,
    yearEntitlement,
    carriedForward: carried,
    carriedExpiresOn: expiresOn ? toIsoDay(expiresOn) : null,
    carriedExpired: expired,
    allocated,
    used: usedThisYear,
    balance: halfDay(allocated - usedThisYear),
  };
}

function toIsoDay(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
