"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.allModels = void 0;
// https://api-docs.deepseek.com/zh-cn/quick_start/pricing
const deepseekChatModels = [
    {
        abilities: {
            functionCall: true,
            structuredOutput: true,
        },
        contextWindowTokens: 131072,
        description: 'DeepSeek V3.2 是 DeepSeek 最新发布的通用大模型，支持混合推理架构，具备更强的 Agent 能力。',
        displayName: 'DeepSeek V3.2 Exp',
        enabled: true,
        id: 'deepseek-chat',
        maxOutput: 8192,
        pricing: {
            currency: 'CNY',
            units: [
                { name: 'textInput_cacheRead', rate: 0.2, strategy: 'fixed', unit: 'millionTokens' },
                { name: 'textInput', rate: 2, strategy: 'fixed', unit: 'millionTokens' },
                { name: 'textOutput', rate: 3, strategy: 'fixed', unit: 'millionTokens' },
            ],
        },
        releasedAt: '2025-12-01',
        type: 'chat',
    },
    {
        abilities: {
            functionCall: true,
            reasoning: true,
        },
        contextWindowTokens: 131072,
        description: 'DeepSeek V3.2 思考模式。在输出最终回答之前，模型会先输出一段思维链内容，以提升最终答案的准确性。',
        displayName: 'DeepSeek V3.2 Exp Thinking',
        enabled: true,
        id: 'deepseek-reasoner',
        maxOutput: 65536,
        pricing: {
            currency: 'CNY',
            units: [
                { name: 'textInput_cacheRead', rate: 0.2, strategy: 'fixed', unit: 'millionTokens' },
                { name: 'textInput', rate: 2, strategy: 'fixed', unit: 'millionTokens' },
                { name: 'textOutput', rate: 3, strategy: 'fixed', unit: 'millionTokens' },
            ],
        },
        releasedAt: '2025-12-01',
        type: 'chat',
    },
];
exports.allModels = [...deepseekChatModels];
exports.default = exports.allModels;
//# sourceMappingURL=deepseek.js.map