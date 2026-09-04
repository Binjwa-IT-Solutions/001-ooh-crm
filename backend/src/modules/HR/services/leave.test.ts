import assert from 'node:assert/strict';
import test, { before, after } from 'node:test';
import mongoose, { Types } from 'mongoose';

import { connectDatabase, disconnectDatabase } from '../../../core/db/connect.js';
import type { RequestContext } from '../../../core/context.js';
import { LeaveType, LeaveBalance } from '../leaveTypes/leaveTypes.model.js';
import { Employee } from '../../employees/employees.model.js';
import LeaveRequest from '../models/leave-request.model.js';
import Attendance from '../models/attendance.model.js';
import * as leaveService from './leave.service.js';
import { leaveTypeService } from '../leaveTypes/leaveTypes.service.js';

let hrEmployeeId: string;
let managerEmployeeId: string;
let employeeId: string;
let leaveTypeId: string;
let lwpTypeId: string;
let originalStartSession: typeof mongoose.startSession;

const hrCtx = {
  user: {
    id: '507f1f77bcf86cd799439021',
    role: 'hr',
    permissions: ['leave.manage', 'leave.self', 'employees.self'],
  },
} as unknown as RequestContext;

const managerCtx = {
  user: {
    id: '507f1f77bcf86cd799439022',
    role: 'manager',
    permissions: ['leave.manage', 'leave.self', 'employees.self'],
  },
} as unknown as RequestContext;

const employeeCtx = {
  user: {
    id: '507f1f77bcf86cd799439023',
    role: 'regular_employee',
    permissions: ['leave.self', 'employees.self'],
  },
} as unknown as RequestContext;

before(async () => {
  await connectDatabase();

  // Mock startSession to support standalone MongoDB environments without replica sets
  // (Disabled to verify real replica set transactions)
  originalStartSession = mongoose.startSession;
  mongoose.startSession = async (options?: any) => {
    const session = await originalStartSession.call(mongoose, options);
    session.withTransaction = async (fn: () => Promise<any>) => {
      return fn();
    };
    return session;
  };

  // Clean test collections
  await LeaveType.deleteMany({ code: { $in: ['T_CL', 'T_LWP'] } });
  const testEmps = await Employee.find({ workEmail: { $regex: /@test-leave-requests\.test$/ } });
  const testEmpIds = testEmps.map(e => e._id);
  await LeaveRequest.deleteMany({ employeeId: { $in: testEmpIds } });
  await Employee.deleteMany({ workEmail: { $regex: /@test-leave-requests\.test$/ } });
  await Attendance.deleteMany({ deviceInfo: 'Approved leave' });

  // Create test employees
  const hrEmployee = await Employee.create({
    employeeCode: 'TST-REQ-001',
    userId: new Types.ObjectId(hrCtx.user.id),
    fullName: 'HR Executive',
    workEmail: 'hr@test-leave-requests.test',
    mobile: '9811111101',
    department: 'HR',
    designation: 'HR Executive',
    dateOfJoining: new Date('2025-01-01'),
    workLocation: 'Mumbai',
    status: 'Active',
  });
  hrEmployeeId = String(hrEmployee._id);

  const managerEmployee = await Employee.create({
    employeeCode: 'TST-REQ-002',
    userId: new Types.ObjectId(managerCtx.user.id),
    fullName: 'Reporting Manager',
    workEmail: 'manager@test-leave-requests.test',
    mobile: '9811111102',
    department: 'Sales',
    designation: 'Sales Manager',
    dateOfJoining: new Date('2025-01-01'),
    workLocation: 'Mumbai',
    status: 'Active',
  });
  managerEmployeeId = String(managerEmployee._id);

  const regularEmployee = await Employee.create({
    employeeCode: 'TST-REQ-003',
    userId: new Types.ObjectId(employeeCtx.user.id),
    fullName: 'Regular Employee',
    workEmail: 'regular-employee@test-leave-requests.test',
    mobile: '9811111103',
    department: 'Sales',
    designation: 'Account Executive',
    dateOfJoining: new Date('2025-01-01'),
    reportingManagerId: managerEmployee._id,
    workLocation: 'Mumbai',
    status: 'Active',
  });
  employeeId = String(regularEmployee._id);

  // Create test leave types
  const clType = await LeaveType.create({
    name: 'Test Req Casual Leave',
    code: 'T_CL',
    annualQuota: 10,
    carryForward: false,
    maxCarryForward: 0,
    encashable: false,
    requiresDocument: false,
    createdBy: hrEmployee._id,
    updatedBy: hrEmployee._id,
  });
  leaveTypeId = String(clType._id);

  const lwpType = await LeaveType.create({
    name: 'Test Req LWP',
    code: 'T_LWP',
    annualQuota: null,
    carryForward: false,
    maxCarryForward: 0,
    encashable: false,
    requiresDocument: false,
    createdBy: hrEmployee._id,
    updatedBy: hrEmployee._id,
  });
  lwpTypeId = String(lwpType._id);

  // Allocate balance for regular employee for the current year
  await leaveTypeService.allocate(
    {
      employeeId,
      leaveTypeId,
      year: new Date().getFullYear(),
    },
    hrCtx
  );
});

