import { KnowledgeBaseItem } from '@lobechat/types';
import { and, desc, eq, inArray } from 'drizzle-orm';

import { NewKnowledgeBase, documents, knowledgeBaseFiles, knowledgeBases } from '../schemas';
import { LobeChatDatabase } from '../type';

// Helper to check if an ID is a document ID
const isDocumentId = (id: string) => id.startsWith('docs_');

export class KnowledgeBaseModel {
  private userId: string;
  private db: LobeChatDatabase;

  constructor(db: LobeChatDatabase, userId: string) {
    this.userId = userId;
    this.db = db;
  }

  // create

  create = async (params: Omit<NewKnowledgeBase, 'userId'>) => {
    const [result] = await this.db
      .insert(knowledgeBases)
      .values({ ...params, userId: this.userId })
      .returning();

    return result;
  };

  addFilesToKnowledgeBase = async (id: string, ids: string[]) => {
    // Separate files and documents
    const fileIds = ids.filter((itemId) => !isDocumentId(itemId));
    const documentIds = ids.filter((itemId) => isDocumentId(itemId));

    const results: any[] = [];

    // Add files to knowledge_base_files table
    if (fileIds.length > 0) {
      const fileResults = await this.db
        .insert(knowledgeBaseFiles)
        .values(fileIds.map((fileId) => ({ fileId, knowledgeBaseId: id, userId: this.userId })))
        .returning();
      results.push(...fileResults);
    }

    // Update documents' knowledgeBaseId directly
    if (documentIds.length > 0) {
      await this.db
        .update(documents)
        .set({ knowledgeBaseId: id, updatedAt: new Date() })
        .where(and(eq(documents.userId, this.userId), inArray(documents.id, documentIds)));
    }

    return results;
  };

  // delete
  delete = async (id: string) => {
    return this.db
      .delete(knowledgeBases)
      .where(and(eq(knowledgeBases.id, id), eq(knowledgeBases.userId, this.userId)));
  };

  deleteAll = async () => {
    return this.db.delete(knowledgeBases).where(eq(knowledgeBases.userId, this.userId));
  };

  removeFilesFromKnowledgeBase = async (knowledgeBaseId: string, ids: string[]) => {
    // Separate files and documents
    const fileIds = ids.filter((itemId) => !isDocumentId(itemId));
    const documentIds = ids.filter((itemId) => isDocumentId(itemId));

    // Remove files from knowledge_base_files table
    if (fileIds.length > 0) {
      await this.db.delete(knowledgeBaseFiles).where(
        and(
          eq(knowledgeBaseFiles.knowledgeBaseId, knowledgeBaseId),
          inArray(knowledgeBaseFiles.fileId, fileIds),
        ),
      );
    }

    // Set documents' knowledgeBaseId to null
    if (documentIds.length > 0) {
      await this.db
        .update(documents)
        .set({ knowledgeBaseId: null, updatedAt: new Date() })
        .where(
          and(
            eq(documents.userId, this.userId),
            eq(documents.knowledgeBaseId, knowledgeBaseId),
            inArray(documents.id, documentIds),
          ),
        );
    }
  };
  // query
  query = async () => {
    const data = await this.db
      .select({
        avatar: knowledgeBases.avatar,
        createdAt: knowledgeBases.createdAt,
        description: knowledgeBases.description,
        id: knowledgeBases.id,
        isPublic: knowledgeBases.isPublic,
        name: knowledgeBases.name,
        settings: knowledgeBases.settings,
        type: knowledgeBases.type,
        updatedAt: knowledgeBases.updatedAt,
      })
      .from(knowledgeBases)
      .where(eq(knowledgeBases.userId, this.userId))
      .orderBy(desc(knowledgeBases.updatedAt));

    return data as KnowledgeBaseItem[];
  };

  findById = async (id: string) => {
    return this.db.query.knowledgeBases.findFirst({
      where: and(eq(knowledgeBases.id, id), eq(knowledgeBases.userId, this.userId)),
    });
  };

  // update
  update = async (id: string, value: Partial<KnowledgeBaseItem>) =>
    this.db
      .update(knowledgeBases)
      .set({ ...value, updatedAt: new Date() })
      .where(and(eq(knowledgeBases.id, id), eq(knowledgeBases.userId, this.userId)));

  static findById = async (db: LobeChatDatabase, id: string) =>
    db.query.knowledgeBases.findFirst({
      where: eq(knowledgeBases.id, id),
    });
}
