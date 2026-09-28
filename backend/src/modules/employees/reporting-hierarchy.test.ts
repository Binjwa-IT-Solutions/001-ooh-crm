import assert from 'node:assert/strict';
import test, { before, after } from 'node:test';
import mongoose, { Types } from 'mongoose';

import { connectDatabase, disconnectDatabase } from '../../core/db/connect.js';
import type { RequestContext } from '../../core/context.js';
import { AuthUser } from '../../core/auth/auth-model.js';
import { AuthService } from '../../core/auth/auth-service.js';
import { Employee } from './employees.model.js';
import { employeeService } from './employees.service.js';

const adminCtx: RequestContext = {
  user: {
    id: '507f1f77bcf86cd799439001',
    email: 'admin.test@mediaoctus.test',
    name: 'Admin Tester',
    role: 'admin',
    permissions: ['employees.view', 'employees.manage', 'employees.sensitive', 'users.create', 'users.view', 'users.update'],
  },
};

before(async () => {
  await connectDatabase();

  // Cleanup test users and employees
  await AuthUser.deleteMany({ email: { $regex: /@mediaoctus\.test$/i } });
  await Employee.deleteMany({
    $or: [
      { workEmail: { $regex: /@mediaoctus\.test$/i } },
      { fullName: { $in: ['Tarun Manager', 'Manager B', 'Tannu', 'Rahul', 'Priya'] } },
    ],
  });
});

after(async () => {
  await AuthUser.deleteMany({ email: { $regex: /@mediaoctus\.test$/i } });
  await Employee.deleteMany({
    $or: [
      { workEmail: { $regex: /@mediaoctus\.test$/i } },
      { fullName: { $in: ['Tarun Manager', 'Manager B', 'Tannu', 'Rahul', 'Priya'] } },
    ],
  });
  await disconnectDatabase();
});

