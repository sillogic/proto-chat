// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AsyncTaskErrorType, AsyncTaskStatus, AsyncTaskType } from '@/types/asyncTask';

// Hoisted mock functions so they can be used in vi.mock factories
const mockAsyncTaskCreate = vi.hoisted(() => vi.fn());
const mockAsyncTaskUpdate = vi.hoisted(() => vi.fn());
const mockFileModelFindById = vi.hoisted(() => vi.fn());
const mockFileModelUpdate = vi.hoisted(() => vi.fn());
const mockDocumentModelFindById = vi.hoisted(() => vi.fn());
const mockDocumentModelUpdate = vi.hoisted(() => vi.fn());
const mockChunkContent = vi.hoisted(() => vi.fn());
const mockEmbeddingChunks = vi.hoisted(() => vi.fn());
const mockParseFileToChunks = vi.hoisted(() => vi.fn());

vi.mock('@/database/models/asyncTask', () => ({
  AsyncTaskModel: vi.fn().mockImplementation(() => ({
    create: mockAsyncTaskCreate,
    update: mockAsyncTaskUpdate,
  })),
}));

vi.mock('@/database/models/file', () => ({
  FileModel: vi.fn().mockImplementation(() => ({
    findById: mockFileModelFindById,
    update: mockFileModelUpdate,
  })),
}));

vi.mock('@/database/models/document', () => ({
  DocumentModel: vi.fn().mockImplementation(() => ({
    findById: mockDocumentModelFindById,
    update: mockDocumentModelUpdate,
  })),
}));

vi.mock('@/server/modules/ContentChunk', () => ({
  ContentChunk: vi.fn().mockImplementation(() => ({
    chunkContent: mockChunkContent,
  })),
}));

vi.mock('@/server/routers/async', () => ({
  createAsyncCaller: vi.fn().mockResolvedValue({
    file: {
      embeddingChunks: mockEmbeddingChunks,
      parseFileToChunks: mockParseFileToChunks,
    },
  }),
}));

import { ChunkService } from './index';

