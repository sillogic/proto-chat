"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AgentRuntimeError = void 0;
exports.AgentRuntimeError = {
    chat: (error) => error,
    createError: (errorType, error) => ({ error, errorType }),
    createImage: (error) => error,
    textToImage: (error) => error,
};
//# sourceMappingURL=createError.js.map