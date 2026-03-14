import { DEFAULT_PROVIDER } from '@lobechat/business-const';
import type { UserSystemAgentConfig } from '@lobechat/types';

import { DEFAULT_SYSTEM_AGENT_CONFIG } from '@/const/settings';
import { type UserStore } from '@/store/user';
import { merge } from '@/utils/merge';

import { currentSettings } from './settings';

/**
 * Merge user's stored system agent config with defaults, fixing stale provider values.
 *
 * When the project switched from upstream LobeChat defaults (anthropic) to ProtoChat,
 * users who had already loaded the app got `provider: 'anthropic'` persisted in their
 * settings. The merge gives user values priority, so the stale provider wins.
 *
 * Fix: for each task, if the stored provider differs from DEFAULT_PROVIDER, reset
 * model+provider to defaults — the old model is unlikely to be valid on the new provider.
 * Same pattern as the page-agent fix (42f4bb9a69).
 */
const currentSystemAgent = (s: UserStore) => {
  const merged = merge(
    DEFAULT_SYSTEM_AGENT_CONFIG,
    currentSettings(s).systemAgent,
  ) as UserSystemAgentConfig;

  for (const key of Object.keys(DEFAULT_SYSTEM_AGENT_CONFIG) as (keyof UserSystemAgentConfig)[]) {
    const item = merged[key];
    if (item?.provider && item.provider !== DEFAULT_PROVIDER) {
      merged[key] = { ...item, ...DEFAULT_SYSTEM_AGENT_CONFIG[key] };
    }
  }

  return merged;
};

const translation = (s: UserStore) => currentSystemAgent(s).translation;
const topic = (s: UserStore) => currentSystemAgent(s).topic;
const thread = (s: UserStore) => currentSystemAgent(s).thread;
const agentMeta = (s: UserStore) => currentSystemAgent(s).agentMeta;
const queryRewrite = (s: UserStore) => currentSystemAgent(s).queryRewrite;
const historyCompress = (s: UserStore) => currentSystemAgent(s).historyCompress;
const generationTopic = (s: UserStore) => currentSystemAgent(s).generationTopic;

export const systemAgentSelectors = {
  agentMeta,
  generationTopic,
  historyCompress,
  queryRewrite,
  thread,
  topic,
  translation,
};
