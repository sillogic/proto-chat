"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.safeParseJSON = void 0;
const safeParseJSON = (text) => {
    if (typeof text !== 'string')
        return undefined;
    let json;
    try {
        json = JSON.parse(text);
    }
    catch {
        return undefined;
    }
    return json;
};
exports.safeParseJSON = safeParseJSON;
//# sourceMappingURL=safeParseJSON.js.map