import { GoogleGenAIOptions } from '@google/genai';
import { ModelRuntime } from '@lobechat/model-runtime';
import { LobeVertexAI } from '@lobechat/model-runtime/vertexai';
import { ClientSecretPayload } from '@lobechat/types';
import { safeParseJSON } from '@lobechat/utils';
import { ModelProvider } from 'model-bank';

import { serverDB } from '@/database/server';
import { getLLMConfig } from '@/envs/llm';
import { getServerGlobalConfig } from '@/server/globalConfig';
import { ProtoChatService } from '@/server/services/protochat';

import apiKeyManager from './apiKeyManager';

export * from './trace';

/**
 * Retrieves the options object from environment and apikeymanager
 * based on the provider and payload.
 *
 * @param provider - The model provider.
 * @param payload - The JWT payload.
 * @returns The options object.
 */
const getParamsFromPayload = async (provider: string, payload: ClientSecretPayload) => {
  const llmConfig = getLLMConfig() as Record<string, any>;
  const globalConfig = await getServerGlobalConfig();
  const dbConfig = globalConfig.aiProvider[provider as keyof typeof globalConfig.aiProvider] as any;

  switch (provider) {
    case ModelProvider.VertexAI: {
      return {};
    }

    default: {
      let upperProvider = provider.toUpperCase();

      if (!(`${upperProvider}_API_KEY` in llmConfig)) {
        upperProvider = ModelProvider.OpenAI.toUpperCase(); // Use OpenAI options as default
      }

      const apiKey = apiKeyManager.pick(payload?.apiKey || dbConfig?.apiKey || llmConfig[`${upperProvider}_API_KEY`]);
      const baseURL = payload?.baseURL || dbConfig?.baseURL || process.env[`${upperProvider}_PROXY_URL`];

      return baseURL ? { apiKey, baseURL } : { apiKey };
    }

    case ModelProvider.Ollama: {
      const baseURL = payload?.baseURL || dbConfig?.baseURL || process.env.OLLAMA_PROXY_URL;

      return { baseURL };
    }

    case ModelProvider.Azure: {
      const { AZURE_API_KEY, AZURE_API_VERSION, AZURE_ENDPOINT } = llmConfig;
      const apiKey = apiKeyManager.pick(payload?.apiKey || dbConfig?.apiKey || AZURE_API_KEY);
      const baseURL = payload?.baseURL || dbConfig?.baseURL || AZURE_ENDPOINT;
      const apiVersion = payload?.azureApiVersion || dbConfig?.apiVersion || AZURE_API_VERSION;
      return { apiKey, apiVersion, baseURL };
    }

    case ModelProvider.AzureAI: {
      const { AZUREAI_ENDPOINT, AZUREAI_ENDPOINT_KEY } = llmConfig;
      const apiKey = payload?.apiKey || dbConfig?.apiKey || AZUREAI_ENDPOINT_KEY;
      const baseURL = payload?.baseURL || dbConfig?.baseURL || AZUREAI_ENDPOINT;
      return { apiKey, baseURL };
    }

    case ModelProvider.Bedrock: {
      const { AWS_SECRET_ACCESS_KEY, AWS_ACCESS_KEY_ID, AWS_REGION, AWS_SESSION_TOKEN } = llmConfig;
      let accessKeyId: string | undefined = dbConfig?.accessKeyId || AWS_ACCESS_KEY_ID;
      let accessKeySecret: string | undefined = dbConfig?.secretAccessKey || AWS_SECRET_ACCESS_KEY;
      let region = dbConfig?.region || AWS_REGION;
      let sessionToken: string | undefined = dbConfig?.sessionToken || AWS_SESSION_TOKEN;
      // if the payload has the api key, use user
      if (payload.apiKey) {
        accessKeyId = payload?.awsAccessKeyId;
        accessKeySecret = payload?.awsSecretAccessKey;
        sessionToken = payload?.awsSessionToken;
        region = payload?.awsRegion;
      }
      return { accessKeyId, accessKeySecret, region, sessionToken };
    }

    case ModelProvider.Cloudflare: {
      const { CLOUDFLARE_API_KEY, CLOUDFLARE_BASE_URL_OR_ACCOUNT_ID } = llmConfig;

      const apiKey = apiKeyManager.pick(payload?.apiKey || dbConfig?.apiKey || CLOUDFLARE_API_KEY);
      const baseURLOrAccountID =
        payload.apiKey && payload.cloudflareBaseURLOrAccountID
          ? payload.cloudflareBaseURLOrAccountID
          : dbConfig?.baseURLOrAccountID || CLOUDFLARE_BASE_URL_OR_ACCOUNT_ID;

      return { apiKey, baseURLOrAccountID };
    }

    case ModelProvider.ComfyUI: {
      const {
        COMFYUI_BASE_URL,
        COMFYUI_AUTH_TYPE,
        COMFYUI_API_KEY,
        COMFYUI_USERNAME,
        COMFYUI_PASSWORD,
        COMFYUI_CUSTOM_HEADERS,
      } = llmConfig;

      // ComfyUI specific handling with environment variables fallback
      const baseURL = payload?.baseURL || dbConfig?.baseURL || COMFYUI_BASE_URL || 'http://127.0.0.1:8000';

      // ComfyUI supports multiple auth types: none, basic, bearer, custom
      // Extract all relevant auth fields from the payload or environment
      const authType = payload?.authType || dbConfig?.authType || COMFYUI_AUTH_TYPE || 'none';
      const apiKey = payload?.apiKey || dbConfig?.apiKey || COMFYUI_API_KEY;
      const username = payload?.username || dbConfig?.username || COMFYUI_USERNAME;
      const password = payload?.password || dbConfig?.password || COMFYUI_PASSWORD;

      // Parse customHeaders from JSON string (similar to Vertex AI credentials handling)
      // Support both payload object and environment variable JSON string
      const customHeaders = payload?.customHeaders || dbConfig?.customHeaders || safeParseJSON(COMFYUI_CUSTOM_HEADERS);

      // Return all authentication parameters
      return {
        apiKey,
        authType,
        baseURL,
        customHeaders,
        password,
        username,
      };
    }

    case ModelProvider.GiteeAI: {
      const { GITEE_AI_API_KEY } = llmConfig;

      const apiKey = apiKeyManager.pick(payload?.apiKey || dbConfig?.apiKey || GITEE_AI_API_KEY);

      return { apiKey };
    }

    case ModelProvider.Github: {
      const { GITHUB_TOKEN } = llmConfig;

      const apiKey = apiKeyManager.pick(payload?.apiKey || dbConfig?.apiKey || GITHUB_TOKEN);

      return { apiKey };
    }

    case ModelProvider.OllamaCloud: {
      const { OLLAMA_CLOUD_API_KEY } = llmConfig;

      const apiKey = apiKeyManager.pick(payload?.apiKey || dbConfig?.apiKey || OLLAMA_CLOUD_API_KEY);

      return { apiKey };
    }

    case ModelProvider.TencentCloud: {
      const { TENCENT_CLOUD_API_KEY } = llmConfig;

      const apiKey = apiKeyManager.pick(payload?.apiKey || dbConfig?.apiKey || TENCENT_CLOUD_API_KEY);

      return { apiKey };
    }
  }
};

