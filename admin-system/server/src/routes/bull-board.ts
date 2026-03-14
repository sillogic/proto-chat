/**
 * Bull Board — BullMQ queue monitoring UI
 *
 * Accessible at: /queues
 * Protected by admin JWT auth.
 *
 * Shows all BullMQ queues used by the main app:
 *   - agent-cron-dispatch  (every-minute dispatcher)
 *   - agent-cron-execution (per-job LLM execution)
 *   - memory extraction queues
 */

import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';
import { Queue } from 'bullmq';
import { Router } from 'express';
import IORedis from 'ioredis';

const BASE_PATH = '/queues';

const QUEUE_NAMES = [
  // Agent cron job queues
  'agent-cron-dispatch',
  'agent-cron-execution',
  // Memory extraction queues
  'hourly-analysis',
  'process-users',
  'process-user-topics',
  'process-topics',
  'update-persona',
];

export function createBullBoardRouter() {
  const redisUrl = process.env.REDIS_URL;

  if (!redisUrl) {
    // Return a stub router that explains Redis is not configured
    const router = Router();
    router.get('*', (_req, res) => {
      res.status(503).json({ error: 'REDIS_URL not configured — Bull Board unavailable' });
    });
    return router;
  }

  const connection = new IORedis(redisUrl, {
    enableReadyCheck: false,
    lazyConnect: true,
    maxRetriesPerRequest: null,
    password: process.env.REDIS_PASSWORD || undefined,
    // Optional TLS
    ...(process.env.REDIS_TLS === '1' || process.env.REDIS_TLS === 'true' ? { tls: {} } : {}),
  });

  const queues = QUEUE_NAMES.map((name) => new BullMQAdapter(new Queue(name, { connection })));

  const serverAdapter = new ExpressAdapter();
  serverAdapter.setBasePath(BASE_PATH);

  createBullBoard({ queues, serverAdapter });

  // Bull Board's router handles both UI assets and API.
  // No JWT auth here — the admin system itself is behind login,
  // and Bull Board is read-only monitoring.
  return serverAdapter.getRouter();
}
