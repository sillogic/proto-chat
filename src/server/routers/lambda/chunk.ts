import { DEFAULT_FILE_EMBEDDING_MODEL_ITEM } from '@lobechat/const';
import { type ChatSemanticSearchChunk, type FileSearchResult } from '@lobechat/types';
import { SemanticSearchSchema } from '@lobechat/types';
import { TRPCError } from '@trpc/server';
import { inArray } from 'drizzle-orm';
import pMap from 'p-map';
import { z } from 'zod';

import { checkBudgetsUsage } from '@/business/server/trpc-middlewares/lambda';
import { AsyncTaskModel } from '@/database/models/asyncTask';
import { ChunkModel } from '@/database/models/chunk';
import { DocumentModel } from '@/database/models/document';
import { EmbeddingModel } from '@/database/models/embedding';
import { EmbeddingUsageLogModel } from '@/database/models/embeddingUsageLog';
import { FileModel } from '@/database/models/file';
import { MessageModel } from '@/database/models/message';
import { SystemEmbeddingModel } from '@/database/models/systemEmbedding';
import { knowledgeBaseFiles } from '@/database/schemas';
import { authedProcedure, router } from '@/libs/trpc/lambda';
import { keyVaults, serverDatabase } from '@/libs/trpc/lambda/middleware';
import { getServerDefaultFilesConfig } from '@/server/globalConfig';
import { KeyVaultsGateKeeper } from '@/server/modules/KeyVaultsEncrypt';
import { initModelRuntimeFromDB, initModelRuntimeWithUserPayload } from '@/server/modules/ModelRuntime';
import { ChunkService } from '@/server/services/chunk';
import { DocumentService } from '@/server/services/document';

const chunkProcedure = authedProcedure
  .use(serverDatabase)
  .use(keyVaults)
  .use(async (opts) => {
    const { ctx } = opts;

    return opts.next({
      ctx: {
        asyncTaskModel: new AsyncTaskModel(ctx.serverDB, ctx.userId),
        chunkModel: new ChunkModel(ctx.serverDB, ctx.userId),
        chunkService: new ChunkService(ctx.serverDB, ctx.userId),
        documentModel: new DocumentModel(ctx.serverDB, ctx.userId),
        documentService: new DocumentService(ctx.serverDB, ctx.userId),
        embeddingModel: new EmbeddingModel(ctx.serverDB, ctx.userId),
        embeddingUsageLogModel: new EmbeddingUsageLogModel(ctx.serverDB),
        fileModel: new FileModel(ctx.serverDB, ctx.userId),
        messageModel: new MessageModel(ctx.serverDB, ctx.userId),
        systemEmbeddingModel: new SystemEmbeddingModel(ctx.serverDB),
      },
    });
  });

/**
 * Group chunks by file and calculate relevance scores
 */
const groupAndRankFiles = (chunks: ChatSemanticSearchChunk[], topK: number): FileSearchResult[] => {
  const fileMap = new Map<string, FileSearchResult>();

  // Group chunks by file
  for (const chunk of chunks) {
    const fileId = chunk.fileId || 'unknown';
    const fileName = chunk.fileName || `File ${fileId}`;

    if (!fileMap.has(fileId)) {
      fileMap.set(fileId, {
        fileId,
        fileName,
        relevanceScore: 0,
        topChunks: [],
      });
    }

    const fileResult = fileMap.get(fileId)!;
    fileResult.topChunks.push({
      id: chunk.id,
      similarity: chunk.similarity,
      text: chunk.text || '',
    });
  }

  // Calculate relevance score for each file (average of top 3 chunks)
  for (const fileResult of fileMap.values()) {
    fileResult.topChunks.sort((a, b) => b.similarity - a.similarity);
    const top3 = fileResult.topChunks.slice(0, 3);
    fileResult.relevanceScore =
      top3.reduce((sum, chunk) => sum + chunk.similarity, 0) / top3.length;
    // Keep only top chunks per file
    fileResult.topChunks = fileResult.topChunks.slice(0, 3);
  }

  // Sort files by relevance score and return top K
  return Array.from(fileMap.values())
    .sort((a, b) => b.relevanceScore - a.relevanceScore)
    .slice(0, topK);
};

