"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.qiniu = exports.ppio = exports.perplexity = exports.openrouter = exports.openaiChatModels = exports.openai = exports.gptImage1ParamsSchema = exports.ollamacloud = exports.ollama = exports.nvidia = exports.novita = exports.newapi = exports.nebius = exports.moonshot = exports.modelscope = exports.mistral = exports.minimax = exports.lobehub = exports.lmstudio = exports.jina = exports.internlm = exports.infiniai = exports.hunyuan = exports.huggingface = exports.higress = exports.groq = exports.google = exports.github = exports.giteeai = exports.fireworksai = exports.fluxSchnellParamsSchema = exports.fal = exports.deepseek = exports.comfyui = exports.cometapi = exports.cohere = exports.cloudflare = exports.cerebras = exports.bfl = exports.bedrock = exports.baichuan = exports.azureai = exports.azure = exports.anthropic = exports.akashchat = exports.aihubmix = exports.ai360 = exports.ai302 = exports.ai21 = exports.LOBE_DEFAULT_MODEL_LIST = void 0;
exports.zhipu = exports.zeroone = exports.zenmux = exports.xinference = exports.xai = exports.wenxin = exports.volcengine = exports.vllm = exports.vertexai = exports.vercelaigateway = exports.v0 = exports.upstage = exports.togetherai = exports.tencentcloud = exports.taichu = exports.stepfun = exports.spark = exports.siliconcloud = exports.sensenova = exports.search1api = exports.sambanova = exports.replicate = exports.qwen = void 0;
const ai21_1 = __importDefault(require("./ai21"));
const ai302_1 = __importDefault(require("./ai302"));
const ai360_1 = __importDefault(require("./ai360"));
const aihubmix_1 = __importDefault(require("./aihubmix"));
const akashchat_1 = __importDefault(require("./akashchat"));
const anthropic_1 = __importDefault(require("./anthropic"));
const azure_1 = __importDefault(require("./azure"));
const azureai_1 = __importDefault(require("./azureai"));
const baichuan_1 = __importDefault(require("./baichuan"));
const bedrock_1 = __importDefault(require("./bedrock"));
const bfl_1 = __importDefault(require("./bfl"));
const cerebras_1 = __importDefault(require("./cerebras"));
const cloudflare_1 = __importDefault(require("./cloudflare"));
const cohere_1 = __importDefault(require("./cohere"));
const cometapi_1 = __importDefault(require("./cometapi"));
const comfyui_1 = __importDefault(require("./comfyui"));
const deepseek_1 = __importDefault(require("./deepseek"));
const fal_1 = __importDefault(require("./fal"));
const fireworksai_1 = __importDefault(require("./fireworksai"));
const giteeai_1 = __importDefault(require("./giteeai"));
const github_1 = __importDefault(require("./github"));
const google_1 = __importDefault(require("./google"));
const groq_1 = __importDefault(require("./groq"));
const higress_1 = __importDefault(require("./higress"));
const huggingface_1 = __importDefault(require("./huggingface"));
const hunyuan_1 = __importDefault(require("./hunyuan"));
const infiniai_1 = __importDefault(require("./infiniai"));
const internlm_1 = __importDefault(require("./internlm"));
const jina_1 = __importDefault(require("./jina"));
const lmstudio_1 = __importDefault(require("./lmstudio"));
const minimax_1 = __importDefault(require("./minimax"));
const mistral_1 = __importDefault(require("./mistral"));
const modelscope_1 = __importDefault(require("./modelscope"));
const moonshot_1 = __importDefault(require("./moonshot"));
const nebius_1 = __importDefault(require("./nebius"));
const newapi_1 = __importDefault(require("./newapi"));
const novita_1 = __importDefault(require("./novita"));
const nvidia_1 = __importDefault(require("./nvidia"));
const ollama_1 = __importDefault(require("./ollama"));
const ollamacloud_1 = __importDefault(require("./ollamacloud"));
const openai_1 = __importDefault(require("./openai"));
const openrouter_1 = __importDefault(require("./openrouter"));
const perplexity_1 = __importDefault(require("./perplexity"));
const ppio_1 = __importDefault(require("./ppio"));
const qiniu_1 = __importDefault(require("./qiniu"));
const qwen_1 = __importDefault(require("./qwen"));
const replicate_1 = __importDefault(require("./replicate"));
const sambanova_1 = __importDefault(require("./sambanova"));
const search1api_1 = __importDefault(require("./search1api"));
const sensenova_1 = __importDefault(require("./sensenova"));
const siliconcloud_1 = __importDefault(require("./siliconcloud"));
const spark_1 = __importDefault(require("./spark"));
const stepfun_1 = __importDefault(require("./stepfun"));
const taichu_1 = __importDefault(require("./taichu"));
const tencentcloud_1 = __importDefault(require("./tencentcloud"));
const togetherai_1 = __importDefault(require("./togetherai"));
const upstage_1 = __importDefault(require("./upstage"));
const v0_1 = __importDefault(require("./v0"));
const vercelaigateway_1 = __importDefault(require("./vercelaigateway"));
const vertexai_1 = __importDefault(require("./vertexai"));
const vllm_1 = __importDefault(require("./vllm"));
const volcengine_1 = __importDefault(require("./volcengine"));
const wenxin_1 = __importDefault(require("./wenxin"));
const xai_1 = __importDefault(require("./xai"));
const xinference_1 = __importDefault(require("./xinference"));
const zenmux_1 = __importDefault(require("./zenmux"));
const zeroone_1 = __importDefault(require("./zeroone"));
const zhipu_1 = __importDefault(require("./zhipu"));
const buildDefaultModelList = (map) => {
    let models = [];
    Object.entries(map).forEach(([provider, providerModels]) => {
        const newModels = providerModels.map((model) => ({
            ...model,
            abilities: model.abilities ?? {},
            enabled: model.enabled || false,
            providerId: provider,
            source: 'builtin',
        }));
        models = models.concat(newModels);
    });
    return models;
};
exports.LOBE_DEFAULT_MODEL_LIST = buildDefaultModelList({
    ai21: ai21_1.default,
    ai302: ai302_1.default,
    ai360: ai360_1.default,
    aihubmix: aihubmix_1.default,
    akashchat: akashchat_1.default,
    anthropic: anthropic_1.default,
    azure: azure_1.default,
    azureai: azureai_1.default,
    baichuan: baichuan_1.default,
    bedrock: bedrock_1.default,
    bfl: bfl_1.default,
    cerebras: cerebras_1.default,
    cloudflare: cloudflare_1.default,
    cohere: cohere_1.default,
    cometapi: cometapi_1.default,
    comfyui: comfyui_1.default,
    deepseek: deepseek_1.default,
    fal: fal_1.default,
    fireworksai: fireworksai_1.default,
    giteeai: giteeai_1.default,
    github: github_1.default,
    google: google_1.default,
    groq: groq_1.default,
    higress: higress_1.default,
    huggingface: huggingface_1.default,
    hunyuan: hunyuan_1.default,
    infiniai: infiniai_1.default,
    internlm: internlm_1.default,
    jina: jina_1.default,
    lmstudio: lmstudio_1.default,
    minimax: minimax_1.default,
    mistral: mistral_1.default,
    modelscope: modelscope_1.default,
    moonshot: moonshot_1.default,
    nebius: nebius_1.default,
    newapi: newapi_1.default,
    novita: novita_1.default,
    nvidia: nvidia_1.default,
    ollama: ollama_1.default,
    ollamacloud: ollamacloud_1.default,
    openai: openai_1.default,
    openrouter: openrouter_1.default,
    perplexity: perplexity_1.default,
    ppio: ppio_1.default,
    qiniu: qiniu_1.default,
    qwen: qwen_1.default,
    replicate: replicate_1.default,
    sambanova: sambanova_1.default,
    search1api: search1api_1.default,
    sensenova: sensenova_1.default,
    siliconcloud: siliconcloud_1.default,
    spark: spark_1.default,
    stepfun: stepfun_1.default,
    taichu: taichu_1.default,
    tencentcloud: tencentcloud_1.default,
    togetherai: togetherai_1.default,
    upstage: upstage_1.default,
    v0: v0_1.default,
    vercelaigateway: vercelaigateway_1.default,
    vertexai: vertexai_1.default,
    vllm: vllm_1.default,
    volcengine: volcengine_1.default,
    wenxin: wenxin_1.default,
    xai: xai_1.default,
    xinference: xinference_1.default,
    zenmux: zenmux_1.default,
    zeroone: zeroone_1.default,
    zhipu: zhipu_1.default,
});
var ai21_2 = require("./ai21");
Object.defineProperty(exports, "ai21", { enumerable: true, get: function () { return __importDefault(ai21_2).default; } });
var ai302_2 = require("./ai302");
Object.defineProperty(exports, "ai302", { enumerable: true, get: function () { return __importDefault(ai302_2).default; } });
var ai360_2 = require("./ai360");
Object.defineProperty(exports, "ai360", { enumerable: true, get: function () { return __importDefault(ai360_2).default; } });
var aihubmix_2 = require("./aihubmix");
Object.defineProperty(exports, "aihubmix", { enumerable: true, get: function () { return __importDefault(aihubmix_2).default; } });
var akashchat_2 = require("./akashchat");
Object.defineProperty(exports, "akashchat", { enumerable: true, get: function () { return __importDefault(akashchat_2).default; } });
var anthropic_2 = require("./anthropic");
Object.defineProperty(exports, "anthropic", { enumerable: true, get: function () { return __importDefault(anthropic_2).default; } });
var azure_2 = require("./azure");
Object.defineProperty(exports, "azure", { enumerable: true, get: function () { return __importDefault(azure_2).default; } });
var azureai_2 = require("./azureai");
Object.defineProperty(exports, "azureai", { enumerable: true, get: function () { return __importDefault(azureai_2).default; } });
var baichuan_2 = require("./baichuan");
Object.defineProperty(exports, "baichuan", { enumerable: true, get: function () { return __importDefault(baichuan_2).default; } });
var bedrock_2 = require("./bedrock");
Object.defineProperty(exports, "bedrock", { enumerable: true, get: function () { return __importDefault(bedrock_2).default; } });
var bfl_2 = require("./bfl");
Object.defineProperty(exports, "bfl", { enumerable: true, get: function () { return __importDefault(bfl_2).default; } });
var cerebras_2 = require("./cerebras");
Object.defineProperty(exports, "cerebras", { enumerable: true, get: function () { return __importDefault(cerebras_2).default; } });
var cloudflare_2 = require("./cloudflare");
Object.defineProperty(exports, "cloudflare", { enumerable: true, get: function () { return __importDefault(cloudflare_2).default; } });
var cohere_2 = require("./cohere");
Object.defineProperty(exports, "cohere", { enumerable: true, get: function () { return __importDefault(cohere_2).default; } });
var cometapi_2 = require("./cometapi");
Object.defineProperty(exports, "cometapi", { enumerable: true, get: function () { return __importDefault(cometapi_2).default; } });
var comfyui_2 = require("./comfyui");
Object.defineProperty(exports, "comfyui", { enumerable: true, get: function () { return __importDefault(comfyui_2).default; } });
var deepseek_2 = require("./deepseek");
Object.defineProperty(exports, "deepseek", { enumerable: true, get: function () { return __importDefault(deepseek_2).default; } });
var fal_2 = require("./fal");
Object.defineProperty(exports, "fal", { enumerable: true, get: function () { return __importDefault(fal_2).default; } });
Object.defineProperty(exports, "fluxSchnellParamsSchema", { enumerable: true, get: function () { return fal_2.fluxSchnellParamsSchema; } });
var fireworksai_2 = require("./fireworksai");
Object.defineProperty(exports, "fireworksai", { enumerable: true, get: function () { return __importDefault(fireworksai_2).default; } });
var giteeai_2 = require("./giteeai");
Object.defineProperty(exports, "giteeai", { enumerable: true, get: function () { return __importDefault(giteeai_2).default; } });
var github_2 = require("./github");
Object.defineProperty(exports, "github", { enumerable: true, get: function () { return __importDefault(github_2).default; } });
var google_2 = require("./google");
Object.defineProperty(exports, "google", { enumerable: true, get: function () { return __importDefault(google_2).default; } });
var groq_2 = require("./groq");
Object.defineProperty(exports, "groq", { enumerable: true, get: function () { return __importDefault(groq_2).default; } });
var higress_2 = require("./higress");
Object.defineProperty(exports, "higress", { enumerable: true, get: function () { return __importDefault(higress_2).default; } });
var huggingface_2 = require("./huggingface");
Object.defineProperty(exports, "huggingface", { enumerable: true, get: function () { return __importDefault(huggingface_2).default; } });
var hunyuan_2 = require("./hunyuan");
Object.defineProperty(exports, "hunyuan", { enumerable: true, get: function () { return __importDefault(hunyuan_2).default; } });
var infiniai_2 = require("./infiniai");
Object.defineProperty(exports, "infiniai", { enumerable: true, get: function () { return __importDefault(infiniai_2).default; } });
var internlm_2 = require("./internlm");
Object.defineProperty(exports, "internlm", { enumerable: true, get: function () { return __importDefault(internlm_2).default; } });
var jina_2 = require("./jina");
Object.defineProperty(exports, "jina", { enumerable: true, get: function () { return __importDefault(jina_2).default; } });
var lmstudio_2 = require("./lmstudio");
Object.defineProperty(exports, "lmstudio", { enumerable: true, get: function () { return __importDefault(lmstudio_2).default; } });
var lobehub_1 = require("./lobehub");
Object.defineProperty(exports, "lobehub", { enumerable: true, get: function () { return __importDefault(lobehub_1).default; } });
var minimax_2 = require("./minimax");
Object.defineProperty(exports, "minimax", { enumerable: true, get: function () { return __importDefault(minimax_2).default; } });
var mistral_2 = require("./mistral");
Object.defineProperty(exports, "mistral", { enumerable: true, get: function () { return __importDefault(mistral_2).default; } });
var modelscope_2 = require("./modelscope");
Object.defineProperty(exports, "modelscope", { enumerable: true, get: function () { return __importDefault(modelscope_2).default; } });
var moonshot_2 = require("./moonshot");
Object.defineProperty(exports, "moonshot", { enumerable: true, get: function () { return __importDefault(moonshot_2).default; } });
var nebius_2 = require("./nebius");
Object.defineProperty(exports, "nebius", { enumerable: true, get: function () { return __importDefault(nebius_2).default; } });
var newapi_2 = require("./newapi");
Object.defineProperty(exports, "newapi", { enumerable: true, get: function () { return __importDefault(newapi_2).default; } });
var novita_2 = require("./novita");
Object.defineProperty(exports, "novita", { enumerable: true, get: function () { return __importDefault(novita_2).default; } });
var nvidia_2 = require("./nvidia");
Object.defineProperty(exports, "nvidia", { enumerable: true, get: function () { return __importDefault(nvidia_2).default; } });
var ollama_2 = require("./ollama");
Object.defineProperty(exports, "ollama", { enumerable: true, get: function () { return __importDefault(ollama_2).default; } });
var ollamacloud_2 = require("./ollamacloud");
Object.defineProperty(exports, "ollamacloud", { enumerable: true, get: function () { return __importDefault(ollamacloud_2).default; } });
var openai_2 = require("./openai");
Object.defineProperty(exports, "gptImage1ParamsSchema", { enumerable: true, get: function () { return openai_2.gptImage1ParamsSchema; } });
Object.defineProperty(exports, "openai", { enumerable: true, get: function () { return __importDefault(openai_2).default; } });
Object.defineProperty(exports, "openaiChatModels", { enumerable: true, get: function () { return openai_2.openaiChatModels; } });
var openrouter_2 = require("./openrouter");
Object.defineProperty(exports, "openrouter", { enumerable: true, get: function () { return __importDefault(openrouter_2).default; } });
var perplexity_2 = require("./perplexity");
Object.defineProperty(exports, "perplexity", { enumerable: true, get: function () { return __importDefault(perplexity_2).default; } });
var ppio_2 = require("./ppio");
Object.defineProperty(exports, "ppio", { enumerable: true, get: function () { return __importDefault(ppio_2).default; } });
var qiniu_2 = require("./qiniu");
Object.defineProperty(exports, "qiniu", { enumerable: true, get: function () { return __importDefault(qiniu_2).default; } });
var qwen_2 = require("./qwen");
Object.defineProperty(exports, "qwen", { enumerable: true, get: function () { return __importDefault(qwen_2).default; } });
var replicate_2 = require("./replicate");
Object.defineProperty(exports, "replicate", { enumerable: true, get: function () { return __importDefault(replicate_2).default; } });
var sambanova_2 = require("./sambanova");
Object.defineProperty(exports, "sambanova", { enumerable: true, get: function () { return __importDefault(sambanova_2).default; } });
var search1api_2 = require("./search1api");
Object.defineProperty(exports, "search1api", { enumerable: true, get: function () { return __importDefault(search1api_2).default; } });
var sensenova_2 = require("./sensenova");
Object.defineProperty(exports, "sensenova", { enumerable: true, get: function () { return __importDefault(sensenova_2).default; } });
var siliconcloud_2 = require("./siliconcloud");
Object.defineProperty(exports, "siliconcloud", { enumerable: true, get: function () { return __importDefault(siliconcloud_2).default; } });
var spark_2 = require("./spark");
Object.defineProperty(exports, "spark", { enumerable: true, get: function () { return __importDefault(spark_2).default; } });
var stepfun_2 = require("./stepfun");
Object.defineProperty(exports, "stepfun", { enumerable: true, get: function () { return __importDefault(stepfun_2).default; } });
var taichu_2 = require("./taichu");
Object.defineProperty(exports, "taichu", { enumerable: true, get: function () { return __importDefault(taichu_2).default; } });
var tencentcloud_2 = require("./tencentcloud");
Object.defineProperty(exports, "tencentcloud", { enumerable: true, get: function () { return __importDefault(tencentcloud_2).default; } });
var togetherai_2 = require("./togetherai");
Object.defineProperty(exports, "togetherai", { enumerable: true, get: function () { return __importDefault(togetherai_2).default; } });
var upstage_2 = require("./upstage");
Object.defineProperty(exports, "upstage", { enumerable: true, get: function () { return __importDefault(upstage_2).default; } });
var v0_2 = require("./v0");
Object.defineProperty(exports, "v0", { enumerable: true, get: function () { return __importDefault(v0_2).default; } });
var vercelaigateway_2 = require("./vercelaigateway");
Object.defineProperty(exports, "vercelaigateway", { enumerable: true, get: function () { return __importDefault(vercelaigateway_2).default; } });
var vertexai_2 = require("./vertexai");
Object.defineProperty(exports, "vertexai", { enumerable: true, get: function () { return __importDefault(vertexai_2).default; } });
var vllm_2 = require("./vllm");
Object.defineProperty(exports, "vllm", { enumerable: true, get: function () { return __importDefault(vllm_2).default; } });
var volcengine_2 = require("./volcengine");
Object.defineProperty(exports, "volcengine", { enumerable: true, get: function () { return __importDefault(volcengine_2).default; } });
var wenxin_2 = require("./wenxin");
Object.defineProperty(exports, "wenxin", { enumerable: true, get: function () { return __importDefault(wenxin_2).default; } });
var xai_2 = require("./xai");
Object.defineProperty(exports, "xai", { enumerable: true, get: function () { return __importDefault(xai_2).default; } });
var xinference_2 = require("./xinference");
Object.defineProperty(exports, "xinference", { enumerable: true, get: function () { return __importDefault(xinference_2).default; } });
var zenmux_2 = require("./zenmux");
Object.defineProperty(exports, "zenmux", { enumerable: true, get: function () { return __importDefault(zenmux_2).default; } });
var zeroone_2 = require("./zeroone");
Object.defineProperty(exports, "zeroone", { enumerable: true, get: function () { return __importDefault(zeroone_2).default; } });
var zhipu_2 = require("./zhipu");
Object.defineProperty(exports, "zhipu", { enumerable: true, get: function () { return __importDefault(zhipu_2).default; } });
//# sourceMappingURL=index.js.map