import { ClientOptions } from 'openai';
import { LobeRuntimeAI } from '../../core/BaseAI';
import { CreateImagePayload, CreateImageResponse } from '../../types/image';
export declare class LobeFalAI implements LobeRuntimeAI {
    constructor({ apiKey }?: ClientOptions);
    createImage(payload: CreateImagePayload): Promise<CreateImageResponse>;
}
//# sourceMappingURL=index.d.ts.map