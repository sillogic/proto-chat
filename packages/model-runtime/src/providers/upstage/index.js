"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LobeUpstageAI = void 0;
const model_bank_1 = require("model-bank");
const openaiCompatibleFactory_1 = require("../../core/openaiCompatibleFactory");
exports.LobeUpstageAI = (0, openaiCompatibleFactory_1.createOpenAICompatibleRuntime)({
    baseURL: 'https://api.upstage.ai/v1/solar',
    debug: {
        chatCompletion: () => process.env.DEBUG_UPSTAGE_CHAT_COMPLETION === '1',
    },
    provider: model_bank_1.ModelProvider.Upstage,
});
//# sourceMappingURL=index.js.map