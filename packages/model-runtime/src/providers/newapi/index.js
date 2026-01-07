"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LobeNewAPIAI = exports.params = void 0;
const model_bank_1 = require("model-bank");
const url_join_1 = __importDefault(require("url-join"));
const models_1 = require("../../const/models");
const RouterRuntime_1 = require("../../core/RouterRuntime");
const modelParse_1 = require("../../utils/modelParse");
/**
 * Detect if running in browser environment
 */
const isBrowser = () => typeof window !== 'undefined' && typeof document !== 'undefined';
/**
 * Parse a pricing API HTTP response into a `NewAPIPricing[] | null`.
 * Shared between browser and server branches to avoid duplicated logic.
 */
const parsePricingResponse = async (res) => {
    if (!res.ok) {
        return null;
    }
    try {
        const body = await res.json();
        return body?.success && body?.data ? body.data : null;
    }
    catch {
        return null;
    }
};
/**
 * Fetch pricing information with CORS bypass for client-side requests
 * In browser environment, use /webapi/proxy to avoid CORS errors
 */
const fetchPricing = async (pricingUrl, apiKey) => {
    try {
        if (isBrowser()) {
            // In browser environment, use the proxy endpoint to avoid CORS
            // The proxy endpoint expects the URL as the request body
            const proxyResponse = await fetch('/webapi/proxy', {
                body: pricingUrl,
                method: 'POST',
            });
            return await parsePricingResponse(proxyResponse);
        }
        else {
            // In server environment, fetch directly
            const pricingResponse = await fetch(pricingUrl, {
                headers: {
                    Authorization: `Bearer ${apiKey}`,
                },
            });
            return await parsePricingResponse(pricingResponse);
        }
    }
    catch (error) {
        console.debug('Failed to fetch NewAPI pricing info:', error);
        return null;
    }
};
exports.params = {
    debug: {
        chatCompletion: () => process.env.DEBUG_NEWAPI_CHAT_COMPLETION === '1',
    },
    defaultHeaders: {
        'X-Client': 'LobeHub',
    },
    id: model_bank_1.ModelProvider.NewAPI,
    models: async ({ client: openAIClient }) => {
        // Get base URL (remove trailing API version paths like /v1, /v1beta, etc.)
        const baseURL = openAIClient.baseURL.replace(/\/v\d+[a-z]*\/?$/, '');
        const modelsPage = (await openAIClient.models.list());
        const modelList = modelsPage.data || [];
        // Try to get pricing information to enrich model details
        let pricingMap = new Map();
        const pricingList = await fetchPricing(`${baseURL}/api/pricing`, openAIClient.apiKey || '');
        if (pricingList) {
            pricingList.forEach((pricing) => {
                pricingMap.set(pricing.model_name, pricing);
            });
        }
        // Process the model list: determine the provider for each model based on priority rules
        const enrichedModelList = modelList.map((model) => {
            let enhancedModel = { ...model };
            // add pricing info
            const pricing = pricingMap.get(model.id);
            if (pricing) {
                // NewAPI pricing calculation logic:
                // - quota_type: 0 means pay-per-token, 1 means pay-per-call
                // - model_ratio: multiplier relative to base price (base price = $0.002/1K tokens)
                // - model_price: directly specified price (takes priority)
                // - completion_ratio: output price multiplier relative to input price
                //
                // LobeChat required format: USD per million tokens
                let inputPrice;
                let outputPrice;
                if (pricing.quota_type === 0) {
                    // Pay-per-token
                    if (pricing.model_price && pricing.model_price > 0) {
                        // model_price is a direct price value; need to confirm its unit.
                        // Assumption: model_price is the price per 1,000 tokens (i.e., $/1K tokens).
                        // To convert to price per 1,000,000 tokens ($/1M tokens), multiply by 1,000,000 / 1,000 = 1,000.
                        // Since the base price is $0.002/1K tokens, multiplying by 2 gives $2/1M tokens.
                        // Therefore, inputPrice = model_price * 2 converts the price to $/1M tokens for LobeChat.
                        inputPrice = pricing.model_price * 2;
                    }
                    else if (pricing.model_ratio) {
                        // model_ratio × $0.002/1K = model_ratio × $2/1M
                        inputPrice = pricing.model_ratio * 2; // Convert to $/1M tokens
                    }
                    if (inputPrice !== undefined) {
                        // Calculate output price
                        outputPrice = inputPrice * (pricing.completion_ratio || 1);
                        enhancedModel.pricing = {
                            units: [
                                {
                                    name: 'textInput',
                                    rate: inputPrice,
                                    strategy: 'fixed',
                                    unit: 'millionTokens',
                                },
                                {
                                    name: 'textOutput',
                                    rate: outputPrice,
                                    strategy: 'fixed',
                                    unit: 'millionTokens',
                                },
                            ],
                        };
                    }
                }
                // quota_type === 1 pay-per-call is not currently supported
            }
            return enhancedModel;
        });
        return (0, modelParse_1.processMultiProviderModelList)(enrichedModelList, 'newapi');
    },
    routers: (options) => {
        const userBaseURL = options.baseURL?.replace(/\/v\d+[a-z]*\/?$/, '') || '';
        return [
            {
                apiType: 'anthropic',
                models: model_bank_1.LOBE_DEFAULT_MODEL_LIST.map((m) => m.id).filter((id) => (0, modelParse_1.detectModelProvider)(id) === 'anthropic'),
                options: {
                    ...options,
                    baseURL: userBaseURL,
                },
            },
            {
                apiType: 'google',
                models: model_bank_1.LOBE_DEFAULT_MODEL_LIST.map((m) => m.id).filter((id) => (0, modelParse_1.detectModelProvider)(id) === 'google'),
                options: {
                    ...options,
                    baseURL: userBaseURL,
                },
            },
            {
                apiType: 'xai',
                models: model_bank_1.LOBE_DEFAULT_MODEL_LIST.map((m) => m.id).filter((id) => (0, modelParse_1.detectModelProvider)(id) === 'xai'),
                options: {
                    ...options,
                    baseURL: (0, url_join_1.default)(userBaseURL, '/v1'),
                },
            },
            {
                apiType: 'openai',
                options: {
                    ...options,
                    baseURL: (0, url_join_1.default)(userBaseURL, '/v1'),
                    chatCompletion: {
                        useResponseModels: [...Array.from(models_1.responsesAPIModels), /gpt-\d(?!\d)/, /^o\d/],
                    },
                },
            },
        ];
    },
};
exports.LobeNewAPIAI = (0, RouterRuntime_1.createRouterRuntime)(exports.params);
//# sourceMappingURL=index.js.map