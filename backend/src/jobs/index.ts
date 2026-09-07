import cron, { type ScheduledTask } from 'node-cron';

import { config } from '../config/index.js';
import { withJobLock } from './job-runner.js';
import { escalationJob } from './escalation.job.js';

export { withJobLock } from './job-runner.js';

/**
 * SCHEDULED JOBS.
 *
 * `startJobs()` is called once from `server.ts`. Register your module's job
 * here — the file itself lives next to this one as `<name>.job.ts`.
 *
 * Jobs the spec calls for, and who owns them:
 *   escalation.job.ts      every 15 minutes   D4
 *   finance-rollup.job.ts  nightly            F3
 *   audit-checks.job.ts    nightly + manual   H1
 *
 * Wrap the body in `withJobLock` — see job-runner.ts for why that is not
 * optional once the app runs in PM2 cluster mode.
 */

interface JobDefinition {
  name: string;
  /** Standard five-field cron expression. */
  schedule: string;
  /** How long the lock is held if the process dies mid-run. */
  lockTtlSeconds: number;
  run: () => Promise<void>;
  description: string;
}

const JOBS: JobDefinition[] = [
  {
    name: 'escalation',
    schedule: '*/15 * * * *',
    lockTtlSeconds: 15 * 60,
    description: 'D4 — escalate overdue tasks',
    run: escalationJob,
  },
  {
    name: 'heartbeat',
    // 03:00 daily. Proves the scheduler is alive without doing any work.
    schedule: '0 3 * * *',
    lockTtlSeconds: 60,
    description: 'Scaffolding check — replace with a real job',
    run: async () => {
      console.log('[job:heartbeat] scheduler is running');
    },
  },
];

const running: ScheduledTask[] = [];

export function startJobs(): void {
  if (!config.jobs.enabled) {
    console.log('[jobs] disabled (set JOBS_ENABLED=true to run scheduled jobs)');
    return;
  }

  for (const job of JOBS) {
    if (!cron.validate(job.schedule)) {
      console.error(`[jobs] "${job.name}" has an invalid cron expression: ${job.schedule}`);
      continue;
    }

    const task = cron.schedule(
      job.schedule,
      () => {
        void withJobLock(job.name, job.lockTtlSeconds, job.run);
      },
      { timezone: config.jobs.timezone },
    );

    running.push(task);
    console.log(`[jobs] scheduled "${job.name}" (${job.schedule}) — ${job.description}`);
  }
}

export function stopJobs(): void {
  for (const task of running) task.stop();
  running.length = 0;
}

/**
 * Runs one job immediately, ignoring its schedule but respecting its lock.
 * Useful for the "run now" button H1 needs, and for testing your job without
 * waiting for the cron to fire.
 */
export async function runJobNow(name: string): Promise<boolean> {
  const job = JOBS.find((candidate) => candidate.name === name);
  if (!job) throw new Error(`No job registered under the name "${name}"`);

  return withJobLock(job.name, job.lockTtlSeconds, job.run);
}

export function listJobs(): Array<Pick<JobDefinition, 'name' | 'schedule' | 'description'>> {
  return JOBS.map(({ name, schedule, description }) => ({ name, schedule, description }));
}
