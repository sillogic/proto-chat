import { embeddingUsageLogs } from '../schemas';
import { LobeChatDatabase } from '../type';

export interface CreateEmbeddingUsageLogParams {
  userId: string;
  modelId: string;
  providerId: string;
  inputTokens: number;
  totalTokens: number;
  costPrice?: string; // in USD
  userPrice?: string; // in credits (for future use)
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
        chunkCount: params.chunkCount,
        costPrice: params.costPrice,
        fileId: params.fileId,
        inputTokens: params.inputTokens,
        modelId: params.modelId,
        operationType: params.operationType || 'file_embedding',
        providerId: params.providerId,
        totalTokens: params.totalTokens,
        userId: params.userId,
        userPrice: params.userPrice || null,
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
          chunkCount: log.chunkCount,
          costPrice: log.costPrice,
          fileId: log.fileId,
          inputTokens: log.inputTokens,
          modelId: log.modelId,
          operationType: log.operationType || 'file_embedding',
          providerId: log.providerId,
          totalTokens: log.totalTokens,
          userId: log.userId,
          userPrice: log.userPrice || null,
        })),
      )
      .returning();

    return results;
  }
}
