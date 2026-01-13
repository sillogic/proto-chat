import { embeddingUsageLogs } from '../schemas';
import { LobeChatDatabase } from '../type';

export interface CreateEmbeddingUsageLogParams {
  userId: string;
  modelId: string;
  providerId: string;
  inputTokens: number;
  totalTokens: number;
  costPrice?: string; // in USD
  operationType?: string;
  fileId?: string;
  chunkCount?: number;
}

export class EmbeddingUsageLogModel {
  private db: LobeChatDatabase;

  constructor(db: LobeChatDatabase) {
    this.db = db;
  }

  /**
   * Create a new embedding usage log
   */
  async create(params: CreateEmbeddingUsageLogParams) {
    const [result] = await this.db
      .insert(embeddingUsageLogs)
      .values({
        userId: params.userId,
        modelId: params.modelId,
        providerId: params.providerId,
        inputTokens: params.inputTokens,
        totalTokens: params.totalTokens,
        costPrice: params.costPrice,
        userPrice: null, // Not charging users in Phase 2
        operationType: params.operationType || 'file_embedding',
        fileId: params.fileId,
        chunkCount: params.chunkCount,
        createdAt: new Date(),
      })
      .returning();

    return result;
  }

  /**
   * Batch create embedding usage logs
   */
  async batchCreate(logs: CreateEmbeddingUsageLogParams[]) {
    if (logs.length === 0) return [];

    const results = await this.db
      .insert(embeddingUsageLogs)
      .values(
        logs.map((log) => ({
          userId: log.userId,
          modelId: log.modelId,
          providerId: log.providerId,
          inputTokens: log.inputTokens,
          totalTokens: log.totalTokens,
          costPrice: log.costPrice,
          userPrice: null,
          operationType: log.operationType || 'file_embedding',
          fileId: log.fileId,
          chunkCount: log.chunkCount,
          createdAt: new Date(),
        })),
      )
      .returning();

    return results;
  }
}