test('User Creation -> Reporting Manager -> Employee Master -> Team Management Flow', async (t) => {
  // 1. Create Tarun (Manager)
  const tarunUser = await AuthService.registerUser({
    name: 'Tarun Manager',
    email: 'tarun.manager@mediaoctus.test',
    passwordPlain: 'Password123!',
    role: 'manager',
    status: 'Active',
  });
  const tarunEmp = await Employee.findOne({ userId: tarunUser.id });
  assert.ok(tarunEmp, 'Tarun employee record should be created');
  assert.equal(tarunEmp.fullName, 'Tarun Manager');

  // 2. Create Manager B
  const managerBUser = await AuthService.registerUser({
    name: 'Manager B',
    email: 'manager.b@mediaoctus.test',
    passwordPlain: 'Password123!',
    role: 'manager',
    status: 'Active',
  });
  const managerBEmp = await Employee.findOne({ userId: managerBUser.id });
  assert.ok(managerBEmp, 'Manager B employee record should be created');

  // 3. Create Tannu with Reporting Manager = Tarun (using Tarun's Employee _id)
  const tannuUser = await AuthService.registerUser({
    name: 'Tannu',
    email: 'tannu.sales@mediaoctus.test',
    passwordPlain: 'Password123!',
    role: 'sales_agent',
    status: 'Active',
    reportingManagerId: String(tarunEmp._id),
  });

  const tannuEmp = await Employee.findOne({ userId: tannuUser.id });
  assert.ok(tannuEmp, 'Tannu employee record should exist');
  assert.equal(String(tannuEmp.reportingManagerId), String(tarunEmp._id), 'Tannu reportingManagerId must match Tarun Employee ID');

  // 4. Verify Employee Master (employeeService.list)
  const listResult = await employeeService.list({ search: 'Tannu', page: 1, pageSize: 10, sortBy: 'fullName', sortDir: 'asc' }, adminCtx);
  const tannuInList = listResult.employees.find((e) => e.id === String(tannuEmp._id));
  assert.ok(tannuInList, 'Tannu must be in employee list');
  assert.equal(tannuInList.fullName, 'Tannu');
  assert.ok(tannuInList.reportingManager, 'reportingManager object must be present');
  assert.equal(tannuInList.reportingManager?.fullName, 'Tarun Manager', 'Reports To must be Tarun Manager');
  assert.equal(tannuInList.reportingManager?.id, String(tarunEmp._id));

  // 5. Verify Team Management (employeeService.getTeamHierarchy)
  const hierarchyAdmin = await employeeService.getTeamHierarchy(adminCtx);
  const tarunTeam = hierarchyAdmin.teams.find((team) => team.manager.id === String(tarunEmp._id));
  assert.ok(tarunTeam, 'Tarun team group must exist in Team Management');
  assert.equal(tarunTeam.members.length, 1);
  assert.equal(tarunTeam.members[0].fullName, 'Tannu');

  // 6. Create Rahul with Reporting Manager = Tarun
  const rahulUser = await AuthService.registerUser({
    name: 'Rahul',
    email: 'rahul.sales@mediaoctus.test',
    passwordPlain: 'Password123!',
    role: 'sales_agent',
    status: 'Active',
    reportingManagerId: String(tarunEmp._id),
  });

  const hierarchyWithRahul = await employeeService.getTeamHierarchy(adminCtx);
  const tarunTeamWithRahul = hierarchyWithRahul.teams.find((team) => team.manager.id === String(tarunEmp._id));
  assert.ok(tarunTeamWithRahul);
  assert.equal(tarunTeamWithRahul.members.length, 2);
  const memberNames = tarunTeamWithRahul.members.map((m) => m.fullName).sort();
  assert.deepEqual(memberNames, ['Rahul', 'Tannu']);

  // 7. Create Priya with Reporting Manager = Manager B
  const priyaUser = await AuthService.registerUser({
    name: 'Priya',
    email: 'priya.sales@mediaoctus.test',
    passwordPlain: 'Password123!',
    role: 'sales_agent',
    status: 'Active',
    reportingManagerId: String(managerBEmp._id),
  });

  const hierarchyWithPriya = await employeeService.getTeamHierarchy(adminCtx);
  const tarunTeamAfterPriya = hierarchyWithPriya.teams.find((team) => team.manager.id === String(tarunEmp._id));
  const managerBTeam = hierarchyWithPriya.teams.find((team) => team.manager.id === String(managerBEmp._id));

  assert.equal(tarunTeamAfterPriya?.members.length, 2, 'Priya must NOT appear under Tarun');
  assert.equal(managerBTeam?.members.length, 1, 'Priya must appear under Manager B');
  assert.equal(managerBTeam?.members[0].fullName, 'Priya');

  // 8. Test Manager filter (e.g. filter by Tarun)
  const filteredByTarun = await employeeService.getTeamHierarchy(adminCtx, String(tarunEmp._id));
  assert.equal(filteredByTarun.teams.length, 1);
  assert.equal(filteredByTarun.teams[0].manager.fullName, 'Tarun Manager');
  assert.equal(filteredByTarun.teams[0].members.length, 2);

  // 9. Test Manager-scoped view (Tarun logged in)
  const tarunCtx: RequestContext = {
    user: {
      id: String(tarunUser.id),
      email: tarunUser.email,
      name: tarunUser.name,
      role: 'manager',
      permissions: ['employees.view', 'attendance.view_team', 'leave.manage'],
    },
  };

  const tarunScopedHierarchy = await employeeService.getTeamHierarchy(tarunCtx);
  assert.equal(tarunScopedHierarchy.teams.length, 1, 'Tarun must only see 1 team (his own)');
  assert.equal(tarunScopedHierarchy.teams[0].manager.fullName, 'Tarun Manager');
  assert.equal(tarunScopedHierarchy.teams[0].members.length, 2);
  assert.equal(tarunScopedHierarchy.unassigned.length, 0);

  // 10. Test Manager unassignment
  const priyaEmp = await Employee.findOne({ userId: priyaUser.id });
  assert.ok(priyaEmp);
  await employeeService.update(String(priyaEmp._id), { reportingManagerId: null } as any, adminCtx);

  const priyaAfterUpdate = await employeeService.getById(String(priyaEmp._id), adminCtx);
  assert.equal(priyaAfterUpdate.reportingManager, null, 'Priya reportingManager must be null after unassigning');

  const hierarchyAfterUnassign = await employeeService.getTeamHierarchy(adminCtx);
  const unassignedPriya = hierarchyAfterUnassign.unassigned.find((u) => u.fullName === 'Priya');
  assert.ok(unassignedPriya, 'Priya should now appear in unassigned list');
});
