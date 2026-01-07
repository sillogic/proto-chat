"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LobeQiniuAI = exports.params = void 0;
const model_bank_1 = require("model-bank");
const openaiCompatibleFactory_1 = require("../../core/openaiCompatibleFactory");
const modelParse_1 = require("../../utils/modelParse");
exports.params = {
    apiKey: 'placeholder-to-avoid-error',
    baseURL: 'https://openai.qiniu.com/v1',
    debug: {
        chatCompletion: () => process.env.DEBUG_QINIU_CHAT_COMPLETION === '1',
    },
    models: async ({ client }) => {
        const modelsPage = (await client.models.list());
        const modelList = modelsPage.data.map((model) => {
            // eslint-disable-next-line unused-imports/no-unused-vars, @typescript-eslint/no-unused-vars
            const { created, ...rest } = model;
            return rest;
        });
        // 自动检测模型提供商并选择相应配置
        return (0, modelParse_1.processMultiProviderModelList)(modelList, 'qiniu');
    },
    provider: model_bank_1.ModelProvider.Qiniu,
};
exports.LobeQiniuAI = (0, openaiCompatibleFactory_1.createOpenAICompatibleRuntime)(exports.params);
//# sourceMappingURL=index.js.map