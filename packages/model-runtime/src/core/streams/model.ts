/**
 * Convert an async iterator to a JSON-formatted ReadableStream
 */
export const createModelPullStream = <
  T extends { completed?: number; digest?: string; status: string; total?: number },
>(
  iterable: AsyncIterable<T>,
  model: string,
  {
    onCancel, // Callback function to invoke on cancellation
  }: {
    onCancel?: (reason?: any) => void; // Callback function signature
  } = {},
): ReadableStream => {
  let iterator: AsyncIterator<T>; // Track the iterator externally so we can call return() on cancellation

  return new ReadableStream({
    // Implement the cancel method
    cancel(reason) {
      // Invoke the provided onCancel callback to perform external cleanup (e.g. client.abort())
      if (onCancel) {
        onCancel(reason);
      }

      // Attempt to gracefully terminate the iterator
      // Note: this depends on whether the AsyncIterable implementation supports return/throw
      if (iterator && typeof iterator.return === 'function') {
        // No need to await — let cleanup run in the background
        iterator.return().catch();
      }
    },
    async start(controller) {
      iterator = iterable[Symbol.asyncIterator](); // Get the iterator

      const encoder = new TextEncoder();

      try {
        // eslint-disable-next-line no-constant-condition
        while (true) {
          // Wait for the next chunk or end of iteration
          const { value: progress, done } = await iterator.next();

          // If iteration is complete, break out of the loop
          if (done) {
            break;
          }

          // Skip 'pulling manifest' status as it contains no progress info
          if (progress.status === 'pulling manifest') continue;

          // Format as standard format and write to stream
          const progressData =
            JSON.stringify({
              completed: progress.completed,
              digest: progress.digest,
              model,
              status: progress.status,
              total: progress.total,
            }) + '\n';

          controller.enqueue(encoder.encode(progressData));
        }

        // Completed normally
        controller.close();
      } catch (error) {
        // Handle errors

        // If the error is caused by an abort operation, handle silently (or log), then try to close the stream
        if (error instanceof DOMException && error.name === 'AbortError') {
          // No need to enqueue error info as the connection may already be closed
          // Attempt to close normally; if already cancelled, the controller may already be closed or errored
          try {
            controller.enqueue(new TextEncoder().encode(JSON.stringify({ status: 'cancelled' })));
            controller.close();
          } catch {
            // Ignore close errors — the stream may already have been handled by the cancel mechanism
          }
        } else {
          console.error('[createModelPullStream] model download stream error:', error);
          // For other errors, try to send the error information to the client
          const errorMessage = error instanceof Error ? error.message : String(error);
          const errorData =
            JSON.stringify({
              error: errorMessage,
              model,
              status: 'error',
            }) + '\n';

          try {
            // Only attempt to enqueue if the stream still expects data
            if (controller.desiredSize !== null && controller.desiredSize > 0) {
              controller.enqueue(encoder.encode(errorData));
            }
          } catch (enqueueError) {
            console.error('[createModelPullStream] Error enqueueing error message:', enqueueError);
            // If this also fails, the connection is likely already closed
          }

          // Attempt to close the stream or mark it as errored
          try {
            controller.close(); // Attempt normal close
          } catch {
            controller.error(error); // If close fails, put the stream into an error state
          }
        }
      }
    },
  });
};