const buildVertexOptions = (
  payload: ClientSecretPayload,
  params: Partial<GoogleGenAIOptions> = {},
): GoogleGenAIOptions => {
  const rawCredentials = payload.apiKey || process.env.VERTEXAI_CREDENTIALS || '';
  const credentials = safeParseJSON<Record<string, string>>(rawCredentials);

  const projectFromParams = params.project as string | undefined;
  const projectFromCredentials = credentials?.project_id;
  const projectFromEnv = process.env.VERTEXAI_PROJECT;

  const project = projectFromParams || projectFromCredentials || projectFromEnv;
  const location =
    (params.location as string | undefined) || payload.vertexAIRegion || process.env.VERTEXAI_LOCATION || undefined;

  const googleAuthOptions = params.googleAuthOptions || (credentials ? { credentials } : undefined);

  const options: GoogleGenAIOptions = {
    ...params,
    vertexai: true,
  };

  if (googleAuthOptions) options.googleAuthOptions = googleAuthOptions;
  if (project) options.project = project;
  if (location) options.location = location as GoogleGenAIOptions['location'];

  return options;
};

/**
 * 初始化ProtoChat Runtime（套壳供应商）
 *
 * ProtoChat是一个"套壳"供应商，整合底层供应商（OpenRouter、DeepSeek等）
 * 需要查询数据库获取模型映射和底层供应商配置
 *
 * @param payload - 用户payload
 * @param params - 运行时参数，必须包含model字段
 * @returns ModelRuntime实例
 */
const initProtoChatRuntime = async (payload: ClientSecretPayload, params: any = {}) => {
  const modelId = params?.model;

  if (!modelId) {
    throw new Error('Model ID is required for ProtoChat provider');
  }

  // 1. 创建ProtoChat服务实例
  const protochatService = new ProtoChatService(serverDB);

  // 2. 查询模型映射（从数据库）
  const mapping = await protochatService.getModelMapping(modelId);

  // 3. 转换模型ID: 'openrouter::openai/gpt-4o' → 'openai/gpt-4o'
  const actualModelId = protochatService.convertModelId(mapping.originalId);

  // 4. 确定实际使用的供应商runtime
  // OpenRouter使用openrouter的runtime，DeepSeek使用deepseek的runtime
  const runtimeProvider = mapping.originalProvider;

  // 5. 构建运行时参数
  const runtimeParams = {
    apiKey: mapping.apiKey,
    baseURL: mapping.baseUrl,
  };

  // 6. 使用底层供应商初始化Runtime
  const runtime = await ModelRuntime.initializeWithProvider(runtimeProvider, runtimeParams);

  // 7. 返回runtime和转换后的模型ID（调用者需要在调用chat()时使用actualModel）
  return {
    actualModel: actualModelId,
    runtime,
  };
};

/**
 * Initializes the agent runtime with the user payload in backend
 * @param provider - The provider name.
 * @param payload - The JWT payload.
 * @param params
 * @returns 包含runtime的对象，对于ProtoChat还包含actualModel
 */
export const initModelRuntimeWithUserPayload = async (
  provider: string,
  payload: ClientSecretPayload,
  params: any = {},
): Promise<{ actualModel?: string, runtime: ModelRuntime; }> => {
  // 特殊处理ProtoChat供应商
  if (ProtoChatService.isProtoChatProvider(provider)) {
    return await initProtoChatRuntime(payload, params);
  }

  const runtimeProvider = payload.runtimeProvider ?? provider;

  let runtime: ModelRuntime;

  if (runtimeProvider === ModelProvider.VertexAI) {
    const vertexOptions = buildVertexOptions(payload, params);
    runtime = new ModelRuntime(LobeVertexAI.initFromVertexAI(vertexOptions));
  } else {
    runtime = await ModelRuntime.initializeWithProvider(runtimeProvider, {
      ...(await getParamsFromPayload(runtimeProvider, payload)),
      ...params,
    });
  }

  return { runtime };
};
