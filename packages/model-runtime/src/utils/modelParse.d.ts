import type { ChatModelCard } from '@lobechat/types';
import type { ModelProviderKey } from '../types';
export interface ModelProcessorConfig {
    excludeKeywords?: readonly string[];
    functionCallKeywords?: readonly string[];
    imageOutputKeywords?: readonly string[];
    reasoningKeywords?: readonly string[];
    searchKeywords?: readonly string[];
    videoKeywords?: readonly string[];
    visionKeywords?: readonly string[];
}
export declare const MODEL_LIST_CONFIGS: {
    readonly anthropic: {
        readonly functionCallKeywords: readonly ["claude"];
        readonly reasoningKeywords: readonly ["-3-7", "3.7", "-4"];
        readonly visionKeywords: readonly ["claude"];
    };
    readonly comfyui: {
        readonly functionCallKeywords: readonly [];
        readonly reasoningKeywords: readonly [];
        readonly visionKeywords: readonly [];
    };
    readonly deepseek: {
        readonly functionCallKeywords: readonly ["v3", "r1", "deepseek-chat"];
        readonly reasoningKeywords: readonly ["r1", "deepseek-reasoner", "v3.1", "v3.2"];
        readonly visionKeywords: readonly ["ocr"];
    };
    readonly google: {
        readonly excludeKeywords: readonly ["tts"];
        readonly functionCallKeywords: readonly ["gemini", "!-image-"];
        readonly imageOutputKeywords: readonly ["-image-"];
        readonly reasoningKeywords: readonly ["thinking", "-2.5-", "!-image-"];
        readonly searchKeywords: readonly ["-search", "!-image-"];
        readonly videoKeywords: readonly ["-2.5-", "!-image-"];
        readonly visionKeywords: readonly ["gemini", "learnlm"];
    };
    readonly inclusionai: {
        readonly functionCallKeywords: readonly ["ling-"];
        readonly reasoningKeywords: readonly ["ring-"];
        readonly visionKeywords: readonly ["ming-"];
    };
    readonly llama: {
        readonly functionCallKeywords: readonly ["llama-3.2", "llama-3.3", "llama-4"];
        readonly reasoningKeywords: readonly [];
        readonly visionKeywords: readonly ["llava"];
    };
    readonly longcat: {
        readonly functionCallKeywords: readonly ["longcat"];
        readonly reasoningKeywords: readonly ["thinking"];
        readonly visionKeywords: readonly [];
    };
    readonly minimax: {
        readonly functionCallKeywords: readonly ["minimax"];
        readonly reasoningKeywords: readonly ["-m"];
        readonly visionKeywords: readonly ["-vl", "Text-01"];
    };
    readonly moonshot: {
        readonly functionCallKeywords: readonly ["moonshot", "kimi"];
        readonly reasoningKeywords: readonly ["thinking"];
        readonly visionKeywords: readonly ["vision", "kimi-latest", "kimi-thinking-preview"];
    };
    readonly openai: {
        readonly excludeKeywords: readonly ["audio"];
        readonly functionCallKeywords: readonly ["4o", "4.1", "o3", "o4", "oss"];
        readonly reasoningKeywords: readonly ["o1", "o3", "o4", "oss"];
        readonly visionKeywords: readonly ["4o", "4.1", "o4"];
    };
    readonly qwen: {
        readonly functionCallKeywords: readonly ["qwen-max", "qwen-plus", "qwen-turbo", "qwen-long", "qwen1.5", "qwen2", "qwen2.5", "qwen3"];
        readonly reasoningKeywords: readonly ["qvq", "qwq", "qwen3", "!-instruct-", "!-coder-", "!-max-"];
        readonly visionKeywords: readonly ["qvq", "-vl", "-omni"];
    };
    readonly replicate: {
        readonly imageOutputKeywords: readonly ["flux", "stable-diffusion", "sdxl", "ideogram", "canny", "depth", "fill", "redux"];
    };
    readonly v0: {
        readonly functionCallKeywords: readonly ["v0"];
        readonly reasoningKeywords: readonly ["v0-1.5"];
        readonly visionKeywords: readonly ["v0"];
    };
    readonly volcengine: {
        readonly functionCallKeywords: readonly ["1.5", "1-5", "1.6", "1-6"];
        readonly reasoningKeywords: readonly ["thinking", "seed", "ui-tars"];
        readonly visionKeywords: readonly ["vision", "-m", "seed", "ui-tars"];
    };
    readonly wenxin: {
        readonly functionCallKeywords: readonly ["ernie-5", "ernie-x1", "pro", "ernie-4.5-21b-a3b-thinking"];
        readonly reasoningKeywords: readonly ["thinking", "ernie-x", "ernie-4.5-vl-28b-a3b"];
        readonly visionKeywords: readonly ["-vl", "ernie-5.0", "picocr", "qianfan-composition"];
    };
    readonly xai: {
        readonly functionCallKeywords: readonly ["grok"];
        readonly reasoningKeywords: readonly ["mini", "grok-4", "grok-code-fast", "!non-reasoning"];
        readonly visionKeywords: readonly ["vision", "grok-4"];
    };
    readonly zeroone: {
        readonly functionCallKeywords: readonly ["fc"];
        readonly visionKeywords: readonly ["vision"];
    };
    readonly zhipu: {
        readonly functionCallKeywords: readonly ["glm-4", "glm-z1"];
        readonly reasoningKeywords: readonly ["glm-zero", "glm-z1", "glm-4.5"];
        readonly visionKeywords: readonly ["glm-4v", "glm-4.1v", "glm-4.5v"];
    };
};
export declare const MODEL_OWNER_DETECTION_CONFIG: {
    readonly anthropic: readonly ["claude"];
    readonly comfyui: readonly ["comfyui/"];
    readonly deepseek: readonly ["deepseek"];
    readonly google: readonly ["gemini", "imagen"];
    readonly inclusionai: readonly ["ling-", "ming-", "ring-"];
    readonly llama: readonly ["llama", "llava"];
    readonly longcat: readonly ["longcat"];
    readonly minimax: readonly ["minimax"];
    readonly moonshot: readonly ["moonshot", "kimi"];
    readonly openai: readonly ["o1", "o3", "o4", "gpt-"];
    readonly qwen: readonly ["qwen", "qwq", "qvq"];
    readonly replicate: readonly [];
    readonly v0: readonly ["v0"];
    readonly volcengine: readonly ["doubao"];
    readonly wenxin: readonly ["ernie", "qianfan"];
    readonly xai: readonly ["grok"];
    readonly zeroone: readonly ["yi-"];
    readonly zhipu: readonly ["glm"];
};
export declare const IMAGE_MODEL_KEYWORDS: readonly ["dall-e", "dalle", "midjourney", "stable-diffusion", "sd", "flux", "imagen", "firefly", "cogview", "wanxiang", "DESCRIBE", "UPSCALE", "!gemini", "-image", "^V3", "^V_2", "^V_1"];
export declare const EMBEDDING_MODEL_KEYWORDS: readonly ["embedding", "embed", "bge", "m3e"];
/**
 * 检测单个模型的提供商类型
 * @param modelId 模型ID
 * @returns 检测到的提供商配置键名，默认为 'openai'
 */
export declare const detectModelProvider: (modelId: string) => keyof typeof MODEL_LIST_CONFIGS;
/**
 * 处理单一提供商的模型列表
 * @param modelList 模型列表
 * @param config 提供商配置
 * @param provider 提供商类型（可选，用于优先匹配对应的本地配置, 当提供了 provider 时，才会尝试从本地配置覆盖 enabled）
 * @returns 处理后的模型卡片列表
 */
export declare const processModelList: (modelList: Array<{
    id: string;
}>, config: ModelProcessorConfig, provider?: keyof typeof MODEL_LIST_CONFIGS) => Promise<ChatModelCard[]>;
/**
 * 处理混合提供商的模型列表
 * @param modelList 模型列表
 * @param providerid 可选的提供商ID，用于获取其本地配置文件
 * @returns 处理后的模型卡片列表
 */
export declare const processMultiProviderModelList: (modelList: Array<{
    id: string;
}>, providerid?: ModelProviderKey) => Promise<ChatModelCard[]>;
//# sourceMappingURL=modelParse.d.ts.map