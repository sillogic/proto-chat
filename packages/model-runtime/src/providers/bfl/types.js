"use strict";
// BFL API Types
Object.defineProperty(exports, "__esModule", { value: true });
exports.BFL_ENDPOINTS = exports.BflStatusResponse = void 0;
var BflStatusResponse;
(function (BflStatusResponse) {
    BflStatusResponse["ContentModerated"] = "Content Moderated";
    BflStatusResponse["Error"] = "Error";
    BflStatusResponse["Pending"] = "Pending";
    BflStatusResponse["Ready"] = "Ready";
    BflStatusResponse["RequestModerated"] = "Request Moderated";
    BflStatusResponse["TaskNotFound"] = "Task not found";
})(BflStatusResponse || (exports.BflStatusResponse = BflStatusResponse = {}));
// Model endpoint mapping
exports.BFL_ENDPOINTS = {
    'flux-dev': '/v1/flux-dev',
    'flux-kontext-max': '/v1/flux-kontext-max',
    'flux-kontext-pro': '/v1/flux-kontext-pro',
    'flux-pro': '/v1/flux-pro',
    'flux-pro-1.1': '/v1/flux-pro-1.1',
    'flux-pro-1.1-ultra': '/v1/flux-pro-1.1-ultra',
};
//# sourceMappingURL=types.js.map