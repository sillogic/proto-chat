import type { UIChatMessage } from '@lobechat/types';
import { describe, expect, it } from 'vitest';

import { contextSupervisorMakeDecision } from '../makeDecision';
import { SupervisorToolName } from '../tools';

const createMessage = (
  id: string,
  role: 'user' | 'assistant' | 'system',
  content: string,
  options?: { agentId?: string; targetId?: string },
): UIChatMessage => ({
  id,
  role,
  content,
  createdAt: 1_634_567_890_000,
  updatedAt: 1_634_567_890_000,
  meta: {},
  ...options,
});

const getToolNames = (result: ReturnType<typeof contextSupervisorMakeDecision>): string[] =>
  (result.tools ?? []).map((t) => t.function.name);

const mockMessages: UIChatMessage[] = [
  createMessage('m1', 'user', 'Hello group'),
  createMessage('m2', 'assistant', 'Hi there', { agentId: 'agent-1' }),
];

const baseContext = {
  availableAgents: [{ id: 'agent-1', title: 'Agent One' }],
  messages: mockMessages,
};

describe('contextSupervisorMakeDecision', () => {
  describe('payload structure', () => {
    it('should return a valid ChatStreamPayload with required fields', () => {
      const result = contextSupervisorMakeDecision(baseContext);

      expect(result).toHaveProperty('messages');
      expect(result).toHaveProperty('temperature', 0.3);
      expect(result).toHaveProperty('tools');
    });

    it('should have a single user message in messages array', () => {
      const result = contextSupervisorMakeDecision(baseContext);

      expect(result.messages).toHaveLength(1);
      expect(result.messages[0].role).toBe('user');
      expect(typeof result.messages[0].content).toBe('string');
      expect(result.messages[0].content.length).toBeGreaterThan(0);
    });

    it('should format tools as ChatCompletionTool objects with type=function', () => {
      const result = contextSupervisorMakeDecision(baseContext);

      for (const tool of result.tools ?? []) {
        expect(tool.type).toBe('function');
        expect(tool.function).toBeDefined();
        expect(typeof tool.function.name).toBe('string');
      }
    });

    it('should return tools as an array', () => {
      const result = contextSupervisorMakeDecision(baseContext);

      expect(Array.isArray(result.tools)).toBe(true);
    });
  });

  describe('tool filtering - allowDM', () => {
    it('should include trigger_agent_dm when allowDM is true', () => {
      const result = contextSupervisorMakeDecision({ ...baseContext, allowDM: true });
      const toolNames = getToolNames(result);

      expect(toolNames).toContain(SupervisorToolName.trigger_agent_dm);
    });

    it('should exclude trigger_agent_dm when allowDM is false', () => {
      const result = contextSupervisorMakeDecision({ ...baseContext, allowDM: false });
      const toolNames = getToolNames(result);

      expect(toolNames).not.toContain(SupervisorToolName.trigger_agent_dm);
    });

    it('should exclude trigger_agent_dm when allowDM is not provided', () => {
      const result = contextSupervisorMakeDecision(baseContext);
      const toolNames = getToolNames(result);

      expect(toolNames).not.toContain(SupervisorToolName.trigger_agent_dm);
    });
  });

  describe('tool filtering - scene', () => {
    it('should include finish_todo and create_todo when scene is productive', () => {
      const result = contextSupervisorMakeDecision({ ...baseContext, scene: 'productive' });
      const toolNames = getToolNames(result);

      expect(toolNames).toContain(SupervisorToolName.finish_todo);
      expect(toolNames).toContain(SupervisorToolName.create_todo);
    });

    it('should exclude finish_todo and create_todo when scene is casual', () => {
      const result = contextSupervisorMakeDecision({ ...baseContext, scene: 'casual' });
      const toolNames = getToolNames(result);

      expect(toolNames).not.toContain(SupervisorToolName.finish_todo);
      expect(toolNames).not.toContain(SupervisorToolName.create_todo);
    });

    it('should exclude finish_todo and create_todo when scene is not provided', () => {
      const result = contextSupervisorMakeDecision(baseContext);
      const toolNames = getToolNames(result);

      expect(toolNames).not.toContain(SupervisorToolName.finish_todo);
      expect(toolNames).not.toContain(SupervisorToolName.create_todo);
    });
  });

  describe('always-included tools', () => {
    it('should always include trigger_agent regardless of flags', () => {
      const scenarios = [
        contextSupervisorMakeDecision(baseContext),
        contextSupervisorMakeDecision({ ...baseContext, allowDM: true, scene: 'productive' }),
        contextSupervisorMakeDecision({ ...baseContext, allowDM: false, scene: 'casual' }),
      ];

      for (const result of scenarios) {
        expect(getToolNames(result)).toContain(SupervisorToolName.trigger_agent);
      }
    });

    it('should always include wait_for_user_input regardless of flags', () => {
      const scenarios = [
        contextSupervisorMakeDecision(baseContext),
        contextSupervisorMakeDecision({ ...baseContext, allowDM: true, scene: 'productive' }),
        contextSupervisorMakeDecision({ ...baseContext, allowDM: false, scene: 'casual' }),
      ];

      for (const result of scenarios) {
        expect(getToolNames(result)).toContain(SupervisorToolName.wait_for_user_input);
      }
    });
  });

  describe('combined tool scenarios', () => {
    it('should have all 5 tools when allowDM=true and scene=productive', () => {
      const result = contextSupervisorMakeDecision({
        ...baseContext,
        allowDM: true,
        scene: 'productive',
      });
      const toolNames = getToolNames(result);

      expect(toolNames).toContain(SupervisorToolName.trigger_agent);
      expect(toolNames).toContain(SupervisorToolName.wait_for_user_input);
      expect(toolNames).toContain(SupervisorToolName.trigger_agent_dm);
      expect(toolNames).toContain(SupervisorToolName.finish_todo);
      expect(toolNames).toContain(SupervisorToolName.create_todo);
      expect(toolNames).toHaveLength(5);
    });

    it('should have only 2 tools when allowDM=false and scene=casual', () => {
      const result = contextSupervisorMakeDecision({
        ...baseContext,
        allowDM: false,
        scene: 'casual',
      });
      const toolNames = getToolNames(result);

      expect(toolNames).toContain(SupervisorToolName.trigger_agent);
      expect(toolNames).toContain(SupervisorToolName.wait_for_user_input);
      expect(toolNames).not.toContain(SupervisorToolName.trigger_agent_dm);
      expect(toolNames).not.toContain(SupervisorToolName.finish_todo);
      expect(toolNames).not.toContain(SupervisorToolName.create_todo);
      expect(toolNames).toHaveLength(2);
    });

    it('should have 3 tools when allowDM=true and scene=casual', () => {
      const result = contextSupervisorMakeDecision({
        ...baseContext,
        allowDM: true,
        scene: 'casual',
      });
      const toolNames = getToolNames(result);

      expect(toolNames).toContain(SupervisorToolName.trigger_agent);
      expect(toolNames).toContain(SupervisorToolName.wait_for_user_input);
      expect(toolNames).toContain(SupervisorToolName.trigger_agent_dm);
      expect(toolNames).not.toContain(SupervisorToolName.finish_todo);
      expect(toolNames).not.toContain(SupervisorToolName.create_todo);
      expect(toolNames).toHaveLength(3);
    });

    it('should have 4 tools when allowDM=false and scene=productive', () => {
      const result = contextSupervisorMakeDecision({
        ...baseContext,
        allowDM: false,
        scene: 'productive',
      });
      const toolNames = getToolNames(result);

      expect(toolNames).toContain(SupervisorToolName.trigger_agent);
      expect(toolNames).toContain(SupervisorToolName.wait_for_user_input);
      expect(toolNames).not.toContain(SupervisorToolName.trigger_agent_dm);
      expect(toolNames).toContain(SupervisorToolName.finish_todo);
      expect(toolNames).toContain(SupervisorToolName.create_todo);
      expect(toolNames).toHaveLength(4);
    });
  });

  describe('agent filtering', () => {
    it('should filter out agents without an id', () => {
      const result = contextSupervisorMakeDecision({
        ...baseContext,
        availableAgents: [
          { id: 'agent-1', title: 'Agent One' },
          { id: '', title: 'No ID Agent' },
          { id: 'agent-2' },
        ],
      });

      // Should succeed without errors and include valid agents in prompt
      expect(result.messages[0].content).toContain('agent-1');
      expect(result.messages[0].content).toContain('agent-2');
    });

    it('should work with an empty agents list', () => {
      const result = contextSupervisorMakeDecision({
        ...baseContext,
        availableAgents: [],
      });

      expect(result).toHaveProperty('messages');
      expect(result.temperature).toBe(0.3);
    });

    it('should work with agents that have no title', () => {
      const result = contextSupervisorMakeDecision({
        ...baseContext,
        availableAgents: [{ id: 'agent-no-title' }],
      });

      expect(result.messages[0].content).toContain('agent-no-title');
    });
  });

  describe('messages handling', () => {
    it('should work with an empty messages array', () => {
      const result = contextSupervisorMakeDecision({
        ...baseContext,
        messages: [],
      });

      expect(result).toHaveProperty('messages');
      expect(result.temperature).toBe(0.3);
    });

    it('should work with supervisor messages (they should be filtered)', () => {
      const messagesWithSupervisor: UIChatMessage[] = [
        createMessage('m1', 'user', 'Hello'),
        {
          ...createMessage('m2', 'assistant', 'Supervisor decision'),
          role: 'supervisor',
          agentId: 'supervisor',
        },
      ];

      const result = contextSupervisorMakeDecision({
        ...baseContext,
        messages: messagesWithSupervisor,
      });

      expect(result).toHaveProperty('messages');
    });

    it('should include userName in the generated prompt', () => {
      const result = contextSupervisorMakeDecision({
        ...baseContext,
        userName: 'Alice',
      });

      expect(result.messages[0].content).toContain('Alice');
    });
  });
});
