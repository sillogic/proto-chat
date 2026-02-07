import { ChatModelCard, ModelProviderCard } from '@/types/llm';

// Re-export all from model-bank/modelProviders
export * from 'model-bank/modelProviders';

// Import providers from model-bank for use in this file
import Ai21Provider from 'packages/model-bank/src/modelProviders/ai21';
import Ai302Provider from 'packages/model-bank/src/modelProviders/ai302';
import Ai360Provider from 'packages/model-bank/src/modelProviders/ai360';
import AiHubMixProvider from 'packages/model-bank/src/modelProviders/aihubmix';
import AkashChatProvider from 'packages/model-bank/src/modelProviders/akashchat';
import AnthropicProvider from 'packages/model-bank/src/modelProviders/anthropic';
import AzureProvider from 'packages/model-bank/src/modelProviders/azure';
import AzureAIProvider from 'packages/model-bank/src/modelProviders/azureai';
import BaichuanProvider from 'packages/model-bank/src/modelProviders/baichuan';
import BedrockProvider from 'packages/model-bank/src/modelProviders/bedrock';
import BflProvider from 'packages/model-bank/src/modelProviders/bfl';
import CerebrasProvider from 'packages/model-bank/src/modelProviders/cerebras';
import CloudflareProvider from 'packages/model-bank/src/modelProviders/cloudflare';
import CohereProvider from 'packages/model-bank/src/modelProviders/cohere';
import CometAPIProvider from 'packages/model-bank/src/modelProviders/cometapi';
import ComfyUIProvider from 'packages/model-bank/src/modelProviders/comfyui';
import DeepSeekProvider from 'packages/model-bank/src/modelProviders/deepseek';
import FalProvider from 'packages/model-bank/src/modelProviders/fal';
import FireworksAIProvider from 'packages/model-bank/src/modelProviders/fireworksai';
import GiteeAIProvider from 'packages/model-bank/src/modelProviders/giteeai';
import GithubProvider from 'packages/model-bank/src/modelProviders/github';
import GoogleProvider from 'packages/model-bank/src/modelProviders/google';
import GroqProvider from 'packages/model-bank/src/modelProviders/groq';
import HigressProvider from 'packages/model-bank/src/modelProviders/higress';
import HuggingFaceProvider from 'packages/model-bank/src/modelProviders/huggingface';
import HunyuanProvider from 'packages/model-bank/src/modelProviders/hunyuan';
import InfiniAIProvider from 'packages/model-bank/src/modelProviders/infiniai';
import InternLMProvider from 'packages/model-bank/src/modelProviders/internlm';
import JinaProvider from 'packages/model-bank/src/modelProviders/jina';
import LMStudioProvider from 'packages/model-bank/src/modelProviders/lmstudio';
import MinimaxProvider from 'packages/model-bank/src/modelProviders/minimax';
import MistralProvider from 'packages/model-bank/src/modelProviders/mistral';
import ModelScopeProvider from 'packages/model-bank/src/modelProviders/modelscope';
import MoonshotProvider from 'packages/model-bank/src/modelProviders/moonshot';
import NebiusProvider from 'packages/model-bank/src/modelProviders/nebius';
import NewAPIProvider from 'packages/model-bank/src/modelProviders/newapi';
import NovitaProvider from 'packages/model-bank/src/modelProviders/novita';
import NvidiaProvider from 'packages/model-bank/src/modelProviders/nvidia';
import OllamaProvider from 'packages/model-bank/src/modelProviders/ollama';
import OllamaCloudProvider from 'packages/model-bank/src/modelProviders/ollamacloud';
import OpenAIProvider from 'packages/model-bank/src/modelProviders/openai';
import OpenRouterProvider from 'packages/model-bank/src/modelProviders/openrouter';
import PerplexityProvider from 'packages/model-bank/src/modelProviders/perplexity';
import PPIOProvider from 'packages/model-bank/src/modelProviders/ppio';
import QiniuProvider from 'packages/model-bank/src/modelProviders/qiniu';
import QwenProvider from 'packages/model-bank/src/modelProviders/qwen';
import ReplicateProvider from 'packages/model-bank/src/modelProviders/replicate';
import SambaNovaProvider from 'packages/model-bank/src/modelProviders/sambanova';
import Search1APIProvider from 'packages/model-bank/src/modelProviders/search1api';
import SenseNovaProvider from 'packages/model-bank/src/modelProviders/sensenova';
import SiliconCloudProvider from 'packages/model-bank/src/modelProviders/siliconcloud';
import SparkProvider from 'packages/model-bank/src/modelProviders/spark';
import StepfunProvider from 'packages/model-bank/src/modelProviders/stepfun';
import TaichuProvider from 'packages/model-bank/src/modelProviders/taichu';
import TencentcloudProvider from 'packages/model-bank/src/modelProviders/tencentcloud';
import TogetherAIProvider from 'packages/model-bank/src/modelProviders/togetherai';
import UpstageProvider from 'packages/model-bank/src/modelProviders/upstage';
import V0Provider from 'packages/model-bank/src/modelProviders/v0';
import VercelAIGatewayProvider from 'packages/model-bank/src/modelProviders/vercelaigateway';
import VertexAIProvider from 'packages/model-bank/src/modelProviders/vertexai';
import VLLMProvider from 'packages/model-bank/src/modelProviders/vllm';
import VolcengineProvider from 'packages/model-bank/src/modelProviders/volcengine';
import WenxinProvider from 'packages/model-bank/src/modelProviders/wenxin';
import XAIProvider from 'packages/model-bank/src/modelProviders/xai';
import XinferenceProvider from 'packages/model-bank/src/modelProviders/xinference';
import ZenMuxProvider from 'packages/model-bank/src/modelProviders/zenmux';
import ZeroOneProvider from 'packages/model-bank/src/modelProviders/zeroone';
import ZhiPuProvider from 'packages/model-bank/src/modelProviders/zhipu';

