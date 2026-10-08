import mongoose from 'mongoose';

import { config } from '../../config/index.js';

/**
 * Connect to MongoDB. Run Mongo as a single-node replica set locally — multi-document
 * transactions (payments, bookings, payroll) do not work on a standalone `mongod`.
 * See the README for the one-time `rs.initiate()` setup.
 */
export async function connectDatabase(maxRetries = 3): Promise<typeof mongoose> {
  mongoose.set('strictQuery', true);

  let lastError: unknown;
  for (let attempt = 1; attempt <= maxRetries; attempt += 1) {
    try {
      const connection = await mongoose.connect(config.mongoUri, {
        serverSelectionTimeoutMS: 30_000,
      });

      console.log(`[db] connected to ${connection.connection.name}`);
      return connection;
    } catch (err) {
      lastError = err;
      console.warn(
        `[db] connection attempt ${attempt}/${maxRetries} failed: ${(err as Error)?.message}`,
      );
      if (attempt < maxRetries) {
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
    }
  }

  throw lastError;
}

export async function disconnectDatabase(): Promise<void> {
  await mongoose.disconnect();
  console.log('[db] disconnected');
}
