"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseDataUri = void 0;
const parseDataUri = (dataUri) => {
    // 正则表达式匹配整个 Data URI 结构
    const dataUriMatch = dataUri.match(/^data:([^;]+);base64,(.+)$/);
    if (dataUriMatch) {
        // 如果是合法的 Data URI
        return { base64: dataUriMatch[2], mimeType: dataUriMatch[1], type: 'base64' };
    }
    try {
        new URL(dataUri);
        // 如果是合法的 URL
        return { base64: null, mimeType: null, type: 'url' };
    }
    catch {
        // 既不是 Data URI 也不是合法 URL
        return { base64: null, mimeType: null, type: null };
    }
};
exports.parseDataUri = parseDataUri;
//# sourceMappingURL=uriParser.js.map