// Import custom ProtoChat provider
import ProtoChatProvider from './protochat';

/**
 * @deprecated
 */
export const LOBE_DEFAULT_MODEL_LIST: ChatModelCard[] = [
  OpenAIProvider.chatModels,
  QwenProvider.chatModels,
  ZhiPuProvider.chatModels,
  BedrockProvider.chatModels,
  DeepSeekProvider.chatModels,
  GoogleProvider.chatModels,
  GroqProvider.chatModels,
  GithubProvider.chatModels,
  MinimaxProvider.chatModels,
  MistralProvider.chatModels,
  ModelScopeProvider.chatModels,
  MoonshotProvider.chatModels,
  OllamaProvider.chatModels,
  VLLMProvider.chatModels,
  XinferenceProvider.chatModels,
  OpenRouterProvider.chatModels,
  TogetherAIProvider.chatModels,
  FireworksAIProvider.chatModels,
  PerplexityProvider.chatModels,
  AnthropicProvider.chatModels,
  HuggingFaceProvider.chatModels,
  XAIProvider.chatModels,
  JinaProvider.chatModels,
  SambaNovaProvider.chatModels,
  CohereProvider.chatModels,
  V0Provider.chatModels,
  ZeroOneProvider.chatModels,
  StepfunProvider.chatModels,
  NovitaProvider.chatModels,
  NvidiaProvider.chatModels,
  BaichuanProvider.chatModels,
  TaichuProvider.chatModels,
  CloudflareProvider.chatModels,
  Ai360Provider.chatModels,
  AiHubMixProvider.chatModels,
  SiliconCloudProvider.chatModels,
  GiteeAIProvider.chatModels,
  UpstageProvider.chatModels,
  SparkProvider.chatModels,
  Ai21Provider.chatModels,
  HunyuanProvider.chatModels,
  WenxinProvider.chatModels,
  SenseNovaProvider.chatModels,
  InternLMProvider.chatModels,
  HigressProvider.chatModels,
  PPIOProvider.chatModels,
  Search1APIProvider.chatModels,
  InfiniAIProvider.chatModels,
  QiniuProvider.chatModels,
  VercelAIGatewayProvider.chatModels,
].flat();

export const DEFAULT_MODEL_PROVIDER_LIST = [
  ProtoChatProvider, // ProtoChat自有供应商（放在最前面）
  OpenAIProvider,
  { ...AzureProvider, chatModels: [] },
  AzureAIProvider,
  OllamaProvider,
  OllamaCloudProvider,
  VLLMProvider,
  ComfyUIProvider,
  XinferenceProvider,
  AnthropicProvider,
  BedrockProvider,
  GoogleProvider,
  VertexAIProvider,
  DeepSeekProvider,
  MoonshotProvider,
  AiHubMixProvider,
  OpenRouterProvider,
  FalProvider,
  HuggingFaceProvider,
  CloudflareProvider,
  GithubProvider,
  NewAPIProvider,
  BflProvider,
  NovitaProvider,
  PPIOProvider,
  Ai302Provider,
  NvidiaProvider,
  TogetherAIProvider,
  FireworksAIProvider,
  GroqProvider,
  PerplexityProvider,
  MistralProvider,
  ModelScopeProvider,
  Ai21Provider,
  UpstageProvider,
  XAIProvider,
  JinaProvider,
  SambaNovaProvider,
  CohereProvider,
  V0Provider,
  QwenProvider,
  WenxinProvider,
  TencentcloudProvider,
  HunyuanProvider,
  ZhiPuProvider,
  SiliconCloudProvider,
  ZeroOneProvider,
  SparkProvider,
  SenseNovaProvider,
  StepfunProvider,
  BaichuanProvider,
  VolcengineProvider,
  MinimaxProvider,
  LMStudioProvider,
  InternLMProvider,
  HigressProvider,
  GiteeAIProvider,
  TaichuProvider,
  Ai360Provider,
  Search1APIProvider,
  InfiniAIProvider,
  AkashChatProvider,
  QiniuProvider,
  ReplicateProvider,
  NebiusProvider,
  CometAPIProvider,
  VercelAIGatewayProvider,
  CerebrasProvider,
  ZenMuxProvider,
];

export const filterEnabledModels = (provider: ModelProviderCard) => {
  return provider.chatModels.filter((v) => v.enabled).map((m) => m.id);
};

export const isProviderDisableBrowserRequest = (id: string) => {
  const provider = DEFAULT_MODEL_PROVIDER_LIST.find((v) => v.id === id && v.disableBrowserRequest);
  return !!provider;
};

// Export custom ProtoChat provider card
export { default as ProtoChatProviderCard } from './protochat';
