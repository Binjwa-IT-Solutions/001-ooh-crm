import assert from 'node:assert/strict';
import test, { before, after } from 'node:test';
import mongoose, { Types } from 'mongoose';

import { connectDatabase, disconnectDatabase } from '../../../core/db/connect.js';
import type { RequestContext } from '../../../core/context.js';
import Holiday from '../models/holiday.model.js';
import { holidayService } from './holiday.service.js';
import * as leaveService from './leave.service.js';
import { LeaveType } from '../leaveTypes/leaveTypes.model.js';
import { leaveTypeService } from '../leaveTypes/leaveTypes.service.js';
import { Employee } from '../../employees/employees.model.js';
import LeaveRequest from '../models/leave-request.model.js';

let employeeId: string;
let leaveTypeId: string;
const testYear = 2026;

const adminCtx = {
  user: {
    id: '507f1f77bcf86cd799439021',
    role: 'admin',
    permissions: ['leave.manage', 'leave.self', 'employees.self', 'holiday.manage'],
  },
} as unknown as RequestContext;

const employeeCtx = {
  user: {
    id: '507f1f77bcf86cd799439023',
    role: 'employee',
    permissions: ['leave.self', 'employees.self'],
  },
} as unknown as RequestContext;

before(async () => {
  await connectDatabase();

  // Mock startSession to support standalone MongoDB environments without replica sets
  const originalStartSession = mongoose.startSession;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  mongoose.startSession = async (options?: any) => {
    const session = await originalStartSession.call(mongoose, options);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    session.withTransaction = async (fn: () => Promise<any>) => {
      return fn();
    };
    return session;
  };

  // Clean collections
  await Holiday.deleteMany({ name: { $regex: /Test|Modified/i } });
  const oldTestEmp = await Employee.findOne({ workEmail: 'test-holiday-emp@mediaoctus.test' });
  if (oldTestEmp) {
    await LeaveRequest.deleteMany({ employeeId: oldTestEmp._id });
  }
  await LeaveType.deleteMany({ code: 'T_HOL_CL' });
  await Employee.deleteMany({ workEmail: 'test-holiday-emp@mediaoctus.test' });

  // Create test employee
  const employee = await Employee.create({
    employeeCode: 'TST-HOL-001',
    userId: new Types.ObjectId(employeeCtx.user.id),
    fullName: 'Test Holiday Employee',
    workEmail: 'test-holiday-emp@mediaoctus.test',
    mobile: '9811111109',
    department: 'HR',
    designation: 'HR Associate',
    dateOfJoining: new Date('2025-01-01'),
    workLocation: 'Mumbai',
    status: 'Active',
  });
  employeeId = String(employee._id);

  // Create test leave type
  const leaveType = await LeaveType.create({
    name: 'Test Holiday Casual Leave',
    code: 'T_HOL_CL',
    annualQuota: 10,
    carryForward: false,
    maxCarryForward: 0,
    encashable: false,
    requiresDocument: false,
  });
  leaveTypeId = String(leaveType._id);

  // Allocate balance
  await leaveTypeService.allocate(
    {
      employeeId,
      leaveTypeId,
      year: testYear,
    },
    adminCtx
  );
});

after(async () => {
  await Holiday.deleteMany({ name: { $regex: /Test|Modified/i } });
  if (employeeId) {
    await LeaveRequest.deleteMany({ employeeId });
  }
  await LeaveType.deleteMany({ code: 'T_HOL_CL' });
  await Employee.deleteMany({ workEmail: 'test-holiday-emp@mediaoctus.test' });
  await disconnectDatabase();
});

test('Holiday CRUD operations', async () => {
  // Create
  const holiday = await holidayService.create(
    {
      name: 'Independence Day Test',
      date: new Date('2026-08-14T00:00:00.000Z'),
      description: 'Independence Day holiday',
    },
    adminCtx
  );
  assert.equal(holiday.name, 'Independence Day Test');
  assert.equal(holiday.date, new Date(Date.UTC(2026, 7, 14)).toISOString());

  // Prevent Duplicates
  await assert.rejects(
    holidayService.create(
      {
        name: 'Another Independence Day Test',
        date: new Date('2026-08-14T00:00:00.000Z'),
      },
      adminCtx
    ),
    /already defined/
  );

  // List
  const list = await holidayService.list(employeeCtx);
  const found = list.find((h) => h.id === holiday.id);
  assert.ok(found);
  assert.equal(found.name, 'Independence Day Test');

  // Update
  const updated = await holidayService.update(
    holiday.id,
    {
      name: 'Independence Day Modified',
      date: new Date('2026-08-14T00:00:00.000Z'),
      description: 'Updated description',
    },
    adminCtx
  );
  assert.equal(updated.name, 'Independence Day Modified');

  // Delete (soft-delete)
  await holidayService.delete(holiday.id, adminCtx);
  const listAfterDelete = await holidayService.list(employeeCtx);
  const foundAfter = listAfterDelete.find((h) => h.id === holiday.id);
  assert.equal(foundAfter, undefined);
});

test('Leave application respects company holidays and Sundays', async () => {
  // Clean holiday collection first
  await Holiday.deleteMany({ name: { $regex: /Test|Modified/i } });

  // 2026-08-15 is a Saturday, 2026-08-16 is a Sunday
  // Let's pick 2026-08-17 (Mon), 2026-08-18 (Tue), 2026-08-19 (Wed). Total 3 weekdays.
  // Add a holiday on 2026-08-18 (Tue)
  await holidayService.create(
    {
      name: 'Test Midweek Holiday',
      date: new Date('2026-08-18T00:00:00.000Z'),
    },
    adminCtx
  );

  // Apply for leave from 2026-08-17 to 2026-08-19.
  // Sundays and Saturdays are excluded by default.
  // Tue (18th) is a company holiday and should be excluded.
  // The duration should be 2 days (Mon 17th and Wed 19th).
  const leave = await leaveService.applyLeave(
    {
      leaveTypeId,
      fromDate: new Date('2026-08-17T00:00:00.000Z'),
      toDate: new Date('2026-08-19T00:00:00.000Z'),
      reason: 'Testing holiday leave calculation integration',
    },
    employeeCtx
  );

  // Assert duration is 2 instead of 3 days
  assert.equal(leave.days, 2);
  assert.equal(leave.status, 'Pending');
});
