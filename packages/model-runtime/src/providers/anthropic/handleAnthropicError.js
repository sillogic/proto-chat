"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleAnthropicError = void 0;
const handleAnthropicError = (error) => {
    let errorResult = error;
    if (error.error) {
        errorResult = error.error;
        if ('error' in errorResult) {
            errorResult = errorResult.error;
        }
    }
    else {
        errorResult = { headers: error.headers, stack: error.stack, status: error.status };
    }
    return { errorResult };
};
exports.handleAnthropicError = handleAnthropicError;
//# sourceMappingURL=handleAnthropicError.js.map