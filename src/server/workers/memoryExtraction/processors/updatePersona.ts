import { type Job } from 'bullmq';

import { getServerDB } from '@/database/server';
import {
  buildUserPersonaJobInput,
  UserPersonaService,
} from '@/server/services/memory/userMemory/persona/service';

import { type UpdatePersonaJobData } from '../queues';

export const updatePersona = async (job: Job<UpdatePersonaJobData>) => {
  const { userId } = job.data;

  if (!userId) {
    throw new Error('Missing userId for persona update.');
  }

  const db = await getServerDB();
  const service = new UserPersonaService(db);
  const context = await buildUserPersonaJobInput(db, userId);
  const result = await service.composeWriting({ ...context, userId });

  console.log('[memory:update-persona] Done:', {
    diffId: result.diff?.id,
    documentId: result.document.id,
    userId,
    version: result.document.version,
  });

  return {
    diffId: result.diff?.id,
    documentId: result.document.id,
    userId,
    version: result.document.version,
  };
};
