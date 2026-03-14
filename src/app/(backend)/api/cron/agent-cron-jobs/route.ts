/**
 * Agent Cron Jobs Dispatcher
 *
 * Called every minute by the system crontab.
 * Queries all enabled agent cron jobs, checks which ones are due to run right now
 * (based on cronPattern + timezone), and enqueues them into BullMQ.
 *
 * Actual LLM execution happens asynchronously in the BullMQ worker
 * (src/server/workers/agentCronJob), with concurrency limits to prevent
 * server overload across many users.
 *
 * Auth: Bearer $CRON_SECRET
 * Schedule: * * * * * (every minute)
 */

import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';

import { AgentCronJobModel } from '@/database/models/agentCronJob';
import { getServerDB } from '@/database/server';
import { AgentCronJobBullMQService } from '@/server/workers/agentCronJob/service';

const CRON_SECRET = process.env.CRON_SECRET || '';

// ─────────────────────────────────────────────────────────────
// Cron pattern matching (no external dependency)
// Handles: * */n n,m n-m exact values
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

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const token = authHeader?.replace('Bearer ', '');

  if (!CRON_SECRET || token !== CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const db = await getServerDB();
    const jobs = await AgentCronJobModel.getEnabledJobs(db);

    const dueJobs = jobs.filter((job) =>
      isDue(job.cronPattern, job.timezone ?? 'UTC'),
    );

    if (dueJobs.length === 0) {
      return NextResponse.json({ enqueued: 0, success: true });
    }

    let enqueued = 0;
    const errors: string[] = [];

    await Promise.all(
      dueJobs.map(async (job) => {
        try {
          await AgentCronJobBullMQService.enqueueJob({
            agentCronJobId: job.id,
            agentId: job.agentId!,
            userId: job.userId,
          });
          enqueued++;
        } catch (err) {
          const msg = err instanceof Error ? err.message : 'Unknown error';
          console.error(`[agent-cron:dispatch] Failed to enqueue job=${job.id}:`, msg);
          errors.push(`job=${job.id}: ${msg}`);
        }
      }),
    );

    console.log(
      `[agent-cron:dispatch] Due=${dueJobs.length} Enqueued=${enqueued} Errors=${errors.length}`,
    );

    return NextResponse.json({
      enqueued,
      errors: errors.length > 0 ? errors : undefined,
      success: true,
      total: dueJobs.length,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error('[agent-cron:dispatch] Fatal error:', error);
    return NextResponse.json({ error: msg, success: false }, { status: 500 });
  }
}
