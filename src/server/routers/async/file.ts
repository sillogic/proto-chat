import { ASYNC_TASK_TIMEOUT } from '@lobechat/business-config/server';
import { TRPCError } from '@trpc/server';
import { chunk } from 'es-toolkit/compat';
import pMap from 'p-map';
import { z } from 'zod';

import { checkBudgetsUsage, checkEmbeddingUsage } from '@/business/server/trpc-middlewares/async';
import { serverDBEnv } from '@/config/db';
import { DEFAULT_FILE_EMBEDDING_MODEL_ITEM } from '@/const/settings/knowledge';
import { AsyncTaskModel } from '@/database/models/asyncTask';
import { ChunkModel } from '@/database/models/chunk';
import { DocumentModel } from '@/database/models/document';
import { EmbeddingModel } from '@/database/models/embedding';
import { EmbeddingUsageLogModel } from '@/database/models/embeddingUsageLog';
import { FileModel } from '@/database/models/file';
import { SystemEmbeddingModel } from '@/database/models/systemEmbedding';
import { type NewChunkItem, type NewEmbeddingsItem } from '@/database/schemas';
import { fileEnv } from '@/envs/file';
import { asyncAuthedProcedure, asyncRouter as router } from '@/libs/trpc/async';
import { getServerDefaultFilesConfig } from '@/server/globalConfig';
import { initModelRuntimeWithUserPayload } from '@/server/modules/ModelRuntime';
import { KeyVaultsGateKeeper } from '@/server/modules/KeyVaultsEncrypt';
import { ChunkService } from '@/server/services/chunk';
import { FileService } from '@/server/services/file';
import { type IAsyncTaskError } from '@/types/asyncTask';
import { AsyncTaskError, AsyncTaskErrorType, AsyncTaskStatus } from '@/types/asyncTask';
import { safeParseJSON } from '@/utils/safeParseJSON';
import { sanitizeUTF8 } from '@/utils/sanitizeUTF8';

const fileProcedure = asyncAuthedProcedure.use(async (opts) => {
  const { ctx } = opts;

  return opts.next({
    ctx: {
      asyncTaskModel: new AsyncTaskModel(ctx.serverDB, ctx.userId),
      chunkModel: new ChunkModel(ctx.serverDB, ctx.userId),
      chunkService: new ChunkService(ctx.serverDB, ctx.userId),
      documentModel: new DocumentModel(ctx.serverDB, ctx.userId),
      embeddingModel: new EmbeddingModel(ctx.serverDB, ctx.userId),
      embeddingUsageLogModel: new EmbeddingUsageLogModel(ctx.serverDB),
      fileModel: new FileModel(ctx.serverDB, ctx.userId),
      fileService: new FileService(ctx.serverDB, ctx.userId),
      systemEmbeddingModel: new SystemEmbeddingModel(ctx.serverDB),
    },
  });
});

