import IORedis from 'ioredis';

import { redisEnv } from '@/envs/redis';

/**
 * Creates a new IORedis connection configured for BullMQ.
 *
 * BullMQ requires:
 * - `maxRetriesPerRequest: null` — for blocking commands used internally
 * - `enableReadyCheck: false` — to avoid startup race conditions
 *
 * A fresh connection is returned each time so callers (Queue, Worker, etc.)
 * each own their connection, as recommended by BullMQ.
 */
export const createBullMQConnection = (): IORedis => {
  if (!redisEnv.REDIS_URL) {
    throw new Error('REDIS_URL is required for BullMQ queue workers');
  }

  return new IORedis(redisEnv.REDIS_URL, {
    db: redisEnv.REDIS_DATABASE,
    enableReadyCheck: false,
    maxRetriesPerRequest: null,
    password: redisEnv.REDIS_PASSWORD,
    tls: redisEnv.REDIS_TLS ? {} : undefined,
    username: redisEnv.REDIS_USERNAME,
  });
};
