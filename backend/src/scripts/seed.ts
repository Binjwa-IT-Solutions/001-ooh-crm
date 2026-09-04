/**
 * Seeds demo data so every module can be built and demoed against something
 * realistic: one login per role, plus an employee master with a real reporting
 * hierarchy (leave approval and escalation both walk it).
 *
 *   npm run seed
 *   npm run seed -- --reset-passwords   also resets the demo passwords
 *
 * Safe to re-run. Existing records are left alone.
 */
import bcrypt from 'bcryptjs';
import { Types } from 'mongoose';

import { config } from '../config/index.js';
import { AuthUser } from '../core/auth/auth-model.js';
import { connectDatabase, disconnectDatabase } from '../core/db/connect.js';
import { formattedSequence } from '../core/db/sequence.js';
import { ROLE_LABELS, type Role } from '../core/rbac/permissions.js';
import { Employee, type Department } from '../modules/employees/employees.model.js';
import Holiday from '../modules/HR/models/holiday.model.js';


const DEMO_PASSWORD = process.env.SEED_PASSWORD ?? 'Password123!';

interface DemoPerson {
  key: string;
  name: string;
  /** Present only for people who also get a login account. */
  email?: string;
  role?: Role;
  department: Department;
  designation: string;
  workLocation: string;
  dateOfJoining: string;
  /** `key` of this person's manager. */
  managerKey?: string;
  /** Annual CTC in rupees — converted to paise on the way in. */
  ctcRupees: number;
  panNumber: string;
}

const DEMO_PEOPLE: DemoPerson[] = [
  {
    key: 'admin',
    name: 'Aditi Rao',
    email: 'admin@mediaoctus.test',
    role: 'admin',
    department: 'Management',
    designation: 'Managing Director',
    workLocation: 'Mumbai',
    dateOfJoining: '2019-04-01',
    ctcRupees: 4_800_000,
    panNumber: 'AAAPR1234A',
  },
  {
    key: 'manager',
    name: 'Rohit Menon',
    email: 'manager@mediaoctus.test',
    role: 'manager',
    department: 'Sales',
    designation: 'Sales Manager',
    workLocation: 'Mumbai',
    dateOfJoining: '2021-06-14',
    managerKey: 'admin',
    ctcRupees: 1_800_000,
    panNumber: 'AABPM2345B',
  },
  {
    key: 'sales',
    name: 'Sana Qureshi',
    email: 'sales@mediaoctus.test',
    role: 'sales_agent',
    department: 'Sales',
    designation: 'Account Executive',
    workLocation: 'Mumbai',
    dateOfJoining: '2024-02-05',
    managerKey: 'manager',
    ctcRupees: 720_000,
    panNumber: 'AACPQ3456C',
  },
  {
    key: 'ops',
    name: 'Vikram Iyer',
    email: 'ops@mediaoctus.test',
    role: 'ops',
    department: 'Operations',
    designation: 'Operations Lead',
    workLocation: 'Pune',
    dateOfJoining: '2022-09-19',
    managerKey: 'admin',
    ctcRupees: 1_320_000,
    panNumber: 'AADPI4567D',
  },
  {
    key: 'finance',
    name: 'Neha Bansal',
    email: 'finance@mediaoctus.test',
    role: 'finance',
    department: 'Finance',
    designation: 'Finance Controller',
    workLocation: 'Mumbai',
    dateOfJoining: '2020-11-02',
    managerKey: 'admin',
    ctcRupees: 1_650_000,
    panNumber: 'AAEPB5678E',
  },
  {
    key: 'hr',
    name: 'Imran Shaikh',
    email: 'hr@mediaoctus.test',
    role: 'hr',
    department: 'HR',
    designation: 'HR Manager',
    workLocation: 'Mumbai',
    dateOfJoining: '2023-01-09',
    managerKey: 'admin',
    ctcRupees: 1_100_000,
    panNumber: 'AAFPS6789F',
  },
  {
    key: 'employee',
    name: 'Priya Nair',
    email: 'employee@mediaoctus.test',
    role: 'employee',
    department: 'Operations',
    designation: 'Field Executive',
    workLocation: 'Pune',
    dateOfJoining: '2025-03-17',
    managerKey: 'ops',
    ctcRupees: 480_000,
    panNumber: 'AAGPN7890G',
  },
];

