import { CreateImageOptions } from '../../core/openaiCompatibleFactory';
import { CreateImagePayload, CreateImageResponse } from '../../types/image';
/**
 * Volcengine image generation implementation
 * Based on Volcengine API docs: https://www.volcengine.com/docs/82379/1541523
 */
export declare function createVolcengineImage(payload: CreateImagePayload, options: CreateImageOptions): Promise<CreateImageResponse>;
//# sourceMappingURL=createImage.d.ts.map