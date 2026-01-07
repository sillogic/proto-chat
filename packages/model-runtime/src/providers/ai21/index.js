"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LobeAi21AI = void 0;
const model_bank_1 = require("model-bank");
const openaiCompatibleFactory_1 = require("../../core/openaiCompatibleFactory");
exports.LobeAi21AI = (0, openaiCompatibleFactory_1.createOpenAICompatibleRuntime)({
    baseURL: 'https://api.ai21.com/studio/v1',
    chatCompletion: {
        handlePayload: (payload) => {
            return {
                ...payload,
                stream: !payload.tools,
            };
        },
    },
    debug: {
        chatCompletion: () => process.env.DEBUG_AI21_CHAT_COMPLETION === '1',
    },
    provider: model_bank_1.ModelProvider.Ai21,
});
//# sourceMappingURL=index.js.map