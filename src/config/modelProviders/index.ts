import { ChatModelCard, ModelProviderCard } from '@/types/llm';

// Import all providers from model-bank package
import Ai21Provider from 'model-bank/modelProviders/ai21';
import Ai302Provider from 'model-bank/modelProviders/ai302';
import Ai360Provider from 'model-bank/modelProviders/ai360';
import AiHubMixProvider from 'model-bank/modelProviders/aihubmix';
import AkashChatProvider from 'model-bank/modelProviders/akashchat';
import AnthropicProvider from 'model-bank/modelProviders/anthropic';
import AzureProvider from 'model-bank/modelProviders/azure';
import AzureAIProvider from 'model-bank/modelProviders/azureai';
import BaichuanProvider from 'model-bank/modelProviders/baichuan';
import BedrockProvider from 'model-bank/modelProviders/bedrock';
import BflProvider from 'model-bank/modelProviders/bfl';
import CerebrasProvider from 'model-bank/modelProviders/cerebras';
import CloudflareProvider from 'model-bank/modelProviders/cloudflare';
import CohereProvider from 'model-bank/modelProviders/cohere';
import CometAPIProvider from 'model-bank/modelProviders/cometapi';
import ComfyUIProvider from 'model-bank/modelProviders/comfyui';
import DeepSeekProvider from 'model-bank/modelProviders/deepseek';
import FalProvider from 'model-bank/modelProviders/fal';
import FireworksAIProvider from 'model-bank/modelProviders/fireworksai';
import GiteeAIProvider from 'model-bank/modelProviders/giteeai';
import GithubProvider from 'model-bank/modelProviders/github';
import GoogleProvider from 'model-bank/modelProviders/google';
import GroqProvider from 'model-bank/modelProviders/groq';
import HigressProvider from 'model-bank/modelProviders/higress';
import HuggingFaceProvider from 'model-bank/modelProviders/huggingface';
import HunyuanProvider from 'model-bank/modelProviders/hunyuan';
import InfiniAIProvider from 'model-bank/modelProviders/infiniai';
import InternLMProvider from 'model-bank/modelProviders/internlm';
import JinaProvider from 'model-bank/modelProviders/jina';
import LMStudioProvider from 'model-bank/modelProviders/lmstudio';
import MinimaxProvider from 'model-bank/modelProviders/minimax';
import MistralProvider from 'model-bank/modelProviders/mistral';
import ModelScopeProvider from 'model-bank/modelProviders/modelscope';
import MoonshotProvider from 'model-bank/modelProviders/moonshot';
import NebiusProvider from 'model-bank/modelProviders/nebius';
import NewAPIProvider from 'model-bank/modelProviders/newapi';
import NovitaProvider from 'model-bank/modelProviders/novita';
import NvidiaProvider from 'model-bank/modelProviders/nvidia';
import OllamaProvider from 'model-bank/modelProviders/ollama';
import OllamaCloudProvider from 'model-bank/modelProviders/ollamacloud';
import OpenAIProvider from 'model-bank/modelProviders/openai';
import OpenRouterProvider from 'model-bank/modelProviders/openrouter';
import PerplexityProvider from 'model-bank/modelProviders/perplexity';
import PPIOProvider from 'model-bank/modelProviders/ppio';
import QiniuProvider from 'model-bank/modelProviders/qiniu';
import QwenProvider from 'model-bank/modelProviders/qwen';
import ReplicateProvider from 'model-bank/modelProviders/replicate';
import SambaNovaProvider from 'model-bank/modelProviders/sambanova';
import Search1APIProvider from 'model-bank/modelProviders/search1api';
import SenseNovaProvider from 'model-bank/modelProviders/sensenova';
import SiliconCloudProvider from 'model-bank/modelProviders/siliconcloud';
import SparkProvider from 'model-bank/modelProviders/spark';
import StepfunProvider from 'model-bank/modelProviders/stepfun';
import TaichuProvider from 'model-bank/modelProviders/taichu';
import TencentcloudProvider from 'model-bank/modelProviders/tencentcloud';
import TogetherAIProvider from 'model-bank/modelProviders/togetherai';
import UpstageProvider from 'model-bank/modelProviders/upstage';
import V0Provider from 'model-bank/modelProviders/v0';
import VercelAIGatewayProvider from 'model-bank/modelProviders/vercelaigateway';
import VertexAIProvider from 'model-bank/modelProviders/vertexai';
import VLLMProvider from 'model-bank/modelProviders/vllm';
import VolcengineProvider from 'model-bank/modelProviders/volcengine';
import WenxinProvider from 'model-bank/modelProviders/wenxin';
import XAIProvider from 'model-bank/modelProviders/xai';
import XinferenceProvider from 'model-bank/modelProviders/xinference';
import ZenMuxProvider from 'model-bank/modelProviders/zenmux';
import ZeroOneProvider from 'model-bank/modelProviders/zeroone';
import ZhiPuProvider from 'model-bank/modelProviders/zhipu';

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

