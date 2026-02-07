import { genUserLLMConfig } from './genUserLLMConfig';

export const DEFAULT_LLM_CONFIG = genUserLLMConfig({
  lmstudio: {
    fetchOnClient: true,
  },
  ollama: {
    enabled: true,
    fetchOnClient: true,
  },
  openai: {
    enabled: false,  // 禁用 OpenAI
  },
  protochat: {
    enabled: true,  // 启用你的 ProtoChat
  },
});

// 修改为你实际使用的模型和提供商
export const DEFAULT_MODEL = 'gemini-2.5-flash';  // ProtoChat 会自动路由到 gemini-2.5-flash

// 使用 OpenRouter 的 Qwen Embedding（通过 ProtoChat）
// 方案1：使用 ProtoChat 的内部 ID（需要在后台配置映射）
// export const DEFAULT_EMBEDDING_MODEL = 'qwen-embed-4b';
// export const DEFAULT_EMBEDDING_PROVIDER = 'protochat';

// 使用 ProtoChat 的内部 ID（需要在后台数据库配置）
export const DEFAULT_EMBEDDING_MODEL = 'qwen-embed-4b';  // 32k 上下文，价格实惠
export const DEFAULT_EMBEDDING_PROVIDER = 'protochat';  // ProtoChat 会路由到 OpenRouter

// Rerank 功能目前未实现，配置仅作占位符
// 如需启用，可配置 Cohere 或其他支持 rerank 的 provider
export const DEFAULT_RERANK_MODEL = 'rerank-english-v3.0';
export const DEFAULT_RERANK_PROVIDER = 'cohere';  // 或改为 'none' / 'disabled'
export const DEFAULT_RERANK_QUERY_MODE = 'full_text';

export const DEFAULT_PROVIDER = 'protochat';  // 修改为你的默认提供商