/** A handful of extra employees, with no login, so the list has something to paginate. */
const EXTRA_STAFF: DemoPerson[] = [
  {
    key: 'extra-1',
    name: 'Kabir Deshpande',
    department: 'Sales',
    designation: 'Account Executive',
    workLocation: 'Delhi',
    dateOfJoining: '2024-07-22',
    managerKey: 'manager',
    ctcRupees: 660_000,
    panNumber: 'AAHPD8901H',
  },
  {
    key: 'extra-2',
    name: 'Meera Krishnan',
    department: 'Marketing',
    designation: 'Creative Designer',
    workLocation: 'Mumbai',
    dateOfJoining: '2025-01-06',
    managerKey: 'admin',
    ctcRupees: 840_000,
    panNumber: 'AAIPK9012I',
  },
  {
    key: 'extra-3',
    name: 'Sourav Ghosh',
    department: 'Operations',
    designation: 'Site Supervisor',
    workLocation: 'Kolkata',
    dateOfJoining: '2023-08-11',
    managerKey: 'ops',
    ctcRupees: 540_000,
    panNumber: 'AAJPG0123J',
  },
];

function mobileFor(index: number): string {
  return String(9800000000 + index);
}

async function seedUsers(resetPasswords: boolean): Promise<Map<string, Types.ObjectId>> {
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  const userIds = new Map<string, Types.ObjectId>();

  console.log('\nUsers');

  for (const person of DEMO_PEOPLE) {
    if (!person.email || !person.role) continue;

    const existing = await AuthUser.findOne({ email: person.email });

    if (!existing) {
      const created = await AuthUser.create({
        name: person.name,
        email: person.email,
        passwordHash,
        role: person.role,
        status: 'Active',
      });
      userIds.set(person.key, created._id as Types.ObjectId);
      console.log(`  created  ${person.email.padEnd(30)} ${ROLE_LABELS[person.role]}`);
      continue;
    }

    userIds.set(person.key, existing._id as Types.ObjectId);

    if (resetPasswords) {
      existing.passwordHash = passwordHash;
      existing.role = person.role;
      existing.status = 'Active';
      existing.deletedAt = null;
      await existing.save();
      console.log(`  reset    ${person.email.padEnd(30)} ${ROLE_LABELS[person.role]}`);
    } else {
      console.log(`  skipped  ${person.email.padEnd(30)} (already exists)`);
    }
  }

  return userIds;
}

async function seedEmployees(userIds: Map<string, Types.ObjectId>): Promise<void> {
  console.log('\nEmployees');

  const employeeIds = new Map<string, Types.ObjectId>();
  const roster = [...DEMO_PEOPLE, ...EXTRA_STAFF];

  // Two passes: create everyone first, then wire up the reporting hierarchy.
  // A manager has to exist before someone can point at them.
  for (const [index, person] of roster.entries()) {
    const workEmail =
      person.email ?? `${person.name.toLowerCase().replace(/[^a-z]+/g, '.')}@mediaoctus.test`;

    const existing = await Employee.findOne({ workEmail });

    if (existing) {
      employeeIds.set(person.key, existing._id as Types.ObjectId);
      console.log(`  skipped  ${existing.employeeCode}  ${person.name}`);
      continue;
    }

    const created = await Employee.create({
      employeeCode: await formattedSequence('employee', 'MO-EMP'),
      userId: userIds.get(person.key) ?? null,
      fullName: person.name,
      workEmail,
      mobile: mobileFor(index),
      department: person.department,
      designation: person.designation,
      employmentType: 'Full-time',
      dateOfJoining: new Date(person.dateOfJoining),
      workLocation: person.workLocation,
      status: 'Active',
      panNumber: person.panNumber,
      // Rupees → integer paise. The API does this conversion in its validator;
      // here we are writing to the model directly, so we do it ourselves.
      annualCtc: person.ctcRupees * 100,
      emergencyContact: {
        name: 'Emergency Contact',
        relationship: 'Spouse',
        mobile: mobileFor(index + 100),
      },
    });

    employeeIds.set(person.key, created._id as Types.ObjectId);
    console.log(`  created  ${created.employeeCode}  ${person.name}`);
  }

  let linked = 0;
  for (const person of roster) {
    if (!person.managerKey) continue;

    const employeeId = employeeIds.get(person.key);
    const managerId = employeeIds.get(person.managerKey);
    if (!employeeId || !managerId) continue;

    const result = await Employee.updateOne(
      { _id: employeeId, reportingManagerId: null },
      { $set: { reportingManagerId: managerId } },
    );

    linked += result.modifiedCount;
  }

  console.log(`  linked   ${linked} reporting relationship${linked === 1 ? '' : 's'}`);
}

async function seedHolidays() {
  console.log('\nHolidays');
  const defaultHolidays = [
    { name: "New Year's Day", date: new Date(Date.UTC(2026, 0, 1)) },
    { name: 'Republic Day', date: new Date(Date.UTC(2026, 0, 26)) },
    { name: 'Independence Day', date: new Date(Date.UTC(2026, 7, 15)) },
    { name: 'Gandhi Jayanti', date: new Date(Date.UTC(2026, 9, 2)) },
    { name: 'Christmas Day', date: new Date(Date.UTC(2026, 11, 25)) },
  ];

  for (const h of defaultHolidays) {
    const existing = await Holiday.findOne({ date: h.date, deletedAt: null });
    if (!existing) {
      await Holiday.create(h);
      console.log(`  created  ${h.name.padEnd(30)} ${h.date.toISOString().slice(0, 10)}`);
    } else {
      console.log(`  skipped  ${h.name.padEnd(30)} (already exists)`);
    }
  }
}

