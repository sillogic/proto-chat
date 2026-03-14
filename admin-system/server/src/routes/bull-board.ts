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

const QUEUES = [
  // ── Agent 定时任务 ──
  { description: '定时任务调度器 — 每分钟检查到期任务并入队', name: 'agent-cron-dispatch' },
  { description: '定时任务执行 — 调用 LLM 生成回复并存储对话', name: 'agent-cron-execution' },
  // ── 用户记忆提取（队列名须与主项目 QUEUE_NAMES 一致）──
  { description: '记忆提取入口 — 每小时分页扫描用户', name: 'memory-extraction-hourly-analysis' },
  { description: '记忆提取 — 按用户批量分发 Topic 任务', name: 'memory-extraction-process-users' },
  { description: '记忆提取 — 按用户分页拉取 Topic 列表', name: 'memory-extraction-process-user-topics' },
  { description: '记忆提取 — 对 Topic 批次执行 LLM 抽取', name: 'memory-extraction-process-topics' },
  { description: '记忆合成 — 汇总提取结果生成用户画像', name: 'memory-extraction-update-persona' },
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

export function createBullBoardRouter(): ReturnType<typeof Router> {
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

  const queues = QUEUES.map(
    ({ name, description }) =>
      new BullMQAdapter(new Queue(name, { connection: connection as any }), { description }),
  );

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
