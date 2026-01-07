import { ILobeAgentRuntimeErrorType } from '../types/error';
export interface ComfyUIError {
    code?: number | string;
    details?: any;
    message: string;
    missingFileName?: string;
    missingFileType?: 'model' | 'component';
    status?: number;
    type?: string;
    userGuidance?: string;
}
export interface ParsedError {
    error: ComfyUIError;
    errorType: ILobeAgentRuntimeErrorType;
}
/**
 * Clean ComfyUI error message by removing formatting characters and extra spaces
 * @param message - Original error message
 * @returns Cleaned error message
 */
export declare function cleanComfyUIErrorMessage(message: string): string;
/**
 * Parse ComfyUI error message and return structured error information
 * Client-side version that focuses on error type categorization
 * File information and userGuidance are expected from server-side error handling
 * @param error - Original error object
 * @returns Parsed error object and error type
 */
export declare function parseComfyUIErrorMessage(error: any): ParsedError;
//# sourceMappingURL=comfyuiErrorParser.d.ts.map