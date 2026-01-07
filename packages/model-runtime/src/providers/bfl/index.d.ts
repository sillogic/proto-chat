import { ClientOptions } from 'openai';
import { LobeRuntimeAI } from '../../core/BaseAI';
import { CreateImagePayload, CreateImageResponse } from '../../types/image';
export declare class LobeBflAI implements LobeRuntimeAI {
    private apiKey;
    baseURL?: string;
    constructor({ apiKey, baseURL }?: ClientOptions);
    createImage(payload: CreateImagePayload): Promise<CreateImageResponse>;
}
//# sourceMappingURL=index.d.ts.map