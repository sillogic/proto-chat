"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LobeTaichuAI = void 0;
const model_bank_1 = require("model-bank");
const openaiCompatibleFactory_1 = require("../../core/openaiCompatibleFactory");
exports.LobeTaichuAI = (0, openaiCompatibleFactory_1.createOpenAICompatibleRuntime)({
    baseURL: 'https://ai-maas.wair.ac.cn/maas/v1',
    chatCompletion: {
        handlePayload: (payload) => {
            const { temperature, top_p, ...rest } = payload;
            return {
                ...rest,
                temperature: temperature !== undefined ? Math.max(temperature / 2, 0.01) : undefined,
                top_p: top_p !== undefined ? Math.min(9.9, Math.max(top_p / 2, 0.1)) : undefined,
            };
        },
    },
    debug: {
        chatCompletion: () => process.env.DEBUG_TAICHU_CHAT_COMPLETION === '1',
    },
    provider: model_bank_1.ModelProvider.Taichu,
});
//# sourceMappingURL=index.js.map