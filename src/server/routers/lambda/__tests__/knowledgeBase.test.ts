import { beforeEach, describe, expect, it, vi } from 'vitest';

import { KnowledgeBaseModel } from '@/database/models/knowledgeBase';
import { KnowledgeBaseItem } from '@/types/knowledgeBase';

import { knowledgeBaseRouter } from '../knowledgeBase';

vi.mock('@/database/models/knowledgeBase');

describe('knowledgeBaseRouter', () => {
  const mockUserId = 'test-user-id';
  const mockKnowledgeBaseId = 'kb-123';
  const mockFileIds = ['file-1', 'file-2', 'file-3'];

  const mockKnowledgeBase: KnowledgeBaseItem = {
    id: mockKnowledgeBaseId,
    name: 'Test Knowledge Base',
    avatar: 'https://example.com/avatar.png',
    description: 'Test description',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    isPublic: false,
    settings: {},
    type: 'knowledge',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  const createMockContext = () => ({
    userId: mockUserId,
    serverDB: {} as any,
  });

  describe('createKnowledgeBase', () => {
    it('should create a new knowledge base and return its id', async () => {
      const mockCreate = vi.fn().mockResolvedValue({ id: mockKnowledgeBaseId });
      vi.mocked(KnowledgeBaseModel).prototype.create = mockCreate;

      const caller = knowledgeBaseRouter.createCaller(createMockContext());
      const result = await caller.createKnowledgeBase({
        name: 'Test Knowledge Base',
        avatar: 'https://example.com/avatar.png',
        description: 'Test description',
      });

      expect(result).toBe(mockKnowledgeBaseId);
      expect(mockCreate).toHaveBeenCalledWith({
        name: 'Test Knowledge Base',
        avatar: 'https://example.com/avatar.png',
        description: 'Test description',
      });
    });

    it('should create knowledge base with minimal required fields', async () => {
      const mockCreate = vi.fn().mockResolvedValue({ id: mockKnowledgeBaseId });
      vi.mocked(KnowledgeBaseModel).prototype.create = mockCreate;

      const caller = knowledgeBaseRouter.createCaller(createMockContext());
      const result = await caller.createKnowledgeBase({
        name: 'Minimal KB',
      });

      expect(result).toBe(mockKnowledgeBaseId);
      expect(mockCreate).toHaveBeenCalledWith({
        name: 'Minimal KB',
        avatar: undefined,
        description: undefined,
      });
    });
  });

  describe('getKnowledgeBases', () => {
    it('should return list of knowledge bases', async () => {
      const mockList = [mockKnowledgeBase];
      const mockQuery = vi.fn().mockResolvedValue(mockList);
      vi.mocked(KnowledgeBaseModel).prototype.query = mockQuery;

      const caller = knowledgeBaseRouter.createCaller(createMockContext());
      const result = await caller.getKnowledgeBases();

      expect(result).toEqual(mockList);
      expect(mockQuery).toHaveBeenCalled();
    });

    it('should return empty array when no knowledge bases exist', async () => {
      const mockQuery = vi.fn().mockResolvedValue([]);
      vi.mocked(KnowledgeBaseModel).prototype.query = mockQuery;

      const caller = knowledgeBaseRouter.createCaller(createMockContext());
      const result = await caller.getKnowledgeBases();

      expect(result).toEqual([]);
      expect(mockQuery).toHaveBeenCalled();
    });
  });

  describe('getKnowledgeBaseById', () => {
    it('should get knowledge base by id', async () => {
      const mockFindById = vi.fn().mockResolvedValue(mockKnowledgeBase);
      vi.mocked(KnowledgeBaseModel).prototype.findById = mockFindById;

      const caller = knowledgeBaseRouter.createCaller(createMockContext());
      const result = await caller.getKnowledgeBaseById({ id: mockKnowledgeBaseId });

      expect(result).toEqual(mockKnowledgeBase);
      expect(mockFindById).toHaveBeenCalledWith(mockKnowledgeBaseId);
    });

    it('should return undefined when knowledge base not found', async () => {
      const mockFindById = vi.fn().mockResolvedValue(undefined);
      vi.mocked(KnowledgeBaseModel).prototype.findById = mockFindById;

      const caller = knowledgeBaseRouter.createCaller(createMockContext());
      const result = await caller.getKnowledgeBaseById({ id: 'non-existent' });

      expect(result).toBeUndefined();
      expect(mockFindById).toHaveBeenCalledWith('non-existent');
    });
  });

  describe('updateKnowledgeBase', () => {
    it('should update knowledge base', async () => {
      const mockUpdate = vi.fn().mockResolvedValue(undefined);
      vi.mocked(KnowledgeBaseModel).prototype.update = mockUpdate;

      const caller = knowledgeBaseRouter.createCaller(createMockContext());
      await caller.updateKnowledgeBase({
        id: mockKnowledgeBaseId,
        value: { name: 'Updated Name', description: 'Updated description' },
      });

      expect(mockUpdate).toHaveBeenCalledWith(mockKnowledgeBaseId, {
        name: 'Updated Name',
        description: 'Updated description',
      });
    });

    it('should update partial fields', async () => {
      const mockUpdate = vi.fn().mockResolvedValue(undefined);
      vi.mocked(KnowledgeBaseModel).prototype.update = mockUpdate;

      const caller = knowledgeBaseRouter.createCaller(createMockContext());
      await caller.updateKnowledgeBase({
        id: mockKnowledgeBaseId,
        value: { avatar: 'new-avatar.png' },
      });

      expect(mockUpdate).toHaveBeenCalledWith(mockKnowledgeBaseId, {
        avatar: 'new-avatar.png',
      });
    });
  });

  describe('addFilesToKnowledgeBase', () => {
    it('should add files to knowledge base', async () => {
      const mockAddFiles = vi.fn().mockResolvedValue([]);
      vi.mocked(KnowledgeBaseModel).prototype.addFilesToKnowledgeBase = mockAddFiles;

      const caller = knowledgeBaseRouter.createCaller(createMockContext());
      await caller.addFilesToKnowledgeBase({
        knowledgeBaseId: mockKnowledgeBaseId,
        ids: mockFileIds,
      });

      expect(mockAddFiles).toHaveBeenCalledWith(mockKnowledgeBaseId, mockFileIds);
    });

    it('should handle adding single file', async () => {
      const mockAddFiles = vi.fn().mockResolvedValue([]);
      vi.mocked(KnowledgeBaseModel).prototype.addFilesToKnowledgeBase = mockAddFiles;

      const caller = knowledgeBaseRouter.createCaller(createMockContext());
      await caller.addFilesToKnowledgeBase({
        knowledgeBaseId: mockKnowledgeBaseId,
        ids: ['single-file'],
      });

      expect(mockAddFiles).toHaveBeenCalledWith(mockKnowledgeBaseId, ['single-file']);
    });

    it('should handle empty file array', async () => {
      const mockAddFiles = vi.fn().mockResolvedValue([]);
      vi.mocked(KnowledgeBaseModel).prototype.addFilesToKnowledgeBase = mockAddFiles;

      const caller = knowledgeBaseRouter.createCaller(createMockContext());
      await caller.addFilesToKnowledgeBase({
        knowledgeBaseId: mockKnowledgeBaseId,
        ids: [],
      });

      expect(mockAddFiles).toHaveBeenCalledWith(mockKnowledgeBaseId, []);
    });
  });

  describe('removeFilesFromKnowledgeBase', () => {
    it('should remove files from knowledge base', async () => {
      const mockRemoveFiles = vi.fn().mockResolvedValue(undefined);
      vi.mocked(KnowledgeBaseModel).prototype.removeFilesFromKnowledgeBase = mockRemoveFiles;

      const caller = knowledgeBaseRouter.createCaller(createMockContext());
      await caller.removeFilesFromKnowledgeBase({
        knowledgeBaseId: mockKnowledgeBaseId,
        ids: mockFileIds,
      });

      expect(mockRemoveFiles).toHaveBeenCalledWith(mockKnowledgeBaseId, mockFileIds);
    });

    it('should handle removing single file', async () => {
      const mockRemoveFiles = vi.fn().mockResolvedValue(undefined);
      vi.mocked(KnowledgeBaseModel).prototype.removeFilesFromKnowledgeBase = mockRemoveFiles;

      const caller = knowledgeBaseRouter.createCaller(createMockContext());
      await caller.removeFilesFromKnowledgeBase({
        knowledgeBaseId: mockKnowledgeBaseId,
        ids: ['file-to-remove'],
      });

      expect(mockRemoveFiles).toHaveBeenCalledWith(mockKnowledgeBaseId, ['file-to-remove']);
    });
  });

  describe('removeKnowledgeBase', () => {
    it('should remove knowledge base', async () => {
      const mockDelete = vi.fn().mockResolvedValue(undefined);
      vi.mocked(KnowledgeBaseModel).prototype.delete = mockDelete;

      const caller = knowledgeBaseRouter.createCaller(createMockContext());
      await caller.removeKnowledgeBase({ id: mockKnowledgeBaseId });

      expect(mockDelete).toHaveBeenCalledWith(mockKnowledgeBaseId);
    });

    it('should handle removeFiles option (note: currently ignored by model)', async () => {
      const mockDelete = vi.fn().mockResolvedValue(undefined);
      vi.mocked(KnowledgeBaseModel).prototype.delete = mockDelete;

      const caller = knowledgeBaseRouter.createCaller(createMockContext());
      await caller.removeKnowledgeBase({
        id: mockKnowledgeBaseId,
        removeFiles: true,
      });

      expect(mockDelete).toHaveBeenCalledWith(mockKnowledgeBaseId);
    });
  });

  describe('removeAllKnowledgeBases', () => {
    it('should remove all knowledge bases', async () => {
      const mockDeleteAll = vi.fn().mockResolvedValue(undefined);
      vi.mocked(KnowledgeBaseModel).prototype.deleteAll = mockDeleteAll;

      const caller = knowledgeBaseRouter.createCaller(createMockContext());
      await caller.removeAllKnowledgeBases();

      expect(mockDeleteAll).toHaveBeenCalled();
    });
  });
});
