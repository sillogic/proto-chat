export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return;

  // Start BullMQ workers for self-hosted async job processing
  if (process.env.REDIS_URL) {
    const { startMemoryExtractionWorkers } = await import(
      './server/workers/memoryExtraction/index'
    );
    startMemoryExtractionWorkers();

    const { startAgentCronJobWorkers } = await import('./server/workers/agentCronJob/index');
    startAgentCronJobWorkers();
  }

  if (process.env.NODE_ENV !== 'production' && !process.env.ENABLE_TELEMETRY_IN_DEV) {
    return;
  }

  const shouldEnable = process.env.ENABLE_TELEMETRY;
  if (!shouldEnable) {
    return;
  }

  await import('./instrumentation.node');
}
