/**
 * Creates or removes a temporary admin account for testing on a live server.
 * Credentials come from the command line, so nothing secret lives in git.
 *
 *   npm run test-user -- create you@example.com YourPassword
 *   npm run test-user -- remove you@example.com
 *
 * `remove` deletes the login, its sessions and trusted devices, and the employee
 * record auto-created for it. Audit-log entries stay, by design.
 */
import bcrypt from 'bcryptjs';

import { config } from '../config/index.js';
import { AuthUser } from '../core/auth/auth-model.js';
import { RefreshToken } from '../core/auth/refresh-token-model.js';
import { LoginApproval, TrustedDevice } from '../core/auth/security-models.js';
import { connectDatabase, disconnectDatabase } from '../core/db/connect.js';
import { Employee } from '../modules/employees/employees.model.js';

const USAGE =
  'Usage:\n  npm run test-user -- create <email> <password>\n  npm run test-user -- remove <email>';

function describeTarget(uri: string): string {
  const match = uri.match(/^mongodb(?:\+srv)?:\/\/(?:[^@/]+@)?([^/?]+)\/?([^?]*)/);
  return match ? `${match[1]} / ${match[2] || '(default db)'}` : '(unparseable MONGO_URI)';
}

async function create(email: string, password: string) {
  if (password.length < 8) throw new Error('Password must be at least 8 characters');

  const existing = await AuthUser.findOne({ email });
  if (existing) {
    console.log(`  exists   ${email} — left unchanged (remove it first to recreate)`);
    return;
  }

  await AuthUser.create({
    name: 'Tarun Singh (test)',
    email,
    passwordHash: await bcrypt.hash(password, 10),
    role: 'admin',
    status: 'Active',
  });
  console.log(`  created  ${email} (admin)`);
}

async function remove(email: string) {
  const user = await AuthUser.findOne({ email });
  if (!user) {
    console.log(`  missing  ${email} — nothing to remove`);
    return;
  }

  const [employees, sessions, devices, approvals] = await Promise.all([
    Employee.deleteMany({ userId: user._id }),
    RefreshToken.deleteMany({ userId: user._id }),
    TrustedDevice.deleteMany({ userId: user._id }),
    LoginApproval.deleteMany({ userId: user._id }),
  ]);
  await AuthUser.deleteOne({ _id: user._id });

  console.log(
    `  removed  ${email} (+ ${employees.deletedCount} employee record, ${sessions.deletedCount} sessions, ` +
      `${devices.deletedCount} devices, ${approvals.deletedCount} approvals)`,
  );
}

async function main() {
  const [action, rawEmail, password] = process.argv.slice(2);
  const email = rawEmail?.trim().toLowerCase();
  if (!email || (action === 'create' && !password) || !['create', 'remove'].includes(action)) {
    console.error(USAGE);
    process.exit(1);
  }

  console.log(`\nTarget database: ${describeTarget(config.mongoUri)}\n`);
  await connectDatabase();
  try {
    if (action === 'create') await create(email, password);
    else await remove(email);
  } finally {
    await disconnectDatabase();
  }
  console.log('');
}

main().catch((err) => {
  console.error('[test-user] failed:', err instanceof Error ? err.message : err);
  process.exit(1);
});
