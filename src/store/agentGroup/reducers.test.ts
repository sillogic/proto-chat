import { type AgentGroupDetail } from '@lobechat/types';
import { describe, expect, it } from 'vitest';

import { type ChatGroupItem } from '@/database/schemas/chatGroup';

import { type ChatGroupState, initialChatGroupState } from './initialState';
import { chatGroupReducers } from './reducers';

// Helper to create a mock ChatGroupItem
const createMockGroupItem = (overrides: Partial<ChatGroupItem> = {}): ChatGroupItem => ({
  accessedAt: new Date('2024-01-01'),
  avatar: null,
  backgroundColor: null,
  clientId: null,
  config: null,
  content: null,
  createdAt: new Date('2024-01-01'),
  description: null,
  editorData: null,
  groupId: null,
  id: 'group-1',
  marketIdentifier: null,
  pinned: false,
  title: 'Test Group',
  updatedAt: new Date('2024-01-01'),
  userId: 'user-1',
  ...overrides,
});

// Helper to create a mock AgentGroupDetail
const createMockGroupDetail = (overrides: Partial<AgentGroupDetail> = {}): AgentGroupDetail => ({
  ...createMockGroupItem(),
  agents: [],
  ...overrides,
});

describe('chatGroupReducers', () => {
  describe('addGroup', () => {
    it('should add a new group to the groups list', () => {
      const state: ChatGroupState = { ...initialChatGroupState };
      const newGroup = createMockGroupItem({ id: 'group-1', title: 'New Group' });

      const newState = chatGroupReducers.addGroup(state, { payload: newGroup });

      expect(newState.groups).toHaveLength(1);
      expect(newState.groups[0]).toEqual(newGroup);
    });

    it('should add the group to the groupMap with empty agents array', () => {
      const state: ChatGroupState = { ...initialChatGroupState };
      const newGroup = createMockGroupItem({ id: 'group-1', title: 'New Group' });

      const newState = chatGroupReducers.addGroup(state, { payload: newGroup });

      expect(newState.groupMap['group-1']).toBeDefined();
      expect(newState.groupMap['group-1'].id).toBe('group-1');
      expect(newState.groupMap['group-1'].agents).toEqual([]);
    });

    it('should preserve existing groups when adding a new one', () => {
      const existingGroup = createMockGroupItem({ id: 'group-1', title: 'Existing Group' });
      const state: ChatGroupState = {
        ...initialChatGroupState,
        groupMap: { 'group-1': createMockGroupDetail({ id: 'group-1' }) },
        groups: [existingGroup],
      };
      const newGroup = createMockGroupItem({ id: 'group-2', title: 'New Group' });

      const newState = chatGroupReducers.addGroup(state, { payload: newGroup });

      expect(newState.groups).toHaveLength(2);
      expect(newState.groupMap['group-1']).toBeDefined();
      expect(newState.groupMap['group-2']).toBeDefined();
    });

    it('should not mutate the original state', () => {
      const state: ChatGroupState = { ...initialChatGroupState };
      const newGroup = createMockGroupItem({ id: 'group-1' });

      const newState = chatGroupReducers.addGroup(state, { payload: newGroup });

      expect(state.groups).toHaveLength(0);
      expect(newState.groups).toHaveLength(1);
    });
  });

  describe('deleteGroup', () => {
    it('should remove the group from the groups list', () => {
      const group1 = createMockGroupItem({ id: 'group-1', title: 'Group 1' });
      const group2 = createMockGroupItem({ id: 'group-2', title: 'Group 2' });
      const state: ChatGroupState = {
        ...initialChatGroupState,
        groupMap: {
          'group-1': createMockGroupDetail({ id: 'group-1' }),
          'group-2': createMockGroupDetail({ id: 'group-2' }),
        },
        groups: [group1, group2],
      };

      const newState = chatGroupReducers.deleteGroup(state, { payload: 'group-1' });

      expect(newState.groups).toHaveLength(1);
      expect(newState.groups[0].id).toBe('group-2');
    });

    it('should remove the group from the groupMap', () => {
      const group1 = createMockGroupItem({ id: 'group-1' });
      const state: ChatGroupState = {
        ...initialChatGroupState,
        groupMap: { 'group-1': createMockGroupDetail({ id: 'group-1' }) },
        groups: [group1],
      };

      const newState = chatGroupReducers.deleteGroup(state, { payload: 'group-1' });

      expect(newState.groupMap['group-1']).toBeUndefined();
    });

    it('should return unchanged state when deleting a non-existent group', () => {
      const group1 = createMockGroupItem({ id: 'group-1' });
      const state: ChatGroupState = {
        ...initialChatGroupState,
        groupMap: { 'group-1': createMockGroupDetail({ id: 'group-1' }) },
        groups: [group1],
      };

      const newState = chatGroupReducers.deleteGroup(state, { payload: 'non-existent' });

      expect(newState.groups).toHaveLength(1);
      expect(newState.groupMap['group-1']).toBeDefined();
    });

    it('should not mutate the original state', () => {
      const group1 = createMockGroupItem({ id: 'group-1' });
      const state: ChatGroupState = {
        ...initialChatGroupState,
        groupMap: { 'group-1': createMockGroupDetail({ id: 'group-1' }) },
        groups: [group1],
      };

      const newState = chatGroupReducers.deleteGroup(state, { payload: 'group-1' });

      expect(state.groups).toHaveLength(1);
      expect(newState.groups).toHaveLength(0);
    });
  });

  describe('loadGroups', () => {
    it('should replace the groups list with the provided payload', () => {
      const state: ChatGroupState = { ...initialChatGroupState };
      const groups = [
        createMockGroupItem({ id: 'group-1', title: 'Group 1' }),
        createMockGroupItem({ id: 'group-2', title: 'Group 2' }),
      ];

      const newState = chatGroupReducers.loadGroups(state, { payload: groups });

      expect(newState.groups).toHaveLength(2);
      expect(newState.groups[0].id).toBe('group-1');
      expect(newState.groups[1].id).toBe('group-2');
    });

    it('should build the groupMap from the provided groups', () => {
      const state: ChatGroupState = { ...initialChatGroupState };
      const groups = [
        createMockGroupItem({ id: 'group-1', title: 'Group 1' }),
        createMockGroupItem({ id: 'group-2', title: 'Group 2' }),
      ];

      const newState = chatGroupReducers.loadGroups(state, { payload: groups });

      expect(newState.groupMap['group-1']).toBeDefined();
      expect(newState.groupMap['group-2']).toBeDefined();
      expect(newState.groupMap['group-1'].agents).toEqual([]);
    });

    it('should preserve existing agents data when reloading groups', () => {
      const existingAgents: AgentGroupDetail['agents'] = [
        {
          agentId: 'agent-1',
          avatar: undefined,
          backgroundColor: undefined,
          createdAt: new Date(),
          description: undefined,
          id: 'agent-1',
          isSupervisor: false,
          slug: 'agent-slug',
          title: 'Agent 1',
          updatedAt: new Date(),
          userId: 'user-1',
        } as any,
      ];
      const state: ChatGroupState = {
        ...initialChatGroupState,
        groupMap: {
          'group-1': createMockGroupDetail({ agents: existingAgents, id: 'group-1' }),
        },
        groups: [createMockGroupItem({ id: 'group-1' })],
      };
      const updatedGroups = [createMockGroupItem({ id: 'group-1', title: 'Updated Group 1' })];

      const newState = chatGroupReducers.loadGroups(state, { payload: updatedGroups });

      // Should preserve the existing agents
      expect(newState.groupMap['group-1'].agents).toEqual(existingAgents);
      // Should update other fields
      expect(newState.groupMap['group-1'].title).toBe('Updated Group 1');
    });

    it('should create new groupMap entry for groups not previously in state', () => {
      const state: ChatGroupState = {
        ...initialChatGroupState,
        groupMap: { 'group-1': createMockGroupDetail({ id: 'group-1' }) },
        groups: [createMockGroupItem({ id: 'group-1' })],
      };
      const newGroups = [
        createMockGroupItem({ id: 'group-1' }),
        createMockGroupItem({ id: 'group-2', title: 'Brand New Group' }),
      ];

      const newState = chatGroupReducers.loadGroups(state, { payload: newGroups });

      expect(newState.groupMap['group-2']).toBeDefined();
      expect(newState.groupMap['group-2'].agents).toEqual([]);
    });

    it('should remove groups from groupMap that are not in the new payload', () => {
      const state: ChatGroupState = {
        ...initialChatGroupState,
        groupMap: {
          'group-1': createMockGroupDetail({ id: 'group-1' }),
          'group-2': createMockGroupDetail({ id: 'group-2' }),
        },
        groups: [createMockGroupItem({ id: 'group-1' }), createMockGroupItem({ id: 'group-2' })],
      };

      const newState = chatGroupReducers.loadGroups(state, {
        payload: [createMockGroupItem({ id: 'group-1' })],
      });

      expect(newState.groupMap['group-1']).toBeDefined();
      expect(newState.groupMap['group-2']).toBeUndefined();
    });

    it('should handle empty payload', () => {
      const state: ChatGroupState = {
        ...initialChatGroupState,
        groupMap: { 'group-1': createMockGroupDetail({ id: 'group-1' }) },
        groups: [createMockGroupItem({ id: 'group-1' })],
      };

      const newState = chatGroupReducers.loadGroups(state, { payload: [] });

      expect(newState.groups).toHaveLength(0);
      expect(Object.keys(newState.groupMap)).toHaveLength(0);
    });

    it('should not mutate the original state', () => {
      const state: ChatGroupState = { ...initialChatGroupState };
      const groups = [createMockGroupItem({ id: 'group-1' })];

      const newState = chatGroupReducers.loadGroups(state, { payload: groups });

      expect(state.groups).toHaveLength(0);
      expect(newState.groups).toHaveLength(1);
    });
  });

  describe('updateGroup', () => {
    it('should update the group in the groupMap', () => {
      const state: ChatGroupState = {
        ...initialChatGroupState,
        groupMap: {
          'group-1': createMockGroupDetail({ id: 'group-1', title: 'Original Title' }),
        },
        groups: [createMockGroupItem({ id: 'group-1', title: 'Original Title' })],
      };

      const newState = chatGroupReducers.updateGroup(state, {
        payload: { id: 'group-1', value: { title: 'Updated Title' } },
      });

      expect(newState.groupMap['group-1'].title).toBe('Updated Title');
    });

    it('should update the group in the groups array', () => {
      const state: ChatGroupState = {
        ...initialChatGroupState,
        groupMap: {
          'group-1': createMockGroupDetail({ id: 'group-1', title: 'Original Title' }),
        },
        groups: [createMockGroupItem({ id: 'group-1', title: 'Original Title' })],
      };

      const newState = chatGroupReducers.updateGroup(state, {
        payload: { id: 'group-1', value: { title: 'Updated Title' } },
      });

      expect(newState.groups[0].title).toBe('Updated Title');
    });

    it('should update multiple fields at once', () => {
      const state: ChatGroupState = {
        ...initialChatGroupState,
        groupMap: {
          'group-1': createMockGroupDetail({ avatar: null, description: null, id: 'group-1' }),
        },
        groups: [createMockGroupItem({ avatar: null, description: null, id: 'group-1' })],
      };

      const newState = chatGroupReducers.updateGroup(state, {
        payload: {
          id: 'group-1',
          value: { avatar: 'new-avatar.png', description: 'New description' },
        },
      });

      expect(newState.groupMap['group-1'].avatar).toBe('new-avatar.png');
      expect(newState.groupMap['group-1'].description).toBe('New description');
    });

    it('should not update other groups in the map', () => {
      const state: ChatGroupState = {
        ...initialChatGroupState,
        groupMap: {
          'group-1': createMockGroupDetail({ id: 'group-1', title: 'Group 1' }),
          'group-2': createMockGroupDetail({ id: 'group-2', title: 'Group 2' }),
        },
        groups: [
          createMockGroupItem({ id: 'group-1', title: 'Group 1' }),
          createMockGroupItem({ id: 'group-2', title: 'Group 2' }),
        ],
      };

      const newState = chatGroupReducers.updateGroup(state, {
        payload: { id: 'group-1', value: { title: 'Updated Group 1' } },
      });

      expect(newState.groupMap['group-2'].title).toBe('Group 2');
      expect(newState.groups[1].title).toBe('Group 2');
    });

    it('should do nothing when updating a non-existent group', () => {
      const state: ChatGroupState = {
        ...initialChatGroupState,
        groupMap: { 'group-1': createMockGroupDetail({ id: 'group-1', title: 'Group 1' }) },
        groups: [createMockGroupItem({ id: 'group-1', title: 'Group 1' })],
      };

      const newState = chatGroupReducers.updateGroup(state, {
        payload: { id: 'non-existent', value: { title: 'Should not apply' } },
      });

      expect(newState.groupMap['group-1'].title).toBe('Group 1');
      expect(newState.groups[0].title).toBe('Group 1');
      expect(newState.groupMap['non-existent']).toBeUndefined();
    });

    it('should not mutate the original state', () => {
      const state: ChatGroupState = {
        ...initialChatGroupState,
        groupMap: { 'group-1': createMockGroupDetail({ id: 'group-1', title: 'Original' }) },
        groups: [createMockGroupItem({ id: 'group-1', title: 'Original' })],
      };

      const newState = chatGroupReducers.updateGroup(state, {
        payload: { id: 'group-1', value: { title: 'Updated' } },
      });

      expect(state.groupMap['group-1'].title).toBe('Original');
      expect(newState.groupMap['group-1'].title).toBe('Updated');
    });
  });
});
