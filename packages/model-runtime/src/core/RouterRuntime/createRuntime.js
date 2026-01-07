"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createRouterRuntime = void 0;
const openai_1 = require("../../providers/openai");
const postProcessModelList_1 = require("../../utils/postProcessModelList");
const baseRuntimeMap_1 = require("./baseRuntimeMap");
const createRouterRuntime = ({ id, routers, apiKey: DEFAULT_API_KEY, models: modelsOption, ...params }) => {
    return class UniformRuntime {
        constructor(options = {}) {
            this._options = {
                ...options,
                apiKey: options.apiKey?.trim() || DEFAULT_API_KEY,
                baseURL: options.baseURL?.trim(),
            };
            // 保存配置但不创建 runtimes
            this._routers = routers;
            this._params = params;
            this._id = id;
        }
        /**
         * Resolve routers configuration and validate
         */
        async resolveRouters(model) {
            const resolvedRouters = typeof this._routers === 'function'
                ? await this._routers(this._options, { model })
                : this._routers;
            if (resolvedRouters.length === 0) {
                throw new Error('empty providers');
            }
            return resolvedRouters;
        }
        /**
         * Create runtime for inference requests (chat, generateObject, etc.)
         * Finds the router that matches the model, or uses the last router as fallback
         */
        async createRuntimeForInference(model) {
            const resolvedRouters = await this.resolveRouters(model);
            const matchedRouter = resolvedRouters.find((router) => {
                if (router.models && router.models.length > 0) {
                    return router.models.includes(model);
                }
                return false;
            }) ?? resolvedRouters.at(-1);
            const providerAI = matchedRouter.runtime ?? baseRuntimeMap_1.baseRuntimeMap[matchedRouter.apiType] ?? openai_1.LobeOpenAI;
            const finalOptions = { ...this._params, ...this._options, ...matchedRouter.options };
            const runtime = new providerAI({ ...finalOptions, id: this._id });
            return {
                id: matchedRouter.apiType,
                models: matchedRouter.models,
                runtime,
            };
        }
        /**
         * Create all runtimes for listing models
         */
        async createRuntimes() {
            const resolvedRouters = await this.resolveRouters();
            return resolvedRouters.map((router) => {
                const providerAI = router.runtime ?? baseRuntimeMap_1.baseRuntimeMap[router.apiType] ?? openai_1.LobeOpenAI;
                const finalOptions = { ...this._params, ...this._options, ...router.options };
                const runtime = new providerAI({ ...finalOptions, id: this._id });
                return {
                    id: router.apiType,
                    models: router.models,
                    runtime,
                };
            });
        }
        // Check if it can match a specific model, otherwise default to using the last runtime
        async getRuntimeByModel(model) {
            const runtimeItem = await this.createRuntimeForInference(model);
            return runtimeItem.runtime;
        }
        async chat(payload, options) {
            try {
                const runtime = await this.getRuntimeByModel(payload.model);
                return await runtime.chat(payload, options);
            }
            catch (e) {
                if (params.chatCompletion?.handleError) {
                    const error = params.chatCompletion.handleError(e, this._options);
                    if (error) {
                        throw error;
                    }
                }
                throw e;
            }
        }
        async generateObject(payload, options) {
            const runtime = await this.getRuntimeByModel(payload.model);
            return runtime.generateObject(payload, options);
        }
        async createImage(payload) {
            const runtime = await this.getRuntimeByModel(payload.model);
            return runtime.createImage(payload);
        }
        async textToImage(payload) {
            const runtime = await this.getRuntimeByModel(payload.model);
            return runtime.textToImage(payload);
        }
        async models() {
            if (modelsOption && typeof modelsOption === 'function') {
                const runtimes = await this.createRuntimes();
                // If it's a functional configuration, use the last runtime's client to call the function
                const lastRuntime = runtimes.at(-1)?.runtime;
                if (lastRuntime && 'client' in lastRuntime) {
                    const modelList = await modelsOption({ client: lastRuntime.client });
                    return await (0, postProcessModelList_1.postProcessModelList)(modelList);
                }
            }
            const runtimes = await this.createRuntimes();
            return runtimes.at(-1)?.runtime.models?.();
        }
        async embeddings(payload, options) {
            const runtime = await this.getRuntimeByModel(payload.model);
            return runtime.embeddings(payload, options);
        }
        async textToSpeech(payload, options) {
            const runtime = await this.getRuntimeByModel(payload.model);
            return runtime.textToSpeech(payload, options);
        }
    };
};
exports.createRouterRuntime = createRouterRuntime;
//# sourceMappingURL=createRuntime.js.map