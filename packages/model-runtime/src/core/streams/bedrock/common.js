"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createBedrockStream = void 0;
const protocol_1 = require("../protocol");
const chatStreamable = async function* (stream) {
    for await (const response of stream) {
        if (response.chunk) {
            const decoder = new TextDecoder();
            const value = decoder.decode(response.chunk.bytes, { stream: true });
            try {
                const chunk = JSON.parse(value);
                yield chunk;
            }
            catch (e) {
                console.log('bedrock stream parser error:', e);
                yield value;
            }
        }
        else {
            yield response;
        }
    }
};
/**
 * covert the bedrock response to a readable stream
 */
const createBedrockStream = (res) => (0, protocol_1.readableFromAsyncIterable)(chatStreamable(res.body));
exports.createBedrockStream = createBedrockStream;
//# sourceMappingURL=common.js.map