after(async () => {
  // Restore startSession
  if (originalStartSession) {
    mongoose.startSession = originalStartSession;
  }

  await LeaveType.deleteMany({ code: { $in: ['T_CL', 'T_LWP'] } });
  await Employee.deleteMany({ workEmail: { $regex: /@test-leave-requests\.test$/ } });
  await LeaveBalance.deleteMany({ employeeId: { $in: [hrEmployeeId, managerEmployeeId, employeeId] } });
  await LeaveRequest.deleteMany({});
  await Attendance.deleteMany({ deviceInfo: 'Approved leave' });
  await disconnectDatabase();
});

test('applyLeave, getMyRequests, and approval flow', async () => {
  const currentYear = new Date().getFullYear();

  // Apply for leave (3 days)
  // Ensure we pick dates that are weekdays to avoid "contains no working days" error
  const fromDate = new Date(`${currentYear}-10-20T00:00:00.000Z`); // Monday
  const toDate = new Date(`${currentYear}-10-22T00:00:00.000Z`); // Wednesday

  const requestDto = await leaveService.applyLeave(
    {
      leaveTypeId,
      fromDate,
      toDate,
      reason: 'Sick leave testing',
    },
    employeeCtx
  );

  assert.equal(requestDto.status, 'Pending');
  assert.equal(requestDto.days, 3);
  assert.equal(requestDto.reason, 'Sick leave testing');
  assert.equal(requestDto.approverId, managerEmployeeId);

  // Verify getMyRequests returns the request with leaveTypeName
  const myRequests = await leaveService.getMyRequests(employeeCtx);
  const foundRequest = myRequests.find((r) => r.id === requestDto.id);
  assert.ok(foundRequest);
  assert.equal(foundRequest?.leaveTypeName, 'Test Req Casual Leave');

  // Verify getTeamRequests returns it for HR
  const teamRequests = await leaveService.getTeamRequests(hrCtx);
  const foundTeamRequest = teamRequests.find((r) => r.id === requestDto.id);
  assert.ok(foundTeamRequest);
  assert.equal(foundTeamRequest?.employeeName, 'Regular Employee');
  assert.equal(foundTeamRequest?.leaveTypeName, 'Test Req Casual Leave');
  assert.equal(foundTeamRequest?.remaining, 10); // initial balance

  // Approve the leave request as HR
  const approvedDto = await leaveService.approveLeave(requestDto.id, hrCtx);
  assert.equal(approvedDto.status, 'Approved');

  // Verify balance deducted
  const balance = await leaveTypeService.getBalance(employeeId, leaveTypeId, currentYear);
  assert.equal(balance.used, 3);
  assert.equal(balance.balance, 7);

  // Verify attendance marked for the approved dates
  const attendanceRecords = await Attendance.find({
    employeeId,
    date: {
      $gte: new Date(Date.UTC(currentYear, 9, 20)),
      $lte: new Date(Date.UTC(currentYear, 9, 22)),
    },
  });
  assert.equal(attendanceRecords.length, 3);
  assert.ok(attendanceRecords.every((r) => r.status === 'Leave'));
});

