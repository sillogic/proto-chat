import { eq } from 'drizzle-orm';

import { systemEmbeddingConfig } from '../schemas';
import { LobeChatDatabase } from '../type';

export class SystemEmbeddingModel {
  private db: LobeChatDatabase;

  constructor(db: LobeChatDatabase) {
    this.db = db;
  }

  /**
   * Get the system embedding configuration
   * Returns the global embedding config (provider, model, apiKey, baseUrl, etc.)
   */
  async getConfig() {
    return this.getConfigById('default');
  }

  /**
   * Get embedding config by id (e.g. 'default' for knowledge base, 'memory' for memory extraction)
   */
  async getConfigById(id: string) {
    const [config] = await this.db
      .select()
      .from(systemEmbeddingConfig)
      .where(eq(systemEmbeddingConfig.id, id))
      .limit(1);

    return config || null;
  }

  /**
   * Get the memory embedding config.
   * Tries id='memory' first; falls back to id='default'.
   */
  async getMemoryEmbeddingConfig() {
    const memoryConfig = await this.getConfigById('memory');
    if (memoryConfig) return memoryConfig;
    return this.getConfigById('default');
  }

  /**
   * Check if system embedding is configured
   */
  async isConfigured(): Promise<boolean> {
    const config = await this.getConfig();
    return !!config && !!config.providerId && !!config.modelId;
  }
}
