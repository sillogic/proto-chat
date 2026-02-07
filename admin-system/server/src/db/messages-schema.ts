import {
  boolean,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

/**
 * Messages 表
 * 来自主项目的 messages 表定义
 */
export const messages = pgTable(
  'messages',
  {
    id: text('id')
      .$defaultFn(() => sql`generate_message_id()`)
      .primaryKey(),
    role: varchar('role', { length: 255 }).notNull(),
    content: text('content'),
    editorData: jsonb('editor_data'),
    summary: text('summary'),
    metadata: jsonb('metadata'),

    // Model info
    model: text('model'),
    provider: text('provider'),

    favorite: boolean('favorite').default(false),
    error: jsonb('error'),

    tools: jsonb('tools'),

    traceId: text('trace_id'),
    observationId: text('observation_id'),

    clientId: text('client_id'),

    // Foreign keys
    userId: text('user_id').notNull(),
    sessionId: text('session_id'),
    topicId: text('topic_id'),
    threadId: text('thread_id'),
    parentId: text('parent_id'),
    quotaId: text('quota_id'),

    agentId: text('agent_id'),
    groupId: text('group_id'),
    targetId: text('target_id'),

    // Multi-models parallel
    messageGroupId: varchar('message_group_id'),

    createdAt: timestamp('created_at').defaultNow().notNull(),
    updatedAt: timestamp('updated_at').defaultNow().notNull(),
  },
  (table) => [
    index('messages_created_at_idx').on(table.createdAt),
    index('messages_user_id_idx').on(table.userId),
    index('messages_topic_id_idx').on(table.topicId),
    index('messages_session_id_idx').on(table.sessionId),
  ],
);

export type Message = typeof messages.$inferSelect;
