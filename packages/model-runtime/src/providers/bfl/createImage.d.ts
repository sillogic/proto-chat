import { CreateImagePayload, CreateImageResponse } from '../../types/image';
interface BflCreateImageOptions {
    apiKey: string;
    baseURL?: string;
    provider: string;
}
/**
 * Create image using BFL API with async task polling
 */
export declare function createBflImage(payload: CreateImagePayload, options: BflCreateImageOptions): Promise<CreateImageResponse>;
export {};
//# sourceMappingURL=createImage.d.ts.map