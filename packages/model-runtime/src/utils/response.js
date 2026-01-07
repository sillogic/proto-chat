"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StreamingResponse = void 0;
const StreamingResponse = (stream, options) => {
    return new Response(stream, {
        headers: {
            'Cache-Control': 'no-cache',
            'Content-Type': 'text/event-stream',
            // for Nginx: disable chunk buffering
            'X-Accel-Buffering': 'no',
            ...options?.headers,
        },
    });
};
exports.StreamingResponse = StreamingResponse;
//# sourceMappingURL=response.js.map