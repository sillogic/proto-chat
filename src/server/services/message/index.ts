import { type LobeChatDatabase } from '@lobechat/database';
import { CompressionRepository } from '@lobechat/database';
import {
  type CreateMessageParams,
  type UIChatMessage,
  type UpdateMessageParams,
} from '@lobechat/types';

import { MessageModel } from '@/database/models/message';
import { aiProviders } from '@/database/schemas';
import { and, eq } from 'drizzle-orm';

import { CreditService } from '../credit';
import { FileService } from '../file';
import { ProtoChatService } from '../protochat';

interface QueryOptions {
  agentId?: string | null;
  groupId?: string | null;
  sessionId?: string | null;
  threadId?: string | null;
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
  private compressionRepository: CompressionRepository;
  private creditService: CreditService;
  private db: LobeChatDatabase;
  private userId: string;

  constructor(db: LobeChatDatabase, userId: string) {
    this.db = db;
    this.userId = userId;
    this.messageModel = new MessageModel(db, userId);
    this.fileService = new FileService(db, userId);
    this.compressionRepository = new CompressionRepository(db, userId);
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
   * Prioritize agentId, fallback to sessionId if not provided (for backwards compatibility)
   */
  private async queryWithSuccess(
    options?: QueryOptions,
  ): Promise<{ messages?: UIChatMessage[]; success: boolean }> {
    if (
      !options ||
      (options.agentId === undefined &&
        options.sessionId === undefined &&
        options.topicId === undefined)
    ) {
      return { success: true };
    }

    const { agentId, sessionId, topicId, groupId, threadId } = options;

    const messages = await this.messageModel.query(
      { agentId, groupId, sessionId, threadId, topicId },
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
    // 1. Create the message (using agentId)
    const item = await this.messageModel.create(params);

    // 2. Query all messages for this agent/topic
    // Use agentId field for query
    const messages = await this.messageModel.query(
      {
        agentId: params.agentId,
        current: 0,
        groupId: params.groupId,
        pageSize: 9999,
        threadId: params.threadId,
        topicId: params.topicId,
      },
      {
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
    // Handle credit deduction when token usage is included in metadata (e.g., after stream finish)
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
              await this.creditService.deductCredits(cost, `Chat completion: ${message.model}`, id, {
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
      // ProtoChat is the platform's own managed provider.
      // Users cannot configure their own ProtoChat API keys, so this is never "user config".
      if (ProtoChatService.isProtoChatProvider(provider)) {
        return false;
      }

      // Check if user has a personal configuration for this provider
      const userConfig = await this.db.query.aiProviders.findFirst({
        where: and(
          eq(aiProviders.userId, this.userId),
          eq(aiProviders.id, provider),
        ),
      });

      // If user has configured their own API key, they won't be charged
      return !!userConfig;
    } catch (error) {
      console.error('[MessageService] Failed to check user config:', error);
      // Default to charging if we can't determine
      return false;
    }
  }

  /**
   * Update tool message with content, metadata, pluginState, and pluginError in a single transaction
   * This prevents race conditions when updating multiple fields
   * Pattern: update + conditional query
   */
  async updateToolMessage(
    id: string,
    value: {
      content?: string;
      metadata?: Record<string, any>;
      pluginError?: any;
      pluginState?: Record<string, any>;
    },
    options?: QueryOptions,
  ): Promise<{ messages?: UIChatMessage[]; success: boolean }> {
    const result = await this.messageModel.updateToolMessage(id, value);
    if (!result.success) {
      return { success: false };
    }
    return this.queryWithSuccess(options);
  }

  /**
   * Add files to a message
   * Pattern: update + conditional query
   */
  async addFilesToMessage(
    messageId: string,
    fileIds: string[],
    options?: QueryOptions,
  ): Promise<{ messages?: UIChatMessage[]; success: boolean }> {
    const result = await this.messageModel.addFiles(messageId, fileIds);
    if (!result.success) {
      return { success: false };
    }
    return this.queryWithSuccess(options);
  }

  /**
   * Update tool arguments by toolCallId - updates both tool message plugin.arguments
   * and parent assistant message tools[].arguments atomically
   *
   * This method uses toolCallId (the stable identifier from AI response) instead of
   * tool message ID, which allows updating arguments even when the tool message
   * hasn't been persisted yet (e.g., during intervention pending state).
   *
   * @param toolCallId - The tool call ID (stable identifier from AI response)
   * @param args - The new arguments value (will be stringified if object)
   * @param options - Query options for returning updated messages
   */
  async updateToolArguments(
    toolCallId: string,
    args: string | Record<string, unknown>,
    options?: QueryOptions,
  ): Promise<{ messages?: UIChatMessage[]; success: boolean }> {
    const argsString = typeof args === 'string' ? args : JSON.stringify(args);

    const result = await this.messageModel.updateToolArguments(toolCallId, argsString);
    if (!result.success) {
      return { success: false };
    }
    return this.queryWithSuccess(options);
  }

  // =============== Compression Methods ===============

  /**
   * Create a compression group for messages
   * Creates a placeholder group, marks messages as compressed, and returns updated messages
   *
   * @param topicId - The topic ID
   * @param messageIds - IDs of messages to compress
   * @param options - Query options for returning updated messages
   */
  async createCompressionGroup(
    topicId: string,
    messageIds: string[],
    options?: QueryOptions,
  ): Promise<{
    messageGroupId: string;
    messages?: UIChatMessage[];
    messagesToSummarize: UIChatMessage[];
    success: boolean;
  }> {
    // 1. Get messages that need to be summarized (before marking them as compressed)
    const allMessages = await this.messageModel.query(
      { topicId, ...options },
      this.getQueryOptions(),
    );

    const messagesToSummarize = allMessages.filter((msg) => messageIds.includes(msg.id));

    // 2. Create compression group with placeholder content
    const messageGroupId = await this.compressionRepository.createCompressionGroup({
      content: '...', // Placeholder content
      messageIds,
      metadata: {
        originalMessageCount: messageIds.length,
      },
      topicId,
    });

    // 3. Query updated messages (compressed messages will be grouped)
    const messages = await this.messageModel.query({ topicId, ...options }, this.getQueryOptions());

    return {
      messageGroupId,
      messages,
      messagesToSummarize,
      success: true,
    };
  }

  /**
   * Finalize compression by updating the group with actual summary content
   *
   * @param messageGroupId - The compression group ID
   * @param content - The generated summary content
   * @param params - Parameters for querying messages
   */
  async finalizeCompression(
    messageGroupId: string,
    content: string,
    params: {
      agentId: string;
      groupId?: string | null;
      threadId?: string | null;
      topicId: string;
    },
  ): Promise<{ messages?: UIChatMessage[]; success: boolean }> {
    const { agentId, groupId, threadId, topicId } = params;

    // 1. Update compression group with actual content
    await this.compressionRepository.updateCompressionContent(messageGroupId, content);

    // 2. Query final messages
    const queryOptions = { agentId, groupId, threadId, topicId };
    const finalMessages = await this.messageModel.query(queryOptions, this.getQueryOptions());

    return {
      messages: finalMessages,
      success: true,
    };
  }

  /**
   * Update message group metadata (e.g., expanded state)
   */
  async updateMessageGroupMetadata(
    messageGroupId: string,
    metadata: { expanded?: boolean },
    context: QueryOptions,
  ): Promise<{ messages: UIChatMessage[] }> {
    await this.compressionRepository.updateMetadata(messageGroupId, metadata);

    const messages = await this.messageModel.query(context, this.getQueryOptions());

    return { messages };
  }

  /**
   * Cancel compression by deleting the compression group and restoring original messages
   *
   * @param messageGroupId - The compression group ID to cancel
   * @param context - Query options for returning updated messages
   */
  async cancelCompression(
    messageGroupId: string,
    context: QueryOptions,
  ): Promise<{ messages: UIChatMessage[]; success: boolean }> {
    // Delete compression group (this also unmarks messages)
    await this.compressionRepository.deleteCompressionGroup(messageGroupId);

    // Query updated messages
    const messages = await this.messageModel.query(context, this.getQueryOptions());

    return { messages, success: true };
  }
}
