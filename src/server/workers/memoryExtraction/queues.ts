import { Queue } from 'bullmq';

import { createBullMQConnection } from '@/libs/bullmq';
import type { MemoryExtractionPayloadInput } from '@/server/services/memory/userMemory/extract';

export const QUEUE_NAMES = {
  hourlyAnalysis: 'memory-extraction-hourly-analysis',
  processTopics: 'memory-extraction-process-topics',
  processUserTopics: 'memory-extraction-process-user-topics',
  processUsers: 'memory-extraction-process-users',
  updatePersona: 'memory-extraction-update-persona',
} as const;

export interface HourlyAnalysisJobData {
  cursor?: { createdAt: string; id: string };
  dryRun?: boolean;
}

// All pipeline jobs share the same MemoryExtractionPayloadInput shape.
// BullMQ serialises job data as JSON; Date objects become ISO strings —
// workers must re-parse via memoryExtractionPayloadSchema before use.
export type ProcessUsersJobData = MemoryExtractionPayloadInput;
export type ProcessUserTopicsJobData = MemoryExtractionPayloadInput;
export type ProcessTopicsJobData = MemoryExtractionPayloadInput;

export interface UpdatePersonaJobData {
  userId: string;
}

const DEFAULT_JOB_OPTIONS = {
  attempts: 3,
  backoff: { delay: 5000, type: 'exponential' as const },
  removeOnComplete: 200,
  removeOnFail: 200,
};

// Queues are lazily created on first access to avoid connecting to Redis at
// module load time (e.g. in edge-runtime API routes that only enqueue jobs).
let _hourlyAnalysisQueue: Queue<HourlyAnalysisJobData> | null = null;
let _processUsersQueue: Queue<ProcessUsersJobData> | null = null;
let _processUserTopicsQueue: Queue<ProcessUserTopicsJobData> | null = null;
let _processTopicsQueue: Queue<ProcessTopicsJobData> | null = null;
let _updatePersonaQueue: Queue<UpdatePersonaJobData> | null = null;

export const getHourlyAnalysisQueue = () => {
  if (!_hourlyAnalysisQueue) {
    _hourlyAnalysisQueue = new Queue<HourlyAnalysisJobData>(QUEUE_NAMES.hourlyAnalysis, {
      connection: createBullMQConnection(),
      defaultJobOptions: DEFAULT_JOB_OPTIONS,
    });
  }
  return _hourlyAnalysisQueue;
};

export const getProcessUsersQueue = () => {
  if (!_processUsersQueue) {
    _processUsersQueue = new Queue<ProcessUsersJobData>(QUEUE_NAMES.processUsers, {
      connection: createBullMQConnection(),
      defaultJobOptions: DEFAULT_JOB_OPTIONS,
    });
  }
  return _processUsersQueue;
};

export const getProcessUserTopicsQueue = () => {
  if (!_processUserTopicsQueue) {
    _processUserTopicsQueue = new Queue<ProcessUserTopicsJobData>(QUEUE_NAMES.processUserTopics, {
      connection: createBullMQConnection(),
      defaultJobOptions: DEFAULT_JOB_OPTIONS,
    });
  }
  return _processUserTopicsQueue;
};

export const getProcessTopicsQueue = () => {
  if (!_processTopicsQueue) {
    _processTopicsQueue = new Queue<ProcessTopicsJobData>(QUEUE_NAMES.processTopics, {
      connection: createBullMQConnection(),
      defaultJobOptions: DEFAULT_JOB_OPTIONS,
    });
  }
  return _processTopicsQueue;
};

export const getUpdatePersonaQueue = () => {
  if (!_updatePersonaQueue) {
    _updatePersonaQueue = new Queue<UpdatePersonaJobData>(QUEUE_NAMES.updatePersona, {
      connection: createBullMQConnection(),
      defaultJobOptions: { ...DEFAULT_JOB_OPTIONS, backoff: { delay: 2000, type: 'exponential' } },
    });
  }
  return _updatePersonaQueue;
};
