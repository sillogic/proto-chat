import { AgentCronJobModel } from '@/database/models/agentCronJob';
import { getServerDB } from '@/database/server';

import { getAgentCronExecutionQueue } from '../queues';

// ─────────────────────────────────────────────────────────────
// Cron pattern matching (no external dependency)
// Handles: *  */n  n,m  n-m  exact values
// Field order: minute hour day-of-month month day-of-week
// ─────────────────────────────────────────────────────────────

function matchField(field: string, value: number): boolean {
  if (field === '*') return true;

  if (field.includes('/')) {
    const [range, stepStr] = field.split('/');
    const step = parseInt(stepStr, 10);
    if (range === '*') return value % step === 0;
    const [start, end] = range.includes('-')
      ? range.split('-').map(Number)
      : [parseInt(range, 10), 59];
    return value >= start && value <= end && (value - start) % step === 0;
  }

  if (field.includes(',')) {
    return field.split(',').some((f) => matchField(f.trim(), value));
  }

  if (field.includes('-')) {
    const [start, end] = field.split('-').map(Number);
    return value >= start && value <= end;
  }

  return parseInt(field, 10) === value;
}

const WEEKDAY_SHORT: Record<string, number> = {
  Fri: 5,
  Mon: 1,
  Sat: 6,
  Sun: 0,
  Thu: 4,
  Tue: 2,
  Wed: 3,
};

function isDue(cronPattern: string, timezone: string): boolean {
  try {
    const now = new Date();
    const parts = new Intl.DateTimeFormat('en-US', {
      day: 'numeric',
      hour: 'numeric',
      hour12: false,
      minute: 'numeric',
      month: 'numeric',
      timeZone: timezone,
      weekday: 'short',
      year: 'numeric',
    }).formatToParts(now);

    const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '0';

    const minute = parseInt(get('minute'), 10);
    const hour = parseInt(get('hour'), 10) % 24; // normalize midnight 24→0
    const dayOfMonth = parseInt(get('day'), 10);
    const month = parseInt(get('month'), 10);
    const weekday = WEEKDAY_SHORT[get('weekday')] ?? 0;

    const [minPart, hourPart, domPart, monPart, dowPart] = cronPattern.trim().split(/\s+/);
    if (!minPart || !hourPart || !domPart || !monPart || !dowPart) return false;

    return (
      matchField(minPart, minute) &&
      matchField(hourPart, hour) &&
      matchField(domPart, dayOfMonth) &&
      matchField(monPart, month) &&
      matchField(dowPart, weekday)
    );
  } catch {
    return false;
  }
}

// ─────────────────────────────────────────────────────────────
// Dispatcher processor — runs every minute via BullMQ repeat
// ─────────────────────────────────────────────────────────────

export const dispatchAgentCronJobs = async () => {
  const db = await getServerDB();
  const allJobs = await AgentCronJobModel.getEnabledJobs(db);

  const dueJobs = allJobs.filter((job) => isDue(job.cronPattern, job.timezone ?? 'UTC'));

  if (dueJobs.length === 0) {
    return { dispatched: 0, total: allJobs.length };
  }

  const queue = getAgentCronExecutionQueue();
  const minuteKey = Math.floor(Date.now() / 60_000);
  let dispatched = 0;

  await Promise.all(
    dueJobs.map(async (job) => {
      try {
        // Deterministic jobId prevents double-enqueue if BullMQ fires twice in one minute
        const jobId = `acron:${job.id}:${minuteKey}`;
        await queue.add(
          'execute',
          { agentCronJobId: job.id, agentId: job.agentId!, userId: job.userId },
          { jobId },
        );
        dispatched++;
      } catch (err) {
        console.error(`[agent-cron:dispatch] Failed to enqueue job=${job.id}:`, err);
      }
    }),
  );

  return { dispatched, total: allJobs.length };
};
