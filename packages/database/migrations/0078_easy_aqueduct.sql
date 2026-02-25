CREATE TYPE "public"."transaction_type" AS ENUM('DEPOSIT', 'CONSUMPTION', 'REFUND', 'ADJUSTMENT', 'SUBSCRIPTION_GRANT');--> statement-breakpoint
CREATE TYPE "public"."plan_interval" AS ENUM('month', 'year');--> statement-breakpoint
CREATE TYPE "public"."plan_type" AS ENUM('individual', 'team');--> statement-breakpoint
CREATE TABLE "user_balances" (
	"balance" numeric(15, 4) DEFAULT '0' NOT NULL,
	"is_unlimited" boolean DEFAULT false,
	"total_purchased" numeric(15, 4) DEFAULT '0' NOT NULL,
	"user_id" text PRIMARY KEY NOT NULL,
	"accessed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_transactions" (
	"amount" numeric(15, 4) NOT NULL,
	"balance_after" numeric(15, 4),
	"category" text,
	"description" text,
	"id" text PRIMARY KEY NOT NULL,
	"metadata" jsonb,
	"ref_id" text,
	"type" "transaction_type" NOT NULL,
	"user_id" text NOT NULL,
	"accessed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payment_notifications" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_no" varchar(64) NOT NULL,
	"pay_channel" varchar(20) NOT NULL,
	"raw_data" text NOT NULL,
	"status" varchar(20) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "payment_orders" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_no" varchar(64) NOT NULL,
	"user_id" text NOT NULL,
	"plan_id" text NOT NULL,
	"plan_interval" varchar(10) NOT NULL,
	"amount" integer NOT NULL,
	"plan_value" integer,
	"currency" varchar(10) DEFAULT 'CNY' NOT NULL,
	"subscription_type" varchar(20) DEFAULT 'recurring' NOT NULL,
	"duration_months" integer,
	"pay_channel" varchar(20) NOT NULL,
	"channel_order_no" varchar(128),
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"channel_data" jsonb,
	"expired_at" timestamp NOT NULL,
	"paid_at" timestamp,
	"closed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "payment_orders_order_no_unique" UNIQUE("order_no")
);
--> statement-breakpoint
CREATE TABLE "protochat_model_pricing" (
	"id" serial PRIMARY KEY NOT NULL,
	"model_id" varchar(200) NOT NULL,
	"cost_input_price" numeric(15, 4) NOT NULL,
	"cost_output_price" numeric(15, 4) NOT NULL,
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
	"alias" varchar(10),
	"api_key" text,
	"base_url" varchar(500),
	"api_endpoint" varchar(500),
	"pricing_sync_strategy" varchar(50),
	"pricing_api_url" varchar(500),
	"settings" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "protochat_providers_alias_unique" UNIQUE("alias")
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
CREATE TABLE "model_pricings" (
	"id" text PRIMARY KEY NOT NULL,
	"input_price" numeric(15, 6) DEFAULT '0' NOT NULL,
	"model" text NOT NULL,
	"output_price" numeric(15, 6) DEFAULT '0' NOT NULL,
	"per_request_price" numeric(15, 6) DEFAULT '0' NOT NULL,
	"provider" text NOT NULL,
	"sub_provider" text,
	"user_input_price" numeric(15, 6) DEFAULT '0' NOT NULL,
	"user_output_price" numeric(15, 6) DEFAULT '0' NOT NULL,
	"memo" text,
	"accessed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subscription_plans" (
	"credits" numeric(12, 2) DEFAULT '0' NOT NULL,
	"currency" text DEFAULT 'CNY' NOT NULL,
	"display_order" integer DEFAULT 0 NOT NULL,
	"features" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"is_active" boolean DEFAULT true,
	"is_popular" boolean DEFAULT false NOT NULL,
	"monthly_price" integer NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"storage_limit" integer DEFAULT 1024 NOT NULL,
	"type" "plan_type" DEFAULT 'individual' NOT NULL,
	"vector_limit" integer DEFAULT 0 NOT NULL,
	"yearly_price" integer,
	"accessed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "subscription_plans_slug_unique" UNIQUE("slug")
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
CREATE TABLE "user_agreements" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"agreement_no" varchar(64),
	"external_agreement_no" varchar(64) NOT NULL,
	"sign_scene" varchar(64) NOT NULL,
	"sign_channel" varchar(20) NOT NULL,
	"plan_id" text NOT NULL,
	"plan_slug" varchar(32) NOT NULL,
	"plan_name" varchar(64) NOT NULL,
	"billing_interval" varchar(10) NOT NULL,
	"single_amount" integer NOT NULL,
	"period_type" varchar(10) NOT NULL,
	"period" integer NOT NULL,
	"next_deduct_date" date,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"sign_time" timestamp,
	"unsign_time" timestamp,
	"unsign_reason" varchar(32),
	"last_deduct_status" varchar(20),
	"last_deduct_time" timestamp,
	"last_deduct_order_no" varchar(64),
	"deduct_fail_count" integer DEFAULT 0,
	"deduct_fail_reason" text,
	"alipay_user_id" varchar(64),
	"alipay_open_id" varchar(128),
	"alipay_logon_id" varchar(64),
	"first_order_no" varchar(64),
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_agreements_external_agreement_no_unique" UNIQUE("external_agreement_no")
);
--> statement-breakpoint
CREATE TABLE "user_extensions" (
	"accessed_at" timestamp DEFAULT now(),
	"admin_notes" text,
	"billing_interval" text,
	"subscription_type" text DEFAULT 'recurring',
	"duration_months" integer,
	"clerk_created_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"current_plan" text DEFAULT 'free',
	"features" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"interests" text[],
	"is_onboarded" boolean DEFAULT false,
	"is_suspended" boolean DEFAULT false,
	"last_usage_reset" timestamp DEFAULT now(),
	"next_credit_grant_at" timestamp,
	"next_plan_id" text,
	"current_agreement_id" text,
	"auto_renew" boolean DEFAULT false,
	"downgrade_reason" text,
	"previous_plan_slug" text,
	"previous_plan_name" text,
	"downgrade_at" timestamp,
	"onboarding" jsonb,
	"plan_expires_at" timestamp,
	"plan_id" text,
	"preference" jsonb,
	"suspend_reason" text,
	"suspended_at" timestamp,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"user_id" text NOT NULL,
	CONSTRAINT "user_extensions_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "user_subscription_history" (
	"auto_renew" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"ended_at" timestamp,
	"features" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"payment_method" text,
	"plan_id" text,
	"plan_name" text NOT NULL,
	"plan_type" text NOT NULL,
	"price" integer DEFAULT 0,
	"billing_interval" text,
	"subscription_type" text DEFAULT 'recurring',
	"duration_months" integer,
	"order_no" varchar(64),
	"slug" text,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"transaction_id" text,
	"user_id" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "chunk_task_id" uuid;--> statement-breakpoint
ALTER TABLE "documents" ADD COLUMN "embedding_task_id" uuid;--> statement-breakpoint
ALTER TABLE "user_balances" ADD CONSTRAINT "user_balances_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_transactions" ADD CONSTRAINT "user_transactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "user_transactions_user_id_idx" ON "user_transactions" USING btree ("user_id");--> statement-breakpoint
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
CREATE UNIQUE INDEX "model_provider_subprovider_idx" ON "model_pricings" USING btree ("model","provider","sub_provider");--> statement-breakpoint
CREATE INDEX "idx_embedding_usage_user" ON "embedding_usage_logs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_embedding_usage_created" ON "embedding_usage_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_system_embedding_models_provider" ON "system_embedding_models" USING btree ("provider_id");--> statement-breakpoint
CREATE UNIQUE INDEX "user_extension_user_id_idx" ON "user_extensions" USING btree ("user_id");--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_chunk_task_id_async_tasks_id_fk" FOREIGN KEY ("chunk_task_id") REFERENCES "public"."async_tasks"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "documents" ADD CONSTRAINT "documents_embedding_task_id_async_tasks_id_fk" FOREIGN KEY ("embedding_task_id") REFERENCES "public"."async_tasks"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "documents_chunk_task_id_idx" ON "documents" USING btree ("chunk_task_id");--> statement-breakpoint
CREATE INDEX "documents_embedding_task_id_idx" ON "documents" USING btree ("embedding_task_id");