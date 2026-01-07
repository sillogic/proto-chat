import { CreateImageOptions } from '../../core/openaiCompatibleFactory';
import { CreateImagePayload, CreateImageResponse } from '../../types/image';
/**
 * Create image using Qwen API
 * Supports both text-to-image (async with polling) and image-to-image (sync) workflows
 */
export declare function createQwenImage(payload: CreateImagePayload, options: CreateImageOptions): Promise<CreateImageResponse>;
//# sourceMappingURL=createImage.d.ts.map