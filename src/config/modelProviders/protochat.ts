import { ModelProviderCard } from '@/types/llm';

/**
 * ProtoChat 自有供应商配置
 *
 * ProtoChat是一个"套壳"供应商，整合底层供应商（OpenRouter、DeepSeek等）
 * 提供统一的AI服务，并进行积分计费。
 *
 * 特点：
 * - 模型列表从后台数据库动态获取
 * - 不支持用户自定义API Key和Base URL
 * - 只有后台管理员可以配置底层供应商
 */
const ProtoChat: ModelProviderCard = {
  // 模型列表从数据库动态获取，这里为空
  chatModels: [],
  // 不需要检查模型，因为是受管理的服务
  checkModel: undefined,
  description:
    'ProtoChat AI 服务是由系统管理员统一配置和管理的AI服务。提供多种主流AI模型，支持对话、图像生成等功能。使用此服务将消耗积分。',
  // 供应商ID
  id: 'protochat',
  // 模型列表配置
  modelList: {
    // 不显示模型获取按钮，因为模型列表由后台管理
    showModelFetcher: false,
  },
  // 供应商名称
  name: 'ProtoChat AI',
  settings: {
    // 禁用浏览器端请求（通过服务端转发）
    disableBrowserRequest: true,
    // 不显示代理URL配置（由后台管理）
    proxyUrl: undefined,
    // SDK类型（实际会根据底层供应商动态选择）
    sdkType: 'openai',
    // 不显示模型获取按钮
    showModelFetcher: false,
  },
  // 不显示配置表单（由后台管理）
  showConfig: false,
  url: 'https://protochat.ai',
};

export default ProtoChat;
