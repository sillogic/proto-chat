export declare enum BflStatusResponse {
    ContentModerated = "Content Moderated",
    Error = "Error",
    Pending = "Pending",
    Ready = "Ready",
    RequestModerated = "Request Moderated",
    TaskNotFound = "Task not found"
}
export interface BflAsyncResponse {
    id: string;
    polling_url: string;
}
export interface BflAsyncWebhookResponse {
    id: string;
    status: string;
    webhook_url: string;
}
export interface BflResultResponse {
    details?: Record<string, any> | null;
    id: string;
    preview?: Record<string, any> | null;
    progress?: number | null;
    result?: any;
    status: BflStatusResponse;
}
export interface BflFluxKontextRequest {
    aspect_ratio?: string | null;
    input_image?: string | null;
    input_image_2?: string | null;
    input_image_3?: string | null;
    input_image_4?: string | null;
    output_format?: 'jpeg' | 'png' | null;
    prompt: string;
    prompt_upsampling?: boolean;
    safety_tolerance?: number;
    seed?: number | null;
    webhook_secret?: string | null;
    webhook_url?: string | null;
}
export interface BflFluxPro11Request {
    height?: number;
    image_prompt?: string | null;
    output_format?: 'jpeg' | 'png' | null;
    prompt?: string | null;
    prompt_upsampling?: boolean;
    safety_tolerance?: number;
    seed?: number | null;
    webhook_secret?: string | null;
    webhook_url?: string | null;
    width?: number;
}
export interface BflFluxPro11UltraRequest {
    aspect_ratio?: string;
    prompt: string;
    raw?: boolean;
    safety_tolerance?: number;
    seed?: number | null;
}
export interface BflFluxProRequest {
    guidance?: number;
    height?: number;
    image_prompt?: string | null;
    prompt?: string | null;
    safety_tolerance?: number;
    seed?: number | null;
    steps?: number;
    width?: number;
}
export interface BflFluxDevRequest {
    guidance?: number;
    height?: number;
    image_prompt?: string | null;
    prompt: string;
    safety_tolerance?: number;
    seed?: number | null;
    steps?: number;
    width?: number;
}
export declare const BFL_ENDPOINTS: {
    readonly 'flux-dev': "/v1/flux-dev";
    readonly 'flux-kontext-max': "/v1/flux-kontext-max";
    readonly 'flux-kontext-pro': "/v1/flux-kontext-pro";
    readonly 'flux-pro': "/v1/flux-pro";
    readonly 'flux-pro-1.1': "/v1/flux-pro-1.1";
    readonly 'flux-pro-1.1-ultra': "/v1/flux-pro-1.1-ultra";
};
export type BflModelId = keyof typeof BFL_ENDPOINTS;
export type BflRequest = BflFluxKontextRequest | BflFluxPro11Request | BflFluxPro11UltraRequest | BflFluxProRequest | BflFluxDevRequest;
//# sourceMappingURL=types.d.ts.map