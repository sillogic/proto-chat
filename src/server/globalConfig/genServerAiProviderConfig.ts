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
    console.error('Failed to fetch global providers from database:', error);
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

      // Process extractEnabledModels and transformToAiModelList concurrently
      const [enabledModels, serverModelLists] = await Promise.all([
        extractEnabledModels(provider, modelString, providerConfig.withDeploymentName || false),
        transformToAiModelList({
          defaultModels: aiModels || [],
          modelString,
          providerId: provider,
          withDeploymentName: providerConfig.withDeploymentName || false,
        }),
      ]);

      const dbProvider = globalDatabaseProviders[provider];

      return {
        config: {
          enabled:
            dbProvider?.enabled ??
            (typeof providerConfig.enabled !== 'undefined'
              ? providerConfig.enabled
              : llmConfig[providerConfig.enabledKey || `ENABLED_${providerUpperCase}`]),
          enabledModels,
          serverModelLists,
          ...(providerConfig.fetchOnClient !== undefined && {
            fetchOnClient: providerConfig.fetchOnClient,
          }),
          // Merge database-backed keyVaults into settings for server usage
          // Note: In runtimeConfig, these settings will be merged.
          // We need to ensure that keys configured in DB take precedence.
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
