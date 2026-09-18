import { LeadsService } from '../modules/leads/leads.service.js';

/**
 * LEAD SLA AUTO-UNCLAIM JOB
 *
 * Runs periodically to:
 * 1. Find all leads claimed by an agent > 24 hours ago with status 'New' and no action/firstResponse
 * 2. Auto-release them back to the Unclaimed pool so other sales reps can claim them
 * 3. Log a status history entry and notify the original agent
 */
export async function leadSlaReleaseJob(): Promise<void> {
  try {
    const released = await LeadsService.releaseBreachedClaimedLeads();
    if (released > 0) {
      console.log(`[job:lead-sla] Auto-released ${released} breached lead(s) back to unclaimed pool`);
    }
  } catch (error) {
    console.error('[job:lead-sla] failed to release breached leads:', error);
  }
}
