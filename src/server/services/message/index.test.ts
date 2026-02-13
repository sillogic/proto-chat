// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { MessageModel } from '@/database/models/message';
import { LobeChatDatabase } from '@/database/type';

import { CreditService } from '../credit';
import { FileService } from '../file';
import { MessageService } from './index';

vi.mock('@/database/models/message');
vi.mock('../credit');
vi.mock('../file');

describe('MessageService', () => {
  let service: MessageService;
  let mockDb: any;
  let mockMessageModel: any;
  let mockFileService: any;
  let mockCreditService: any;
  const mockUserId = 'test-user-id';

  beforeEach(() => {
    vi.clearAllMocks();

    // Setup mock database
    mockDb = {
      query: {
        aiProviders: {
          findFirst: vi.fn(),
        },
      },
    } as any;

    // Setup mock MessageModel
    mockMessageModel = {
      create: vi.fn(),
      query: vi.fn(),
      deleteMessages: vi.fn(),
      deleteMessage: vi.fn(),
      updateMessageRAG: vi.fn(),
      updateMessagePlugin: vi.fn(),
      updatePluginState: vi.fn(),
      update: vi.fn(),
      updateMetadata: vi.fn(),
      findById: vi.fn(),
    };

    // Setup mock FileService
    mockFileService = {
      getFullFileUrl: vi.fn((path) => path ? `https://example.com/${path}` : null),
    };

    // Setup mock CreditService
    mockCreditService = {
      calculateCost: vi.fn(),
      deductCredits: vi.fn(),
    };

    (MessageModel as any).mockImplementation(() => mockMessageModel);
    (FileService as any).mockImplementation(() => mockFileService);
    (CreditService as any).mockImplementation(() => mockCreditService);

    service = new MessageService(mockDb as LobeChatDatabase, mockUserId);
  });

  describe('createMessage', () => {
    it('should create a message and return messages list', async () => {
      const params = {
        role: 'user' as const,
        content: 'Hello',
        sessionId: 'session-1',
      };

      const createdMessage = { id: 'msg-1', ...params };
      const messagesList = [createdMessage];

      mockMessageModel.create.mockResolvedValue(createdMessage);
      mockMessageModel.query.mockResolvedValue(messagesList);

      const result = await service.createMessage(params);

      expect(result).toEqual({
        id: 'msg-1',
        messages: messagesList,
      });

      expect(mockMessageModel.create).toHaveBeenCalledWith(params);
      expect(mockMessageModel.query).toHaveBeenCalledWith(
        {
          current: 0,
          groupId: undefined,
          pageSize: 9999,
          sessionId: params.sessionId,
          topicId: undefined,
        },
        expect.objectContaining({
          groupAssistantMessages: false,
        }),
      );
    });

    it('should create a message with groupId and topicId', async () => {
      const params = {
        role: 'user' as const,
        content: 'Hello',
        sessionId: 'session-1',
        groupId: 'group-1',
        topicId: 'topic-1',
      };

      const createdMessage = { id: 'msg-2', ...params };
      mockMessageModel.create.mockResolvedValue(createdMessage);
      mockMessageModel.query.mockResolvedValue([createdMessage]);

      await service.createMessage(params);

      expect(mockMessageModel.query).toHaveBeenCalledWith(
        expect.objectContaining({
          groupId: 'group-1',
          topicId: 'topic-1',
        }),
        expect.any(Object),
      );
    });
  });

  describe('removeMessages', () => {
    it('should remove multiple messages and return success without query', async () => {
      const ids = ['msg-1', 'msg-2'];

      mockMessageModel.deleteMessages.mockResolvedValue(undefined);

      const result = await service.removeMessages(ids);

      expect(result).toEqual({ success: true });
      expect(mockMessageModel.deleteMessages).toHaveBeenCalledWith(ids);
      expect(mockMessageModel.query).not.toHaveBeenCalled();
    });

    it('should remove messages and return updated message list when sessionId provided', async () => {
      const ids = ['msg-1'];
      const options = { sessionId: 'session-1' };
      const messagesList: any[] = [{ id: 'msg-2', content: 'remaining' }];

      mockMessageModel.deleteMessages.mockResolvedValue(undefined);
      mockMessageModel.query.mockResolvedValue(messagesList);

      const result = await service.removeMessages(ids, options);

      expect(result).toEqual({
        success: true,
        messages: messagesList,
      });
      expect(mockMessageModel.query).toHaveBeenCalledWith(
        { sessionId: 'session-1', topicId: undefined, groupId: undefined },
        expect.any(Object),
      );
    });

    it('should remove messages and return updated list when topicId provided', async () => {
      const ids = ['msg-1'];
      const options = { topicId: 'topic-1' };
      const messagesList: any[] = [];

      mockMessageModel.deleteMessages.mockResolvedValue(undefined);
      mockMessageModel.query.mockResolvedValue(messagesList);

      const result = await service.removeMessages(ids, options);

      expect(result).toEqual({
        success: true,
        messages: messagesList,
      });
      expect(mockMessageModel.query).toHaveBeenCalledWith(
        { sessionId: undefined, topicId: 'topic-1', groupId: undefined },
        expect.any(Object),
      );
    });
  });

  describe('removeMessage', () => {
    it('should remove single message and return success without query', async () => {
      const id = 'msg-1';

      mockMessageModel.deleteMessage.mockResolvedValue(undefined);

      const result = await service.removeMessage(id);

      expect(result).toEqual({ success: true });
      expect(mockMessageModel.deleteMessage).toHaveBeenCalledWith(id);
      expect(mockMessageModel.query).not.toHaveBeenCalled();
    });

    it('should remove message and return updated list with options', async () => {
      const id = 'msg-1';
      const options = { sessionId: 'session-1', topicId: 'topic-1' };
      const messagesList: any[] = [];

      mockMessageModel.deleteMessage.mockResolvedValue(undefined);
      mockMessageModel.query.mockResolvedValue(messagesList);

      const result = await service.removeMessage(id, options);

      expect(result).toEqual({
        success: true,
        messages: messagesList,
      });
    });
  });

  describe('updateMessageRAG', () => {
    it('should update message RAG and return success', async () => {
      const id = 'msg-1';
      const ragValue = { chunks: ['chunk1', 'chunk2'] };

      mockMessageModel.updateMessageRAG.mockResolvedValue(undefined);

      const result = await service.updateMessageRAG(id, ragValue);

      expect(result).toEqual({ success: true });
      expect(mockMessageModel.updateMessageRAG).toHaveBeenCalledWith(id, ragValue);
    });

    it('should update RAG and return messages when options provided', async () => {
      const id = 'msg-1';
      const ragValue = { chunks: [] };
      const options = { sessionId: 'session-1' };
      const messagesList = [{ id: 'msg-1' }];

      mockMessageModel.updateMessageRAG.mockResolvedValue(undefined);
      mockMessageModel.query.mockResolvedValue(messagesList);

      const result = await service.updateMessageRAG(id, ragValue, options);

      expect(result).toEqual({ success: true, messages: messagesList });
    });
  });

  describe('updatePluginError', () => {
    it('should update plugin error', async () => {
      const id = 'msg-1';
      const errorValue = { message: 'Plugin failed' };

      mockMessageModel.updateMessagePlugin.mockResolvedValue(undefined);

      await service.updatePluginError(id, errorValue);

      expect(mockMessageModel.updateMessagePlugin).toHaveBeenCalledWith(id, {
        error: errorValue,
      });
    });
  });

  describe('updatePluginState', () => {
    it('should update plugin state and return messages', async () => {
      const id = 'msg-1';
      const stateValue = { status: 'running' };
      const options = { sessionId: 'session-1' };
      const messagesList = [{ id: 'msg-1' }];

      mockMessageModel.updatePluginState.mockResolvedValue(undefined);
      mockMessageModel.query.mockResolvedValue(messagesList);

      const result = await service.updatePluginState(id, stateValue, options);

      expect(result).toEqual({ success: true, messages: messagesList });
      expect(mockMessageModel.updatePluginState).toHaveBeenCalledWith(id, stateValue);
    });
  });

  describe('updateMessagePlugin', () => {
    it('should update message plugin and return messages', async () => {
      const id = 'msg-1';
      const pluginValue = { tool: 'search', result: 'data' };
      const options = { sessionId: 'session-1' };
      const messagesList = [{ id: 'msg-1' }];

      mockMessageModel.updateMessagePlugin.mockResolvedValue(undefined);
      mockMessageModel.query.mockResolvedValue(messagesList);

      const result = await service.updateMessagePlugin(id, pluginValue, options);

      expect(result).toEqual({ success: true, messages: messagesList });
      expect(mockMessageModel.updateMessagePlugin).toHaveBeenCalledWith(id, pluginValue);
    });
  });

  describe('updateMessage', () => {
    it('should update message without metadata and not trigger credit deduction', async () => {
      const id = 'msg-1';
      const updateParams = { content: 'Updated content' };
      const options = { sessionId: 'session-1' };
      const messagesList = [{ id: 'msg-1', content: 'Updated content' }];

      mockMessageModel.update.mockResolvedValue(undefined);
      mockMessageModel.query.mockResolvedValue(messagesList);

      const result = await service.updateMessage(id, updateParams, options);

      expect(result).toEqual({ success: true, messages: messagesList });
      expect(mockMessageModel.update).toHaveBeenCalledWith(id, updateParams);
      expect(mockCreditService.calculateCost).not.toHaveBeenCalled();
    });

    it('should update message with metadata and trigger credit deduction', async () => {
      const id = 'msg-1';
      const updateParams = {
        content: 'AI response',
        metadata: {
          totalInputTokens: 100,
          totalOutputTokens: 200,
        },
      };
      const options = { sessionId: 'session-1' };

      const assistantMessage = {
        id: 'msg-1',
        role: 'assistant',
        model: 'gpt-4',
        provider: 'openai',
        metadata: {},
      };

      mockMessageModel.update.mockResolvedValue(undefined);
      mockMessageModel.query.mockResolvedValue([assistantMessage]);
      mockMessageModel.findById.mockResolvedValue(assistantMessage);
      mockDb.query.aiProviders.findFirst.mockResolvedValue(null); // Using global provider
      mockCreditService.calculateCost.mockResolvedValue(1.5);
      mockCreditService.deductCredits.mockResolvedValue(undefined);
      mockMessageModel.updateMetadata.mockResolvedValue(undefined);

      const result = await service.updateMessage(id, updateParams, options);

      expect(result).toEqual({ success: true, messages: [assistantMessage] });
      expect(mockMessageModel.findById).toHaveBeenCalledWith(id);
      expect(mockCreditService.calculateCost).toHaveBeenCalledWith(
        'gpt-4',
        'openai',
        100,
        200,
        false, // isUserConfig = false (using global provider)
      );
      expect(mockCreditService.deductCredits).toHaveBeenCalledWith(
        1.5,
        'Chat completion: gpt-4 ',
        id,
        {
          model: 'gpt-4',
          provider: 'openai',
          totalInputTokens: 100,
          totalOutputTokens: 200,
        },
      );
      expect(mockMessageModel.updateMetadata).toHaveBeenCalledWith(id, {
        cost: 1.5,
        creditsDeducted: true,
      });
    });
  });

  describe('updateMetadata', () => {
    it('should update metadata without tokens and not trigger credit deduction', async () => {
      const id = 'msg-1';
      const metadata = { customField: 'value' };

      mockMessageModel.updateMetadata.mockResolvedValue(undefined);

      const result = await service.updateMetadata(id, metadata);

      expect(result).toEqual({ success: true });
      expect(mockMessageModel.updateMetadata).toHaveBeenCalledWith(id, metadata);
      expect(mockMessageModel.findById).not.toHaveBeenCalled();
    });

    it('should update metadata with tokens and trigger credit deduction for assistant message', async () => {
      const id = 'msg-1';
      const metadata = {
        totalInputTokens: 50,
        totalOutputTokens: 100,
      };

      const assistantMessage = {
        id: 'msg-1',
        role: 'assistant',
        model: 'claude-3',
        provider: 'anthropic',
        metadata: {},
      };

      mockMessageModel.updateMetadata.mockResolvedValue(undefined);
      mockMessageModel.findById.mockResolvedValue(assistantMessage);
      mockDb.query.aiProviders.findFirst.mockResolvedValue(null);
      mockCreditService.calculateCost.mockResolvedValue(0.75);
      mockCreditService.deductCredits.mockResolvedValue(undefined);

      const result = await service.updateMetadata(id, metadata);

      expect(result).toEqual({ success: true });
      expect(mockCreditService.calculateCost).toHaveBeenCalledWith(
        'claude-3',
        'anthropic',
        50,
        100,
        false,
      );
      expect(mockCreditService.deductCredits).toHaveBeenCalled();
      expect(mockMessageModel.updateMetadata).toHaveBeenCalledTimes(2); // Once for initial update, once for marking credits deducted
    });

    it('should NOT deduct credits if already deducted', async () => {
      const id = 'msg-1';
      const metadata = {
        totalInputTokens: 50,
        totalOutputTokens: 100,
      };

      const assistantMessage = {
        id: 'msg-1',
        role: 'assistant',
        model: 'gpt-4',
        provider: 'openai',
        metadata: { creditsDeducted: true }, // Already deducted
      };

      mockMessageModel.updateMetadata.mockResolvedValue(undefined);
      mockMessageModel.findById.mockResolvedValue(assistantMessage);

      await service.updateMetadata(id, metadata);

      // Should NOT call calculateCost or deductCredits
      expect(mockCreditService.calculateCost).not.toHaveBeenCalled();
      expect(mockCreditService.deductCredits).not.toHaveBeenCalled();
      expect(mockMessageModel.updateMetadata).toHaveBeenCalledTimes(1); // Only initial update
    });

    it('should NOT deduct credits for user messages', async () => {
      const id = 'msg-1';
      const metadata = {
        totalInputTokens: 50,
        totalOutputTokens: 100,
      };

      const userMessage = {
        id: 'msg-1',
        role: 'user',
        model: null,
        provider: null,
      };

      mockMessageModel.updateMetadata.mockResolvedValue(undefined);
      mockMessageModel.findById.mockResolvedValue(userMessage);

      await service.updateMetadata(id, metadata);

      expect(mockCreditService.calculateCost).not.toHaveBeenCalled();
      expect(mockCreditService.deductCredits).not.toHaveBeenCalled();
    });

    it('should NOT deduct credits if user is using their own API key', async () => {
      const id = 'msg-1';
      const metadata = {
        totalInputTokens: 50,
        totalOutputTokens: 100,
      };

      const assistantMessage = {
        id: 'msg-1',
        role: 'assistant',
        model: 'gpt-4',
        provider: 'openai',
        metadata: {},
      };

      const userConfig = {
        id: 'openai',
        userId: mockUserId,
        isGlobal: false,
        keyVaults: JSON.stringify({ apiKey: 'user-api-key-123' }),
      };

      mockMessageModel.updateMetadata.mockResolvedValue(undefined);
      mockMessageModel.findById.mockResolvedValue(assistantMessage);
      mockDb.query.aiProviders.findFirst.mockResolvedValue(userConfig);
      mockCreditService.calculateCost.mockResolvedValue(0);

      await service.updateMetadata(id, metadata);

      // Should pass isUserConfig = true, resulting in 0 cost
      expect(mockCreditService.calculateCost).toHaveBeenCalledWith(
        'gpt-4',
        'openai',
        50,
        100,
        true, // isUserConfig = true
      );
      expect(mockCreditService.deductCredits).not.toHaveBeenCalled();
      expect(mockMessageModel.updateMetadata).toHaveBeenCalledWith(id, {
        cost: 0,
        creditsDeducted: true,
        userConfig: true,
      });
    });

    it('should deduct credits when cost > 0 even with user config without API key', async () => {
      const id = 'msg-1';
      const metadata = {
        totalInputTokens: 50,
        totalOutputTokens: 100,
      };

      const assistantMessage = {
        id: 'msg-1',
        role: 'assistant',
        model: 'gpt-4',
        provider: 'openai',
        metadata: {},
      };

      const userConfigWithoutKey = {
        id: 'openai',
        userId: mockUserId,
        isGlobal: false,
        keyVaults: JSON.stringify({}), // No API key
      };

      mockMessageModel.updateMetadata.mockResolvedValue(undefined);
      mockMessageModel.findById.mockResolvedValue(assistantMessage);
      mockDb.query.aiProviders.findFirst.mockResolvedValue(userConfigWithoutKey);
      mockCreditService.calculateCost.mockResolvedValue(1.0);
      mockCreditService.deductCredits.mockResolvedValue(undefined);

      await service.updateMetadata(id, metadata);

      expect(mockCreditService.calculateCost).toHaveBeenCalledWith(
        'gpt-4',
        'openai',
        50,
        100,
        false, // isUserConfig = false because no API key
      );
      expect(mockCreditService.deductCredits).toHaveBeenCalled();
    });

    it('should handle credit deduction errors gracefully', async () => {
      const id = 'msg-1';
      const metadata = {
        totalInputTokens: 50,
        totalOutputTokens: 100,
      };

      const assistantMessage = {
        id: 'msg-1',
        role: 'assistant',
        model: 'gpt-4',
        provider: 'openai',
        metadata: {},
      };

      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      mockMessageModel.updateMetadata.mockResolvedValue(undefined);
      mockMessageModel.findById.mockResolvedValue(assistantMessage);
      mockDb.query.aiProviders.findFirst.mockRejectedValue(new Error('DB error'));

      // Should not throw, just log error
      const result = await service.updateMetadata(id, metadata);

      expect(result).toEqual({ success: true });
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[MessageService] Failed to check user config:',
        expect.any(Error),
      );

      consoleErrorSpy.mockRestore();
    });

    it('should return messages when options provided', async () => {
      const id = 'msg-1';
      const metadata = { customField: 'value' };
      const options = { sessionId: 'session-1', topicId: 'topic-1' };
      const messagesList = [{ id: 'msg-1' }];

      mockMessageModel.updateMetadata.mockResolvedValue(undefined);
      mockMessageModel.query.mockResolvedValue(messagesList);

      const result = await service.updateMetadata(id, metadata, options);

      expect(result).toEqual({ success: true, messages: messagesList });
    });
  });

  describe('isUserUsingOwnConfig (edge cases)', () => {
    it('should handle user config with null keyVaults', async () => {
      const id = 'msg-1';
      const metadata = {
        totalInputTokens: 50,
        totalOutputTokens: 100,
      };

      const assistantMessage = {
        id: 'msg-1',
        role: 'assistant',
        model: 'gpt-4',
        provider: 'openai',
        metadata: {},
      };

      const userConfig = {
        id: 'openai',
        userId: mockUserId,
        isGlobal: false,
        keyVaults: null, // null keyVaults
      };

      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      mockMessageModel.updateMetadata.mockResolvedValue(undefined);
      mockMessageModel.findById.mockResolvedValue(assistantMessage);
      mockDb.query.aiProviders.findFirst.mockResolvedValue(userConfig);
      mockCreditService.calculateCost.mockResolvedValue(1.0);
      mockCreditService.deductCredits.mockResolvedValue(undefined);

      await service.updateMetadata(id, metadata);

      // Should default to billing when config exists but no API key
      expect(mockCreditService.calculateCost).toHaveBeenCalledWith(
        'gpt-4',
        'openai',
        50,
        100,
        false,
      );

      consoleWarnSpy.mockRestore();
    });
  });
});