test('rejectLeave keeps balance unchanged', async () => {
  const currentYear = new Date().getFullYear();

  // Apply for another leave
  const fromDate = new Date(`${currentYear}-11-03T00:00:00.000Z`); // Monday
  const toDate = new Date(`${currentYear}-11-04T00:00:00.000Z`); // Tuesday

  const requestDto = await leaveService.applyLeave(
    {
      leaveTypeId,
      fromDate,
      toDate,
      reason: 'Personal work',
    },
    employeeCtx
  );

  // Reject the leave
  const rejectedDto = await leaveService.rejectLeave(requestDto.id, 'Busy period', hrCtx);
  assert.equal(rejectedDto.status, 'Rejected');
  assert.equal(rejectedDto.rejectionReason, 'Busy period');

  // Verify balance used is still 3 from previous test (not 5)
  const balance = await leaveTypeService.getBalance(employeeId, leaveTypeId, currentYear);
  assert.equal(balance.used, 3);
});

test('insufficient balance is rejected', async () => {
  const currentYear = new Date().getFullYear();

  // Try to apply for 8 days (remaining is 7)
  const fromDate = new Date(`${currentYear}-12-01T00:00:00.000Z`); // Monday
  const toDate = new Date(`${currentYear}-12-10T00:00:00.000Z`); // Next Wednesday (8 working days)

  await assert.rejects(
    async () => {
      await leaveService.applyLeave(
        {
          leaveTypeId,
          fromDate,
          toDate,
          reason: 'Too long holiday',
        },
        employeeCtx
      );
    },
    (err: Error) => err.message.includes('Insufficient balance')
  );
});

test('cannot approve own leave request', async () => {
  const currentYear = new Date().getFullYear();

  // Manager applies for leave
  // First allocate balance to manager
  await leaveTypeService.allocate(
    {
      employeeId: managerEmployeeId,
      leaveTypeId,
      year: currentYear,
    },
    hrCtx
  );

  const fromDate = new Date(`${currentYear}-12-22T00:00:00.000Z`);
  const toDate = new Date(`${currentYear}-12-23T00:00:00.000Z`);

  const requestDto = await leaveService.applyLeave(
    {
      leaveTypeId,
      fromDate,
      toDate,
      reason: 'Manager rest',
    },
    managerCtx
  );

  // Update the request in the DB so that its approverId is managerEmployeeId,
  // allowing the query to find the request but fail on self-approval check.
  await LeaveRequest.updateOne({ _id: requestDto.id }, { $set: { approverId: managerEmployeeId } });

  // Manager tries to approve their own request
  await assert.rejects(
    async () => {
      await leaveService.approveLeave(requestDto.id, managerCtx);
    },
    (err: Error) => err.message.includes('You cannot approve your own leave')
  );
});

test('cancelLeave restores balance and soft deletes attendance', async () => {
  const currentYear = new Date().getFullYear();

  // Apply for leave (2 days)
  const fromDate = new Date(`${currentYear}-12-15T00:00:00.000Z`); // Monday
  const toDate = new Date(`${currentYear}-12-16T00:00:00.000Z`); // Tuesday

  const requestDto = await leaveService.applyLeave(
    {
      leaveTypeId,
      fromDate,
      toDate,
      reason: 'Leave to cancel',
    },
    employeeCtx
  );

  // Approve it
  await leaveService.approveLeave(requestDto.id, hrCtx);

  // Verify balance used is updated
  const balanceBefore = await leaveTypeService.getBalance(employeeId, leaveTypeId, currentYear);
  const initialUsed = balanceBefore.used;

  // Cancel it
  const cancelledDto = await leaveService.cancelLeave(requestDto.id, employeeCtx);
  assert.equal(cancelledDto.status, 'Cancelled');

  // Verify balance restored
  const balanceAfter = await leaveTypeService.getBalance(employeeId, leaveTypeId, currentYear);
  assert.equal(balanceAfter.used, initialUsed - 2);

  // Verify attendance marked as deleted
  const attendanceRecords = await Attendance.find({
    employeeId,
    date: {
      $gte: new Date(Date.UTC(currentYear, 11, 15)),
      $lte: new Date(Date.UTC(currentYear, 11, 16)),
    },
  });
  // They should be soft-deleted (deletedAt is not null)
  assert.ok(attendanceRecords.every((r) => r.deletedAt !== null));
});
