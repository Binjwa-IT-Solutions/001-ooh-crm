import mongoose from 'mongoose';

/**
 * Runs `fn` inside a MongoDB transaction when the connection supports
 * transactions (replica-set or Atlas), or without a session when it does not
 * (e.g. standalone dev MongoDB).
 *
 * Usage:
 *   return withOptionalTransaction(async (session) => {
 *     await Doc.create([...], { session });
 *   });
 */
export async function withOptionalTransaction<T>(
  fn: (session: mongoose.ClientSession | undefined) => Promise<T>
): Promise<T> {
  let session: mongoose.ClientSession | undefined;

  try {
    session = await mongoose.startSession();
    try {
      session.startTransaction();
      const result = await fn(session);
      await session.commitTransaction();
      return result;
    } catch (txErr) {
      // If transaction fails, retry without session
      const errMsg = (txErr as Error).message ?? '';
      if (
        errMsg.includes('Transaction numbers are only allowed') ||
        errMsg.includes('does not support transactions') ||
        errMsg.includes('not supported') ||
        errMsg.includes('MongoServerError') ||
        errMsg.includes('retryable writes') ||
        errMsg.includes('retryWrites') ||
        errMsg.includes('transactions are only') ||
        errMsg.includes('not replica set')
      ) {
        try { await session.abortTransaction(); } catch { /* ignore */ }
        session.endSession();
        // Retry without a transaction
        return fn(undefined);
      }
      try { await session.abortTransaction(); } catch { /* ignore */ }
      throw txErr;
    }
  } catch (err) {
    if (session) {
      try { session.endSession(); } catch { /* ignore */ }
    }
    throw err;
  } finally {
    if (session) {
      try { session.endSession(); } catch { /* ignore */ }
    }
  }
}
