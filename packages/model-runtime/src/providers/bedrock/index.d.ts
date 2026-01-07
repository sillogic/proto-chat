import { LobeRuntimeAI } from '../../core/BaseAI';
import { ChatMethodOptions, ChatStreamPayload, Embeddings, EmbeddingsOptions, EmbeddingsPayload } from '../../types';
/**
 * A prompt constructor for HuggingFace LLama 2 chat models.
 * Does not support `function` messages.
 * @see https://huggingface.co/meta-llama/Llama-2-70b-chat-hf and https://huggingface.co/blog/llama2#how-to-prompt-llama-2
 */
export declare function experimental_buildLlama2Prompt(messages: {
    content: string;
    role: string;
}[]): string;
export interface LobeBedrockAIParams {
    accessKeyId?: string;
    accessKeySecret?: string;
    id?: string;
    region?: string;
    sessionToken?: string;
}
export declare class LobeBedrockAI implements LobeRuntimeAI {
    private client;
    private id;
    region: string;
    constructor(options?: LobeBedrockAIParams);
    chat(payload: ChatStreamPayload, options?: ChatMethodOptions): Promise<Response>;
    /**
     * Supports the Amazon Titan Text models series.
     * Cohere Embed models are not supported
     * because the current text size per request
     * exceeds the maximum 2048 characters limit
     * for a single request for this series of models.
     * [bedrock embed guide] https://docs.aws.amazon.com/bedrock/latest/userguide/model-parameters-embed.html
     */
    embeddings(payload: EmbeddingsPayload, options?: EmbeddingsOptions): Promise<Embeddings[]>;
    private invokeEmbeddingModel;
    private invokeClaudeModel;
    private invokeLlamaModel;
}
export default LobeBedrockAI;
//# sourceMappingURL=index.d.ts.map