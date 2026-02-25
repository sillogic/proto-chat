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
    const [config] = await this.db
      .select()
      .from(systemEmbeddingConfig)
      .where(eq(systemEmbeddingConfig.id, 'default'))
      .limit(1);

    return config || null;
  }

  /**
   * Check if system embedding is configured
   */
  async isConfigured(): Promise<boolean> {
    const config = await this.getConfig();
    return !!config && !!config.providerId && !!config.modelId;
  }
}
