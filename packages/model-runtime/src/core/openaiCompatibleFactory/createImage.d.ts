import OpenAI from 'openai';
import { CreateImagePayload, CreateImageResponse } from '../../types/image';
/**
 * Create image using OpenAI Compatible API
 */
export declare function createOpenAICompatibleImage(client: OpenAI, payload: CreateImagePayload, provider: string): Promise<CreateImageResponse>;
//# sourceMappingURL=createImage.d.ts.map