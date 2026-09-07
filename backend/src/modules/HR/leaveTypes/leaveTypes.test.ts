import assert from 'node:assert/strict';
import test, { before, after } from 'node:test';
import { Types } from 'mongoose';

import { connectDatabase, disconnectDatabase } from '../../../core/db/connect.js';
import type { RequestContext } from '../../../core/context.js';
import { permissionsForRole } from '../../../core/rbac/permissions.js';
import { LeaveType, LeaveBalance } from './leaveTypes.model.js';
import { Employee } from '../../employees/employees.model.js';
import { leaveTypeService } from './leaveTypes.service.js';
import {
  createLeaveTypeSchema,
  allocateBalanceSchema,
} from './leaveTypes.validator.js';

// ============================================================================
// PURE LOGIC TESTS (No DB required)
// ============================================================================

test('a valid leave type passes validation', () => {
  const input = {
    name: 'Sick Leave',
    code: 'SL',
    annualQuota: 12,
    carryForward: false,
    maxCarryForward: 0,
    encashable: false,
    requiresDocument: false,
  };
  const parsed = createLeaveTypeSchema.parse(input);
  assert.equal(parsed.name, 'Sick Leave');
  assert.equal(parsed.annualQuota, 12);
  assert.equal(parsed.carryForward, false);
});

test('a leave type with null annual quota (unlimited) is allowed', () => {
  const input = {
    name: 'Leave Without Pay',
    code: 'LWP',
    annualQuota: null,
    carryForward: false,
    maxCarryForward: 0,
    encashable: false,
    requiresDocument: false,
  };
  const parsed = createLeaveTypeSchema.parse(input);
  assert.equal(parsed.annualQuota, null);
});

test('invalid parameters are rejected by schemas', () => {
  // Invalid quota (negative)
  assert.throws(() =>
    createLeaveTypeSchema.parse({
      name: 'Test Leave',
      code: 'TL',
      annualQuota: -5,
    })
  );

  // Invalid year in allocate schema
  assert.throws(() =>
    allocateBalanceSchema.parse({
      employeeId: 'emp123',
      leaveTypeId: 'lt123',
      year: 1999, // Min is 2000
    })
  );
});

test('permissions matrix has leave permissions mapped correctly', () => {
  // Admin and HR have leave.manage
  assert.ok(permissionsForRole('admin').includes('leave.manage'));
  assert.ok(permissionsForRole('hr').includes('leave.manage'));
  assert.ok(permissionsForRole('manager').includes('leave.manage'));

  // Employees have leave.self but NOT leave.manage
  assert.ok(permissionsForRole('employee').includes('leave.self'));
  assert.equal(permissionsForRole('employee').includes('leave.manage'), false);
});

// ============================================================================
// DATABASE TESTS (Mongo required)
// ============================================================================



let hrUserEmployeeId: string;
let managerEmployeeId: string;
let reportEmployeeId: string;
let otherEmployeeId: string;
let leaveTypeId: string;
let carryForwardLeaveTypeId: string;

const hrCtx = {
  user: {
    id: '507f1f77bcf86cd799439011',
    role: 'hr',
    permissions: ['leave.manage', 'leave.self', 'employees.self'],
  },
} as unknown as RequestContext;

const managerCtx = {
  user: {
    id: '507f1f77bcf86cd799439012',
    role: 'manager',
    permissions: ['leave.manage', 'leave.self', 'employees.self'],
  },
} as unknown as RequestContext;

const reportCtx = {
  user: {
    id: '507f1f77bcf86cd799439013',
    role: 'employee',
    permissions: ['leave.self', 'employees.self'],
  },
} as unknown as RequestContext;

const otherCtx = {
  user: {
    id: '507f1f77bcf86cd799439014',
    role: 'employee',
    permissions: ['leave.self', 'employees.self'],
  },
} as unknown as RequestContext;

