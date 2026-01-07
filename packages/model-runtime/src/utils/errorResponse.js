"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createErrorResponse = void 0;
const types_1 = require("@lobechat/types");
const types_2 = require("../types");
const getStatus = (errorType) => {
    // InvalidAccessCode / InvalidAzureAPIKey / InvalidOpenAIAPIKey / InvalidZhipuAPIKey ....
    if (errorType.toString().includes('Invalid'))
        return 401;
    switch (errorType) {
        case types_2.AgentRuntimeErrorType.InvalidProviderAPIKey: {
            return 401;
        }
        case types_2.AgentRuntimeErrorType.ExceededContextWindow: {
            return 400;
        }
        case types_2.AgentRuntimeErrorType.LocationNotSupportError: {
            return 403;
        }
        case types_2.AgentRuntimeErrorType.ModelNotFound: {
            return 404;
        }
        case types_2.AgentRuntimeErrorType.InsufficientQuota:
        case types_2.AgentRuntimeErrorType.QuotaLimitReached: {
            return 429;
        }
        // define the 471~480 as provider error
        case types_2.AgentRuntimeErrorType.AgentRuntimeError: {
            return 470;
        }
        case types_2.AgentRuntimeErrorType.ProviderBizError: {
            return 471;
        }
        // all local provider connection error
        case types_2.AgentRuntimeErrorType.OllamaServiceUnavailable:
        case types_1.ChatErrorType.OllamaServiceUnavailable:
        case types_2.AgentRuntimeErrorType.OllamaBizError: {
            return 472;
        }
    }
    return errorType;
};
const createErrorResponse = (errorType, body) => {
    const statusCode = getStatus(errorType);
    const data = { body, errorType };
    if (typeof statusCode !== 'number' || statusCode < 200 || statusCode > 599) {
        console.error(`current StatusCode: \`${statusCode}\` .`, 'Please go to `./utils/errorResponse.ts` to defined the statusCode.');
    }
    return new Response(JSON.stringify(data), { status: statusCode });
};
exports.createErrorResponse = createErrorResponse;
//# sourceMappingURL=errorResponse.js.map