export const chunkRouter = router({
  createEmbeddingChunksTask: chunkProcedure
    .input(
      z.object({
        id: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const asyncTaskId = await ctx.chunkService.asyncEmbeddingFileChunks(input.id);

      return { id: asyncTaskId, success: true };
    }),

  createParseFileTask: chunkProcedure
    .input(
      z.object({
        id: z.string(),
        skipExist: z.boolean().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      console.info('[createParseFileTask] Received request - fileId:', input.id, 'skipExist:', input.skipExist);
      const asyncTaskId = await ctx.chunkService.asyncParseFileToChunks(input.id, input.skipExist);
      console.info('[createParseFileTask] asyncParseFileToChunks returned taskId:', asyncTaskId);

      return { id: asyncTaskId, success: true };
    }),

  getChunksByFileId: chunkProcedure
    .input(
      z.object({
        cursor: z.number().nullish(),
        id: z.string(),
      }),
    )
    .query(async ({ ctx, input }) => {
      return {
        items: await ctx.chunkModel.findByFileId(input.id, input.cursor || 0),
        nextCursor: input.cursor ? input.cursor + 1 : 1,
      };
    }),

  getFileContents: chunkProcedure
    .input(
      z.object({
        fileIds: z.array(z.string()),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      return await pMap(
        input.fileIds,
        async (fileId) => {
          // 1. Find file information
          const file = await ctx.fileModel.findById(fileId);
          if (!file) {
            return {
              content: '',
              error: 'File not found',
              fileId,
              filename: `Unknown file ${fileId}`,
            };
          }

          // 2. Find existing parsed document
          let document:
            | {
                content: string | null;
                metadata: Record<string, any> | null;
              }
            | undefined = await ctx.documentModel.findByFileId(fileId);

          // 3. If not exists, parse the file
          if (!document) {
            try {
              document = await ctx.documentService.parseFile(fileId);
            } catch (error) {
              return {
                content: '',
                error: `Failed to parse file: ${(error as Error).message}`,
                fileId,
                filename: file.name,
              };
            }
          }

          // 4. Calculate file statistics
          const content = document.content || '';
          const lines = content.split('\n');
          const totalLineCount = lines.length;
          const totalCharCount = content.length;
          const preview = lines.slice(0, 5).join('\n');

          // 5. Return content with details
          return {
            content,
            fileId,
            filename: file.name,
            metadata: document.metadata,
            preview,
            totalCharCount,
            totalLineCount,
          };
        },
        { concurrency: 3 },
      );
    }),

  retryParseFileTask: chunkProcedure
    .input(
      z.object({
        id: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const result = await ctx.fileModel.findById(input.id);

      if (!result) return;

      // 1. delete the previous task if exist
      if (result.chunkTaskId) {
        await ctx.asyncTaskModel.delete(result.chunkTaskId);
      }

      // 2. create a new asyncTask for chunking
      const asyncTaskId = await ctx.chunkService.asyncParseFileToChunks(input.id);

      return { id: asyncTaskId, success: true };
    }),

  semanticSearch: chunkProcedure
    .input(
      z.object({
        fileIds: z.array(z.string()).optional(),
        query: z.string(),
      }),
    )
    .use(checkBudgetsUsage)
    .mutation(async ({ ctx, input }) => {
      // Try to get system embedding configuration from database
      const systemConfig = await ctx.systemEmbeddingModel.getConfig();

      let model: string;
      let provider: string;
      let modelInputPrice: number | null = null;
      let agentRuntime;

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
        const embeddingPayload = {
          apiKey: decryptedApiKey,
          baseURL: systemConfig.baseUrl || undefined,
        };

        // Initialize runtime with system payload
        const result = await initModelRuntimeWithUserPayload(provider, embeddingPayload, { model });
        agentRuntime = result.runtime;
      } else {
        // Fallback to environment variable configuration
        const envConfig = getServerDefaultFilesConfig().embeddingModel || DEFAULT_FILE_EMBEDDING_MODEL_ITEM;
        provider = envConfig.provider;
        model = envConfig.model;

        // Read user's provider config from database
        agentRuntime = await initModelRuntimeFromDB(ctx.serverDB, ctx.userId, provider, { model });
      }

      const embeddings = await agentRuntime.embeddings({
        dimensions: 1024,
        input: input.query,
        model,
      });

      // Record semantic search embedding usage (for cost analysis, not charging users)
      try {
        // Calculate query tokens (estimate: characters / 4)
        const queryTokens = Math.ceil(input.query.length / 4);

        // Calculate cost in USD
        let costPrice: string | undefined;
        if (modelInputPrice) {
          const costInUSD = (queryTokens / 1_000_000) * modelInputPrice;
          costPrice = costInUSD.toFixed(8);
        }

        await ctx.embeddingUsageLogModel.create({
          userId: ctx.userId,
          modelId: model,
          providerId: provider,
          inputTokens: queryTokens,
          totalTokens: queryTokens,
          costPrice,
          userPrice: undefined, // Not charging users for semantic search
          operationType: 'semantic_search',
          chunkCount: 1, // Single query
        });
      } catch (logError) {
        console.error('[Semantic Search] Failed to log usage:', logError);
        // Don't fail the search if logging fails
      }

      return ctx.chunkModel.semanticSearch({
        embedding: embeddings![0],
        fileIds: input.fileIds,
        query: input.query,
      });
    }),

  semanticSearchForChat: chunkProcedure
    .input(SemanticSearchSchema)
    .mutation(async ({ ctx, input }) => {
      try {
        // Try to get system embedding configuration from database
        const systemConfig = await ctx.systemEmbeddingModel.getConfig();

        let model: string;
        let provider: string;
        let modelInputPrice: number | null = null;
        let modelRuntime;

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
          const embeddingPayload = {
            apiKey: decryptedApiKey,
            baseURL: systemConfig.baseUrl || undefined,
          };

          // Initialize runtime with system payload
          const result = await initModelRuntimeWithUserPayload(provider, embeddingPayload, { model });
          modelRuntime = result.runtime;
        } else {
          // Fallback to environment variable configuration
          const envConfig = getServerDefaultFilesConfig().embeddingModel || DEFAULT_FILE_EMBEDDING_MODEL_ITEM;
          provider = envConfig.provider;
          model = envConfig.model;

          // Read user's provider config from database
          modelRuntime = await initModelRuntimeFromDB(ctx.serverDB, ctx.userId, provider, { model });
        }

        let embedding: number[];

        // slice content to make sure in the context window limit
        const query = input.query.length > 8000 ? input.query.slice(0, 8000) : input.query;

        const embeddings = await modelRuntime.embeddings({
          dimensions: 1024,
          input: query,
          model,
        });

        embedding = embeddings![0];

        // Record semantic search embedding usage (for cost analysis, not charging users)
        try {
          // Calculate query tokens (estimate: characters / 4)
          const queryTokens = Math.ceil(query.length / 4);

          // Calculate cost in USD
          let costPrice: string | undefined;
          if (modelInputPrice) {
            const costInUSD = (queryTokens / 1_000_000) * modelInputPrice;
            costPrice = costInUSD.toFixed(8);
          }

          await ctx.embeddingUsageLogModel.create({
            userId: ctx.userId,
            modelId: model,
            providerId: provider,
            inputTokens: queryTokens,
            totalTokens: queryTokens,
            costPrice,
            userPrice: undefined, // Not charging users for semantic search
            operationType: 'semantic_search',
            chunkCount: 1, // Single query
          });
        } catch (logError) {
          console.error('[Semantic Search] Failed to log usage:', logError);
          // Don't fail the search if logging fails
        }

        let finalFileIds = input.fileIds ?? [];

        if (input.knowledgeIds && input.knowledgeIds.length > 0) {
          const knowledgeFiles = await ctx.serverDB.query.knowledgeBaseFiles.findMany({
            where: inArray(knowledgeBaseFiles.knowledgeBaseId, input.knowledgeIds),
          });

          finalFileIds = knowledgeFiles.map((f) => f.fileId).concat(finalFileIds);
        }

        const chunks = await ctx.chunkModel.semanticSearchForChat({
          embedding,
          fileIds: finalFileIds,
          query: input.query,
          topK: input.topK,
        });

        // Group chunks by file and calculate relevance scores
        const fileResults = groupAndRankFiles(chunks, input.topK || 15);

        // TODO: need to rerank the chunks

        return { chunks, fileResults };
      } catch (e) {
        console.error(e);

        const error = e as any;
        const errorType = error.errorType;

        // Map business error types to appropriate HTTP status codes
        if (errorType === 'InvalidProviderAPIKey') {
          throw new TRPCError({
            code: 'METHOD_NOT_SUPPORTED',
            message: error.message || 'Invalid API key for embedding provider',
          });
        }

        if (errorType === 'ProviderBizError') {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: error.message || 'Provider service error',
          });
        }

        // For unknown errors, still return 500 but with proper message
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error.message || errorType || 'Failed to perform semantic search',
        });
      }
    }),
});
