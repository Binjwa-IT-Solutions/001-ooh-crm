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
  } catch {
    return fn(undefined);
  }

  try {
    try {
      session.startTransaction();
      const result = await fn(session);
      await session.commitTransaction();
      return result;
    } catch (txErr: any) {
      const errMsg = txErr?.message ?? '';
      const errCode = txErr?.code;
      const isTxUnsupported =
        errCode === 20 ||
        txErr?.codeName === 'IllegalOperation' ||
        errMsg.includes('Transaction numbers are only allowed') ||
        errMsg.includes('does not support transactions') ||
        errMsg.includes('not supported') ||
        errMsg.includes('replica set') ||
        errMsg.includes('MongoServerError') ||
        errMsg.includes('retryable writes') ||
        errMsg.includes('retryWrites') ||
        errMsg.includes('transactions are only') ||
        errMsg.includes('not replica set') ||
        errMsg.includes('Cannot start a transaction');

      if (isTxUnsupported) {
        try { await session.abortTransaction(); } catch { /* ignore */ }
        try { await session.endSession(); } catch { /* ignore */ }
        session = undefined;
        // Retry without a transaction
        return await fn(undefined);
      }

      try { await session.abortTransaction(); } catch { /* ignore */ }
      throw txErr;
    }
  } finally {
    if (session) {
      try { await session.endSession(); } catch { /* ignore */ }
    }
  }
}
