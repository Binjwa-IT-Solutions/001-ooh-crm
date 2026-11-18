import assert from 'node:assert/strict';
import test from 'node:test';

import { computeBalance, entitlement, type LeavePolicy } from './leave-balance.js';

const monthly1: LeavePolicy = { quotaPeriod: 'Monthly', quotaDays: 1, carryForward: false, maxCarryForward: 0, carryForwardExpiryMonths: null };
const yearly12: LeavePolicy = { ...monthly1, quotaPeriod: 'Yearly', quotaDays: 12 };

test('monthly quota accrues one month at a time', () => {
  // 18 Nov → Jan..Nov = 11 months
  const b = computeBalance({ policy: monthly1, year: 2026, asOf: new Date(2026, 10, 18), usedThisYear: 2, usedLastYear: 0 });
  assert.equal(b.accrued, 11);
  assert.equal(b.yearEntitlement, 12);
  assert.equal(b.balance, 9);
});

test('monthly quota starts from the joining month', () => {
  const b = computeBalance({
    policy: { ...monthly1, quotaDays: 1.5 },
    year: 2026,
    asOf: new Date(2026, 10, 18),
    joinedOn: new Date(2026, 7, 20), // August
    usedThisYear: 0,
    usedLastYear: 0,
  });
  assert.equal(b.accrued, 6); // Aug..Nov = 4 months × 1.5
});

test('yearly quota is prorated for mid-year joiners, rounded to half days', () => {
  assert.equal(entitlement(yearly12, 2026, new Date(2026, 6, 1)), 6); // July → 6 of 12 months
  assert.equal(entitlement({ ...yearly12, quotaDays: 15 }, 2026, new Date(2026, 9, 1)), 4); // 15 × 3/12 = 3.75 → 4
  assert.equal(entitlement(yearly12, 2026, new Date(2027, 0, 1)), 0); // joins next year
});

test('carry forward is capped and expires', () => {
  const policy: LeavePolicy = { ...yearly12, carryForward: true, maxCarryForward: 5, carryForwardExpiryMonths: 3 };

  const feb = computeBalance({ policy, year: 2026, asOf: new Date(2026, 1, 10), usedThisYear: 0, usedLastYear: 4 });
  assert.equal(feb.carriedForward, 5); // 12 - 4 = 8, capped at 5
  assert.equal(feb.carriedExpiresOn, '2026-03-31');
  assert.equal(feb.balance, 17);

  // After 31 March only the carried days already used still count
  const may = computeBalance({ policy, year: 2026, asOf: new Date(2026, 4, 1), usedThisYear: 2, usedLastYear: 4 });
  assert.equal(may.carriedExpired, true);
  assert.equal(may.allocated, 14); // 12 + 2 carried days used before 31 March
  assert.equal(may.balance, 12);

  // Leave taken AFTER the expiry can't use the expired carried days
  const late = computeBalance({ policy, year: 2026, asOf: new Date(2026, 10, 18), usedThisYear: 1, usedLastYear: 4, usedBeforeCarryExpiry: 0 });
  assert.equal(late.allocated, 12);
  assert.equal(late.balance, 11);
});

test('unlimited leave has no balance', () => {
  const b = computeBalance({ policy: { ...monthly1, quotaPeriod: 'Unlimited' }, year: 2026, usedThisYear: 7, usedLastYear: 0 });
  assert.equal(b.balance, null);
  assert.equal(b.used, 7);
});
