"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MessageToolCallSchema = void 0;
const zod_1 = require("zod");
exports.MessageToolCallSchema = zod_1.z.object({
    function: zod_1.z.object({
        arguments: zod_1.z.string(),
        name: zod_1.z.string(),
    }),
    id: zod_1.z.string(),
    thoughtSignature: zod_1.z.string().optional(),
    type: zod_1.z.string(),
});
//# sourceMappingURL=toolsCalling.js.map