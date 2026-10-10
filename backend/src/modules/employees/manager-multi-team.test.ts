import assert from 'node:assert/strict';
import { after, before, beforeEach, describe, it } from 'node:test';
import { Types } from 'mongoose';

import { connectDatabase, disconnectDatabase, assertTestDatabase } from '../../core/db/connect.js';
import { type RequestContext } from '../../core/context.js';
import { Employee } from './employees.model.js';
import { Team } from './team.model.js';
import { employeeService } from './employees.service.js';
import { AuthUser } from '../../core/auth/auth-model.js';
import { Lead } from '../leads/leads.model.js';

describe('Multi-Team Management under Manager & Member CRM Summary', () => {
  let managerUser: any;
  let managerEmp: any;
  let emp1: any;
  let emp2: any;
  let mgrCtx: RequestContext;

  before(async () => {
    await connectDatabase({ isTestConnection: true });
  });

  after(async () => {
    await disconnectDatabase();
  });

  beforeEach(async () => {
    assertTestDatabase();
    await Employee.deleteMany({});
    await Team.deleteMany({});
    await AuthUser.deleteMany({});
    await Lead.deleteMany({});

    managerUser = await AuthUser.create({
      email: 'manager@mediaoctus.com',
      passwordHash: 'hash123',
      role: 'manager',
      name: 'Manager Bob',
      status: 'Active',
      permissions: ['employees.view', 'leads.view'],
    });

    managerEmp = await Employee.create({
      employeeCode: 'MO-EMP-0001',
      fullName: 'Manager Bob',
      workEmail: 'manager@mediaoctus.com',
      department: 'Management',
      designation: 'Sales Manager',
      userId: managerUser._id,
      status: 'Active',
    });

    const user1 = await AuthUser.create({
      email: 'emp1@mediaoctus.com',
      passwordHash: 'hash123',
      role: 'sales_agent',
      name: 'Alice Smith',
      status: 'Active',
      permissions: [],
    });

    emp1 = await Employee.create({
      employeeCode: 'MO-EMP-0002',
      fullName: 'Alice Smith',
      workEmail: 'emp1@mediaoctus.com',
      department: 'Sales',
      designation: 'Sales Executive',
      userId: user1._id,
      reportingManagerId: managerEmp._id,
      status: 'Active',
    });

    const user2 = await AuthUser.create({
      email: 'emp2@mediaoctus.com',
      passwordHash: 'hash123',
      role: 'sales_agent',
      name: 'Charlie Brown',
      status: 'Active',
      permissions: [],
    });

    emp2 = await Employee.create({
      employeeCode: 'MO-EMP-0003',
      fullName: 'Charlie Brown',
      workEmail: 'emp2@mediaoctus.com',
      department: 'Sales',
      designation: 'Junior Executive',
      userId: user2._id,
      reportingManagerId: managerEmp._id,
      status: 'Active',
    });

    mgrCtx = {
      user: {
        id: String(managerUser._id),
        role: 'manager',
        permissions: ['employees.view', 'leads.view'],
        department: 'Sales',
      },
    } as unknown as RequestContext;
  });

  it('allows manager to create multiple named teams', async () => {
    const team1 = await employeeService.createTeam(
      { name: 'Team Alpha', description: 'Alpha squad' },
      mgrCtx,
    );
    assert.equal(team1.name, 'Team Alpha');
    assert.equal(team1.managerId, String(managerEmp._id));

    const team2 = await employeeService.createTeam(
      { name: 'Team Beta', description: 'Beta squad' },
      mgrCtx,
    );
    assert.equal(team2.name, 'Team Beta');

    const hierarchy = await employeeService.getTeamHierarchy(mgrCtx);
    assert.equal(hierarchy.managers?.length, 1);
    assert.equal(hierarchy.managers![0].teams.length, 2);
  });

  it('allows adding and moving members across multiple teams', async () => {
    const teamA = await employeeService.createTeam({ name: 'Alpha' }, mgrCtx);
    const teamB = await employeeService.createTeam({ name: 'Beta' }, mgrCtx);

    const updatedA = await employeeService.addMemberToTeam(teamA.id, String(emp1._id), mgrCtx);
    assert.equal(updatedA.members.length, 1);
    assert.equal(updatedA.members[0].id, String(emp1._id));

    // Add emp1 to team B as well (multi-team assignment)
    const updatedB = await employeeService.addMemberToTeam(teamB.id, String(emp1._id), mgrCtx);
    assert.equal(updatedB.members.length, 1);

    // Reassign emp1 from Team A to Team B (if moving)
    await employeeService.removeMemberFromTeam(teamA.id, String(emp1._id), mgrCtx);
    const finalA = await Team.findById(teamA.id);
    assert.equal(finalA!.members.length, 0);
  });

  it('returns CRM summary with leads breakdown for manager view', async () => {
    const teamA = await employeeService.createTeam({ name: 'Alpha' }, mgrCtx);
    await employeeService.addMemberToTeam(teamA.id, String(emp1._id), mgrCtx);

    // Create leads assigned to Alice (emp1)
    await Lead.create({
      leadNumber: 'LD-0001',
      source: 'Website',
      companyName: 'Acme Corp',
      contactPerson: 'John Doe',
      mobile: '9876543210',
      email: 'john@acme.com',
      status: 'Interested',
      qualification: {
        budget: 5000000,
        city: 'Mumbai',
      },
      assignedTo: emp1.userId,
      createdBy: managerUser._id,
    });

    await Lead.create({
      leadNumber: 'LD-0002',
      source: 'Website',
      companyName: 'Globex Ltd',
      contactPerson: 'Jane Smith',
      mobile: '9123456780',
      email: 'jane@globex.com',
      status: 'Won',
      qualification: {
        budget: 12000000,
        city: 'Delhi',
      },
      assignedTo: emp1.userId,
      createdBy: managerUser._id,
    });

    const summary = await employeeService.getMemberCrmSummary(String(emp1._id), mgrCtx);
    assert.equal(summary.leads.total, 2);
    assert.equal(summary.leads.byStatus['Interested'], 1);
    assert.equal(summary.leads.byStatus['Won'], 1);
    assert.equal(summary.leads.recent.length, 2);
    assert.equal(summary.leads.recent[0].companyName, 'Globex Ltd');
    assert.equal(summary.leads.recent[0].status, 'Won');
    assert.equal(summary.leads.recent[0].budget, 120000);
  });
});
