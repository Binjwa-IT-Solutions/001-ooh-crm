import mongoose from 'mongoose';

import { config } from '../../config/index.js';

/**
 * Asserts that the active Mongoose connection is targeting an isolated test database.
 * If not, immediately throws a fatal error to prevent accidental deletion of development data.
 */
export function assertTestDatabase(mongooseInstance: typeof mongoose = mongoose): void {
  const dbName = mongooseInstance.connection.name;
  if (!dbName || !dbName.toLowerCase().includes('test')) {
    throw new Error(
      `[FATAL DB SAFETY GUARD]: Destructive operation blocked! The current database connection "${dbName}" is not an isolated test database (must contain "test"). Aborting test immediately without modifying any data.`,
    );
  }
}

/**
 * Connect to MongoDB. Run Mongo as a single-node replica set locally — multi-document
 * transactions (payments, bookings, payroll) do not work on a standalone `mongod`.
 * See the README for the one-time `rs.initiate()` setup.
 */
export async function connectDatabase(options?: { isTestConnection?: boolean }): Promise<typeof mongoose> {
  mongoose.set('strictQuery', true);

  const isTest = config.isTest || options?.isTestConnection === true;
  const targetUri = isTest ? config.mongoTestUri : config.mongoUri;

  const connection = await mongoose.connect(targetUri, {
    serverSelectionTimeoutMS: 10_000,
    retryWrites: false,
  });

  const connectedDbName = connection.connection.name;

  if (isTest) {
    const isSafeTestDb = connectedDbName.toLowerCase().includes('test');
    if (!isSafeTestDb) {
      await mongoose.disconnect();
      throw new Error(
        `[FATAL DB SAFETY GUARD]: Test suite connected to non-test database "${connectedDbName}". ` +
        `Tests must only run against a dedicated test database (must contain "test"). Aborting test immediately without modifying any data.`,
      );
    }
  }

  console.log(`[db] connected to ${connectedDbName}${isTest ? ' (TEST DB - ISOLATED)' : ''}`);
  return connection;
}

export async function disconnectDatabase(): Promise<void> {
  await mongoose.disconnect();
  console.log('[db] disconnected');
}
