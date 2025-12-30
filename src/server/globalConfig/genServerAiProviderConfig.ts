import { ProviderConfig } from '@lobechat/types';
import { AiFullModelCard, ModelProvider } from 'model-bank';
import * as AiModels from 'model-bank';

import { getLLMConfig } from '@/envs/llm';
import { KeyVaultsGateKeeper } from '@/server/modules/KeyVaultsEncrypt';
import { extractEnabledModels, transformToAiModelList } from '@/utils/server/parseModels';
import { aiProviders, serverDB } from '@lobechat/database';
import { eq } from 'drizzle-orm';

interface ProviderSpecificConfig {
  enabled?: boolean;
  enabledKey?: string;
  fetchOnClient?: boolean;
  modelListKey?: string;
  withDeploymentName?: boolean;
}

export const genServerAiProvidersConfig = async (
  specificConfig: Record<any, ProviderSpecificConfig>,
) => {
  const llmConfig = getLLMConfig() as Record<string, any>;

  // 1. Fetch global providers from database
  let globalDatabaseProviders: Record<string, any> = {};
  try {
    const dbProviders = await serverDB.select().from(aiProviders).where(eq(aiProviders.isGlobal, true));

    if (dbProviders.length > 0) {
      for (const p of dbProviders) {
        let keyVaults = {};
        if (p.keyVaults) {
          keyVaults = await KeyVaultsGateKeeper.getUserKeyVaults(p.keyVaults);
        }
        globalDatabaseProviders[p.id] = {
          ...p,
          keyVaults,
        };
      }
    }
  } catch (error) {
    if (process.env.SKIP_DB_OPERATIONS !== '1' && process.env.SKIP_DB_CHECK !== '1') {
      console.error('Failed to fetch global providers from database:', error);
    }
  }

  // Process all providers concurrently
  const providerConfigs = await Promise.all(
    Object.values(ModelProvider).map(async (provider) => {
      const providerUpperCase = provider.toUpperCase();
      const aiModels = AiModels[provider] as AiFullModelCard[];

      if (!aiModels)
        throw new Error(
          `Provider [${provider}] not found in aiModels, please make sure you have exported the provider in the \`aiModels/index.ts\``,
        );

      const providerConfig = specificConfig[provider as keyof typeof specificConfig] || {};
      const modelString =
        process.env[providerConfig.modelListKey ?? `${providerUpperCase}_MODEL_LIST`];

      const dbProvider = globalDatabaseProviders[provider];
      const isGlobalEnabled = dbProvider?.enabled === true;

      // If it's a global provider, we should force fetchOnClient to false
      // to ensure the server-side proxy (and the global key) is used.
      const finalFetchOnClient = isGlobalEnabled
        ? false
        : providerConfig.fetchOnClient !== undefined
          ? providerConfig.fetchOnClient
          : undefined;

      // If enabled in DB but no model string in env, we should at least enable all default models
      const finalModelString = modelString || (isGlobalEnabled ? '+all' : '');

      // Process extractEnabledModels and transformToAiModelList concurrently
      const [enabledModels, serverModelLists] = await Promise.all([
        extractEnabledModels(provider, finalModelString, providerConfig.withDeploymentName || false),
        transformToAiModelList({
          defaultModels: aiModels || [],
          modelString: finalModelString,
          providerId: provider,
          withDeploymentName: providerConfig.withDeploymentName || false,
        }),
      ]);

      return {
        config: {
          enabled:
            isGlobalEnabled ||
            (typeof providerConfig.enabled !== 'undefined'
              ? providerConfig.enabled
              : llmConfig[providerConfig.enabledKey || `ENABLED_${providerUpperCase}`]),
          enabledModels,
          serverModelLists,
          ...(finalFetchOnClient !== undefined && {
            fetchOnClient: finalFetchOnClient,
          }),
          // Merge database-backed keyVaults into settings for server usage
          ...dbProvider?.keyVaults,
        },
        provider,
      };
    }),
  );

  // Convert the results to an object
  const config = {} as Record<string, ProviderConfig>;
  for (const { provider, config: providerConfig } of providerConfigs) {
    config[provider] = providerConfig;
  }

  return config;
};
