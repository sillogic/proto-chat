/**
 * Bull Board — BullMQ queue monitoring UI
 *
 * Accessible at: /queues (opens in new browser tab from admin sidebar)
 * Protected by HttpOnly cookie set during admin login.
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
import cookieParser from 'cookie-parser';
import { type NextFunction, type Request, type Response, Router } from 'express';
import IORedis from 'ioredis';
import jwt from 'jsonwebtoken';

import { JWT_SECRET } from '../config/auth';

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

/**
 * Verify the admin_token cookie set during login.
 * Returns 401 HTML page (not JSON) so the browser shows a meaningful message.
 */
function requireAdminCookie(req: Request, res: Response, next: NextFunction) {
  const token = req.cookies?.admin_token;
  if (!token) {
    return res.status(401).send(
      '<h3>Unauthorized</h3><p>Please log in to the admin system first, then revisit this page.</p>',
    );
  }
  try {
    jwt.verify(token, JWT_SECRET as string);
    next();
  } catch {
    return res.status(401).send(
      '<h3>Session expired</h3><p>Please log in to the admin system again.</p>',
    );
  }
}

export function createBullBoardRouter() {
  const redisUrl = process.env.REDIS_URL;

  if (!redisUrl) {
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
    ...(process.env.REDIS_TLS === '1' || process.env.REDIS_TLS === 'true' ? { tls: {} } : {}),
  });

  const queues = QUEUE_NAMES.map((name) => new BullMQAdapter(new Queue(name, { connection })));

  const serverAdapter = new ExpressAdapter();
  serverAdapter.setBasePath(BASE_PATH);

  createBullBoard({ queues, serverAdapter });

  const router = Router();

  // Parse cookies so we can read admin_token
  router.use(cookieParser());

  // Verify admin login cookie
  router.use(requireAdminCookie);

  // Bull Board UI + API
  router.use(serverAdapter.getRouter());

  return router;
}
