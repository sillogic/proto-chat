"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.allModels = void 0;
const search1apiChatModels = [
    {
        abilities: {
            reasoning: true,
            search: true,
        },
        contextWindowTokens: 131072,
        description: 'DeepSeek R1 70B 标准版，支持实时联网搜索，适合需要最新信息的对话和文本处理任务。',
        displayName: 'DeepSeek R1 70B',
        enabled: true,
        id: 'deepseek-r1-70b-online',
        maxOutput: 16384,
        type: 'chat',
    },
    {
        abilities: {
            reasoning: true,
            search: true,
        },
        contextWindowTokens: 65536,
        description: 'DeepSeek R1 满血版，拥有 671B 参数，支持实时联网搜索，具有更强大的理解和生成能力。',
        displayName: 'DeepSeek R1',
        enabled: true,
        id: 'deepseek-r1-online',
        maxOutput: 8192,
        type: 'chat',
    },
    {
        abilities: {
            reasoning: true,
            search: true,
        },
        contextWindowTokens: 131072,
        description: 'DeepSeek R1 70B 快速版，支持实时联网搜索，在保持模型性能的同时提供更快的响应速度。',
        displayName: 'DeepSeek R1 70B Fast',
        enabled: true,
        id: 'deepseek-r1-70b-fast-online',
        maxOutput: 16384,
        type: 'chat',
    },
    {
        abilities: {
            reasoning: true,
            search: true,
        },
        contextWindowTokens: 163840,
        description: 'DeepSeek R1 满血快速版，支持实时联网搜索，结合了 671B 参数的强大能力和更快的响应速度。',
        displayName: 'DeepSeek R1 Fast',
        enabled: true,
        id: 'deepseek-r1-fast-online',
        maxOutput: 16384,
        type: 'chat',
    },
];
exports.allModels = [...search1apiChatModels];
exports.default = exports.allModels;
//# sourceMappingURL=search1api.js.map