"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.baseRuntimeMap = void 0;
const anthropic_1 = require("../../providers/anthropic");
const azureai_1 = require("../../providers/azureai");
const cloudflare_1 = require("../../providers/cloudflare");
const deepseek_1 = require("../../providers/deepseek");
const fal_1 = require("../../providers/fal");
const google_1 = require("../../providers/google");
const openai_1 = require("../../providers/openai");
const qwen_1 = require("../../providers/qwen");
const xai_1 = require("../../providers/xai");
exports.baseRuntimeMap = {
    anthropic: anthropic_1.LobeAnthropicAI,
    azure: azureai_1.LobeAzureAI,
    cloudflare: cloudflare_1.LobeCloudflareAI,
    deepseek: deepseek_1.LobeDeepSeekAI,
    fal: fal_1.LobeFalAI,
    google: google_1.LobeGoogleAI,
    openai: openai_1.LobeOpenAI,
    qwen: qwen_1.LobeQwenAI,
    xai: xai_1.LobeXAI,
};
//# sourceMappingURL=baseRuntimeMap.js.map