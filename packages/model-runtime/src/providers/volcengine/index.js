"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LobeVolcengineAI = void 0;
const model_bank_1 = require("model-bank");
const openaiCompatibleFactory_1 = require("../../core/openaiCompatibleFactory");
const createImage_1 = require("./createImage");
exports.LobeVolcengineAI = (0, openaiCompatibleFactory_1.createOpenAICompatibleRuntime)({
    baseURL: 'https://ark.cn-beijing.volces.com/api/v3',
    chatCompletion: {
        handlePayload: (payload) => {
            const { model, thinking, ...rest } = payload;
            return {
                ...rest,
                model,
                ...(thinking?.type && { thinking: { type: thinking.type } }),
            };
        },
    },
    createImage: createImage_1.createVolcengineImage,
    debug: {
        chatCompletion: () => process.env.DEBUG_VOLCENGINE_CHAT_COMPLETION === '1',
    },
    provider: model_bank_1.ModelProvider.Volcengine,
});
//# sourceMappingURL=index.js.map