async function seedLeaveTypesAndBalances(): Promise<void> {
  console.log('\nLeave Types & Balances');
  const { LeaveType, LeaveBalance } = await import('../modules/HR/leaveTypes/leaveTypes.model.js');
  const { Employee } = await import('../modules/employees/employees.model.js');

  const defaultTypes = [
    { name: 'Casual Leave', code: 'CL', annualQuota: 12, carryForward: false, maxCarryForward: 0, encashable: false, requiresDocument: false, status: 'Active' as const },
    { name: 'Sick Leave', code: 'SL', annualQuota: 12, carryForward: false, maxCarryForward: 0, encashable: false, requiresDocument: false, status: 'Active' as const },
    { name: 'Privilege Leave', code: 'PL', annualQuota: 15, carryForward: true, maxCarryForward: 30, encashable: true, requiresDocument: false, status: 'Active' as const },
    { name: 'Maternity Leave', code: 'ML', annualQuota: 182, carryForward: false, maxCarryForward: 0, encashable: false, requiresDocument: false, status: 'Active' as const },
    { name: 'Paternity Leave', code: 'PTL', annualQuota: 15, carryForward: false, maxCarryForward: 0, encashable: false, requiresDocument: false, status: 'Active' as const },
    { name: 'Compensatory Off', code: 'COMP', annualQuota: 0, carryForward: false, maxCarryForward: 0, encashable: false, requiresDocument: false, status: 'Active' as const },
    { name: 'Leave Without Pay', code: 'LWP', annualQuota: null, carryForward: false, maxCarryForward: 0, encashable: false, requiresDocument: false, status: 'Active' as const },
  ];

  const allowedCodes = defaultTypes.map((t) => t.code);
  const obsoleteTypes = await LeaveType.find({ code: { $nin: allowedCodes } });
  if (obsoleteTypes.length > 0) {
    const obsoleteIds = obsoleteTypes.map((ot) => ot._id);
    await LeaveBalance.deleteMany({ leaveTypeId: { $in: obsoleteIds } });
    await LeaveType.deleteMany({ _id: { $in: obsoleteIds } });
    console.log(`  removed ${obsoleteTypes.length} obsolete leave types and their balances`);
  }

  const year = new Date().getFullYear();
  const employeeDocs = await Employee.find({ deletedAt: null });

  for (const t of defaultTypes) {
    let leaveType = await LeaveType.findOne({ code: t.code, deletedAt: null });
    if (!leaveType) {
      leaveType = await LeaveType.create(t);
      console.log(`  created leave type: ${t.name} (${t.code})`);
    } else {
      leaveType.name = t.name;
      leaveType.annualQuota = t.annualQuota;
      leaveType.carryForward = t.carryForward;
      leaveType.maxCarryForward = t.maxCarryForward;
      leaveType.encashable = t.encashable;
      leaveType.requiresDocument = t.requiresDocument;
      leaveType.status = t.status;
      await leaveType.save();
      console.log(`  updated/verified leave type: ${t.name} (${t.code})`);
    }

    if (t.annualQuota !== null) {
      for (const emp of employeeDocs) {
        const existingBalance = await LeaveBalance.findOne({
          employeeId: emp._id,
          leaveTypeId: leaveType._id,
          year,
        });

        if (!existingBalance) {
          await LeaveBalance.create({
            employeeId: emp._id,
            leaveTypeId: leaveType._id,
            year,
            allocated: t.annualQuota,
            used: 0,
            carriedForward: 0,
          });
        } else {
          existingBalance.allocated = t.annualQuota;
          await existingBalance.save();
        }
      }
    }
  }
}

async function seed() {
  if (config.isProduction) {
    throw new Error('Refusing to run the seed script with NODE_ENV=production');
  }

  const resetPasswords = process.argv.includes('--reset-passwords');

  await connectDatabase();

  const userIds = await seedUsers(resetPasswords);
  await seedEmployees(userIds);
  await seedHolidays();
  await seedLeaveTypesAndBalances();

  console.log(`\nDemo password for every seeded account: ${DEMO_PASSWORD}`);
  console.log('Sign in, then read the OTP off the login screen (dev mode) or the API log.\n');

  await disconnectDatabase();
}


seed().catch((err) => {
  console.error('[seed] failed:', err);
  process.exit(1);
});