before(async () => {
  await connectDatabase();

  // Clean test databases
  await LeaveType.deleteMany({ code: { $in: ['TEST_CL', 'TEST_PL', 'TEST_LWP'] } });
  await Employee.deleteMany({ workEmail: { $regex: /@test-leave-module\.test$/ } });

  // Create test employees
  const hrEmployee = await Employee.create({
    employeeCode: 'TST-EMP-001',
    userId: new Types.ObjectId(hrCtx.user.id),
    fullName: 'HR Specialist',
    workEmail: 'hr@test-leave-module.test',
    mobile: '9800000101',
    department: 'HR',
    designation: 'HR Executive',
    dateOfJoining: new Date('2025-01-01'),
    workLocation: 'Mumbai',
    status: 'Active',
  });
  hrUserEmployeeId = String(hrEmployee._id);

  const managerEmployee = await Employee.create({
    employeeCode: 'TST-EMP-002',
    userId: new Types.ObjectId(managerCtx.user.id),
    fullName: 'Sales Manager',
    workEmail: 'manager@test-leave-module.test',
    mobile: '9800000102',
    department: 'Sales',
    designation: 'Sales Manager',
    dateOfJoining: new Date('2025-01-01'),
    workLocation: 'Mumbai',
    status: 'Active',
  });
  managerEmployeeId = String(managerEmployee._id);

  const reportEmployee = await Employee.create({
    employeeCode: 'TST-EMP-003',
    userId: new Types.ObjectId(reportCtx.user.id),
    fullName: 'Report Agent',
    workEmail: 'report@test-leave-module.test',
    mobile: '9800000103',
    department: 'Sales',
    designation: 'Account Executive',
    dateOfJoining: new Date('2026-06-01'), // Joined mid-year in 2026!
    reportingManagerId: managerEmployee._id,
    workLocation: 'Mumbai',
    status: 'Active',
  });
  reportEmployeeId = String(reportEmployee._id);

  const otherEmployee = await Employee.create({
    employeeCode: 'TST-EMP-004',
    userId: new Types.ObjectId(otherCtx.user.id),
    fullName: 'Independent Staff',
    workEmail: 'other@test-leave-module.test',
    mobile: '9800000104',
    department: 'Operations',
    designation: 'Field Executive',
    dateOfJoining: new Date('2025-01-01'),
    workLocation: 'Pune',
    status: 'Active',
  });
  otherEmployeeId = String(otherEmployee._id);

  // Create test leave types
  const clType = await LeaveType.create({
    name: 'Test Casual Leave',
    code: 'TEST_CL',
    annualQuota: 12,
    carryForward: false,
    maxCarryForward: 0,
    encashable: false,
    requiresDocument: false,
    createdBy: hrEmployee._id,
    updatedBy: hrEmployee._id,
  });
  leaveTypeId = String(clType._id);

  const plType = await LeaveType.create({
    name: 'Test Privilege Leave',
    code: 'TEST_PL',
    annualQuota: 15,
    carryForward: true,
    maxCarryForward: 10,
    encashable: true,
    requiresDocument: false,
    createdBy: hrEmployee._id,
    updatedBy: hrEmployee._id,
  });
  carryForwardLeaveTypeId = String(plType._id);
});

after(async () => {
  // Clean up
  await LeaveType.deleteMany({ code: { $in: ['TEST_CL', 'TEST_PL', 'TEST_LWP'] } });
  await Employee.deleteMany({ workEmail: { $regex: /@test-leave-module\.test$/ } });
  await LeaveBalance.deleteMany({ employeeId: { $in: [hrUserEmployeeId, managerEmployeeId, reportEmployeeId, otherEmployeeId] } });
  await disconnectDatabase();
});

test('non-HR/Admin users cannot create or modify leave types', async () => {
  await assert.rejects(
    async () => {
      await leaveTypeService.create(
        {
          name: 'Unauthorized Leave',
          code: 'TEST_UN',
          annualQuota: 10,
          carryForward: false,
          maxCarryForward: 0,
          encashable: false,
          requiresDocument: false,
        },
        reportCtx
      );
    },
    (err: Error) => err.message.includes('Only HR and Admin')
  );

  await assert.rejects(
    async () => {
      await leaveTypeService.update(
        leaveTypeId,
        {
          name: 'Unauthorized Edit',
        },
        reportCtx
      );
    },
    (err: Error) => err.message.includes('Only HR and Admin')
  );
});

test('leave balance allocation pro-rates mid-year joiners', async () => {
  // Report agent joined on 2026-06-01.
  // Pro-rating for TEST_CL (annualQuota = 12) for 2026:
  // Days from 2026-06-01 to 2026-12-31 is 214 days.
  // 12 * (214/365) = 7.035 -> Math.round gives 7.
  const balanceDto = await leaveTypeService.allocate(
    {
      employeeId: reportEmployeeId,
      leaveTypeId: leaveTypeId,
      year: 2026,
    },
    hrCtx
  );

  assert.equal(balanceDto.allocated, 7, 'Mid-year joiner quota must be prorated');
  assert.equal(balanceDto.balance, 7, 'Balance must equal allocated + carriedForward - used');
});

test('leave balance allocation assigns full quota for prior joiners', async () => {
  // manager joined in 2025. Target year is 2026.
  // Should get full quota of 12.
  const balanceDto = await leaveTypeService.allocate(
    {
      employeeId: managerEmployeeId,
      leaveTypeId: leaveTypeId,
      year: 2026,
    },
    hrCtx
  );

  assert.equal(balanceDto.allocated, 12, 'Prior joiner must get full quota');
});

