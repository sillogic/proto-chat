// @vitest-environment node
import { DEFAULT_AGENT_CONFIG, DEFAULT_CHAT_GROUP_CHAT_CONFIG } from '@lobechat/const';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AgentModel } from '@/database/models/agent';
import { ChatGroupModel } from '@/database/models/chatGroup';
import { AgentGroupRepository } from '@/database/repositories/agentGroup';
import { getServerDefaultAgentConfig } from '@/server/globalConfig';

import { AgentGroupService } from './index';

// Mock all external dependencies
vi.mock('@/database/models/agent', () => ({
  AgentModel: vi.fn(),
}));

vi.mock('@/database/models/chatGroup', () => ({
  ChatGroupModel: vi.fn(),
}));

vi.mock('@/database/repositories/agentGroup', () => ({
  AgentGroupRepository: vi.fn(),
}));

vi.mock('@/server/globalConfig', () => ({
  getServerDefaultAgentConfig: vi.fn().mockReturnValue({}),
}));

describe('AgentGroupService', () => {
  let service: AgentGroupService;
  const mockDb = {} as any;
  const mockUserId = 'test-user-id';

  const mockAgentModel = {
    batchDelete: vi.fn().mockResolvedValue(undefined),
  };

  const mockChatGroupModel = {
    queryWithMemberDetails: vi.fn().mockResolvedValue([]),
    getGroupAgents: vi.fn().mockResolvedValue([]),
    delete: vi.fn().mockResolvedValue({ id: 'group-1' }),
  };

  const mockAgentGroupRepo = {
    findByIdWithAgents: vi.fn().mockResolvedValue(null),
    checkAgentsBeforeRemoval: vi
      .fn()
      .mockResolvedValue({ nonVirtualAgentIds: [], virtualAgents: [] }),
  };

  beforeEach(() => {
    vi.clearAllMocks();

    (AgentModel as any).mockImplementation(() => mockAgentModel);
    (ChatGroupModel as any).mockImplementation(() => mockChatGroupModel);
    (AgentGroupRepository as any).mockImplementation(() => mockAgentGroupRepo);
    (getServerDefaultAgentConfig as any).mockReturnValue({});

    service = new AgentGroupService(mockDb, mockUserId);
  });

  describe('getGroupDetail', () => {
    it('should delegate to agentGroupRepo.findByIdWithAgents', async () => {
      const mockDetail = { id: 'group-1', name: 'Test Group', agents: [] };
      mockAgentGroupRepo.findByIdWithAgents.mockResolvedValue(mockDetail);

      const result = await service.getGroupDetail('group-1');

      expect(mockAgentGroupRepo.findByIdWithAgents).toHaveBeenCalledWith('group-1');
      expect(result).toEqual(mockDetail);
    });

    it('should return null when group is not found', async () => {
      mockAgentGroupRepo.findByIdWithAgents.mockResolvedValue(null);

      const result = await service.getGroupDetail('nonexistent-group');

      expect(result).toBeNull();
    });
  });

  describe('getGroups', () => {
    it('should delegate to chatGroupModel.queryWithMemberDetails', async () => {
      const mockGroups = [
        { id: 'group-1', name: 'Group 1' },
        { id: 'group-2', name: 'Group 2' },
      ];
      mockChatGroupModel.queryWithMemberDetails.mockResolvedValue(mockGroups);

      const result = await service.getGroups();

      expect(mockChatGroupModel.queryWithMemberDetails).toHaveBeenCalled();
      expect(result).toEqual(mockGroups);
    });

    it('should return empty array when no groups exist', async () => {
      mockChatGroupModel.queryWithMemberDetails.mockResolvedValue([]);

      const result = await service.getGroups();

      expect(result).toEqual([]);
    });
  });

  describe('deleteGroup', () => {
    it('should delete group and return deleted group with empty virtual agent ids when no virtual agents', async () => {
      const mockGroupAgents = [{ agentId: 'agent-1' }, { agentId: 'agent-2' }];
      const mockDeletedGroup = { id: 'group-1' };

      mockChatGroupModel.getGroupAgents.mockResolvedValue(mockGroupAgents);
      mockAgentGroupRepo.checkAgentsBeforeRemoval.mockResolvedValue({
        nonVirtualAgentIds: ['agent-1', 'agent-2'],
        virtualAgents: [],
      });
      mockChatGroupModel.delete.mockResolvedValue(mockDeletedGroup);

      const result = await service.deleteGroup('group-1');

      expect(mockChatGroupModel.getGroupAgents).toHaveBeenCalledWith('group-1');
      expect(mockAgentGroupRepo.checkAgentsBeforeRemoval).toHaveBeenCalledWith('group-1', [
        'agent-1',
        'agent-2',
      ]);
      expect(mockChatGroupModel.delete).toHaveBeenCalledWith('group-1');
      expect(mockAgentModel.batchDelete).not.toHaveBeenCalled();
      expect(result).toEqual({ deletedVirtualAgentIds: [], group: mockDeletedGroup });
    });

    it('should delete virtual agents when group contains virtual agents', async () => {
      const mockGroupAgents = [{ agentId: 'agent-1' }, { agentId: 'virtual-agent-1' }];
      const mockDeletedGroup = { id: 'group-1' };

      mockChatGroupModel.getGroupAgents.mockResolvedValue(mockGroupAgents);
      mockAgentGroupRepo.checkAgentsBeforeRemoval.mockResolvedValue({
        nonVirtualAgentIds: ['agent-1'],
        virtualAgents: [{ id: 'virtual-agent-1', title: 'Virtual Agent' }],
      });
      mockChatGroupModel.delete.mockResolvedValue(mockDeletedGroup);

      const result = await service.deleteGroup('group-1');

      expect(mockAgentModel.batchDelete).toHaveBeenCalledWith(['virtual-agent-1']);
      expect(result).toEqual({
        deletedVirtualAgentIds: ['virtual-agent-1'],
        group: mockDeletedGroup,
      });
    });

    it('should handle group with no agents', async () => {
      const mockDeletedGroup = { id: 'empty-group' };

      mockChatGroupModel.getGroupAgents.mockResolvedValue([]);
      mockAgentGroupRepo.checkAgentsBeforeRemoval.mockResolvedValue({
        nonVirtualAgentIds: [],
        virtualAgents: [],
      });
      mockChatGroupModel.delete.mockResolvedValue(mockDeletedGroup);

      const result = await service.deleteGroup('empty-group');

      expect(mockAgentGroupRepo.checkAgentsBeforeRemoval).toHaveBeenCalledWith('empty-group', []);
      expect(mockAgentModel.batchDelete).not.toHaveBeenCalled();
      expect(result).toEqual({ deletedVirtualAgentIds: [], group: mockDeletedGroup });
    });

    it('should delete multiple virtual agents', async () => {
      const mockGroupAgents = [
        { agentId: 'virtual-1' },
        { agentId: 'virtual-2' },
        { agentId: 'virtual-3' },
      ];

      mockChatGroupModel.getGroupAgents.mockResolvedValue(mockGroupAgents);
      mockAgentGroupRepo.checkAgentsBeforeRemoval.mockResolvedValue({
        nonVirtualAgentIds: [],
        virtualAgents: [
          { id: 'virtual-1', title: 'Virtual 1' },
          { id: 'virtual-2', title: 'Virtual 2' },
          { id: 'virtual-3', title: 'Virtual 3' },
        ],
      });
      mockChatGroupModel.delete.mockResolvedValue({ id: 'group-1' });

      const result = await service.deleteGroup('group-1');

      expect(mockAgentModel.batchDelete).toHaveBeenCalledWith([
        'virtual-1',
        'virtual-2',
        'virtual-3',
      ]);
      expect(result.deletedVirtualAgentIds).toEqual(['virtual-1', 'virtual-2', 'virtual-3']);
    });
  });

  describe('normalizeGroupConfig', () => {
    it('should merge config with DEFAULT_CHAT_GROUP_CHAT_CONFIG', () => {
      const partialConfig = { allowDM: false };

      const result = service.normalizeGroupConfig(partialConfig as any);

      expect(result).toEqual({
        ...DEFAULT_CHAT_GROUP_CHAT_CONFIG,
        allowDM: false,
      });
    });

    it('should return undefined when config is null', () => {
      const result = service.normalizeGroupConfig(null);

      expect(result).toBeUndefined();
    });

    it('should return undefined when config is undefined', () => {
      const result = service.normalizeGroupConfig(undefined);

      expect(result).toBeUndefined();
    });

    it('should preserve default values when partial config is provided', () => {
      const partialConfig = { openingMessage: 'Welcome!' };

      const result = service.normalizeGroupConfig(partialConfig as any);

      expect(result).toMatchObject({
        allowDM: DEFAULT_CHAT_GROUP_CHAT_CONFIG.allowDM,
        openingMessage: 'Welcome!',
        openingQuestions: DEFAULT_CHAT_GROUP_CHAT_CONFIG.openingQuestions,
        revealDM: DEFAULT_CHAT_GROUP_CHAT_CONFIG.revealDM,
        systemPrompt: DEFAULT_CHAT_GROUP_CHAT_CONFIG.systemPrompt,
      });
    });

    it('should return full config with all defaults when empty config is provided', () => {
      const result = service.normalizeGroupConfig({} as any);

      expect(result).toEqual(DEFAULT_CHAT_GROUP_CHAT_CONFIG);
    });

    it('should allow overriding all default values', () => {
      const fullConfig = {
        allowDM: false,
        openingMessage: 'Hello!',
        openingQuestions: ['Q1', 'Q2'],
        revealDM: true,
        systemPrompt: 'You are a helpful assistant',
      };

      const result = service.normalizeGroupConfig(fullConfig as any);

      expect(result).toEqual(fullConfig);
    });
  });

  describe('mergeAgentsDefaultConfig', () => {
    const mockDefaultAgentConfig = { config: {} };

    it('should merge DEFAULT_AGENT_CONFIG with agents', () => {
      const agents = [{ id: 'agent-1', model: 'gpt-4' }];

      const result = service.mergeAgentsDefaultConfig(mockDefaultAgentConfig as any, agents);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: 'agent-1',
        model: 'gpt-4',
      });
    });

    it('should apply server default agent config', () => {
      (getServerDefaultAgentConfig as any).mockReturnValue({ model: 'claude-3' });

      const agents = [{ id: 'agent-1' }];
      const result = service.mergeAgentsDefaultConfig(mockDefaultAgentConfig as any, agents);

      // Agent-specific config should override server defaults
      expect(result[0]).toMatchObject({ id: 'agent-1' });
    });

    it('should apply user default agent config over server defaults', () => {
      (getServerDefaultAgentConfig as any).mockReturnValue({ model: 'claude-3' });

      const userConfig = { config: { model: 'gpt-4o' } };
      const agents = [{ id: 'agent-1' }];

      const result = service.mergeAgentsDefaultConfig(userConfig as any, agents);

      expect(result[0]).toMatchObject({ id: 'agent-1' });
    });

    it('should override user default config with agent-specific config', () => {
      const userConfig = { config: { model: 'gpt-4o', temperature: 0.7 } };
      const agents = [{ id: 'agent-1', model: 'claude-3-opus' }];

      const result = service.mergeAgentsDefaultConfig(userConfig as any, agents);

      // Agent-specific model should override user default
      expect(result[0].model).toBe('claude-3-opus');
    });

    it('should handle empty agents array', () => {
      const result = service.mergeAgentsDefaultConfig(mockDefaultAgentConfig as any, []);

      expect(result).toEqual([]);
    });

    it('should handle multiple agents', () => {
      const agents = [
        { id: 'agent-1', model: 'gpt-4' },
        { id: 'agent-2', model: 'claude-3' },
        { id: 'agent-3' },
      ];

      const result = service.mergeAgentsDefaultConfig(mockDefaultAgentConfig as any, agents);

      expect(result).toHaveLength(3);
      expect(result[0]).toMatchObject({ id: 'agent-1', model: 'gpt-4' });
      expect(result[1]).toMatchObject({ id: 'agent-2', model: 'claude-3' });
    });

    it('should handle user default config with no config property', () => {
      const userConfig = {};
      const agents = [{ id: 'agent-1' }];

      const result = service.mergeAgentsDefaultConfig(userConfig as any, agents);

      expect(result).toHaveLength(1);
      // Should fall back to DEFAULT_AGENT_CONFIG
      expect(result[0]).toMatchObject({ id: 'agent-1' });
    });

    it('should preserve DEFAULT_AGENT_CONFIG as base when user config is empty', () => {
      const userConfig = { config: {} };
      const agents = [{ id: 'agent-1' }];

      const result = service.mergeAgentsDefaultConfig(userConfig as any, agents);

      // Should have DEFAULT_AGENT_CONFIG values as base
      expect(result[0]).toMatchObject({
        id: 'agent-1',
        model: DEFAULT_AGENT_CONFIG.model,
      });
    });
  });
});
