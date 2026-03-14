import { GTDIdentifier } from '@lobechat/builtin-tool-gtd';
import { NotebookIdentifier } from '@lobechat/builtin-tool-notebook';

import type { BuiltinAgentDefinition } from '../../types';
import { BUILTIN_AGENT_SLUGS } from '../../types';
import { systemRole } from './systemRole';

/**
 * Inbox Agent - the default assistant agent for general conversations
 *
 * Note: model and provider are intentionally undefined to use user's default settings
 */
export const INBOX: BuiltinAgentDefinition = {
  avatar: '/avatars/lobe-ai.png',
  persist: {
    title: 'ProtoChat',
  },
  runtime: (ctx) => ({
    plugins: [
      'lobe-web-browsing',
      GTDIdentifier,
      NotebookIdentifier,
      ...(ctx.plugins || []),
    ],
    systemRole: systemRole,
  }),

  slug: BUILTIN_AGENT_SLUGS.inbox,
};
