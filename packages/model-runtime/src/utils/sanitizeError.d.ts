/**
 * Sanitizes error objects by removing sensitive information that could expose API keys or other credentials.
 * This is particularly important for errors from Azure/OpenAI SDKs that may include request headers.
 */
export declare function sanitizeError(error: any): any;
//# sourceMappingURL=sanitizeError.d.ts.map