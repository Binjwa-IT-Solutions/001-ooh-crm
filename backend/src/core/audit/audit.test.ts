import assert from 'node:assert/strict';
import test from 'node:test';

import { extractEntityId, parseTarget } from './audit-middleware.js';
import { diffFields } from './audit-service.js';
import { redact } from './redact.js';

// Pure logic only — no database needed.

test('redact masks secrets and statutory identifiers', () => {
  const masked = redact({
    name: 'Rukmini',
    password: 'hunter2',
    panNumber: 'ABCDE1234F',
    aadhaarNumber: '123456789012',
    bankAccountNumber: '00112233',
    refreshToken: 'abc',
  }) as Record<string, unknown>;

  assert.equal(masked.name, 'Rukmini', 'non-sensitive fields survive');
  for (const key of [
    'password',
    'panNumber',
    'aadhaarNumber',
    'bankAccountNumber',
    'refreshToken',
  ]) {
    assert.equal(masked[key], '[redacted]', `${key} must be masked`);
  }
});

test('redact is case-insensitive about key names', () => {
  const masked = redact({ PassWord: 'x', PANNumber: 'y' }) as Record<string, unknown>;
  assert.equal(masked.PassWord, '[redacted]');
  assert.equal(masked.PANNumber, '[redacted]');
});

test('redact masks MFA enrollment material', () => {
  const masked = redact({
    enrollmentToken: 'setup-token',
    secret: 'base32-secret',
    otpauthUrl: 'otpauth://totp/example?secret=base32-secret',
    totpCode: '123456',
    secondAdmin: { password: 'password', totpCode: '654321' },
  }) as Record<string, unknown>;

  assert.equal(masked.enrollmentToken, '[redacted]');
  assert.equal(masked.secret, '[redacted]');
  assert.equal(masked.otpauthUrl, '[redacted]');
  assert.equal(masked.totpCode, '[redacted]');
  assert.deepEqual(masked.secondAdmin, { password: '[redacted]', totpCode: '[redacted]' });
});

test('redact reaches into nested objects and arrays', () => {
  const masked = redact({
    user: { profile: { password: 'secret' } },
    people: [{ panNumber: 'ABCDE1234F' }],
  }) as Record<string, Record<string, Record<string, unknown>>>;

  assert.equal(masked.user.profile.password, '[redacted]');
  assert.equal(
    (masked.people as unknown as Array<Record<string, unknown>>)[0].panNumber,
    '[redacted]',
  );
});

test('redact caps long strings and large arrays', () => {
  const longString = redact('x'.repeat(5000)) as string;
  assert.ok(longString.length < 3000, 'a huge string must be truncated');

  const bigArray = redact(Array.from({ length: 500 }, (_, i) => i)) as unknown[];
  assert.equal(bigArray.length, 50, 'a huge array must be capped');
});

test('redact stops at a depth limit rather than recursing forever', () => {
  type Deep = { next?: Deep };
  const deep: Deep = {};
  let cursor = deep;
  for (let i = 0; i < 20; i += 1) {
    cursor.next = {};
    cursor = cursor.next;
  }
  assert.doesNotThrow(() => redact(deep));
});

test('diffFields returns only what actually changed', () => {
  const changes = diffFields(
    { status: 'New', city: 'Mumbai', budget: 100 },
    { status: 'Contacted', city: 'Mumbai', budget: 100 },
  );

  assert.equal(changes.length, 1);
  assert.deepEqual(changes[0], { field: 'status', from: 'New', to: 'Contacted' });
});

test('diffFields redacts sensitive values inside the diff', () => {
  const changes = diffFields({ panNumber: 'AAAAA1111A' }, { panNumber: 'BBBBB2222B' });
  assert.equal(changes[0].from, '[redacted]');
  assert.equal(changes[0].to, '[redacted]');
});

test('diffFields treats undefined and null as equal', () => {
  assert.equal(diffFields({ a: undefined }, { a: null }).length, 0);
});

test('parseTarget extracts the entity and the id from a path', () => {
  assert.deepEqual(parseTarget('/api/employees'), { entity: 'employees', entityId: null });
  assert.deepEqual(parseTarget('/api/employees/64b7f9a1c2d3e4f5a6b7c8d9'), {
    entity: 'employees',
    entityId: '64b7f9a1c2d3e4f5a6b7c8d9',
  });
  assert.deepEqual(parseTarget('/api/employees/64b7f9a1c2d3e4f5a6b7c8d9/reports'), {
    entity: 'employees',
    entityId: '64b7f9a1c2d3e4f5a6b7c8d9',
  });
});

test('parseTarget ignores the query string and non-id segments', () => {
  assert.deepEqual(parseTarget('/api/leads?status=New'), { entity: 'leads', entityId: null });
  assert.deepEqual(parseTarget('/api/employees/me'), { entity: 'employees', entityId: null });
});

test('extractEntityId finds the new id in a create response', () => {
  const id = '64b7f9a1c2d3e4f5a6b7c8d9';

  assert.equal(extractEntityId({ id }), id, 'top-level id');
  assert.equal(extractEntityId({ _id: id }), id, 'top-level _id');
  assert.equal(extractEntityId({ message: 'Created', employee: { id } }), id, 'nested envelope');
});

test('extractEntityId returns null rather than guessing', () => {
  assert.equal(extractEntityId(null), null);
  assert.equal(extractEntityId('a string'), null);
  assert.equal(extractEntityId({ message: 'ok' }), null);
  assert.equal(extractEntityId({ id: 'not-an-object-id' }), null);
  assert.equal(
    extractEntityId({ items: [{ id: '64b7f9a1c2d3e4f5a6b7c8d9' }] }),
    null,
    'arrays are not scanned',
  );
});
