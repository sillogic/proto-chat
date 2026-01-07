"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LobeSambaNovaAI = void 0;
const model_bank_1 = require("model-bank");
const openaiCompatibleFactory_1 = require("../../core/openaiCompatibleFactory");
exports.LobeSambaNovaAI = (0, openaiCompatibleFactory_1.createOpenAICompatibleRuntime)({
    baseURL: 'https://api.sambanova.ai/v1',
    debug: {
        chatCompletion: () => process.env.DEBUG_SAMBANOVA_CHAT_COMPLETION === '1',
    },
    provider: model_bank_1.ModelProvider.SambaNova,
});
//# sourceMappingURL=index.js.map