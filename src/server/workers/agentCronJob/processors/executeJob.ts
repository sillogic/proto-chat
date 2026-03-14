import { type Job } from 'bullmq';

import { AgentModel } from '@/database/models/agent';
import { AgentCronJobModel } from '@/database/models/agentCronJob';
import { MessageModel } from '@/database/models/message';
import { TopicModel } from '@/database/models/topic';
import { getServerDB } from '@/database/server';
import {
  initModelRuntimeFromDB,
  initModelRuntimeWithUserPayload,
} from '@/server/modules/ModelRuntime';
import { ProtoChatService } from '@/server/services/protochat';

import { type ExecuteAgentCronJobData } from '../queues';

const CRON_RESPONSE_SCHEMA = {
  name: 'cron_response',
  schema: {
    additionalProperties: false,
    properties: {
      content: {
        description: 'The complete agent response text',
        type: 'string',
      },
    },
    required: ['content'],
    type: 'object' as const,
  },
  strict: true,
};

export const executeAgentCronJob = async (job: Job<ExecuteAgentCronJobData>) => {
  const { agentCronJobId, agentId, userId } = job.data;

  const db = await getServerDB();

  // 1. Load and validate cron job
  const cronJobModel = new AgentCronJobModel(db, userId);
  const cronJob = await cronJobModel.findById(agentCronJobId);

  if (!cronJob) {
    return { reason: 'Cron job not found', skipped: true };
  }
  if (!cronJob.enabled) {
    return { reason: 'Cron job is disabled', skipped: true };
  }
  if (!cronJob.content?.trim()) {
    return { reason: 'Cron job has no content to send', skipped: true };
  }

  // 2. Load agent config
  const agentModel = new AgentModel(db, userId);
  const agent = await agentModel.getAgentConfigById(agentId);

  if (!agent) {
    return { reason: 'Agent not found', skipped: true };
  }

  const provider = agent.provider ?? 'openai';
  const model = agent.model;

  if (!model) {
    return { reason: 'Agent has no model configured', skipped: true };
  }

  // 3. Build messages
  const messages: Array<{ content: string; role: 'system' | 'user' }> = [];
  if (agent.systemRole?.trim()) {
    messages.push({ content: agent.systemRole, role: 'system' });
  }
  messages.push({ content: cronJob.content, role: 'user' });

  // 4. Initialize model runtime (same pattern as SystemAgentService)
  let modelRuntime;
  let effectiveModel = model;

  if (ProtoChatService.isProtoChatProvider(provider)) {
    const { actualModel, runtime } = await initModelRuntimeWithUserPayload(
      provider,
      {},
      { model },
    );
    modelRuntime = runtime;
    effectiveModel = actualModel || model;
  } else {
    modelRuntime = await initModelRuntimeFromDB(db, userId, provider);
  }

  // 5. Call LLM (non-streaming via generateObject)
  const result = await modelRuntime.generateObject(
    { messages: messages as any[], model: effectiveModel, schema: CRON_RESPONSE_SCHEMA },
    {},
  );

  const content = (result as { content?: string })?.content?.trim();
  if (!content) {
    throw new Error('LLM returned empty response');
  }

  // 6. Persist topic + messages
  const topicModel = new TopicModel(db, userId);
  const topic = await topicModel.create({
    agentId,
    metadata: { cronJobId: agentCronJobId } as any,
    title: cronJob.name || 'Scheduled Task',
    trigger: 'cron',
  });

  const messageModel = new MessageModel(db, userId);

  await messageModel.create({
    content: cronJob.content,
    role: 'user',
    topicId: topic.id,
  });

  await messageModel.create({
    content,
    model: effectiveModel,
    provider,
    role: 'assistant',
    topicId: topic.id,
  });

  // 7. Update execution stats (only on success)
  await AgentCronJobModel.updateExecutionStats(db, agentCronJobId);

  console.log(
    `[agent-cron] Executed job=${agentCronJobId} user=${userId} agent=${agentId} topic=${topic.id}`,
  );

  return { success: true, topicId: topic.id };
};
