import { ModelProviderCard, UserModelProviderConfig } from '@lobechat/types';
import { ModelProvider } from 'model-bank';

import * as ModelBankProviderCards from 'model-bank/modelProviders';
import ProtoChatProviderCard from '../../../src/config/modelProviders/protochat';

// Combine model-bank providers with custom ProtoChat provider
const ProviderCards = {
  ...ModelBankProviderCards,
  ProtoChatProviderCard,
};

export const genUserLLMConfig = (specificConfig: Record<any, any>): UserModelProviderConfig => {
  return Object.keys(ModelProvider).reduce((config, providerKey) => {
    const provider = ModelProvider[providerKey as keyof typeof ModelProvider];
    const providerCard = ProviderCards[
      `${providerKey}ProviderCard` as keyof typeof ProviderCards
    ] as ModelProviderCard;
    const providerConfig = specificConfig[provider as keyof typeof specificConfig] || {};

    config[provider] = {
      enabled: providerConfig.enabled !== undefined ? providerConfig.enabled : false,
      enabledModels: providerCard ? ModelBankProviderCards.filterEnabledModels(providerCard) : [],
      ...(providerConfig.fetchOnClient !== undefined && {
        fetchOnClient: providerConfig.fetchOnClient,
      }),
    };

    return config;
  }, {} as UserModelProviderConfig);
};
