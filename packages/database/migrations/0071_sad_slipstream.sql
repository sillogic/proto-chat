CREATE TABLE "protochat_model_pricing" (
	"id" serial PRIMARY KEY NOT NULL,
	"model_id" varchar(200) NOT NULL,
	"cost_input_price" numeric(15, 4) NOT NULL,
	"cost_output_price" numeric(15, 4) NOT NULL,
	"user_input_price" numeric(15, 4) NOT NULL,
	"user_output_price" numeric(15, 4) NOT NULL,
	"currency" varchar(10) DEFAULT 'USD',
	"price_source" varchar(50),
	"is_free" boolean DEFAULT false,
	"synced_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "protochat_pricing_model_id_unique" UNIQUE("model_id")
);
--> statement-breakpoint
CREATE TABLE "protochat_models" (
	"id" varchar(200) PRIMARY KEY NOT NULL,
	"original_id" varchar(200) NOT NULL,
	"original_provider" varchar(64) NOT NULL,
	"display_name" varchar(200) NOT NULL,
	"type" varchar(20) NOT NULL,
	"enabled" boolean DEFAULT false NOT NULL,
	"capabilities" jsonb,
	"context_tokens" integer,
	"max_output" integer,
	"parameters" jsonb,
	"settings" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "protochat_models_original_id_unique" UNIQUE("original_id")
);
--> statement-breakpoint
CREATE TABLE "protochat_providers" (
	"id" varchar(64) PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL,
	"type" varchar(50) NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"priority" integer DEFAULT 0,
	"api_key" text,
	"base_url" varchar(500),
	"api_endpoint" varchar(500),
	"pricing_sync_strategy" varchar(50),
	"pricing_api_url" varchar(500),
	"settings" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "protochat_settings" (
	"id" varchar(50) PRIMARY KEY NOT NULL,
	"value" numeric(10, 4) NOT NULL,
	"description" varchar(500),
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "protochat_usage_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar(64) NOT NULL,
	"model_id" varchar(200) NOT NULL,
	"original_provider" varchar(64) NOT NULL,
	"input_tokens" integer NOT NULL,
	"output_tokens" integer NOT NULL,
	"total_tokens" integer NOT NULL,
	"cost_price" numeric(15, 4),
	"user_price" numeric(15, 4),
	"request_id" varchar(100),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "system_default_model_config" (
	"id" varchar(50) PRIMARY KEY DEFAULT 'default' NOT NULL,
	"model_id" varchar(200),
	"display_name" varchar(200),
	"provider_id" varchar(64),
	"provider_name" varchar(200),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "embedding_usage_logs" (
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
CREATE TABLE "system_embedding_config" (
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
CREATE TABLE "system_embedding_models" (
	"id" serial PRIMARY KEY NOT NULL,
	"model_id" varchar(200) NOT NULL,
	"display_name" varchar(200) NOT NULL,
	"provider_id" varchar(64) NOT NULL,
	"dimensions" integer DEFAULT 1024,
	"context_tokens" integer,
	"input_price" numeric(15, 4),
	"currency" varchar(10) DEFAULT 'USD',
	"synced_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "system_embedding_models_model_id_unique" UNIQUE("model_id")
);
--> statement-breakpoint
DROP INDEX "model_provider_idx";--> statement-breakpoint
ALTER TABLE "ai_providers" ADD COLUMN "pricing_sync_strategy" varchar(50);--> statement-breakpoint
ALTER TABLE "ai_providers" ADD COLUMN "pricing_api_url" varchar(500);--> statement-breakpoint
ALTER TABLE "model_pricings" ADD COLUMN "sub_provider" text;--> statement-breakpoint
ALTER TABLE "model_pricings" ADD COLUMN "user_input_price" numeric(15, 6) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "model_pricings" ADD COLUMN "user_output_price" numeric(15, 6) DEFAULT '0' NOT NULL;--> statement-breakpoint
CREATE INDEX "protochat_pricing_model_id_idx" ON "protochat_model_pricing" USING btree ("model_id");--> statement-breakpoint
CREATE INDEX "protochat_pricing_synced_at_idx" ON "protochat_model_pricing" USING btree ("synced_at");--> statement-breakpoint
CREATE INDEX "protochat_models_original_provider_idx" ON "protochat_models" USING btree ("original_provider");--> statement-breakpoint
CREATE INDEX "protochat_models_enabled_idx" ON "protochat_models" USING btree ("enabled");--> statement-breakpoint
CREATE INDEX "protochat_models_type_idx" ON "protochat_models" USING btree ("type");--> statement-breakpoint
CREATE INDEX "protochat_providers_enabled_idx" ON "protochat_providers" USING btree ("enabled");--> statement-breakpoint
CREATE INDEX "protochat_providers_priority_idx" ON "protochat_providers" USING btree ("priority");--> statement-breakpoint
CREATE INDEX "protochat_usage_user_id_idx" ON "protochat_usage_logs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "protochat_usage_model_id_idx" ON "protochat_usage_logs" USING btree ("model_id");--> statement-breakpoint
CREATE INDEX "protochat_usage_created_at_idx" ON "protochat_usage_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "protochat_usage_original_provider_idx" ON "protochat_usage_logs" USING btree ("original_provider");--> statement-breakpoint
CREATE INDEX "idx_embedding_usage_user" ON "embedding_usage_logs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_embedding_usage_created" ON "embedding_usage_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_system_embedding_models_provider" ON "system_embedding_models" USING btree ("provider_id");--> statement-breakpoint
CREATE INDEX "ai_providers_pricing_sync_strategy_idx" ON "ai_providers" USING btree ("pricing_sync_strategy");--> statement-breakpoint
CREATE UNIQUE INDEX "model_provider_subprovider_idx" ON "model_pricings" USING btree ("model","provider","sub_provider");