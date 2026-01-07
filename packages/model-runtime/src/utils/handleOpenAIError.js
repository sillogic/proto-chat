"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleOpenAIError = void 0;
const openai_1 = __importDefault(require("openai"));
const error_1 = require("../types/error");
const handleOpenAIError = (error) => {
    let errorResult;
    // Check if the error is an OpenAI APIError
    if (error instanceof openai_1.default.APIError) {
        // if error is definitely OpenAI APIError, there will be an error object
        if (error.error) {
            errorResult = error.error;
        }
        // Or if there is a cause, we use error cause
        // This often happened when there is a bug of the `openai` package.
        else if (error.cause) {
            errorResult = error.cause;
        }
        // if there is no other request error, the error object is a Response like object
        else {
            errorResult = { headers: error.headers, status: error.status };
        }
        return {
            errorResult,
        };
    }
    else {
        const err = error;
        errorResult = { cause: err.cause, message: err.message, name: err.name };
        return {
            RuntimeError: error_1.AgentRuntimeErrorType.AgentRuntimeError,
            errorResult,
        };
    }
};
exports.handleOpenAIError = handleOpenAIError;
//# sourceMappingURL=handleOpenAIError.js.map