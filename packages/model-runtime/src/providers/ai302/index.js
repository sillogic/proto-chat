"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Lobe302AI = exports.params = void 0;
const model_bank_1 = require("model-bank");
const openaiCompatibleFactory_1 = require("../../core/openaiCompatibleFactory");
const error_1 = require("../../types/error");
const modelParse_1 = require("../../utils/modelParse");
exports.params = {
    baseURL: 'https://api.302.ai/v1',
    chatCompletion: {
        handleError: (error) => {
            let errorResponse;
            if (error instanceof Response) {
                errorResponse = error;
            }
            else if ('status' in error) {
                errorResponse = error;
            }
            if (errorResponse && errorResponse.status === 401) {
                return {
                    error: errorResponse.status,
                    errorType: error_1.AgentRuntimeErrorType.InvalidProviderAPIKey,
                };
            }
            return {
                error,
            };
        },
    },
    debug: {
        chatCompletion: () => process.env.DEBUG_AI302_CHAT_COMPLETION === '1',
    },
    errorType: {
        bizError: error_1.AgentRuntimeErrorType.ProviderBizError,
        invalidAPIKey: error_1.AgentRuntimeErrorType.InvalidProviderAPIKey,
    },
    models: async ({ client }) => {
        const modelsPage = (await client.models.list());
        const modelList = modelsPage.data;
        return (0, modelParse_1.processMultiProviderModelList)(modelList, 'ai302');
    },
    provider: model_bank_1.ModelProvider.Ai302,
};
exports.Lobe302AI = (0, openaiCompatibleFactory_1.createOpenAICompatibleRuntime)(exports.params);
//# sourceMappingURL=index.js.map