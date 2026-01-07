import { AIBaseModelCard } from 'model-bank';
import OpenAI from 'openai';
import { ChatMethodOptions, ChatStreamPayload, CreateImagePayload, CreateImageResponse, Embeddings, EmbeddingsOptions, EmbeddingsPayload, GenerateObjectOptions, GenerateObjectPayload, ModelRequestOptions, PullModelParams, TextToImagePayload, TextToSpeechOptions, TextToSpeechPayload } from '../types';
export interface LobeRuntimeAI {
    baseURL?: string;
    chat?(payload: ChatStreamPayload, options?: ChatMethodOptions): Promise<Response>;
    generateObject?(payload: GenerateObjectPayload, options?: GenerateObjectOptions): Promise<any>;
    embeddings?(payload: EmbeddingsPayload, options?: EmbeddingsOptions): Promise<Embeddings[]>;
    models?(): Promise<any>;
    textToImage?: (payload: TextToImagePayload) => Promise<string[]>;
    createImage?: (payload: CreateImagePayload) => Promise<CreateImageResponse>;
    textToSpeech?: (payload: TextToSpeechPayload, options?: TextToSpeechOptions) => Promise<ArrayBuffer>;
    pullModel?(params: PullModelParams, options?: ModelRequestOptions): Promise<Response>;
}
export declare abstract class LobeOpenAICompatibleRuntime {
    abstract baseURL: string;
    abstract client: OpenAI;
    abstract chat(payload: ChatStreamPayload, options?: ChatMethodOptions): Promise<Response>;
    abstract createImage(payload: CreateImagePayload): Promise<CreateImageResponse>;
    abstract generateObject(payload: GenerateObjectPayload, options?: GenerateObjectOptions): Promise<Record<string, any>>;
    abstract models(): Promise<AIBaseModelCard[]>;
    abstract embeddings(payload: EmbeddingsPayload, options?: EmbeddingsOptions): Promise<Embeddings[]>;
}
//# sourceMappingURL=BaseAI.d.ts.map