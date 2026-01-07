"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LobeSparkAI = exports.params = void 0;
const model_bank_1 = require("model-bank");
const openaiCompatibleFactory_1 = require("../../core/openaiCompatibleFactory");
const streams_1 = require("../../core/streams");
const getBaseURLByModel = (model) => {
    if (model.includes('x1-preview')) {
        return 'https://spark-api-open-preview.xf-yun.com/v2';
    }
    if (model.includes('spark-x')) {
        return 'https://spark-api-open.xf-yun.com/v2';
    }
    return 'https://spark-api-open.xf-yun.com/v1';
};
exports.params = {
    baseURL: 'https://spark-api-open.xf-yun.com/v1',
    chatCompletion: {
        handlePayload: (payload, options) => {
            const { enabledSearch, thinking, tools, ...rest } = payload;
            const baseURL = getBaseURLByModel(payload.model);
            if (options)
                options.baseURL = baseURL;
            const sparkTools = enabledSearch
                ? [
                    ...(tools || []),
                    {
                        type: 'web_search',
                        web_search: {
                            enable: true,
                            search_mode: process.env.SPARK_SEARCH_MODE || 'normal', // normal or deep
                            /*
                          show_ref_label: true,
                          */
                        },
                    },
                ]
                : tools;
            return {
                ...rest,
                thinking: { type: thinking?.type },
                tools: sparkTools,
            };
        },
        handleStream: streams_1.SparkAIStream,
        handleTransformResponseToStream: streams_1.transformSparkResponseToStream,
        noUserId: true,
    },
    debug: {
        chatCompletion: () => process.env.DEBUG_SPARK_CHAT_COMPLETION === '1',
    },
    provider: model_bank_1.ModelProvider.Spark,
};
exports.LobeSparkAI = (0, openaiCompatibleFactory_1.createOpenAICompatibleRuntime)(exports.params);
//# sourceMappingURL=index.js.map