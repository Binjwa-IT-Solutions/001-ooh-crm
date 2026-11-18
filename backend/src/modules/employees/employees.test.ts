import assert from 'node:assert/strict';
import test from 'node:test';

import { permissionsForRole } from '../../core/rbac/permissions.js';
import { DEPARTMENTS, EMPLOYEE_STATUSES, SENSITIVE_FIELDS } from './employees.model.js';
import {
  createEmployeeSchema,
  listEmployeesSchema,
  updateEmployeeSchema,
} from './employees.validator.js';

/**
 * REFERENCE MODULE — tests.
 *
 * These cover the pure logic: validation, the money boundary, and the
 * permission wiring. They need no database, so they run in milliseconds and
 * nobody can skip them because "Mongo wasn't up".
 *
 * Test the rules that would actually hurt if they broke, not every getter.
 */

const validEmployee = {
  fullName: 'Rukmini Desai',
  workEmail: 'rukmini@mediaoctus.test',
  mobile: '9876543210',
  department: 'Sales',
  designation: 'Account Executive',
  dateOfJoining: '2026-01-15',
  workLocation: 'Mumbai',
};

// ------------------------------------------------------------- validation

test('a valid employee passes validation', () => {
  const parsed = createEmployeeSchema.parse(validEmployee);
  assert.equal(parsed.fullName, 'Rukmini Desai');
  assert.equal(parsed.employmentType, 'Full-time', 'employmentType should default');
  assert.equal(parsed.status, 'Active', 'status should default');
});

test('required fields are actually required', () => {
  for (const field of ['fullName', 'workEmail', 'mobile', 'department', 'dateOfJoining']) {
    const incomplete = { ...validEmployee } as Record<string, unknown>;
    delete incomplete[field];
    assert.throws(
      () => createEmployeeSchema.parse(incomplete),
      `expected "${field}" to be required`,
    );
  }
});

test('employeeCode sent by the client is ignored, never trusted', () => {
  const parsed = createEmployeeSchema.parse({ ...validEmployee, employeeCode: 'MO-EMP-9999' });
  assert.equal(
    (parsed as Record<string, unknown>).employeeCode,
    undefined,
    'the server generates the code; a client-supplied one must be dropped',
  );
});

test('an unknown department is rejected', () => {
  assert.throws(() => createEmployeeSchema.parse({ ...validEmployee, department: 'Legal' }));
});

test('mobile must be a valid Indian number', () => {
  assert.throws(() => createEmployeeSchema.parse({ ...validEmployee, mobile: '1234567890' }));
  assert.throws(() => createEmployeeSchema.parse({ ...validEmployee, mobile: '98765' }));
  assert.doesNotThrow(() => createEmployeeSchema.parse({ ...validEmployee, mobile: '6000000000' }));
});

test('PAN, Aadhaar and IFSC formats are enforced', () => {
  assert.doesNotThrow(() =>
    createEmployeeSchema.parse({
      ...validEmployee,
      panNumber: 'ABCDE1234F',
      aadhaarNumber: '123456789012',
      ifsc: 'HDFC0001234',
    }),
  );

  assert.throws(() => createEmployeeSchema.parse({ ...validEmployee, panNumber: 'ABC123' }));
  assert.throws(() => createEmployeeSchema.parse({ ...validEmployee, aadhaarNumber: '12345' }));
  assert.throws(() => createEmployeeSchema.parse({ ...validEmployee, ifsc: 'HDFC1001234' }));
});

test('PAN is upper-cased at the boundary', () => {
  const parsed = createEmployeeSchema.parse({ ...validEmployee, panNumber: 'abcde1234f' });
  assert.equal(parsed.panNumber, 'ABCDE1234F');
});

test('an exit date before the joining date is rejected', () => {
  assert.throws(() =>
    createEmployeeSchema.parse({
      ...validEmployee,
      dateOfJoining: '2026-01-15',
      dateOfExit: '2025-12-01',
    }),
  );
});

// ------------------------------------------------------------------ money