test('carry forward limit limits transfer and lapses overflow', async () => {
  // Let's seed a previous year balance (2025) for manager
  // TEST_PL: annualQuota 15, carryForward: true, maxCarryForward: 10.
  // In 2025: allocated: 15, used: 3. Remaining = 12.
  // When allocating for 2026: maxCarryForward is 10. 12 remaining -> 10 carried forward. 2 lapses.
  await LeaveBalance.create({
    employeeId: managerEmployeeId,
    leaveTypeId: carryForwardLeaveTypeId,
    year: 2025,
    allocated: 15,
    used: 3,
    carriedForward: 0,
    createdBy: new Types.ObjectId(hrCtx.user.id),
    updatedBy: new Types.ObjectId(hrCtx.user.id),
  });

  const balanceDto = await leaveTypeService.allocate(
    {
      employeeId: managerEmployeeId,
      leaveTypeId: carryForwardLeaveTypeId,
      year: 2026,
    },
    hrCtx
  );

  assert.equal(balanceDto.carriedForward, 10, 'Carried forward must be capped at maxCarryForward');
  assert.equal(balanceDto.allocated, 15, 'Allocated must be full quota');
  assert.equal(balanceDto.balance, 25, 'Balance must be allocated + carriedForward');
});

test('Leave Without Pay does not block due to balance and deduction is bypassed', async () => {
  // Create LWP leave type (annualQuota: null)
  const lwpType = await LeaveType.create({
    name: 'Test LWP',
    code: 'TEST_LWP',
    annualQuota: null,
    carryForward: false,
    maxCarryForward: 0,
    encashable: false,
    requiresDocument: false,
    createdBy: new Types.ObjectId(hrCtx.user.id),
    updatedBy: new Types.ObjectId(hrCtx.user.id),
  });

  // Getting balance for LWP should return 0 allocated/used/carriedForward
  const balance = await leaveTypeService.getBalance(reportEmployeeId, String(lwpType._id), 2026);
  assert.equal(balance.balance, 0);

  // Deducting balance on LWP must NOT throw or deduct anything
  await assert.doesNotReject(async () => {
    await leaveTypeService.deductBalance(
      reportEmployeeId,
      String(lwpType._id),
      2026,
      10, // Try to deduct 10 days
      hrCtx
    );
  });
});

test('employees can access only their own leave balance', async () => {
  // reportCtx can access reportEmployeeId (Self)
  await assert.doesNotReject(async () => {
    await leaveTypeService.getBalanceForEmployee(reportEmployeeId, 2026, reportCtx);
  });

  // reportCtx cannot access otherEmployeeId (Forbidden)
  await assert.rejects(
    async () => {
      await leaveTypeService.getBalanceForEmployee(otherEmployeeId, 2026, reportCtx);
    },
    (err: Error) => err.message.includes('do not have permission')
  );
});

test('managers can access their direct reports but not independent employees', async () => {
  // managerCtx can access reportEmployeeId (reports to manager)
  await assert.doesNotReject(async () => {
    await leaveTypeService.getBalanceForEmployee(reportEmployeeId, 2026, managerCtx);
  });

  // managerCtx cannot access otherEmployeeId (does not report to manager)
  await assert.rejects(
    async () => {
      await leaveTypeService.getBalanceForEmployee(otherEmployeeId, 2026, managerCtx);
    },
    (err: Error) => err.message.includes('do not have permission')
  );
});

test('HR and Admin can access any employee balances', async () => {
  // hrCtx can access otherEmployeeId
  await assert.doesNotReject(async () => {
    await leaveTypeService.getBalanceForEmployee(otherEmployeeId, 2026, hrCtx);
  });
});

test('duplicate leave type code is prevented', async () => {
  await assert.rejects(
    async () => {
      await leaveTypeService.create(
        {
          name: 'Duplicate Casual Leave',
          code: 'TEST_CL', // already exists
          annualQuota: 12,
          carryForward: false,
          maxCarryForward: 0,
          encashable: false,
          requiresDocument: false,
        },
        hrCtx
      );
    },
    (err: Error) => err.message.includes('already exists')
  );
});

test('deactivating a leave type works and sets status to Inactive', async () => {
  const result = await leaveTypeService.delete(leaveTypeId, hrCtx);
  assert.equal(result.status, 'Inactive');

  const doc = await LeaveType.findById(leaveTypeId);
  assert.equal(doc?.status, 'Inactive');
});
