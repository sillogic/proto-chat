"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.allModels = void 0;
const cloudflareChatModels = [
    {
        abilities: {
            reasoning: true,
        },
        contextWindowTokens: 80000,
        displayName: 'deepseek r1 (distill qwen 32b)',
        enabled: true,
        id: '@cf/deepseek-ai/deepseek-r1-distill-qwen-32b',
        type: 'chat',
    },
    {
        abilities: {
            reasoning: true,
        },
        contextWindowTokens: 24000,
        displayName: 'qwq 32b',
        enabled: true,
        id: '@cf/qwen/qwq-32b',
        type: 'chat',
    },
    {
        contextWindowTokens: 32768,
        displayName: 'qwen2.5 coder 32b',
        id: '@cf/qwen/qwen2.5-coder-32b-instruct',
        type: 'chat',
    },
    {
        contextWindowTokens: 80000,
        displayName: 'gemma 3 12b',
        id: '@cf/google/gemma-3-12b-it',
        type: 'chat',
    },
    {
        abilities: {
            functionCall: true,
        },
        contextWindowTokens: 24000,
        displayName: 'llama 3.3 70b',
        id: '@cf/meta/llama-3.3-70b-instruct-fp8-fast',
        type: 'chat',
    },
    {
        abilities: {
            functionCall: true,
        },
        contextWindowTokens: 131000,
        displayName: 'llama 4 17b',
        id: '@cf/meta/llama-4-scout-17b-16e-instruct',
        type: 'chat',
    },
    {
        abilities: {
            functionCall: true,
        },
        contextWindowTokens: 128000,
        displayName: 'mistral small 3.1 24b',
        id: '@cf/mistralai/mistral-small-3.1-24b-instruct',
        type: 'chat',
    },
    {
        contextWindowTokens: 8192,
        displayName: 'openchat-3.5-0106',
        id: '@cf/openchat/openchat-3.5-0106',
        type: 'chat',
    },
    {
        contextWindowTokens: 7500,
        displayName: 'qwen1.5-14b-chat-awq',
        enabled: true,
        id: '@cf/qwen/qwen1.5-14b-chat-awq',
        type: 'chat',
    },
    {
        contextWindowTokens: 128000,
        displayName: 'llama 3.1 8b',
        id: '@cf/meta/llama-3.1-8b-instruct-fast',
        type: 'chat',
    },
];
exports.allModels = [...cloudflareChatModels];
exports.default = exports.allModels;
//# sourceMappingURL=cloudflare.js.map