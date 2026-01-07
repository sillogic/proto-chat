import type { ComfyUIKeyVault } from '@lobechat/types';
import { LobeRuntimeAI } from '../../core/BaseAI';
import { AuthenticatedImageRuntime, CreateImagePayload, CreateImageResponse } from '../../types';
/**
 * ComfyUI Runtime implementation
 * Supports text-to-image and image editing
 */
export declare class LobeComfyUI implements LobeRuntimeAI, AuthenticatedImageRuntime {
    private options;
    baseURL: string;
    constructor(options?: ComfyUIKeyVault);
    /**
     * Get authentication headers for image download
     * Used by framework for authenticated image downloads
     */
    getAuthHeaders(): Record<string, string> | undefined;
    /**
     * Create image using internal API endpoint
     * Always uses full URL for consistency across environments
     */
    createImage(payload: CreateImagePayload): Promise<CreateImageResponse>;
}
//# sourceMappingURL=index.d.ts.map