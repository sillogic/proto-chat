import { GoogleGenAI } from '@google/genai';
import { CreateImagePayload, CreateImageResponse } from '../../types/image';
/**
 * Create image using Google AI models
 */
export declare function createGoogleImage(client: GoogleGenAI, provider: string, payload: CreateImagePayload): Promise<CreateImageResponse>;
//# sourceMappingURL=createImage.d.ts.map