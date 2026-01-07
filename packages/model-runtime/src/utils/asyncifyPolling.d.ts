export interface TaskResult<T> {
    data?: T;
    error?: any;
    status: 'pending' | 'success' | 'failed';
}
export interface PollingErrorContext {
    consecutiveFailures: number;
    error: any;
    retries: number;
}
export interface PollingErrorResult {
    error?: any;
    isContinuePolling: boolean;
}
export interface AsyncifyPollingOptions<T, R> {
    backoffMultiplier?: number;
    checkStatus: (result: T) => TaskResult<R>;
    initialInterval?: number;
    logger?: {
        debug?: (...args: any[]) => void;
        error?: (...args: any[]) => void;
    };
    maxConsecutiveFailures?: number;
    maxInterval?: number;
    maxRetries?: number;
    onPollingError?: (context: PollingErrorContext) => PollingErrorResult;
    pollingQuery: () => Promise<T>;
}
/**
 * Convert polling pattern to async/await pattern
 *
 * @param options Polling configuration options
 * @returns Promise<R> The data returned when task completes
 * @throws Error When task fails or times out
 */
export declare function asyncifyPolling<T, R>(options: AsyncifyPollingOptions<T, R>): Promise<R>;
//# sourceMappingURL=asyncifyPolling.d.ts.map