-- Migration: Revert user memory vector columns from 4096 back to 1024 dimensions
-- Reason: Qwen3-Embedding-8B supports MRL truncation via dimensions=1024 parameter,
--         same as the knowledge base. 1024 dims allows HNSW indexes (pgvector limit: 2000).
--         The 4096 migration was unnecessary.

-- user_memories
ALTER TABLE "user_memories" DROP COLUMN IF EXISTS "summary_vector_1024";
ALTER TABLE "user_memories" DROP COLUMN IF EXISTS "details_vector_1024";
ALTER TABLE "user_memories" ADD COLUMN "summary_vector_1024" vector(1024);
ALTER TABLE "user_memories" ADD COLUMN "details_vector_1024" vector(1024);
CREATE INDEX "user_memories_summary_vector_1024_index" ON "user_memories" USING hnsw ("summary_vector_1024" vector_cosine_ops);
CREATE INDEX "user_memories_details_vector_1024_index" ON "user_memories" USING hnsw ("details_vector_1024" vector_cosine_ops);

-- user_memories_contexts
ALTER TABLE "user_memories_contexts" DROP COLUMN IF EXISTS "description_vector";
ALTER TABLE "user_memories_contexts" ADD COLUMN "description_vector" vector(1024);
CREATE INDEX "user_memories_contexts_description_vector_index" ON "user_memories_contexts" USING hnsw ("description_vector" vector_cosine_ops);

-- user_memories_preferences
ALTER TABLE "user_memories_preferences" DROP COLUMN IF EXISTS "conclusion_directives_vector";
ALTER TABLE "user_memories_preferences" ADD COLUMN "conclusion_directives_vector" vector(1024);
CREATE INDEX "user_memories_preferences_conclusion_directives_vector_index" ON "user_memories_preferences" USING hnsw ("conclusion_directives_vector" vector_cosine_ops);

-- user_memories_activities
ALTER TABLE "user_memories_activities" DROP COLUMN IF EXISTS "narrative_vector";
ALTER TABLE "user_memories_activities" DROP COLUMN IF EXISTS "feedback_vector";
ALTER TABLE "user_memories_activities" ADD COLUMN "narrative_vector" vector(1024);
ALTER TABLE "user_memories_activities" ADD COLUMN "feedback_vector" vector(1024);
CREATE INDEX "user_memories_activities_narrative_vector_index" ON "user_memories_activities" USING hnsw ("narrative_vector" vector_cosine_ops);
CREATE INDEX "user_memories_activities_feedback_vector_index" ON "user_memories_activities" USING hnsw ("feedback_vector" vector_cosine_ops);

-- user_memories_identities
ALTER TABLE "user_memories_identities" DROP COLUMN IF EXISTS "description_vector";
ALTER TABLE "user_memories_identities" ADD COLUMN "description_vector" vector(1024);
CREATE INDEX "user_memories_identities_description_vector_index" ON "user_memories_identities" USING hnsw ("description_vector" vector_cosine_ops);

-- user_memories_experiences
ALTER TABLE "user_memories_experiences" DROP COLUMN IF EXISTS "situation_vector";
ALTER TABLE "user_memories_experiences" DROP COLUMN IF EXISTS "action_vector";
ALTER TABLE "user_memories_experiences" DROP COLUMN IF EXISTS "key_learning_vector";
ALTER TABLE "user_memories_experiences" ADD COLUMN "situation_vector" vector(1024);
ALTER TABLE "user_memories_experiences" ADD COLUMN "action_vector" vector(1024);
ALTER TABLE "user_memories_experiences" ADD COLUMN "key_learning_vector" vector(1024);
CREATE INDEX "user_memories_experiences_situation_vector_index" ON "user_memories_experiences" USING hnsw ("situation_vector" vector_cosine_ops);
CREATE INDEX "user_memories_experiences_action_vector_index" ON "user_memories_experiences" USING hnsw ("action_vector" vector_cosine_ops);
CREATE INDEX "user_memories_experiences_key_learning_vector_index" ON "user_memories_experiences" USING hnsw ("key_learning_vector" vector_cosine_ops);
