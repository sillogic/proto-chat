import type { ModelProviderCard } from '@/types/llm';

/**
 * ProtoChat proprietary provider configuration
 *
 * ProtoChat is a "wrapper" provider that integrates underlying providers (OpenRouter, DeepSeek, etc.)
 * providing unified AI services with credit-based billing.
 *
 * Features:
 * - Model list is dynamically fetched from the backend database
 * - Does not support user-defined API Key and Base URL
 * - Only backend administrators can configure the underlying providers
 */
const ProtoChat: ModelProviderCard = {
  // Model list is dynamically fetched from the database, empty here
  chatModels: [],
  // No model check needed as this is a managed service
  checkModel: undefined,
  description:
    'ProtoChat AI 服务是由系统管理员统一配置和管理的AI服务。提供多种主流AI模型，支持对话、图像生成等功能。使用此服务将消耗积分。',
  // Enabled by default to ensure new users can use it right away
  enabled: true,
  // Provider ID
  id: 'protochat',
  // Model list configuration
  modelList: {
    // Hide the model fetcher button since the model list is managed by the backend
    showModelFetcher: false,
  },
  // Provider name
  name: 'ProtoChat AI',
  settings: {
    // Disable browser-side requests (routed through server-side)
    disableBrowserRequest: true,
    // Hide proxy URL configuration (managed by the backend)
    proxyUrl: undefined,
    // SDK type (dynamically selected based on the underlying provider)
    sdkType: 'openai',
    // Hide the model fetcher button
    showModelFetcher: false,
  },
  // Hide the configuration form (managed by the backend)
  showConfig: false,
  url: 'https://protochat.ai',
};

export default ProtoChat;