export const fileRouter = router({
  embeddingChunks: fileProcedure
    .use(checkEmbeddingUsage)
    .use(checkBudgetsUsage)
    .input(
      z.object({
        fileId: z.string(),
        taskId: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Support both files and documents
      let file;
      const isDocument = input.fileId.startsWith('docs_');

      if (isDocument) {
        file = await ctx.documentModel.findById(input.fileId);
      } else {
        file = await ctx.fileModel.findById(input.fileId);
      }

      if (!file) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: isDocument ? 'Document not found' : 'File not found' });
      }

      const asyncTask = await ctx.asyncTaskModel.findById(input.taskId);

      if (!asyncTask) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Async Task not found' });

      // Try to get system embedding configuration from database
      const systemConfig = await ctx.systemEmbeddingModel.getConfig();

      let model: string;
      let provider: string;
      let modelInputPrice: number | null = null;
      let embeddingPayload = ctx.jwtPayload; // Default to user's payload

      if (systemConfig && systemConfig.providerId && systemConfig.modelId) {
        // Use system configuration from database
        provider = systemConfig.providerId;
        model = systemConfig.modelId;
        modelInputPrice = systemConfig.inputPrice ? parseFloat(systemConfig.inputPrice) : null;

        // Decrypt API Key from system config
        let decryptedApiKey: string | undefined;
        if (systemConfig.apiKey) {
          try {
            const gateKeeper = await KeyVaultsGateKeeper.initWithEnvKey();
            const result = await gateKeeper.decrypt(systemConfig.apiKey);
            if (result.wasAuthentic) {
              decryptedApiKey = result.plaintext;
            }
          } catch (e) {
            console.error('[Embedding] Failed to decrypt API key:', e);
          }
        }

        // Create custom payload with system config
        embeddingPayload = {
          ...ctx.jwtPayload,
          apiKey: decryptedApiKey,
          baseURL: systemConfig.baseUrl || undefined,
        };
      } else {
        // Fallback to environment variable configuration
        const envConfig = getServerDefaultFilesConfig().embeddingModel || DEFAULT_FILE_EMBEDDING_MODEL_ITEM;
        provider = envConfig.provider;
        model = envConfig.model;
      }

      try {
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => {
            reject(
              new AsyncTaskError(
                AsyncTaskErrorType.Timeout,
                'embedding task is timeout, please try again',
              ),
            );
          }, ASYNC_TASK_TIMEOUT);
        });

        const embeddingPromise = async () => {
          // update the task status to success
          await ctx.asyncTaskModel.update(input.taskId, {
            status: AsyncTaskStatus.Processing,
          });

          const startAt = Date.now();

          const CHUNK_SIZE = fileEnv.EMBEDDING_BATCH_SIZE;
          const CONCURRENCY = fileEnv.EMBEDDING_CONCURRENCY;

          const chunks = await ctx.chunkModel.getChunksTextByFileId(input.fileId);
          const requestArray = chunk(chunks, CHUNK_SIZE);

          let totalInputTokens = 0;
          let totalTokens = 0;

          try {
            await pMap(
              requestArray,
              async (chunks) => {
                const { runtime: agentRuntime, actualModel } = await initModelRuntimeWithUserPayload(provider, embeddingPayload, { model });
                const modelId = actualModel || model;

                const embeddings = await agentRuntime.embeddings({
                  dimensions: 1024,
                  input: chunks.map((c) => c.text),
                  model: modelId,
                });

                const items: NewEmbeddingsItem[] =
                  embeddings?.map((e, idx) => ({
                    chunkId: chunks[idx].id,
                    embeddings: e,
                    fileId: input.fileId,
                    model,
                  })) || [];

                await ctx.embeddingModel.bulkCreate(items);

                // Calculate tokens for this batch (estimate: characters / 4)
                const batchTokens = chunks.reduce((sum, c) => sum + Math.ceil(c.text.length / 4), 0);
                totalInputTokens += batchTokens;
                totalTokens += batchTokens;
              },
              { concurrency: CONCURRENCY },
            );
          } catch (e: any) {
            throw {
              message: e.errorType ?? e.message ?? JSON.stringify(e),
              name: AsyncTaskErrorType.EmbeddingError,
            };
          }

          // Record embedding usage log
          if (totalInputTokens > 0) {
            try {
              // Calculate cost in USD
              let costPrice: string | undefined;
              if (modelInputPrice) {
                // modelInputPrice is per 1M tokens
                const costInUSD = (totalInputTokens / 1_000_000) * modelInputPrice;
                costPrice = costInUSD.toFixed(8); // 8 decimal places for precision
              }

              await ctx.embeddingUsageLogModel.create({
                chunkCount: chunks.length,
                costPrice: costPrice,
                fileId: input.fileId,
                inputTokens: totalInputTokens,
                modelId: model,
                operationType: 'file_embedding',
                providerId: provider,
                totalTokens: totalTokens,
                userId: ctx.userId,
              });
            } catch (logError) {
              console.error('[Embedding] Failed to log usage:', logError);
              // Don't fail the embedding task if logging fails
            }
          }

          const duration = Date.now() - startAt;
          // update the task status to success
          await ctx.asyncTaskModel.update(input.taskId, {
            duration,
            status: AsyncTaskStatus.Success,
          });

          return { success: true };
        };

        // Race between the chunking process and the timeout
        return await Promise.race([embeddingPromise(), timeoutPromise]);
      } catch (e) {
        console.error('embeddingChunks error', e);

        await ctx.asyncTaskModel.update(input.taskId, {
          error: new AsyncTaskError((e as Error).name, (e as Error).message),
          status: AsyncTaskStatus.Error,
        });

        const fileName = isDocument
          ? (file.title || file.filename || 'Document')
          : file.name;

        return {
          message: `File ${fileName}(${input.taskId}) failed to embedding: ${(e as Error).message}`,
          success: false,
        };
      }
    }),

  parseFileToChunks: fileProcedure
    .input(
      z.object({
        fileId: z.string(),
        taskId: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      console.log('[parseFileToChunks] Received request for fileId:', input.fileId, 'taskId:', input.taskId);

      // Support both files and documents
      let file;
      let isDocument = false;

      if (input.fileId.startsWith('docs_')) {
        console.log('[parseFileToChunks] Querying document');
        file = await ctx.documentModel.findById(input.fileId);
        isDocument = true;
      } else {
        console.log('[parseFileToChunks] Querying file');
        file = await ctx.fileModel.findById(input.fileId);
      }

      if (!file) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: `${isDocument ? 'Document' : 'File'} not found` });
      }

      console.log('[parseFileToChunks] Found', isDocument ? 'document' : 'file', '- name:', file.name || file.title || file.filename, '- fileType:', file.fileType);

      let content: Uint8Array | undefined;

      // For custom/document type, use content from database directly
      if (isDocument && file.fileType === 'custom/document') {
        console.log('[parseFileToChunks] Custom document detected, using content from database');
        if (!file.content) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'Document content is empty' });
        }
        // Convert text content to Uint8Array
        content = new TextEncoder().encode(file.content);
      } else {
        // Get file content from storage
        const fileUrl = isDocument ? file.source : file.url;
        if (!fileUrl) {
          throw new TRPCError({ code: 'BAD_REQUEST', message: 'File URL not found' });
        }

        try {
          content = await ctx.fileService.getFileByteArray(fileUrl);
        } catch (e) {
          console.error(e);
          // if file not found, delete it from db
          if ((e as any).Code === 'NoSuchKey') {
            if (isDocument) {
              await ctx.documentModel.delete(input.fileId);
            } else {
              await ctx.fileModel.delete(input.fileId, serverDBEnv.REMOVE_GLOBAL_FILE);
            }
            throw new TRPCError({ code: 'BAD_REQUEST', message: 'File not found' });
          }
        }
      }

      if (!content) return;

      const asyncTask = await ctx.asyncTaskModel.findById(input.taskId);

      if (!asyncTask) throw new TRPCError({ code: 'BAD_REQUEST', message: 'Async Task not found' });

      try {
        const startAt = Date.now();

        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => {
            reject(
              new AsyncTaskError(
                AsyncTaskErrorType.Timeout,
                'chunking task is timeout, please try again',
              ),
            );
          }, ASYNC_TASK_TIMEOUT);
        });

        const chunkingPromise = async () => {
          const chunkService = ctx.chunkService;
          // update the task status to processing
          await ctx.asyncTaskModel.update(input.taskId, { status: AsyncTaskStatus.Processing });

          // Get filename with extension
          let filename = file.name || file.filename || file.title || 'unknown';
          let effectiveFileType = file.fileType;

          // Special handling for custom/document - treat as plain text
          if (file.fileType === 'custom/document') {
            // Custom documents are plain text, use .txt extension for chunking
            if (!filename.includes('.')) {
              filename = `${filename}.txt`;
            }
            effectiveFileType = 'text/plain';
            console.log('[parseFileToChunks] Custom document, treating as text/plain');
          } else if (!filename.includes('.') && file.fileType) {
            // If filename has no extension but fileType exists, append extension from fileType
            const extension = file.fileType.includes('/')
              ? file.fileType.split('/').pop()
              : file.fileType;

            // Map common MIME types to extensions
            const extMap: Record<string, string> = {
              'vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
              'msword': 'doc',
              'pdf': 'pdf',
            };

            const ext = extMap[extension || ''] || extension;
            filename = `${filename}.${ext}`;
            console.log('[parseFileToChunks] Appended extension to filename:', filename);
          }

          console.log('[parseFileToChunks] Chunking with fileType:', effectiveFileType, 'filename:', filename);

          // partition file to chunks
          const chunkResult = await chunkService.chunkContent({
            content,
            fileType: effectiveFileType,
            filename,
          });

          // after finish partition, we need to filter out some elements
          const chunks = chunkResult.chunks.map(
            ({ text, ...item }): NewChunkItem => ({
              ...item,
              text: text ? sanitizeUTF8(text) : '',
              userId: ctx.userId,
            }),
          );

          const duration = Date.now() - startAt;

          // if no chunk found, throw error
          if (chunks.length === 0) {
            throw {
              message:
                'No chunk found in this file. it may due to current chunking method can not parse file accurately',
              name: AsyncTaskErrorType.NoChunkError,
            };
          }

          await ctx.chunkModel.bulkCreate(chunks, input.fileId);

          if (chunkResult.unstructuredChunks) {
            const unstructuredChunks = chunkResult.unstructuredChunks.map(
              (item): NewChunkItem => ({ ...item, fileId: input.fileId, userId: ctx.userId }),
            );
            await ctx.chunkModel.bulkCreateUnstructuredChunks(unstructuredChunks);
          }

          // update the task status to success
          await ctx.asyncTaskModel.update(input.taskId, {
            duration,
            status: AsyncTaskStatus.Success,
          });

          // if enable auto embedding, trigger the embedding task
          if (fileEnv.CHUNKS_AUTO_EMBEDDING) {
            await chunkService.asyncEmbeddingFileChunks(input.fileId);
          }

          return { success: true };
        };
        // Race between the chunking process and the timeout
        return await Promise.race([chunkingPromise(), timeoutPromise]);
      } catch (e) {
        const error = e as any;

        const asyncTaskError = error.body
          ? ({ body: safeParseJSON(error.body) ?? error.body, name: error.name } as IAsyncTaskError)
          : new AsyncTaskError((error as Error).name, error.message);

        console.error('[Chunking Error]', asyncTaskError);
        await ctx.asyncTaskModel.update(input.taskId, {
          error: asyncTaskError,
          status: AsyncTaskStatus.Error,
        });

        return {
          message: `File ${file.name}(${input.taskId}) failed to chunking: ${(e as Error).message}`,
          success: false,
        };
      }
    }),
});
