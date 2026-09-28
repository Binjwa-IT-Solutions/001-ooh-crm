import assert from 'node:assert/strict';
import test from 'node:test';

import { AuthService } from './auth-service.js';
import {
  listUsersSchema,
  loginSchema,
  registerSchema,
  updateUserSchema,
  verifyOtpSchema,
} from './auth-validator.js';
import {
  permissionsForRole,
  roleHasPermission,
  ROLE_PERMISSIONS,
  ROLES,
} from '../rbac/permissions.js';

// These tests cover the pure logic only — no database required.
// Module tests that need Mongo belong in the module's own <name>.test.ts.

test('generateOtpCode creates a numeric 6-digit OTP', () => {
  const otp = AuthService.generateOtpCode();

  assert.equal(typeof otp, 'string');
  assert.equal(otp.length, 6);
  assert.match(otp, /^\d{6}$/);
});

test('generateOtpCode honours a custom length', () => {
  assert.equal(AuthService.generateOtpCode(4).length, 4);
  assert.equal(AuthService.generateOtpCode(8).length, 8);
});

test('generateOtpCode does not repeat itself', () => {
  const codes = new Set(Array.from({ length: 50 }, () => AuthService.generateOtpCode()));
  assert.ok(codes.size > 40, 'expected mostly distinct codes');
});

test('login validation rejects a malformed email', () => {
  assert.throws(() => loginSchema.parse({ email: 'not-an-email', password: 'secret' }));
  assert.doesNotThrow(() => loginSchema.parse({ email: 'a@b.com', password: 'secret' }));
});

test('login validation lowercases and trims the email', () => {
  const parsed = loginSchema.parse({
    email: '  Admin@MediaOctus.test ',
    password: 'secret',
  });
  assert.equal(parsed.email, 'admin@mediaoctus.test');
});

test('OTP validation accepts only numeric codes', () => {
  assert.doesNotThrow(() => verifyOtpSchema.parse({ challengeId: 'abc', code: '123456' }));
  assert.throws(() => verifyOtpSchema.parse({ challengeId: 'abc', code: '12ab56' }));
  assert.throws(() => verifyOtpSchema.parse({ challengeId: '', code: '123456' }));
});

test('register validation enforces a minimum password length', () => {
  assert.throws(() =>
    registerSchema.parse({
      name: 'Test User',
      email: 'a@b.com',
      password: 'short',
    }),
  );
});

test('register validation rejects an unknown role', () => {
  assert.throws(() =>
    registerSchema.parse({
      name: 'Test User',
      email: 'a@b.com',
      password: 'Password123!',
      role: 'superuser',
    }),
  );
});

test('register validation accepts valid role and status', () => {
  const parsed = registerSchema.parse({
    name: 'New Officer',
    email: 'officer@mediaoctus.test',
    password: 'Password123!',
    role: 'sales_agent',
    status: 'Active',
  });
  assert.equal(parsed.role, 'sales_agent');
  assert.equal(parsed.status, 'Active');
});

test('listUsers validation provides defaults', () => {
  const parsed = listUsersSchema.parse({});
  assert.equal(parsed.page, 1);
  assert.equal(parsed.pageSize, 10);
});

test('updateUser validation validates fields properly', () => {
  const parsed = updateUserSchema.parse({
    name: 'Updated Name',
    role: 'manager',
    status: 'Inactive',
  });
  assert.equal(parsed.name, 'Updated Name');
  assert.equal(parsed.role, 'manager');
  assert.equal(parsed.status, 'Inactive');
});

test('every role has an entry in the permission matrix', () => {
  for (const role of ROLES) {
    assert.ok(ROLE_PERMISSIONS[role], `no permissions declared for role "${role}"`);
  }
});

test('admin holds every permission and employee does not', () => {
  assert.ok(roleHasPermission('admin', 'finance.bank_details'));
  assert.equal(roleHasPermission('employee', 'finance.bank_details'), false);
  assert.equal(roleHasPermission('sales_agent', 'users.create'), false);
});

test('an unknown role gets no permissions rather than throwing', () => {
  assert.deepEqual(permissionsForRole('not-a-role'), []);
});


