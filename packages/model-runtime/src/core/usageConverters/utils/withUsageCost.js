"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.withUsageCost = void 0;
const computeChatCost_1 = require("./computeChatCost");
const withUsageCost = (usage, pricing, options) => {
    if (!pricing)
        return usage;
    const pricingResult = (0, computeChatCost_1.computeChatCost)(pricing, usage, options);
    if (!pricingResult)
        return usage;
    return { ...usage, cost: pricingResult.totalCost };
};
exports.withUsageCost = withUsageCost;
//# sourceMappingURL=withUsageCost.js.map