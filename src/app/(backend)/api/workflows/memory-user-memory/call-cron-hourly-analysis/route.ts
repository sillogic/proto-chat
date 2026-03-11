import { NextResponse } from 'next/server';

import { MemoryExtractionBullMQService } from '@/server/workers/memoryExtraction/service';

/**
 * POST /api/workflows/memory-user-memory/call-cron-hourly-analysis
 *
 * Triggered by the cron job. Enqueues a BullMQ hourly-analysis job that fans out
 * process-users jobs for all eligible users (paginated internally by the worker).
 */
export const POST = async (req: Request) => {
  try {
    const body = await req.json().catch(() => ({}));
    const { cursor, dryRun } = body as { cursor?: { createdAt: string; id: string }; dryRun?: boolean };

    const job = await MemoryExtractionBullMQService.enqueueHourlyAnalysis({ cursor, dryRun });

    return NextResponse.json(
      { jobId: job?.id, message: 'Hourly memory extraction scheduled via BullMQ.' },
      { status: 202 },
    );
  } catch (error) {
    console.error('[memory-extraction:hourly] failed to enqueue job', error);
    return NextResponse.json({ error: (error as Error).message }, { status: 500 });
  }
};
