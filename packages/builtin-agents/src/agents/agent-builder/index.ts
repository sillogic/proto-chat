import { AgentBuilderIdentifier } from '@lobechat/builtin-tool-agent-builder';
import { DEFAULT_PROVIDER } from '@lobechat/business-const';

import type { BuiltinAgentDefinition } from '../../types';
import { BUILTIN_AGENT_SLUGS } from '../../types';
import { systemRoleTemplate } from './systemRole';

/**
 * Agent Builder - used for configuring AI agents through natural conversation
 */
export const AGENT_BUILDER: BuiltinAgentDefinition = {
  avatar: '/avatars/agent-builder.png',

  // Persist config - stored in database
  // Use gemini-3.1-flash-lite-preview for better tool-calling reliability
  // (gemini-2.5-flash tends to skip tool calls and just generate text)
  persist: {
    model: 'gemini-3.1-flash-lite-preview',
    provider: DEFAULT_PROVIDER,
  },

  // Runtime config - static systemRole
  runtime: (ctx) => ({
    plugins: [AgentBuilderIdentifier, ...(ctx.plugins || [])],
    systemRole: systemRoleTemplate,
  }),

  slug: BUILTIN_AGENT_SLUGS.agentBuilder,
};
