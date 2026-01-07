declare class CloudflareStreamTransformer {
    private textDecoder;
    private buffer;
    private parseChunk;
    transform(chunk: Uint8Array, controller: TransformStreamDefaultController): Promise<void>;
}
declare const DEFAULT_BASE_URL_PREFIX = "https://api.cloudflare.com";
declare function fillUrl(accountID: string): string;
declare function desensitizeCloudflareUrl(url: string): string;
export { CloudflareStreamTransformer, DEFAULT_BASE_URL_PREFIX, desensitizeCloudflareUrl, fillUrl };
//# sourceMappingURL=cloudflare.d.ts.map