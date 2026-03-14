import debug from 'debug';
import { Worker } from 'bullmq';

import { createBullMQConnection } from '@/libs/bullmq';

import { QUEUE_NAMES, getHourlyAnalysisQueue } from './queues';
import { processHourlyAnalysis } from './processors/hourlyAnalysis';
import { processUsers } from './processors/processUsers';
import { processUserTopics } from './processors/processUserTopics';
import { processTopics } from './processors/processTopics';
import { updatePersona } from './processors/updatePersona';

const log = debug('lobe-server:workers:memory-extraction');

/**
 * Start all BullMQ workers for the memory extraction pipeline.
 *
 * Concurrency mirrors the Upstash flowControl parallelism values:
 * - hourlyAnalysis : 1  — only one hourly coordinator runs at a time
 * - processUsers   : 2  — light I/O fan-out, keep low
 * - processUserTopics : 10 — parallel topic pagination per user
 * - processTopics  : 10 — parallel LLM extraction batches
 * - updatePersona  : 5  — parallel persona composition
 */
export const startMemoryExtractionWorkers = () => {
  const workers: Worker[] = [];

  const hourlyWorker = new Worker(
    QUEUE_NAMES.hourlyAnalysis,
    processHourlyAnalysis,
    { concurrency: 1, connection: createBullMQConnection() },
  );

  const processUsersWorker = new Worker(
    QUEUE_NAMES.processUsers,
    processUsers,
    { concurrency: 2, connection: createBullMQConnection() },
  );

  const processUserTopicsWorker = new Worker(
    QUEUE_NAMES.processUserTopics,
    processUserTopics,
    { concurrency: 10, connection: createBullMQConnection() },
  );

  const processTopicsWorker = new Worker(
    QUEUE_NAMES.processTopics,
    processTopics,
    { concurrency: 10, connection: createBullMQConnection() },
  );

  const updatePersonaWorker = new Worker(
    QUEUE_NAMES.updatePersona,
    updatePersona,
    { concurrency: 5, connection: createBullMQConnection() },
  );

  workers.push(
    hourlyWorker,
    processUsersWorker,
    processUserTopicsWorker,
    processTopicsWorker,
    updatePersonaWorker,
  );

  for (const worker of workers) {
    worker.on('completed', (job) => {
      log('Job completed [%s:%s]', job.queueName, job.id);
    });

    worker.on('failed', (job, err) => {
      log('Job failed [%s:%s]: %O', job?.queueName, job?.id, err);
      console.error(`[memory-extraction worker] Job failed [${job?.queueName}:${job?.id}]:`, err);
    });

    worker.on('error', (err) => {
      log('Worker error [%s]: %O', worker.name, err);
      console.error(`[memory-extraction worker] Worker error [${worker.name}]:`, err);
    });
  }

  // Register repeatable hourly-analysis job (every hour at minute 0).
  // In upstream LobeChat this is triggered by an external cron service (Vercel/Upstash),
  // but for self-hosted we use BullMQ's built-in repeat — idempotent across restarts.
  const hourlyQueue = getHourlyAnalysisQueue();
  hourlyQueue.add('hourly-analysis', {}, {
    jobId: 'hourly-analysis:root',
    repeat: { pattern: '0 * * * *' },
  });

  log('Memory extraction workers started (%d workers), hourly-analysis registered (0 * * * *)', workers.length);

  return workers;
};
