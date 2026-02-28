import { type NewChunkItem, type NewUnstructuredChunkItem } from '@/database/schemas';
import { knowledgeEnv } from '@/envs/knowledge';
import { ChunkingLoader } from '@/libs/langchain';

import { type ChunkingService } from './rules';
import { ChunkingRuleParser } from './rules';

export interface ChunkContentParams {
  content: Uint8Array;
  filename: string;
  fileType: string;
  mode?: 'fast' | 'hi-res';
}

interface ChunkResult {
  chunks: NewChunkItem[];
  unstructuredChunks?: NewUnstructuredChunkItem[];
}

export class ContentChunk {
  private langchainClient: ChunkingLoader;
  private chunkingRules: Record<string, ChunkingService[]>;

  constructor() {
    this.langchainClient = new ChunkingLoader();
    this.chunkingRules = ChunkingRuleParser.parse(knowledgeEnv.FILE_TYPE_CHUNKING_RULES || '');
  }

  private getChunkingServices(fileType: string): ChunkingService[] {
    const ext = fileType.split('/').pop()?.toLowerCase() || '';
    return this.chunkingRules[ext] || ['default'];
  }

  async chunkContent(params: ChunkContentParams): Promise<ChunkResult> {
    const services = this.getChunkingServices(params.fileType);

    for (const service of services) {
      try {
        switch (service) {
          case 'doc2x': {
            // Future implementation
            break;
          }

          default: {
            return await this.chunkByLangChain(params.filename, params.content);
          }
        }
      } catch (error) {
        // If this is the last service, throw the error
        if (service === services.at(-1)) throw error;
        // Otherwise continue to next service
        console.error(`Chunking failed with service ${service}:`, error);
      }
    }

    // Fallback to langchain if no service succeeded
    return await this.chunkByLangChain(params.filename, params.content);
  }

  private canUseUnstructured(): boolean {
    return !!(knowledgeEnv.UNSTRUCTURED_API_KEY && knowledgeEnv.UNSTRUCTURED_SERVER_URL);
  }

  private chunkByLangChain = async (
    filename: string,
    content: Uint8Array,
  ): Promise<ChunkResult> => {
    console.info('[ContentChunk] Starting langchain partition, filename:', filename, 'content size:', content.length);
    const res = await this.langchainClient.partitionContent(filename, content);
    console.info('[ContentChunk] Partition result:', res.length, 'documents');

    const documents = res.map((item, index) => ({
      id: item.id,
      index,
      metadata: item.metadata,
      text: item.pageContent,
      type: 'LangChainElement',
    }));

    console.info('[ContentChunk] Mapped documents:', documents.length, 'chunks');
    if (documents.length > 0) {
      console.info('[ContentChunk] First chunk text length:', documents[0].text.length);
      console.info('[ContentChunk] First chunk preview:', documents[0].text.slice(0, 100));
    }

    return { chunks: documents };
  };
}