// Re-export all provider cards from model-bank
export { default as Ai21ProviderCard } from 'model-bank/modelProviders/ai21';
export { default as Ai302ProviderCard } from 'model-bank/modelProviders/ai302';
export { default as Ai360ProviderCard } from 'model-bank/modelProviders/ai360';
export { default as AiHubMixProviderCard } from 'model-bank/modelProviders/aihubmix';
export { default as AkashChatProviderCard } from 'model-bank/modelProviders/akashchat';
export { default as AnthropicProviderCard } from 'model-bank/modelProviders/anthropic';
export { default as AzureProviderCard } from 'model-bank/modelProviders/azure';
export { default as AzureAIProviderCard } from 'model-bank/modelProviders/azureai';
export { default as BaichuanProviderCard } from 'model-bank/modelProviders/baichuan';
export { default as BedrockProviderCard } from 'model-bank/modelProviders/bedrock';
export { default as BflProviderCard } from 'model-bank/modelProviders/bfl';
export { default as CerebrasProviderCard } from 'model-bank/modelProviders/cerebras';
export { default as CloudflareProviderCard } from 'model-bank/modelProviders/cloudflare';
export { default as CohereProviderCard } from 'model-bank/modelProviders/cohere';
export { default as CometAPIProviderCard } from 'model-bank/modelProviders/cometapi';
export { default as ComfyUIProviderCard } from 'model-bank/modelProviders/comfyui';
export { default as DeepSeekProviderCard } from 'model-bank/modelProviders/deepseek';
export { default as FalProviderCard } from 'model-bank/modelProviders/fal';
export { default as FireworksAIProviderCard } from 'model-bank/modelProviders/fireworksai';
export { default as GiteeAIProviderCard } from 'model-bank/modelProviders/giteeai';
export { default as GithubProviderCard } from 'model-bank/modelProviders/github';
export { default as GoogleProviderCard } from 'model-bank/modelProviders/google';
export { default as GroqProviderCard } from 'model-bank/modelProviders/groq';
export { default as HigressProviderCard } from 'model-bank/modelProviders/higress';
export { default as HuggingFaceProviderCard } from 'model-bank/modelProviders/huggingface';
export { default as HunyuanProviderCard } from 'model-bank/modelProviders/hunyuan';
export { default as InfiniAIProviderCard } from 'model-bank/modelProviders/infiniai';
export { default as InternLMProviderCard } from 'model-bank/modelProviders/internlm';
export { default as JinaProviderCard } from 'model-bank/modelProviders/jina';
export { default as LMStudioProviderCard } from 'model-bank/modelProviders/lmstudio';
export { default as LobeHubProviderCard } from 'model-bank/modelProviders/lobehub';
export { default as MinimaxProviderCard } from 'model-bank/modelProviders/minimax';
export { default as MistralProviderCard } from 'model-bank/modelProviders/mistral';
export { default as ModelScopeProviderCard } from 'model-bank/modelProviders/modelscope';
export { default as MoonshotProviderCard } from 'model-bank/modelProviders/moonshot';
export { default as NebiusProviderCard } from 'model-bank/modelProviders/nebius';
export { default as NewAPIProviderCard } from 'model-bank/modelProviders/newapi';
export { default as NovitaProviderCard } from 'model-bank/modelProviders/novita';
export { default as NvidiaProviderCard } from 'model-bank/modelProviders/nvidia';
export { default as OllamaProviderCard } from 'model-bank/modelProviders/ollama';
export { default as OllamaCloudProviderCard } from 'model-bank/modelProviders/ollamacloud';
export { default as OpenAIProviderCard } from 'model-bank/modelProviders/openai';
export { default as OpenRouterProviderCard } from 'model-bank/modelProviders/openrouter';
export { default as PerplexityProviderCard } from 'model-bank/modelProviders/perplexity';
export { default as PPIOProviderCard } from 'model-bank/modelProviders/ppio';
export { default as QiniuProviderCard } from 'model-bank/modelProviders/qiniu';
export { default as QwenProviderCard } from 'model-bank/modelProviders/qwen';
export { default as ReplicateProviderCard } from 'model-bank/modelProviders/replicate';
export { default as SambaNovaProviderCard } from 'model-bank/modelProviders/sambanova';
export { default as Search1APIProviderCard } from 'model-bank/modelProviders/search1api';
export { default as SenseNovaProviderCard } from 'model-bank/modelProviders/sensenova';
export { default as SiliconCloudProviderCard } from 'model-bank/modelProviders/siliconcloud';
export { default as SparkProviderCard } from 'model-bank/modelProviders/spark';
export { default as StepfunProviderCard } from 'model-bank/modelProviders/stepfun';
export { default as TaichuProviderCard } from 'model-bank/modelProviders/taichu';
export { default as TencentCloudProviderCard } from 'model-bank/modelProviders/tencentcloud';
export { default as TogetherAIProviderCard } from 'model-bank/modelProviders/togetherai';
export { default as UpstageProviderCard } from 'model-bank/modelProviders/upstage';
export { default as V0ProviderCard } from 'model-bank/modelProviders/v0';
export { default as VercelAIGatewayProviderCard } from 'model-bank/modelProviders/vercelaigateway';
export { default as VertexAIProviderCard } from 'model-bank/modelProviders/vertexai';
export { default as VLLMProviderCard } from 'model-bank/modelProviders/vllm';
export { default as VolcengineProviderCard } from 'model-bank/modelProviders/volcengine';
export { default as WenxinProviderCard } from 'model-bank/modelProviders/wenxin';
export { default as XAIProviderCard } from 'model-bank/modelProviders/xai';
export { default as XinferenceProviderCard } from 'model-bank/modelProviders/xinference';
export { default as ZenMuxProviderCard } from 'model-bank/modelProviders/zenmux';
export { default as ZeroOneProviderCard } from 'model-bank/modelProviders/zeroone';
export { default as ZhiPuProviderCard } from 'model-bank/modelProviders/zhipu';

// Export custom ProtoChat provider card
export { default as ProtoChatProviderCard } from './protochat';
