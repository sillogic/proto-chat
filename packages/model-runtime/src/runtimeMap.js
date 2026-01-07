"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.providerRuntimeMap = void 0;
const ai21_1 = require("./providers/ai21");
const ai302_1 = require("./providers/ai302");
const ai360_1 = require("./providers/ai360");
const aihubmix_1 = require("./providers/aihubmix");
const akashchat_1 = require("./providers/akashchat");
const anthropic_1 = require("./providers/anthropic");
const azureOpenai_1 = require("./providers/azureOpenai");
const azureai_1 = require("./providers/azureai");
const baichuan_1 = require("./providers/baichuan");
const bedrock_1 = require("./providers/bedrock");
const bfl_1 = require("./providers/bfl");
const cerebras_1 = require("./providers/cerebras");
const cloudflare_1 = require("./providers/cloudflare");
const cohere_1 = require("./providers/cohere");
const cometapi_1 = require("./providers/cometapi");
const comfyui_1 = require("./providers/comfyui");
const deepseek_1 = require("./providers/deepseek");
const fal_1 = require("./providers/fal");
const fireworksai_1 = require("./providers/fireworksai");
const giteeai_1 = require("./providers/giteeai");
const github_1 = require("./providers/github");
const google_1 = require("./providers/google");
const groq_1 = require("./providers/groq");
const higress_1 = require("./providers/higress");
const huggingface_1 = require("./providers/huggingface");
const hunyuan_1 = require("./providers/hunyuan");
const infiniai_1 = require("./providers/infiniai");
const internlm_1 = require("./providers/internlm");
const jina_1 = require("./providers/jina");
const lmstudio_1 = require("./providers/lmstudio");
const minimax_1 = require("./providers/minimax");
const mistral_1 = require("./providers/mistral");
const modelscope_1 = require("./providers/modelscope");
const moonshot_1 = require("./providers/moonshot");
const nebius_1 = require("./providers/nebius");
const newapi_1 = require("./providers/newapi");
const novita_1 = require("./providers/novita");
const nvidia_1 = require("./providers/nvidia");
const ollama_1 = require("./providers/ollama");
const ollamacloud_1 = require("./providers/ollamacloud");
const openai_1 = require("./providers/openai");
const openrouter_1 = require("./providers/openrouter");
const perplexity_1 = require("./providers/perplexity");
const ppio_1 = require("./providers/ppio");
const qiniu_1 = require("./providers/qiniu");
const qwen_1 = require("./providers/qwen");
const replicate_1 = require("./providers/replicate");
const sambanova_1 = require("./providers/sambanova");
const search1api_1 = require("./providers/search1api");
const sensenova_1 = require("./providers/sensenova");
const siliconcloud_1 = require("./providers/siliconcloud");
const spark_1 = require("./providers/spark");
const stepfun_1 = require("./providers/stepfun");
const taichu_1 = require("./providers/taichu");
const tencentcloud_1 = require("./providers/tencentcloud");
const togetherai_1 = require("./providers/togetherai");
const upstage_1 = require("./providers/upstage");
const v0_1 = require("./providers/v0");
const vercelaigateway_1 = require("./providers/vercelaigateway");
const vllm_1 = require("./providers/vllm");
const volcengine_1 = require("./providers/volcengine");
const wenxin_1 = require("./providers/wenxin");
const xai_1 = require("./providers/xai");
const xinference_1 = require("./providers/xinference");
const zenmux_1 = require("./providers/zenmux");
const zeroone_1 = require("./providers/zeroone");
const zhipu_1 = require("./providers/zhipu");
exports.providerRuntimeMap = {
    ai21: ai21_1.LobeAi21AI,
    ai302: ai302_1.Lobe302AI,
    ai360: ai360_1.LobeAi360AI,
    aihubmix: aihubmix_1.LobeAiHubMixAI,
    akashchat: akashchat_1.LobeAkashChatAI,
    anthropic: anthropic_1.LobeAnthropicAI,
    azure: azureOpenai_1.LobeAzureOpenAI,
    azureai: azureai_1.LobeAzureAI,
    baichuan: baichuan_1.LobeBaichuanAI,
    bedrock: bedrock_1.LobeBedrockAI,
    bfl: bfl_1.LobeBflAI,
    cerebras: cerebras_1.LobeCerebrasAI,
    cloudflare: cloudflare_1.LobeCloudflareAI,
    cohere: cohere_1.LobeCohereAI,
    cometapi: cometapi_1.LobeCometAPIAI,
    comfyui: comfyui_1.LobeComfyUI,
    deepseek: deepseek_1.LobeDeepSeekAI,
    fal: fal_1.LobeFalAI,
    fireworksai: fireworksai_1.LobeFireworksAI,
    giteeai: giteeai_1.LobeGiteeAI,
    github: github_1.LobeGithubAI,
    google: google_1.LobeGoogleAI,
    groq: groq_1.LobeGroq,
    higress: higress_1.LobeHigressAI,
    huggingface: huggingface_1.LobeHuggingFaceAI,
    hunyuan: hunyuan_1.LobeHunyuanAI,
    infiniai: infiniai_1.LobeInfiniAI,
    internlm: internlm_1.LobeInternLMAI,
    jina: jina_1.LobeJinaAI,
    lmstudio: lmstudio_1.LobeLMStudioAI,
    minimax: minimax_1.LobeMinimaxAI,
    mistral: mistral_1.LobeMistralAI,
    modelscope: modelscope_1.LobeModelScopeAI,
    moonshot: moonshot_1.LobeMoonshotAI,
    nebius: nebius_1.LobeNebiusAI,
    newapi: newapi_1.LobeNewAPIAI,
    novita: novita_1.LobeNovitaAI,
    nvidia: nvidia_1.LobeNvidiaAI,
    ollama: ollama_1.LobeOllamaAI,
    ollamacloud: ollamacloud_1.LobeOllamaCloudAI,
    openai: openai_1.LobeOpenAI,
    openrouter: openrouter_1.LobeOpenRouterAI,
    perplexity: perplexity_1.LobePerplexityAI,
    ppio: ppio_1.LobePPIOAI,
    qiniu: qiniu_1.LobeQiniuAI,
    qwen: qwen_1.LobeQwenAI,
    replicate: replicate_1.LobeReplicateAI,
    router: newapi_1.LobeNewAPIAI,
    sambanova: sambanova_1.LobeSambaNovaAI,
    search1api: search1api_1.LobeSearch1API,
    sensenova: sensenova_1.LobeSenseNovaAI,
    siliconcloud: siliconcloud_1.LobeSiliconCloudAI,
    spark: spark_1.LobeSparkAI,
    stepfun: stepfun_1.LobeStepfunAI,
    taichu: taichu_1.LobeTaichuAI,
    tencentcloud: tencentcloud_1.LobeTencentCloudAI,
    togetherai: togetherai_1.LobeTogetherAI,
    upstage: upstage_1.LobeUpstageAI,
    v0: v0_1.LobeV0AI,
    vercelaigateway: vercelaigateway_1.LobeVercelAIGatewayAI,
    vllm: vllm_1.LobeVLLMAI,
    volcengine: volcengine_1.LobeVolcengineAI,
    wenxin: wenxin_1.LobeWenxinAI,
    xai: xai_1.LobeXAI,
    xinference: xinference_1.LobeXinferenceAI,
    zenmux: zenmux_1.LobeZenMuxAI,
    zeroone: zeroone_1.LobeZeroOneAI,
    zhipu: zhipu_1.LobeZhipuAI,
};
//# sourceMappingURL=runtimeMap.js.map