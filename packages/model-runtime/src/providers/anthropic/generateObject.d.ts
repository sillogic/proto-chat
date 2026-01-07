import type Anthropic from '@anthropic-ai/sdk';
import { GenerateObjectOptions, GenerateObjectPayload } from '../../types';
/**
 * Generate structured output using Anthropic Claude API with Function Calling
 */
export declare const createAnthropicGenerateObject: (client: Anthropic, payload: GenerateObjectPayload, options?: GenerateObjectOptions) => Promise<unknown>;
//# sourceMappingURL=generateObject.d.ts.map