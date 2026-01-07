"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parseToolCalls = void 0;
const types_1 = require("../types");
const immer_1 = require("immer");
const parseToolCalls = (origin, value) => (0, immer_1.produce)(origin, (draft) => {
    // if there is no origin, we should parse all the value and set it to draft
    if (draft.length === 0) {
        draft.push(...value.map((item) => types_1.MessageToolCallSchema.parse(item)));
        return;
    }
    // if there is origin, we should merge the value to the origin
    value.forEach(({ index, ...item }) => {
        if (!draft?.[index]) {
            // if not, we should insert it to the draft
            draft?.splice(index, 0, types_1.MessageToolCallSchema.parse(item));
        }
        else {
            // if it is already in the draft, we should merge the arguments to the draft
            if (item.function?.arguments) {
                draft[index].function.arguments += item.function.arguments;
            }
        }
    });
});
exports.parseToolCalls = parseToolCalls;
//# sourceMappingURL=parseToolCalls.js.map