"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.nanoid = exports.createNanoId = void 0;
// generate('1234567890abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ', 16); //=> "4f90d13a42"
const non_secure_1 = require("nanoid/non-secure");
const createNanoId = (size = 8) => (0, non_secure_1.customAlphabet)('1234567890abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ', size);
exports.createNanoId = createNanoId;
exports.nanoid = (0, exports.createNanoId)();
//# sourceMappingURL=uuid.js.map