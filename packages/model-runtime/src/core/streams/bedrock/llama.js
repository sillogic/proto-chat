"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AWSBedrockLlamaStream = exports.transformLlamaStream = void 0;
const uuid_1 = require("../../../utils/uuid");
const protocol_1 = require("../protocol");
const common_1 = require("./common");
const transformLlamaStream = (chunk, stack) => {
    // maybe need another structure to add support for multiple choices
    if (chunk.stop_reason) {
        return { data: 'finished', id: stack.id, type: 'stop' };
    }
    return { data: chunk.generation, id: stack.id, type: 'text' };
};
exports.transformLlamaStream = transformLlamaStream;
const AWSBedrockLlamaStream = (res, cb) => {
    const streamStack = { id: 'chat_' + (0, uuid_1.nanoid)() };
    const stream = res instanceof ReadableStream ? res : (0, common_1.createBedrockStream)(res);
    return stream
        .pipeThrough((0, protocol_1.createSSEProtocolTransformer)(exports.transformLlamaStream, streamStack))
        .pipeThrough((0, protocol_1.createCallbacksTransformer)(cb));
};
exports.AWSBedrockLlamaStream = AWSBedrockLlamaStream;
//# sourceMappingURL=llama.js.map