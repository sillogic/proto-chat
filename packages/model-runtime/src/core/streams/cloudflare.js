"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_BASE_URL_PREFIX = exports.CloudflareStreamTransformer = void 0;
exports.desensitizeCloudflareUrl = desensitizeCloudflareUrl;
exports.fillUrl = fillUrl;
const desensitizeUrl_1 = require("../../utils/desensitizeUrl");
class CloudflareStreamTransformer {
    constructor() {
        this.textDecoder = new TextDecoder();
        this.buffer = '';
    }
    parseChunk(chunk, controller) {
        const dataPrefix = /^data: /;
        const json = chunk.replace(dataPrefix, '');
        const parsedChunk = JSON.parse(json);
        const res = parsedChunk?.response;
        if (!res)
            return; // TODO: Add test; Handle tool_call parameter.
        controller.enqueue(`event: text\n`);
        controller.enqueue(`data: ${JSON.stringify(parsedChunk.response)}\n\n`);
    }
    async transform(chunk, controller) {
        let textChunk = this.textDecoder.decode(chunk);
        if (this.buffer.trim() !== '') {
            textChunk = this.buffer + textChunk;
            this.buffer = '';
        }
        const splits = textChunk.split('\n\n');
        for (let i = 0; i < splits.length - 1; i++) {
            if (/\[DONE]/.test(splits[i].trim())) {
                return;
            }
            this.parseChunk(splits[i], controller);
        }
        const lastChunk = splits.at(-1);
        if (lastChunk.trim() !== '') {
            this.buffer += lastChunk; // does not need to be trimmed.
        } // else drop.
    }
}
exports.CloudflareStreamTransformer = CloudflareStreamTransformer;
const DEFAULT_BASE_URL_PREFIX = 'https://api.cloudflare.com';
exports.DEFAULT_BASE_URL_PREFIX = DEFAULT_BASE_URL_PREFIX;
function fillUrl(accountID) {
    return `${DEFAULT_BASE_URL_PREFIX}/client/v4/accounts/${accountID}/ai/run/`;
}
function desensitizeAccountId(path) {
    return path.replace(/\/[\dA-Fa-f]{32}\//, '/****/');
}
function desensitizeCloudflareUrl(url) {
    const urlObj = new URL(url);
    let { protocol, hostname, port, pathname, search } = urlObj;
    if (url.startsWith(DEFAULT_BASE_URL_PREFIX)) {
        return `${protocol}//${hostname}${port ? `:${port}` : ''}${desensitizeAccountId(pathname)}${search}`;
    }
    else {
        const desensitizedUrl = (0, desensitizeUrl_1.desensitizeUrl)(`${protocol}//${hostname}${port ? `:${port}` : ''}`);
        if (desensitizedUrl.endsWith('/') && pathname.startsWith('/')) {
            pathname = pathname.slice(1);
        }
        return `${desensitizedUrl}${desensitizeAccountId(pathname)}${search}`;
    }
}
//# sourceMappingURL=cloudflare.js.map