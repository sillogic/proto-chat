import { DEFAULT_SYSTEM_AGENT_CONFIG } from '@lobechat/const';
import { chainSummaryTitle } from '@lobechat/prompts';
import { type UserSystemAgentConfig, type UserSystemAgentConfigKey } from '@lobechat/types';
import debug from 'debug';
import fs from 'node:fs';
import path from 'node:path';

import { UserModel } from '@/database/models/user';
import { type LobeChatDatabase } from '@/database/type';
import { initModelRuntimeFromDB, initModelRuntimeWithUserPayload } from '@/server/modules/ModelRuntime';
import { ProtoChatService } from '@/server/services/protochat';
import { CreditService } from '@/server/services/credit';

const log = debug('lobe-server:system-agent-service');

// Fallback inline prompt used when the MD file cannot be read
const IMAGE_OPTIMIZER_PROMPT_FALLBACK = [
  '你是一位专业的科研图像生成提示词专家，服务对象为中国科研院所、高校的科研人员与教师。',
  '要求：',
  '- 始终输出英文提示词',
  '- 不得指定分辨率、宽高比或图片张数',
  '- 不要要求图中出现可读文字',
  '- 只输出提示词本身，不加解释',
  '- 符合 SCI 期刊插图的视觉标准，50–120 词',
].join('\n');

let _imageOptimizerPrompt: string | null = null;
const getImageOptimizerPrompt = (): string => {
  if (_imageOptimizerPrompt !== null) return _imageOptimizerPrompt;
  try {
    const promptPath = path.join(
      process.cwd(),
      'src/server/services/systemAgent/prompts/image-optimizer.md',
    );
    _imageOptimizerPrompt = fs.readFileSync(promptPath, 'utf-8');
    log('Loaded image optimizer prompt from file (%d chars)', _imageOptimizerPrompt.length);
  } catch {
    log('image-optimizer.md not found, using fallback prompt');
    _imageOptimizerPrompt = IMAGE_OPTIMIZER_PROMPT_FALLBACK;
  }
  return _imageOptimizerPrompt;
};

const OPTIMIZE_IMAGE_PROMPT_SCHEMA = {
  name: 'optimized_image_prompt',
  schema: {
    additionalProperties: false,
    properties: {
      optimizedPrompt: { description: 'The optimized image generation prompt', type: 'string' },
    },
    required: ['optimizedPrompt'],
    type: 'object' as const,
  },
  strict: true,
};

const TOPIC_TITLE_SCHEMA = {
  name: 'topic_title',
  schema: {
    additionalProperties: false,
    properties: {
      title: { description: 'A concise topic title', type: 'string' },
    },
    required: ['title'],
    type: 'object' as const,
  },
  strict: true,
};

/**
 * Server-side service for SystemAgent automated tasks.
 *
 * Encapsulates the common pattern: read user's systemAgent config → build chain prompt
 * → call LLM via generateObject → return structured result.
 *
 * Each public method corresponds to a `UserSystemAgentConfigKey` task type
 * (topic, translation, agentMeta, etc.).
 */
export class SystemAgentService {
  private readonly db: LobeChatDatabase;
  private readonly userId: string;

  constructor(db: LobeChatDatabase, userId: string) {
    this.db = db;
    this.userId = userId;
  }

  /**
   * Generate a concise topic title from user prompt + assistant reply.
   *
   * @returns The generated title string, or null on failure
   */
  async generateTopicTitle(params: {
    lastAssistantContent: string;
    userPrompt: string;
  }): Promise<string | null> {
    const { userPrompt, lastAssistantContent } = params;

    try {
      const { model, provider } = await this.getTaskModelConfig('topic');
      const locale = await this.getUserLocale();

      log('generateTopicTitle: locale=%s, model=%s, provider=%s', locale, model, provider);

      const messages = [
        { content: userPrompt, role: 'user' as const },
        { content: lastAssistantContent, role: 'assistant' as const },
      ];

      const payload = chainSummaryTitle(messages, locale);

      // For ProtoChat, we need to resolve the actual underlying model ID
      let modelRuntime;
      let effectiveModel = model;
      if (ProtoChatService.isProtoChatProvider(provider)) {
        const { runtime, actualModel } = await initModelRuntimeWithUserPayload(provider, {}, { model });
        modelRuntime = runtime;
        effectiveModel = actualModel || model;
        } else {
        modelRuntime = await initModelRuntimeFromDB(this.db, this.userId, provider);
      }

      let capturedUsage: { inputTokens: number; outputTokens: number } | null = null;
      const result = await modelRuntime.generateObject(
        { messages: payload.messages as any[], model: effectiveModel, schema: TOPIC_TITLE_SCHEMA },
        {
          onUsage: (usage) => {
            capturedUsage = usage;
          },
        },
      );

      if (capturedUsage) {
        const inputTokens = (capturedUsage as { inputTokens: number }).inputTokens;
        const outputTokens = (capturedUsage as { outputTokens: number }).outputTokens;
        const creditService = new CreditService(this.db, this.userId);
        const costPrice = await creditService.calculateCostPrice(model, provider, inputTokens, outputTokens);
        void creditService
          .recordUsage('Topic title generation', {
            costPrice,
            model,
            provider,
            totalInputTokens: inputTokens,
            totalOutputTokens: outputTokens,
            type: 'title_generation',
          })
          .catch((e) => {
            console.error('SystemAgentService: failed to record title generation usage:', e);
          });
      }

      const title = (result as { title?: string })?.title?.trim();
      if (!title) {
        log('generateTopicTitle: LLM returned empty title');
        return null;
      }

      log('generateTopicTitle: generated title="%s"', title);
      return title;
    } catch (error) {
      console.error('SystemAgentService.generateTopicTitle failed:', error);
      return null;
    }
  }

