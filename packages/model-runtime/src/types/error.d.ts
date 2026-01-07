export declare const AgentRuntimeErrorType: {
    readonly AgentRuntimeError: "AgentRuntimeError";
    readonly LocationNotSupportError: "LocationNotSupportError";
    readonly QuotaLimitReached: "QuotaLimitReached";
    readonly InsufficientQuota: "InsufficientQuota";
    readonly ModelNotFound: "ModelNotFound";
    readonly PermissionDenied: "PermissionDenied";
    readonly ExceededContextWindow: "ExceededContextWindow";
    readonly InvalidProviderAPIKey: "InvalidProviderAPIKey";
    readonly ProviderBizError: "ProviderBizError";
    readonly InvalidOllamaArgs: "InvalidOllamaArgs";
    readonly OllamaBizError: "OllamaBizError";
    readonly OllamaServiceUnavailable: "OllamaServiceUnavailable";
    readonly InvalidBedrockCredentials: "InvalidBedrockCredentials";
    readonly InvalidVertexCredentials: "InvalidVertexCredentials";
    readonly StreamChunkError: "StreamChunkError";
    readonly InvalidGithubToken: "InvalidGithubToken";
    readonly ConnectionCheckFailed: "ConnectionCheckFailed";
    readonly ProviderNoImageGenerated: "ProviderNoImageGenerated";
    readonly InvalidComfyUIArgs: "InvalidComfyUIArgs";
    readonly ComfyUIBizError: "ComfyUIBizError";
    readonly ComfyUIServiceUnavailable: "ComfyUIServiceUnavailable";
    readonly ComfyUIEmptyResult: "ComfyUIEmptyResult";
    readonly ComfyUIUploadFailed: "ComfyUIUploadFailed";
    readonly ComfyUIWorkflowError: "ComfyUIWorkflowError";
    readonly ComfyUIModelError: "ComfyUIModelError";
    /**
     * @deprecated
     */
    readonly NoOpenAIAPIKey: "NoOpenAIAPIKey";
};
export declare const AGENT_RUNTIME_ERROR_SET: Set<string>;
export type ILobeAgentRuntimeErrorType = (typeof AgentRuntimeErrorType)[keyof typeof AgentRuntimeErrorType];
export declare const StandardErrorType: {
    readonly BadRequest: 400;
    readonly Unauthorized: 401;
    readonly Forbidden: 403;
    readonly ContentNotFound: 404;
    readonly MethodNotAllowed: 405;
    readonly TooManyRequests: 429;
    readonly InternalServerError: 500;
    readonly BadGateway: 502;
    readonly ServiceUnavailable: 503;
    readonly GatewayTimeout: 504;
};
export type ErrorType = (typeof StandardErrorType)[keyof typeof StandardErrorType];
/**
 * 聊天消息错误对象
 */
export interface ChatMessageError {
    body?: any;
    message: string;
    type: ErrorType | ILobeAgentRuntimeErrorType;
}
//# sourceMappingURL=error.d.ts.map