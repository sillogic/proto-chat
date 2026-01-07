"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StandardErrorType = exports.AGENT_RUNTIME_ERROR_SET = exports.AgentRuntimeErrorType = void 0;
/* eslint-disable sort-keys-fix/sort-keys-fix */
// ******* Runtime Biz Error ******* //
exports.AgentRuntimeErrorType = {
    AgentRuntimeError: 'AgentRuntimeError', // Agent Runtime 模块运行时错误
    LocationNotSupportError: 'LocationNotSupportError',
    QuotaLimitReached: 'QuotaLimitReached',
    InsufficientQuota: 'InsufficientQuota',
    ModelNotFound: 'ModelNotFound',
    PermissionDenied: 'PermissionDenied',
    ExceededContextWindow: 'ExceededContextWindow',
    InvalidProviderAPIKey: 'InvalidProviderAPIKey',
    ProviderBizError: 'ProviderBizError',
    InvalidOllamaArgs: 'InvalidOllamaArgs',
    OllamaBizError: 'OllamaBizError',
    OllamaServiceUnavailable: 'OllamaServiceUnavailable',
    InvalidBedrockCredentials: 'InvalidBedrockCredentials',
    InvalidVertexCredentials: 'InvalidVertexCredentials',
    StreamChunkError: 'StreamChunkError',
    InvalidGithubToken: 'InvalidGithubToken',
    ConnectionCheckFailed: 'ConnectionCheckFailed',
    // ******* Image Generation Error ******* //
    ProviderNoImageGenerated: 'ProviderNoImageGenerated',
    InvalidComfyUIArgs: 'InvalidComfyUIArgs',
    ComfyUIBizError: 'ComfyUIBizError',
    ComfyUIServiceUnavailable: 'ComfyUIServiceUnavailable',
    ComfyUIEmptyResult: 'ComfyUIEmptyResult',
    ComfyUIUploadFailed: 'ComfyUIUploadFailed',
    ComfyUIWorkflowError: 'ComfyUIWorkflowError',
    ComfyUIModelError: 'ComfyUIModelError',
    /**
     * @deprecated
     */
    NoOpenAIAPIKey: 'NoOpenAIAPIKey',
};
exports.AGENT_RUNTIME_ERROR_SET = new Set(Object.values(exports.AgentRuntimeErrorType));
/* eslint-disable sort-keys-fix/sort-keys-fix */
exports.StandardErrorType = {
    // ******* Client Error ******* //
    BadRequest: 400,
    Unauthorized: 401,
    Forbidden: 403,
    ContentNotFound: 404,
    MethodNotAllowed: 405,
    TooManyRequests: 429,
    // ******* Server Error ******* //
    InternalServerError: 500,
    BadGateway: 502,
    ServiceUnavailable: 503,
    GatewayTimeout: 504,
};
//# sourceMappingURL=error.js.map