  /**
   * Optimize a rough image generation prompt using a specified ProtoChat model.
   *
   * @param prompt  - The user's rough prompt idea
   * @param modelId - Full ProtoChat model ID, e.g. "protochat::alias::gpt-4o"
   * @returns The optimized prompt string, or null on failure
   */
  async optimizeImagePrompt(params: {
    modelId: string;
    prompt: string;
  }): Promise<string | null> {
    const { prompt, modelId } = params;

    try {
      if (!modelId.startsWith('protochat::')) {
        console.error('SystemAgentService.optimizeImagePrompt: invalid modelId format:', modelId);
        return null;
      }

      // Pass full composite ID as params.model; initProtoChatRuntime will look it up via getModelMapping
      const { runtime, actualModel } = await initModelRuntimeWithUserPayload('protochat', {}, { model: modelId });
      const effectiveModel = actualModel || modelId;

      const messages = [
        {
          content: getImageOptimizerPrompt(),
          role: 'system' as const,
        },
        { content: prompt, role: 'user' as const },
      ];

      let capturedUsage: { inputTokens: number; outputTokens: number } | null = null;
      const result = await runtime.generateObject(
        { messages, model: effectiveModel, schema: OPTIMIZE_IMAGE_PROMPT_SCHEMA },
        { onUsage: (usage) => { capturedUsage = usage; } },
      );

      if (capturedUsage) {
        const { inputTokens, outputTokens } = capturedUsage as { inputTokens: number; outputTokens: number };
        const creditService = new CreditService(this.db, this.userId);
        const costPrice = await creditService.calculateCostPrice(modelId, 'protochat', inputTokens, outputTokens);
        void creditService
          .recordUsage('Image prompt optimization', {
            costPrice,
            model: modelId,
            provider: 'protochat',
            totalInputTokens: inputTokens,
            totalOutputTokens: outputTokens,
            type: 'prompt_optimize',
          })
          .catch((e) => {
            console.error('SystemAgentService: failed to record prompt optimization usage:', e);
          });
      }

      const optimizedPrompt = (result as { optimizedPrompt?: string })?.optimizedPrompt?.trim();
      if (!optimizedPrompt) return null;

      return optimizedPrompt;
    } catch (error) {
      console.error('SystemAgentService.optimizeImagePrompt failed:', error);
      return null;
    }
  }

  // ============== Private Helpers ============== //

  /**
   * Get the model/provider config for a specific systemAgent task type.
   * Falls back to DEFAULT_SYSTEM_AGENT_CONFIG when user has no custom settings.
   */
  private async getTaskModelConfig(
    taskKey: UserSystemAgentConfigKey,
  ): Promise<{ model: string; provider: string }> {
    const userModel = new UserModel(this.db, this.userId);
    const settings = await userModel.getUserSettings();
    const systemAgent = settings?.systemAgent as Partial<UserSystemAgentConfig> | undefined;

    const taskConfig = systemAgent?.[taskKey];
    const defaults = DEFAULT_SYSTEM_AGENT_CONFIG[taskKey];

    return {
      model: taskConfig?.model || defaults.model,
      provider: taskConfig?.provider || defaults.provider,
    };
  }

  /**
   * Get the user's preferred response language (locale).
   */
  private async getUserLocale(): Promise<string> {
    const userInfo = await UserModel.getInfoForAIGeneration(this.db, this.userId);
    return userInfo.responseLanguage || 'en-US';
  }
}
