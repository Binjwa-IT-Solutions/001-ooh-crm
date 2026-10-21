/**
 * Creates the initial live login accounts. Run once against the live database;
 * the client creates further users from the app.
 *
 *   1. Set MONGO_URI in backend/.env to the live Atlas URI
 *   2. npm run seed:live-users
 *   3. Set MONGO_URI back to your local database
 *
 * Safe to re-run: an existing account is reported and left untouched. Each new
 * account gets a random password printed once — share it privately; an admin can
 * reset it from the user's profile. Users enrol their authenticator at first
 * sign-in, and HR fills the employee records (their own prompt covers the rest).
 */
import crypto from 'node:crypto';

import bcrypt from 'bcryptjs';

import { config } from '../config/index.js';
import { AuthUser } from '../core/auth/auth-model.js';
import { connectDatabase, disconnectDatabase } from '../core/db/connect.js';
import { ROLE_LABELS, type Role } from '../core/rbac/permissions.js';

const LIVE_USERS: Array<{ name: string; email: string; role: Role }> = [
  { name: 'Mansi', email: 'mansi@mediaoctus.com', role: 'sales_agent' },
  { name: 'Aishwarya', email: 'aishwarya@mediaoctus.com', role: 'hr' },
  { name: 'Krati', email: 'krati@mediaoctus.com', role: 'ops' },
  { name: 'Director', email: 'director@mediaoctus.com', role: 'admin' },
];

/** Host and database name only — never echo credentials from the URI. */
function describeTarget(uri: string): string {
  const match = uri.match(/^mongodb(?:\+srv)?:\/\/(?:[^@/]+@)?([^/?]+)\/?([^?]*)/);
  return match ? `${match[1]} / ${match[2] || '(default db)'}` : '(unparseable MONGO_URI)';
}

function generatePassword(): string {
  // 18 URL-safe characters (~108 bits); comfortably above the 8-character minimum.
  return crypto.randomBytes(14).toString('base64url').slice(0, 18);
}

async function main() {
  console.log(`\nTarget database: ${describeTarget(config.mongoUri)}\n`);

  await connectDatabase();
  const created: Array<{ email: string; password: string }> = [];

  try {
    for (const person of LIVE_USERS) {
      const existing = await AuthUser.findOne({ email: person.email }).select('role status deletedAt');
      if (existing) {
        const state = existing.deletedAt ? 'deleted' : existing.status;
        console.log(`  exists   ${person.email.padEnd(28)} ${existing.role} (${state}) — left unchanged`);
        continue;
      }

      const password = generatePassword();
      await AuthUser.create({
        name: person.name,
        email: person.email,
        passwordHash: await bcrypt.hash(password, 10),
        role: person.role,
        status: 'Active',
      });
      created.push({ email: person.email, password });
      console.log(`  created  ${person.email.padEnd(28)} ${ROLE_LABELS[person.role]}`);
    }
  } finally {
    await disconnectDatabase();
  }

  if (created.length > 0) {
    console.log('\nTemporary passwords (shown once — copy them now and share privately):');
    for (const { email, password } of created) {
      console.log(`  ${email.padEnd(28)} ${password}`);
    }
  }
  console.log('');
}

main().catch((err) => {
  console.error('[seed:live-users] failed:', err instanceof Error ? err.message : err);
  process.exit(1);
});
