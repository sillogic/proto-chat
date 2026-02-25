import { type LobeChatDatabase } from '@lobechat/database';

import { AsyncTaskModel } from '@/database/models/asyncTask';
import { DocumentModel } from '@/database/models/document';
import { FileModel } from '@/database/models/file';
import { type ChunkContentParams, ContentChunk } from '@/server/modules/ContentChunk';
import { createAsyncCaller } from '@/server/routers/async';
import {
  AsyncTaskError,
  AsyncTaskErrorType,
  AsyncTaskStatus,
  AsyncTaskType,
} from '@/types/asyncTask';

export class ChunkService {
  private userId: string;
  private chunkClient: ContentChunk;
  private fileModel: FileModel;
  private documentModel: DocumentModel;
  private asyncTaskModel: AsyncTaskModel;
  private db: LobeChatDatabase;

  constructor(serverDB: LobeChatDatabase, userId: string) {
    this.userId = userId;
    this.db = serverDB;

    this.chunkClient = new ContentChunk();

    this.fileModel = new FileModel(serverDB, userId);
    this.documentModel = new DocumentModel(serverDB, userId);
    this.asyncTaskModel = new AsyncTaskModel(serverDB, userId);
  }

  async chunkContent(params: ChunkContentParams) {
    return this.chunkClient.chunkContent(params);
  }

  async asyncEmbeddingFileChunks(fileId: string) {
    // Support both files and documents
    let result;
    let isDocument = false;

    if (fileId.startsWith('docs_')) {
      result = await this.documentModel.findById(fileId);
      isDocument = true;
    } else {
      result = await this.fileModel.findById(fileId);
    }

    if (!result) return;

    // 1. create a asyncTaskId
    const asyncTaskId = await this.asyncTaskModel.create({
      status: AsyncTaskStatus.Pending,
      type: AsyncTaskType.Embedding,
    });

    // Update the appropriate table
    if (isDocument) {
      await this.documentModel.update(fileId, { embeddingTaskId: asyncTaskId });
    } else {
      await this.fileModel.update(fileId, { embeddingTaskId: asyncTaskId });
    }

    // Async router will read keyVaults from DB, no need to pass jwtPayload
    const asyncCaller = await createAsyncCaller({ userId: this.userId });

    // trigger embedding task asynchronously
    try {
      await asyncCaller.file.embeddingChunks({ fileId, taskId: asyncTaskId });
    } catch (e) {
      console.error('[embeddingFileChunks] error:', e);

      await this.asyncTaskModel.update(asyncTaskId, {
        error: new AsyncTaskError(
          AsyncTaskErrorType.TaskTriggerError,
          'trigger chunk embedding async task error. Please make sure the APP_URL is available from your server. You can check the proxy config or WAF blocking',
        ),
        status: AsyncTaskStatus.Error,
      });
    }

    return asyncTaskId;
  }

  /**
   * parse file to chunks with async task
   */
  async asyncParseFileToChunks(fileId: string, skipExist?: boolean) {
    console.log('[asyncParseFileToChunks] Called with fileId:', fileId, 'skipExist:', skipExist);

    // Support both files (file_xxx or no prefix) and documents (docs_xxx)
    let result;
    let isDocument = false;

    if (fileId.startsWith('docs_')) {
      // This is a document, query documents table with full ID (including prefix)
      console.log('[asyncParseFileToChunks] Detected document ID, querying documents table');
      result = await this.documentModel.findById(fileId);
      isDocument = true;
    } else {
      // This is a file, query files table
      result = await this.fileModel.findById(fileId);
    }

    if (!result) {
      console.log('[asyncParseFileToChunks] File/Document not found:', fileId);
      return;
    }

    console.log('[asyncParseFileToChunks] Found', isDocument ? 'document' : 'file', 'chunkTaskId:', result.chunkTaskId);

    // skip if already exist chunk tasks
    if (skipExist && result.chunkTaskId) {
      console.log('[asyncParseFileToChunks] Skipping file', fileId, '- already has chunkTaskId:', result.chunkTaskId);
      return;
    }

    console.log('[asyncParseFileToChunks] Starting chunking for file:', fileId);

    // 1. create a asyncTaskId
    const asyncTaskId = await this.asyncTaskModel.create({
      status: AsyncTaskStatus.Processing,
      type: AsyncTaskType.Chunking,
    });

    console.log('[asyncParseFileToChunks] Created async task:', asyncTaskId);

    // Update the appropriate table
    if (isDocument) {
      await this.documentModel.update(fileId, { chunkTaskId: asyncTaskId });
    } else {
      await this.fileModel.update(fileId, { chunkTaskId: asyncTaskId });
    }

    // Async router will read keyVaults from DB, no need to pass jwtPayload
    const asyncCaller = await createAsyncCaller({ userId: this.userId });

    console.log('[asyncParseFileToChunks] Triggering async call to parseFileToChunks');

    // trigger parse file task asynchronously
    asyncCaller.file.parseFileToChunks({ fileId: fileId, taskId: asyncTaskId }).catch(async (e) => {
      console.error('[ParseFileToChunks] error:', e);

      await this.asyncTaskModel.update(asyncTaskId, {
        error: new AsyncTaskError(
          AsyncTaskErrorType.TaskTriggerError,
          'trigger chunk embedding async task error. Please make sure the APP_URL is available from your server. You can check the proxy config or WAF blocking',
        ),
        status: AsyncTaskStatus.Error,
      });
    });

    console.log('[asyncParseFileToChunks] Async task triggered, returning taskId:', asyncTaskId);

    return asyncTaskId;
  }
}