test('CTC is converted from rupees to integer paise at the boundary', () => {
  const parsed = createEmployeeSchema.parse({ ...validEmployee, annualCtc: 1_250_000 });
  assert.equal(parsed.annualCtc, 125_000_000);
  assert.ok(Number.isInteger(parsed.annualCtc), 'money must never be stored as a float');
});

test('fractional rupees round to whole paise, not to a float', () => {
  const parsed = createEmployeeSchema.parse({ ...validEmployee, annualCtc: 1250.505 });
  assert.equal(parsed.annualCtc, 125_051);
  assert.ok(Number.isInteger(parsed.annualCtc));
});

test('a negative CTC is rejected', () => {
  assert.throws(() => createEmployeeSchema.parse({ ...validEmployee, annualCtc: -1 }));
});

// ------------------------------------------------------------- list query

test('list defaults to server-side pagination', () => {
  const parsed = listEmployeesSchema.parse({});
  assert.equal(parsed.page, 1);
  assert.equal(parsed.pageSize, 25);
  assert.equal(parsed.sortBy, 'fullName');
});

test('pageSize is capped so nobody can request the whole collection', () => {
  assert.throws(() => listEmployeesSchema.parse({ pageSize: '5000' }));
  assert.equal(listEmployeesSchema.parse({ pageSize: '100' }).pageSize, 100);
});

test('list query coerces numeric strings from the URL', () => {
  const parsed = listEmployeesSchema.parse({ page: '3', pageSize: '10' });
  assert.equal(parsed.page, 3);
  assert.equal(parsed.pageSize, 10);
});

test('an unsortable column is rejected', () => {
  assert.throws(() => listEmployeesSchema.parse({ sortBy: 'annualCtc' }));
});

// ------------------------------------------------------------------ patch

test('a partial update is allowed but an empty one is not', () => {
  assert.doesNotThrow(() => updateEmployeeSchema.parse({ designation: 'Senior Executive' }));
  assert.throws(() => updateEmployeeSchema.parse({}));
});

// ------------------------------------------------------------ permissions

test('only Admin, HR and Finance may see PAN, Aadhaar, bank details and CTC', () => {
  const allowed = ['admin', 'hr', 'finance'];
  const denied = ['manager', 'sales_agent', 'ops', 'employee'];

  for (const role of allowed) {
    assert.ok(
      permissionsForRole(role).includes('employees.sensitive'),
      `${role} should hold employees.sensitive`,
    );
  }

  for (const role of denied) {
    assert.equal(
      permissionsForRole(role).includes('employees.sensitive'),
      false,
      `${role} must NOT hold employees.sensitive`,
    );
  }
});

test('only Admin and HR may create or edit employees', () => {
  assert.ok(permissionsForRole('admin').includes('employees.manage'));
  assert.ok(permissionsForRole('hr').includes('employees.manage'));

  for (const role of ['manager', 'finance', 'sales_agent', 'ops', 'employee']) {
    assert.equal(permissionsForRole(role).includes('employees.manage'), false, role);
  }
});

test('every role can read its own employee record', () => {
  for (const role of ['admin', 'manager', 'sales_agent', 'ops', 'finance', 'hr', 'employee']) {
    assert.ok(permissionsForRole(role).includes('employees.self'), role);
  }
});

// ------------------------------------------------------------------ model

test('the sensitive field list matches what the DTO strips', () => {
  assert.deepEqual([...SENSITIVE_FIELDS].sort(), [
    'aadhaarNumber',
    'annualCtc',
    'bankAccountNumber',
    'ifsc',
    'panNumber',
  ]);
});

test('departments and statuses are non-empty enums', () => {
  assert.ok(DEPARTMENTS.length > 0);
  assert.ok(EMPLOYEE_STATUSES.includes('Active'));
});

test('personalMobile is accepted when valid and rejected when malformed', () => {
  const valid = updateEmployeeSchema.parse({ personalMobile: '9876543210' });
  assert.equal(valid.personalMobile, '9876543210');

  const empty = updateEmployeeSchema.parse({ personalMobile: '' });
  assert.equal(empty.personalMobile, '');

  assert.throws(() => updateEmployeeSchema.parse({ personalMobile: '123' }));
});

