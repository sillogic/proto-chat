import { ModelParamsSchema } from '../standard-parameters';
import { AIChatModelCard, AIEmbeddingModelCard, AIImageModelCard, AIRealtimeModelCard, AISTTModelCard, AITTSModelCard } from '../types/aiModel';
export declare const gptImage1ParamsSchema: ModelParamsSchema;
export declare const openaiChatModels: AIChatModelCard[];
export declare const openaiEmbeddingModels: AIEmbeddingModelCard[];
export declare const openaiTTSModels: AITTSModelCard[];
export declare const openaiSTTModels: AISTTModelCard[];
export declare const openaiImageModels: AIImageModelCard[];
export declare const openaiRealtimeModels: AIRealtimeModelCard[];
export declare const allModels: (AIChatModelCard | AIEmbeddingModelCard | AIImageModelCard | AITTSModelCard | AISTTModelCard | AIRealtimeModelCard)[];
export default allModels;
//# sourceMappingURL=openai.d.ts.map