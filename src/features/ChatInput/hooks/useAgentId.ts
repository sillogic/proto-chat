'use client';

import { useAgentStore } from '@/store/agent';

import { useOptionalStoreApi } from '../store';

/**
 * Hook to get the effective agentId for ChatInput components.
 * Returns agentId from ChatInput store if provided (including empty string),
 * otherwise falls back to activeAgentId.
 *
 * Note: Empty string is a valid value (e.g., when Group's supervisorAgentId is not loaded yet),
 * so we only fallback when agentId is undefined (not provided).
 *
 * Gracefully handles missing ChatInputProvider (e.g., when rendered in a Portal
 * outside the provider tree, like ModelSwitchPanel in the chat header).
 */
export const useAgentId = () => {
  const storeApi = useOptionalStoreApi();
  const agentIdFromChatInput = storeApi?.getState().agentId;

  const activeAgentId = useAgentStore((s) => s.activeAgentId);

  // Only fallback to activeAgentId when agentIdFromChatInput is undefined (not provided)
  // Empty string is a valid value and should NOT trigger fallback
  return agentIdFromChatInput !== undefined ? agentIdFromChatInput : activeAgentId || '';
};
