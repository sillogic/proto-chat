import type { ChatModelCard } from '@lobechat/types';
import { LobeRuntimeAI } from '../../core/BaseAI';
import { ChatMethodOptions, ChatStreamPayload } from '../../types';
export interface CloudflareModelCard {
    description: string;
    name: string;
    properties?: Record<string, string>;
    task?: {
        description?: string;
        name: string;
    };
}
export interface LobeCloudflareParams {
    apiKey?: string;
    baseURLOrAccountID?: string;
}
export declare class LobeCloudflareAI implements LobeRuntimeAI {
    baseURL: string;
    accountID: string;
    apiKey?: string;
    constructor({ apiKey, baseURLOrAccountID }?: LobeCloudflareParams);
    chat(payload: ChatStreamPayload, options?: ChatMethodOptions): Promise<Response>;
    models(): Promise<ChatModelCard[]>;
}
//# sourceMappingURL=index.d.ts.map