describe('ChunkService', () => {
  let service: ChunkService;
  const mockUserId = 'user-test-123';
  const mockDb = {} as any;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new ChunkService(mockDb, mockUserId);
  });

  // -------------------------
  // chunkContent
  // -------------------------
  describe('chunkContent', () => {
    it('should delegate to chunkClient.chunkContent and return its result', async () => {
      const params = { content: 'hello world', fileId: 'file-abc' } as any;
      const expectedResult = { chunks: ['chunk1', 'chunk2'] };
      mockChunkContent.mockResolvedValue(expectedResult);

      const result = await service.chunkContent(params);

      expect(mockChunkContent).toHaveBeenCalledWith(params);
      expect(result).toEqual(expectedResult);
    });

    it('should propagate errors from chunkClient.chunkContent', async () => {
      const params = { content: 'test' } as any;
      mockChunkContent.mockRejectedValue(new Error('Chunk error'));

      await expect(service.chunkContent(params)).rejects.toThrow('Chunk error');
    });
  });

  // -------------------------
  // asyncEmbeddingFileChunks
  // -------------------------
  describe('asyncEmbeddingFileChunks', () => {
    describe('file routing', () => {
      it('should use fileModel for regular file IDs', async () => {
        mockFileModelFindById.mockResolvedValue({ id: 'file-123' });
        mockAsyncTaskCreate.mockResolvedValue('task-001');
        mockEmbeddingChunks.mockResolvedValue(undefined);

        await service.asyncEmbeddingFileChunks('file-123');

        expect(mockFileModelFindById).toHaveBeenCalledWith('file-123');
        expect(mockDocumentModelFindById).not.toHaveBeenCalled();
      });

      it('should use documentModel for docs_ prefixed file IDs', async () => {
        mockDocumentModelFindById.mockResolvedValue({ id: 'docs_456' });
        mockAsyncTaskCreate.mockResolvedValue('task-001');
        mockEmbeddingChunks.mockResolvedValue(undefined);

        await service.asyncEmbeddingFileChunks('docs_456');

        expect(mockDocumentModelFindById).toHaveBeenCalledWith('docs_456');
        expect(mockFileModelFindById).not.toHaveBeenCalled();
      });
    });

    describe('early return when not found', () => {
      it('should return undefined when file is not found', async () => {
        mockFileModelFindById.mockResolvedValue(null);

        const result = await service.asyncEmbeddingFileChunks('file-nonexistent');

        expect(result).toBeUndefined();
        expect(mockAsyncTaskCreate).not.toHaveBeenCalled();
      });

      it('should return undefined when document is not found', async () => {
        mockDocumentModelFindById.mockResolvedValue(null);

        const result = await service.asyncEmbeddingFileChunks('docs_nonexistent');

        expect(result).toBeUndefined();
        expect(mockAsyncTaskCreate).not.toHaveBeenCalled();
      });
    });

    describe('async task creation', () => {
      it('should create async task with Pending status and Embedding type', async () => {
        mockFileModelFindById.mockResolvedValue({ id: 'file-123' });
        mockAsyncTaskCreate.mockResolvedValue('task-embed-001');
        mockEmbeddingChunks.mockResolvedValue(undefined);

        await service.asyncEmbeddingFileChunks('file-123');

        expect(mockAsyncTaskCreate).toHaveBeenCalledWith({
          status: AsyncTaskStatus.Pending,
          type: AsyncTaskType.Embedding,
        });
      });

      it('should update file with embeddingTaskId for regular files', async () => {
        mockFileModelFindById.mockResolvedValue({ id: 'file-123' });
        mockAsyncTaskCreate.mockResolvedValue('task-embed-001');
        mockEmbeddingChunks.mockResolvedValue(undefined);

        await service.asyncEmbeddingFileChunks('file-123');

        expect(mockFileModelUpdate).toHaveBeenCalledWith('file-123', {
          embeddingTaskId: 'task-embed-001',
        });
      });

      it('should update document with embeddingTaskId for docs_ files', async () => {
        mockDocumentModelFindById.mockResolvedValue({ id: 'docs_456' });
        mockAsyncTaskCreate.mockResolvedValue('task-embed-002');
        mockEmbeddingChunks.mockResolvedValue(undefined);

        await service.asyncEmbeddingFileChunks('docs_456');

        expect(mockDocumentModelUpdate).toHaveBeenCalledWith('docs_456', {
          embeddingTaskId: 'task-embed-002',
        });
      });

      it('should return the created asyncTaskId', async () => {
        mockFileModelFindById.mockResolvedValue({ id: 'file-123' });
        mockAsyncTaskCreate.mockResolvedValue('task-embed-abc');
        mockEmbeddingChunks.mockResolvedValue(undefined);

        const result = await service.asyncEmbeddingFileChunks('file-123');

        expect(result).toBe('task-embed-abc');
      });
    });

    describe('error handling', () => {
      it('should update task with error status and TaskTriggerError when embedding call fails', async () => {
        mockFileModelFindById.mockResolvedValue({ id: 'file-123' });
        mockAsyncTaskCreate.mockResolvedValue('task-embed-001');
        mockAsyncTaskUpdate.mockResolvedValue(undefined);
        mockEmbeddingChunks.mockRejectedValue(new Error('Network failure'));

        const result = await service.asyncEmbeddingFileChunks('file-123');

        expect(mockAsyncTaskUpdate).toHaveBeenCalledWith(
          'task-embed-001',
          expect.objectContaining({
            status: AsyncTaskStatus.Error,
            error: expect.objectContaining({
              name: AsyncTaskErrorType.TaskTriggerError,
            }),
          }),
        );
        // still returns the taskId even on error
        expect(result).toBe('task-embed-001');
      });
    });
  });

  // -------------------------
  // asyncParseFileToChunks
  // -------------------------
  describe('asyncParseFileToChunks', () => {
    describe('file routing', () => {
      it('should use fileModel for regular file IDs', async () => {
        mockFileModelFindById.mockResolvedValue({ id: 'file-123', chunkTaskId: null });
        mockAsyncTaskCreate.mockResolvedValue('task-chunk-001');
        mockParseFileToChunks.mockResolvedValue(undefined);

        await service.asyncParseFileToChunks('file-123');

        expect(mockFileModelFindById).toHaveBeenCalledWith('file-123');
        expect(mockDocumentModelFindById).not.toHaveBeenCalled();
      });

      it('should use documentModel for docs_ prefixed file IDs', async () => {
        mockDocumentModelFindById.mockResolvedValue({ id: 'docs_456', chunkTaskId: null });
        mockAsyncTaskCreate.mockResolvedValue('task-chunk-001');
        mockParseFileToChunks.mockResolvedValue(undefined);

        await service.asyncParseFileToChunks('docs_456');

        expect(mockDocumentModelFindById).toHaveBeenCalledWith('docs_456');
        expect(mockFileModelFindById).not.toHaveBeenCalled();
      });
    });

    describe('early return conditions', () => {
      it('should return undefined when file is not found', async () => {
        mockFileModelFindById.mockResolvedValue(null);

        const result = await service.asyncParseFileToChunks('file-nonexistent');

        expect(result).toBeUndefined();
        expect(mockAsyncTaskCreate).not.toHaveBeenCalled();
      });

      it('should return undefined when document is not found', async () => {
        mockDocumentModelFindById.mockResolvedValue(null);

        const result = await service.asyncParseFileToChunks('docs_nonexistent');

        expect(result).toBeUndefined();
        expect(mockAsyncTaskCreate).not.toHaveBeenCalled();
      });

      it('should return undefined when skipExist is true and chunkTaskId already exists', async () => {
        mockFileModelFindById.mockResolvedValue({
          id: 'file-123',
          chunkTaskId: 'existing-task-id',
        });

        const result = await service.asyncParseFileToChunks('file-123', true);

        expect(result).toBeUndefined();
        expect(mockAsyncTaskCreate).not.toHaveBeenCalled();
      });

      it('should proceed when skipExist is false even if chunkTaskId exists', async () => {
        mockFileModelFindById.mockResolvedValue({
          id: 'file-123',
          chunkTaskId: 'existing-task-id',
        });
        mockAsyncTaskCreate.mockResolvedValue('task-chunk-new');
        mockParseFileToChunks.mockResolvedValue(undefined);

        const result = await service.asyncParseFileToChunks('file-123', false);

        expect(result).toBe('task-chunk-new');
        expect(mockAsyncTaskCreate).toHaveBeenCalledOnce();
      });

      it('should proceed when skipExist is true but chunkTaskId is null', async () => {
        mockFileModelFindById.mockResolvedValue({ id: 'file-123', chunkTaskId: null });
        mockAsyncTaskCreate.mockResolvedValue('task-chunk-001');
        mockParseFileToChunks.mockResolvedValue(undefined);

        const result = await service.asyncParseFileToChunks('file-123', true);

        expect(result).toBe('task-chunk-001');
      });

      it('should proceed when skipExist is undefined (default) and chunkTaskId exists', async () => {
        mockFileModelFindById.mockResolvedValue({
          id: 'file-123',
          chunkTaskId: 'existing-task-id',
        });
        mockAsyncTaskCreate.mockResolvedValue('task-chunk-new');
        mockParseFileToChunks.mockResolvedValue(undefined);

        const result = await service.asyncParseFileToChunks('file-123');

        expect(result).toBe('task-chunk-new');
      });
    });

    describe('async task creation', () => {
      it('should create async task with Processing status and Chunking type', async () => {
        mockFileModelFindById.mockResolvedValue({ id: 'file-123', chunkTaskId: null });
        mockAsyncTaskCreate.mockResolvedValue('task-chunk-001');
        mockParseFileToChunks.mockResolvedValue(undefined);

        await service.asyncParseFileToChunks('file-123');

        expect(mockAsyncTaskCreate).toHaveBeenCalledWith({
          status: AsyncTaskStatus.Processing,
          type: AsyncTaskType.Chunking,
        });
      });

      it('should update file with chunkTaskId for regular files', async () => {
        mockFileModelFindById.mockResolvedValue({ id: 'file-123', chunkTaskId: null });
        mockAsyncTaskCreate.mockResolvedValue('task-chunk-001');
        mockParseFileToChunks.mockResolvedValue(undefined);

        await service.asyncParseFileToChunks('file-123');

        expect(mockFileModelUpdate).toHaveBeenCalledWith('file-123', {
          chunkTaskId: 'task-chunk-001',
        });
      });

      it('should update document with chunkTaskId for docs_ files', async () => {
        mockDocumentModelFindById.mockResolvedValue({ id: 'docs_456', chunkTaskId: null });
        mockAsyncTaskCreate.mockResolvedValue('task-chunk-002');
        mockParseFileToChunks.mockResolvedValue(undefined);

        await service.asyncParseFileToChunks('docs_456');

        expect(mockDocumentModelUpdate).toHaveBeenCalledWith('docs_456', {
          chunkTaskId: 'task-chunk-002',
        });
      });

      it('should return the created asyncTaskId', async () => {
        mockFileModelFindById.mockResolvedValue({ id: 'file-123', chunkTaskId: null });
        mockAsyncTaskCreate.mockResolvedValue('task-chunk-xyz');
        mockParseFileToChunks.mockResolvedValue(undefined);

        const result = await service.asyncParseFileToChunks('file-123');

        expect(result).toBe('task-chunk-xyz');
      });
    });

    describe('fire-and-forget behavior', () => {
      it('should return taskId without waiting for parseFileToChunks to complete', async () => {
        mockFileModelFindById.mockResolvedValue({ id: 'file-123', chunkTaskId: null });
        mockAsyncTaskCreate.mockResolvedValue('task-chunk-001');

        // A slow promise that never resolves during the test
        let resolveSlowPromise!: () => void;
        const slowPromise = new Promise<void>((resolve) => {
          resolveSlowPromise = resolve;
        });
        mockParseFileToChunks.mockReturnValue(slowPromise);

        // Should return without waiting for the parse task
        const result = await service.asyncParseFileToChunks('file-123');
        expect(result).toBe('task-chunk-001');

        // Clean up: resolve the hanging promise
        resolveSlowPromise();
        await slowPromise;
      });

      it('should update task with error status when parse call fails asynchronously', async () => {
        mockFileModelFindById.mockResolvedValue({ id: 'file-123', chunkTaskId: null });
        mockAsyncTaskCreate.mockResolvedValue('task-chunk-001');
        mockAsyncTaskUpdate.mockResolvedValue(undefined);

        let rejectParsePromise!: (err: Error) => void;
        const failingPromise = new Promise<void>((_, reject) => {
          rejectParsePromise = reject;
        });
        mockParseFileToChunks.mockReturnValue(failingPromise);

        // The function itself should resolve successfully (fire-and-forget)
        const result = await service.asyncParseFileToChunks('file-123');
        expect(result).toBe('task-chunk-001');

        // Trigger the async failure
        rejectParsePromise(new Error('Parse service unavailable'));

        // Allow the promise rejection handler to execute
        await new Promise((resolve) => setTimeout(resolve, 10));

        expect(mockAsyncTaskUpdate).toHaveBeenCalledWith(
          'task-chunk-001',
          expect.objectContaining({
            status: AsyncTaskStatus.Error,
            error: expect.objectContaining({
              name: AsyncTaskErrorType.TaskTriggerError,
            }),
          }),
        );
      });
    });
  });
});
