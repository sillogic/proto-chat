"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.asyncifyPolling = asyncifyPolling;
const async_retry_1 = __importDefault(require("async-retry"));
// Internal error class to signal that polling should continue
class PendingError extends Error {
    constructor() {
        super('Task is pending, continue polling');
        this.name = 'PendingError';
    }
}
// Internal error class to signal that task has failed and should not retry
class TaskFailedError extends Error {
    constructor(error) {
        super(error instanceof Error ? error.message : String(error));
        this.name = 'TaskFailedError';
        this.originalError = error;
    }
}
/**
 * Convert polling pattern to async/await pattern
 *
 * @param options Polling configuration options
 * @returns Promise<R> The data returned when task completes
 * @throws Error When task fails or times out
 */
async function asyncifyPolling(options) {
    const { pollingQuery, checkStatus, initialInterval = 500, maxInterval = 5000, backoffMultiplier = 1.5, maxConsecutiveFailures = 3, maxRetries = Infinity, onPollingError, logger, } = options;
    let consecutiveFailures = 0;
    // async-retry uses Infinity for retries when maxRetries is Infinity
    // but we need to handle this case properly
    const retriesConfig = maxRetries === Infinity ? 1000000 : maxRetries - 1;
    try {
        return await (0, async_retry_1.default)(async (bail, attemptNumber) => {
            const retries = attemptNumber - 1;
            try {
                // Execute polling function
                const pollingResult = await pollingQuery();
                // Reset consecutive failures counter on successful execution
                consecutiveFailures = 0;
                // Check task status
                const statusResult = checkStatus(pollingResult);
                logger?.debug?.(`Task status: ${statusResult.status} (attempt ${attemptNumber})`);
                switch (statusResult.status) {
                    case 'success': {
                        return statusResult.data;
                    }
                    case 'failed': {
                        // Task logic failed, throw error immediately (not counted as consecutive failure)
                        bail(new TaskFailedError(statusResult.error || new Error('Task failed')));
                        // This return is never reached due to bail, but needed for type safety
                        return undefined;
                    }
                    default: {
                        // 'pending' or unknown status - continue polling by throwing PendingError
                        throw new PendingError();
                    }
                }
            }
            catch (error) {
                // Re-throw internal errors that should be handled by async-retry
                if (error instanceof PendingError) {
                    throw error;
                }
                // Polling function execution failed (network error, etc.)
                consecutiveFailures++;
                logger?.error?.(`Failed to execute polling function (attempt ${attemptNumber}/${maxRetries === Infinity ? '∞' : maxRetries}, consecutive failures: ${consecutiveFailures}/${maxConsecutiveFailures}):`, error);
                // Handle custom error processing if provided
                if (onPollingError) {
                    const errorResult = onPollingError({
                        consecutiveFailures,
                        error,
                        retries,
                    });
                    if (!errorResult.isContinuePolling) {
                        // Custom error handler decided to stop polling
                        bail(errorResult.error || error);
                        return undefined;
                    }
                    // Custom error handler decided to continue polling
                    logger?.debug?.('Custom error handler decided to continue polling');
                    throw error; // Rethrow to trigger retry
                }
                else {
                    // Default behavior: check if maximum consecutive failures reached
                    if (consecutiveFailures >= maxConsecutiveFailures) {
                        bail(new Error(`Failed to execute polling function after ${consecutiveFailures} consecutive attempts: ${error}`));
                        return undefined;
                    }
                }
                // Rethrow to trigger retry
                throw error;
            }
        }, {
            factor: backoffMultiplier,
            maxTimeout: maxInterval,
            minTimeout: initialInterval,
            onRetry: (error, attempt) => {
                if (!(error instanceof PendingError)) {
                    logger?.debug?.(`Retrying after error (attempt ${attempt})`);
                }
            },
            randomize: false, // Disable jitter for predictable intervals
            retries: retriesConfig,
        });
    }
    catch (error) {
        // Handle TaskFailedError by throwing the original error
        if (error instanceof TaskFailedError) {
            throw error.originalError;
        }
        // Handle max retries exceeded
        if (error instanceof PendingError) {
            throw new Error(`Task timeout after ${maxRetries} attempts`);
        }
        throw error;
    }
}
//# sourceMappingURL=asyncifyPolling.js.map