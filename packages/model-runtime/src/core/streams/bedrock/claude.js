"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AWSBedrockClaudeStream = void 0;
const uuid_1 = require("../../../utils/uuid");
const anthropic_1 = require("../anthropic");
const protocol_1 = require("../protocol");
const common_1 = require("./common");
const AWSBedrockClaudeStream = (res, options) => {
    const streamStack = { id: 'chat_' + (0, uuid_1.nanoid)() };
    const stream = res instanceof ReadableStream ? res : (0, common_1.createBedrockStream)(res);
    const transformWithPayload = (chunk, ctx) => (0, anthropic_1.transformAnthropicStream)(chunk, ctx, options?.payload);
    return stream
        .pipeThrough((0, protocol_1.createTokenSpeedCalculator)(transformWithPayload, {
        inputStartAt: options?.inputStartAt,
        streamStack,
    }))
        .pipeThrough((0, protocol_1.createSSEProtocolTransformer)((c) => c, streamStack))
        .pipeThrough((0, protocol_1.createCallbacksTransformer)(options?.callbacks));
};
exports.AWSBedrockClaudeStream = AWSBedrockClaudeStream;
//# sourceMappingURL=claude.js.map