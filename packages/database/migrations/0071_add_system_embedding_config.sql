-- System Embedding Configuration Tables
-- These tables store global embedding model configuration for the entire system

CREATE TABLE IF NOT EXISTS "system_embedding_config" (
	"id" varchar(50) PRIMARY KEY DEFAULT 'default' NOT NULL,
	"provider_id" varchar(64) NOT NULL,
	"model_id" varchar(200) NOT NULL,
	"display_name" varchar(200),
	"api_key" text,
	"base_url" varchar(500),
	"models_sync_url" varchar(500),
	"input_price" numeric(15, 4),
	"currency" varchar(10) DEFAULT 'USD',
	"context_tokens" integer,
	"dimensions" integer DEFAULT 1024,
	"last_synced_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "system_embedding_models" (
	"id" serial PRIMARY KEY NOT NULL,
	"model_id" varchar(200) UNIQUE NOT NULL,
	"display_name" varchar(200) NOT NULL,
	"provider_id" varchar(64) NOT NULL,
	"dimensions" integer DEFAULT 1024,
	"context_tokens" integer,
	"input_price" numeric(15, 4),
	"currency" varchar(10) DEFAULT 'USD',
	"synced_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "embedding_usage_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar(64) NOT NULL,
	"model_id" varchar(200) NOT NULL,
	"provider_id" varchar(64) NOT NULL,
	"input_tokens" integer NOT NULL,
	"total_tokens" integer NOT NULL,
	"cost_price" numeric(15, 8),
	"user_price" numeric(15, 8),
	"operation_type" varchar(50),
	"file_id" text,
	"chunk_count" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_embedding_usage_user" ON "embedding_usage_logs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_embedding_usage_created" ON "embedding_usage_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_system_embedding_models_provider" ON "system_embedding_models" USING btree ("provider_id");
