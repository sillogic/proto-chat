import { LobeChatDatabase } from '@/database/type';
import { CreateMessageParams, UIChatMessage, UpdateMessageParams } from '@lobechat/types';
import { safeParseJSON } from '@lobechat/utils';

import { MessageModel } from '@/database/models/message';
import { aiProviders } from '@/database/schemas';
import { eq, and } from 'drizzle-orm';

import { CreditService } from '../credit';
import { FileService } from '../file';

interface QueryOptions {
  groupId?: string | null;
  sessionId?: string | null;
  topicId?: string | null;
}

interface CreateMessageResult {
  id: string;
  messages: any[];
}

/**
 * Message Service
 *
 * Encapsulates repeated "mutation + conditional query" logic.
 * After performing update/delete operations, conditionally returns message list based on sessionId/topicId.
 */
export class MessageService {
  private messageModel: MessageModel;
  private fileService: FileService;
  private creditService: CreditService;
  private db: LobeChatDatabase;
  private userId: string;

  constructor(db: LobeChatDatabase, userId: string) {
    this.db = db;
    this.userId = userId;
    this.messageModel = new MessageModel(db, userId);
    this.fileService = new FileService(db, userId);
    this.creditService = new CreditService(db, userId);
  }

  /**
   * Unified URL processing function
   */
  private get postProcessUrl() {
    return (path: string | null) => this.fileService.getFullFileUrl(path);
  }

  /**
   * Unified query options
   */
  private getQueryOptions() {
    return {
      groupAssistantMessages: false,
      postProcessUrl: this.postProcessUrl,
    };
  }

  /**
   * Query messages and return response with success status (used after mutations)
   */
  private async queryWithSuccess(
    options?: QueryOptions,
  ): Promise<{ messages?: UIChatMessage[]; success: boolean }> {
    if (!options || (options.sessionId === undefined && options.topicId === undefined)) {
      return { success: true };
    }

    const { sessionId, topicId, groupId } = options;

    const messages = await this.messageModel.query(
      { groupId, sessionId, topicId },
      this.getQueryOptions(),
    );

    return { messages, success: true };
  }

  /**
   * Create a new message and return the complete message list
   * Pattern: create + query
   *
   * This method combines message creation and querying into a single operation,
   * reducing the need for separate refresh calls and improving performance.
   */
  async createMessage(params: CreateMessageParams): Promise<CreateMessageResult> {
    // 1. Create the message
    const item = await this.messageModel.create(params);

    // 2. Query all messages for this session/topic
    const messages = await this.messageModel.query(
      {
        current: 0,
        groupId: params.groupId,
        pageSize: 9999,
        sessionId: params.sessionId,
        topicId: params.topicId,
      },
      {
        groupAssistantMessages: false,
        postProcessUrl: this.postProcessUrl,
      },
    );

    // 3. Return the result
    return {
      id: item.id,
      messages,
    };
  }

  /**
   * Remove messages with optional message list return
   * Pattern: delete + conditional query
   */
  async removeMessages(ids: string[], options?: QueryOptions) {
    await this.messageModel.deleteMessages(ids);
    return this.queryWithSuccess(options);
  }

  /**
   * Remove single message with optional message list return
   * Pattern: delete + conditional query
   */
  async removeMessage(id: string, options?: QueryOptions) {
    await this.messageModel.deleteMessage(id);
    return this.queryWithSuccess(options);
  }

  /**
   * Update message RAG with optional message list return
   * Pattern: update + conditional query
   */
  async updateMessageRAG(id: string, value: any, options?: QueryOptions) {
    await this.messageModel.updateMessageRAG(id, value);
    return this.queryWithSuccess(options);
  }

  /**
   * Update plugin error with optional message list return
   * Pattern: update + conditional query
   */
  async updatePluginError(id: string, value: any, options?: QueryOptions) {
    await this.messageModel.updateMessagePlugin(id, { error: value });
    return this.queryWithSuccess(options);
  }

  /**
   * Update plugin state and return message list
   * Pattern: update + conditional query
   */
  async updatePluginState(
    id: string,
    value: any,
    options: QueryOptions,
  ): Promise<{ messages?: UIChatMessage[]; success: boolean }> {
    await this.messageModel.updatePluginState(id, value);
    return this.queryWithSuccess(options);
  }

