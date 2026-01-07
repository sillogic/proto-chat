import { AgentInitErrorPayload, ChatCompletionErrorPayload, CreateImageErrorPayload } from '../types';
import { ILobeAgentRuntimeErrorType } from '../types/error';
export declare const AgentRuntimeError: {
    chat: (error: ChatCompletionErrorPayload) => ChatCompletionErrorPayload;
    createError: (errorType: ILobeAgentRuntimeErrorType | string | number, error?: any) => AgentInitErrorPayload;
    createImage: (error: CreateImageErrorPayload) => CreateImageErrorPayload;
    textToImage: (error: any) => any;
};
//# sourceMappingURL=createError.d.ts.map