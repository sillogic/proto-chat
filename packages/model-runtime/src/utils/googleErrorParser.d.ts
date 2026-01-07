import { ILobeAgentRuntimeErrorType } from '../types/error';
export interface ParsedError {
    error: any;
    errorType: ILobeAgentRuntimeErrorType;
}
export interface GoogleChatError {
    '@type': string;
    'domain': string;
    'metadata': {
        service: string;
    };
    'reason': string;
}
export type GoogleChatErrors = GoogleChatError[];
/**
 * Clean error message by removing formatting characters and extra spaces
 * @param message - Original error message
 * @returns Cleaned error message
 */
export declare function cleanErrorMessage(message: string): string;
/**
 * Extract status code information from error message
 * @param message - Error message
 * @returns Extracted error details and prefix
 */
export declare function extractStatusCodeFromError(message: string): {
    errorDetails: any;
    prefix: string;
};
/**
 * Parse error message from Google AI API
 * @param message - Original error message
 * @returns Parsed error object and error type
 */
export declare function parseGoogleErrorMessage(message: string): ParsedError;
//# sourceMappingURL=googleErrorParser.d.ts.map