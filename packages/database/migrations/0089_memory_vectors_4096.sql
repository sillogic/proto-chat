-- Migration: Resize user memory vector columns from 1024 to 4096 dimensions
-- Reason: Qwen3-Embedding-8B natively outputs 4096-dimensional vectors.
-- Note: HNSW indexes are NOT created because pgvector HNSW index limit is 2000 dims.
--       Sequential scan is used instead (acceptable for typical user memory dataset sizes).
-- Existing vector data is cleared (incompatible with new dimension).

-- user_memories
DROP INDEX IF EXISTS "user_memories_summary_vector_1024_index";
DROP INDEX IF EXISTS "user_memories_details_vector_1024_index";
ALTER TABLE "user_memories" DROP COLUMN IF EXISTS "summary_vector_1024";
ALTER TABLE "user_memories" DROP COLUMN IF EXISTS "details_vector_1024";
ALTER TABLE "user_memories" ADD COLUMN "summary_vector_1024" vector(4096);
ALTER TABLE "user_memories" ADD COLUMN "details_vector_1024" vector(4096);

-- user_memories_contexts
DROP INDEX IF EXISTS "user_memories_contexts_description_vector_index";
ALTER TABLE "user_memories_contexts" DROP COLUMN IF EXISTS "description_vector";
ALTER TABLE "user_memories_contexts" ADD COLUMN "description_vector" vector(4096);

-- user_memories_preferences
DROP INDEX IF EXISTS "user_memories_preferences_conclusion_directives_vector_index";
ALTER TABLE "user_memories_preferences" DROP COLUMN IF EXISTS "conclusion_directives_vector";
ALTER TABLE "user_memories_preferences" ADD COLUMN "conclusion_directives_vector" vector(4096);

-- user_memories_activities
DROP INDEX IF EXISTS "user_memories_activities_narrative_vector_index";
DROP INDEX IF EXISTS "user_memories_activities_feedback_vector_index";
ALTER TABLE "user_memories_activities" DROP COLUMN IF EXISTS "narrative_vector";
ALTER TABLE "user_memories_activities" DROP COLUMN IF EXISTS "feedback_vector";
ALTER TABLE "user_memories_activities" ADD COLUMN "narrative_vector" vector(4096);
ALTER TABLE "user_memories_activities" ADD COLUMN "feedback_vector" vector(4096);

-- user_memories_identities
DROP INDEX IF EXISTS "user_memories_identities_description_vector_index";
ALTER TABLE "user_memories_identities" DROP COLUMN IF EXISTS "description_vector";
ALTER TABLE "user_memories_identities" ADD COLUMN "description_vector" vector(4096);

-- user_memories_experiences
DROP INDEX IF EXISTS "user_memories_experiences_situation_vector_index";
DROP INDEX IF EXISTS "user_memories_experiences_action_vector_index";
DROP INDEX IF EXISTS "user_memories_experiences_key_learning_vector_index";
ALTER TABLE "user_memories_experiences" DROP COLUMN IF EXISTS "situation_vector";
ALTER TABLE "user_memories_experiences" DROP COLUMN IF EXISTS "action_vector";
ALTER TABLE "user_memories_experiences" DROP COLUMN IF EXISTS "key_learning_vector";
ALTER TABLE "user_memories_experiences" ADD COLUMN "situation_vector" vector(4096);
ALTER TABLE "user_memories_experiences" ADD COLUMN "action_vector" vector(4096);
ALTER TABLE "user_memories_experiences" ADD COLUMN "key_learning_vector" vector(4096);
