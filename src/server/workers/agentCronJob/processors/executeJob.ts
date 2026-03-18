import { DEFAULT_PROVIDER } from '@lobechat/business-const';
import { DEFAULT_MODEL } from '@lobechat/const';
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
import { CreditService } from '@/server/services/credit';
import { ProtoChatService } from '@/server/services/protochat';
import { SearchService } from '@/server/services/search';

import { type ExecuteAgentCronJobData } from '../queues';

// ── Tool definitions for LLM function calling ──────────────────────────────

const WEB_SEARCH_TOOL = {
  function: {
    description:
      'Search the web for real-time information. Use this when the user asks about current events, prices, weather, news, or anything requiring up-to-date data.',
    name: 'web_search',
    parameters: {
      properties: {
        query: {
          description: 'The search query string',
          type: 'string',
        },
      },
      required: ['query'],
      type: 'object',
    },
  },
  type: 'function' as const,
};

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

const MAX_TOOL_ROUNDS = 5;

// ── Main executor ──────────────────────────────────────────────────────────

export const executeAgentCronJob = async (job: Job<ExecuteAgentCronJobData>) => {
  const { agentCronJobId, agentId, userId } = job.data;

  const db = await getServerDB();

  // Wrap in try/catch so we can record failure status before re-throwing
  try {
    return await _execute(db, agentCronJobId, agentId, userId);
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    // Best-effort: don't let the status write swallow the original error
    await AgentCronJobModel.recordExecutionResult(db, agentCronJobId, 'failed', msg).catch(
      () => {},
    );
    throw error;
  }
};

const _execute = async (
  db: Awaited<ReturnType<typeof getServerDB>>,
  agentCronJobId: string,
  agentId: string,
  userId: string,
) => {
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

  // Fall back to project defaults when agent has no explicit model/provider
  const provider = agent.provider || DEFAULT_PROVIDER;
  const model = agent.model || DEFAULT_MODEL;

  // Check if agent has web browsing enabled
  const plugins: string[] = agent.plugins || [];
  const hasWebBrowsing = plugins.includes('lobe-web-browsing');

  // 3. Build messages
  const messages: Array<{ content: string; role: 'assistant' | 'system' | 'tool' | 'user' }> = [];
  if (agent.systemRole?.trim()) {
    messages.push({ content: agent.systemRole, role: 'system' });
  }
  messages.push({ content: cronJob.content, role: 'user' });

  // 4. Initialize model runtime
  let modelRuntime: any;
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

  // 5. Tool-calling loop: LLM may request web search, we execute and feed back
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  const onUsage = (usage: { inputTokens: number; outputTokens: number }) => {
    totalInputTokens += usage.inputTokens;
    totalOutputTokens += usage.outputTokens;
  };

  let content: string | undefined;
  const searchService = hasWebBrowsing ? new SearchService() : null;

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    if (hasWebBrowsing && round < MAX_TOOL_ROUNDS - 1) {
      // Call LLM with web_search tool available
      const toolResult = await modelRuntime.generateObject(
        { messages: messages as any[], model: effectiveModel, tools: [WEB_SEARCH_TOOL] },
        { onUsage },
      );

      // Check if LLM returned tool calls
      if (Array.isArray(toolResult) && toolResult.length > 0 && toolResult[0]?.name === 'web_search') {
        const query = toolResult[0].arguments?.query;
        if (query && searchService) {
          // Execute web search
          const searchData = await searchService.webSearch({ query });
          const { searchResultsPrompt } = await import('@lobechat/prompts');
          const searchContent = searchData.results.slice(0, 10).map((item: any) => ({
            content: item.content,
            title: item.title,
            url: item.url,
          }));
          const xmlContent = searchResultsPrompt(searchContent);

          // Feed tool result back to LLM
          messages.push({
            content: `[Tool Call: web_search] query="${query}"`,
            role: 'assistant',
          });
          messages.push({
            content: xmlContent,
            role: 'user', // tool results as user message for compatibility
          });
          continue; // Next round: LLM will process search results
        }
      }

      // LLM didn't call tools — it may have returned a direct object response
      // (some models return structured output instead of tool calls)
      if (toolResult && !Array.isArray(toolResult) && (toolResult as any).content) {
        content = (toolResult as { content: string }).content.trim();
        break;
      }
    }

    // Final round or no tools: get structured response
    const finalResult = await modelRuntime.generateObject(
      { messages: messages as any[], model: effectiveModel, schema: CRON_RESPONSE_SCHEMA },
      { onUsage },
    );
    content = (finalResult as { content?: string })?.content?.trim();
    break;
  }

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
    agentId,
    content: cronJob.content,
    role: 'user',
    topicId: topic.id,
  });

  await messageModel.create({
    agentId,
    content,
    metadata: {
      totalInputTokens,
      totalOutputTokens,
    },
    model: effectiveModel,
    provider,
    role: 'assistant',
    topicId: topic.id,
  });

  // 7. Deduct credits and record cost
  if (totalInputTokens > 0 || totalOutputTokens > 0) {
    try {
      const creditService = new CreditService(db, userId);
      const [cost, costPrice] = await Promise.all([
        creditService.calculateCost(model, provider, totalInputTokens, totalOutputTokens),
        creditService.calculateCostPrice(model, provider, totalInputTokens, totalOutputTokens),
      ]);
      if (cost > 0) {
        await creditService.deductCredits(cost, `Cron job: ${cronJob.name || agentCronJobId}`, undefined, {
          costPrice,
          model,
          provider,
          totalInputTokens,
          totalOutputTokens,
          type: 'cron_job',
        });
      }
    } catch (e) {
      console.error('[agent-cron] Failed to deduct credits:', e);
    }
  }

  // 8. Update execution stats + status
  await Promise.all([
    AgentCronJobModel.updateExecutionStats(db, agentCronJobId),
    AgentCronJobModel.recordExecutionResult(db, agentCronJobId, 'success'),
  ]);

  return { success: true, topicId: topic.id };
};
