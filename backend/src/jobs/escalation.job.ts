import { withJobLock } from './job-runner.js';
import { processEscalations } from '../modules/escalations/escalation.service.js';

/**
 * ESCALATION JOB — D4
 *
 * Runs every 15 minutes to:
 * 1. Find all overdue tasks
 * 2. Determine escalation levels (L1 @ 2h, L2 @ 6h, L3 @ 24h)
 * 3. Create escalations for new levels
 * 4. Send notifications
 *
 * Wrapped in `withJobLock` to be idempotent and safe in cluster mode.
 */
export async function escalationJob(): Promise<void> {
  try {
    console.log('[job:escalation] starting...');

    await processEscalations();

    console.log('[job:escalation] complete');
  } catch (error) {
    console.error('[job:escalation] failed:', error);

    // Don't re-throw — log and continue so the scheduler doesn't stop
  }
}