  /**
   * Update message plugin and return message list
   * Pattern: update + conditional query
   */
  async updateMessagePlugin(
    id: string,
    value: any,
    options: QueryOptions,
  ): Promise<{ messages?: UIChatMessage[]; success: boolean }> {
    await this.messageModel.updateMessagePlugin(id, value);
    return this.queryWithSuccess(options);
  }

  /**
   * Update message and return message list
   * Pattern: update + conditional query
   */
  async updateMessage(
    id: string,
    value: UpdateMessageParams,
    options: QueryOptions,
  ): Promise<{ messages?: UIChatMessage[]; success: boolean }> {
    await this.messageModel.update(id, value as any);

    // Handle credit deduction if metadata with tokens is provided
    if (value.metadata) {
      await this.handleCreditDeduction(id, value.metadata);
    }

    return this.queryWithSuccess(options);
  }

  /**
   * Update message metadata with optional message list return
   * Pattern: update + conditional query
   */
  async updateMetadata(id: string, value: any, options?: QueryOptions) {
    // 1. Update the metadata in database
    await this.messageModel.updateMetadata(id, value);

    // 2. Handle credit deduction if tokens are provided
    await this.handleCreditDeduction(id, value);

    return this.queryWithSuccess(options);
  }

  /**
   * Private helper to handle credit deduction logic
   */
  private async handleCreditDeduction(id: string, incomingMetadata: any) {
    const { totalInputTokens, totalOutputTokens } = incomingMetadata;

    if (totalInputTokens || totalOutputTokens) {
      try {
        const message = await this.messageModel.findById(id);
        if (message && message.role === 'assistant' && message.model && message.provider) {
          // Check if credits have already been deducted for this message
          const metadata = (message.metadata || {}) as any;
          if (!metadata.creditsDeducted) {
            // Check if user is using their own API key for this provider
            const isUserConfig = await this.isUserUsingOwnConfig(message.provider);

            const cost = await this.creditService.calculateCost(
              message.model,
              message.provider,
              totalInputTokens || 0,
              totalOutputTokens || 0,
              isUserConfig, // Pass the flag to determine if user is using own config
            );
            if (cost > 0) {
              await this.creditService.deductCredits(cost, `Chat completion: ${message.model} `, id, {
                model: message.model,
                provider: message.provider,
                totalInputTokens: totalInputTokens || 0,
                totalOutputTokens: totalOutputTokens || 0,
              });
              // Mark as deducted in database
              await this.messageModel.updateMetadata(id, { cost, creditsDeducted: true });
            } else if (isUserConfig) {
              // Mark as deducted (but free) to avoid re-checking
              await this.messageModel.updateMetadata(id, { cost: 0, creditsDeducted: true, userConfig: true });
            }
          }
        }
      } catch (error) {
        console.error('[MessageService] Failed to deduct credits:', error);
      }
    }
  }

  /**
   * Check if user has configured their own API key for a provider
   *
   * Billing logic:
   * - Only global providers (ProtoChat) are billable
   * - If user configured their own API key, they use their own service and won't be charged
   *
   * @param provider - Provider ID
   * @returns true if user is using their own API key (no charge), false if using global provider (will charge)
   */
  private async isUserUsingOwnConfig(provider: string): Promise<boolean> {
    try {
      // Check if user has a personal configuration for this provider
      const userConfig = await this.db.query.aiProviders.findFirst({
        where: and(
          eq(aiProviders.userId, this.userId),
          eq(aiProviders.id, provider),
          eq(aiProviders.isGlobal, false) // Only check user's personal providers (not global)
        ),
      });

      if (!userConfig) {
        // No user config found, user is using global provider (ProtoChat)
        return false;
      }

      // User has a personal provider config, check if they provided an API key
      if (userConfig.keyVaults) {
        const keyVaults = safeParseJSON<{ apiKey?: string }>(userConfig.keyVaults);
        if (keyVaults?.apiKey) {
          // User provided their own API key, don't charge
          return true;
        }
      }

      // User config exists but no API key provided
      // This shouldn't happen in normal flow, but treat as user config
      console.warn(`[MessageService] User ${this.userId} has provider ${provider} config without API key`);
      return false;
    } catch (error) {
      console.error('[MessageService] Failed to check user config:', error);
      return false; // On error, default to billing (safer)
    }
  }
}
