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
CREATE TABLE "model_pricings" (
	"id" text PRIMARY KEY NOT NULL,
	"input_price" numeric(10, 6) DEFAULT '0',
	"model" text NOT NULL,
	"output_price" numeric(10, 6) DEFAULT '0',
	"per_request_price" numeric(10, 6) DEFAULT '0',
	"provider" text NOT NULL,
	"accessed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subscription_plans" (
	"credits" numeric(12, 2) DEFAULT '0' NOT NULL,
	"currency" text DEFAULT 'CNY' NOT NULL,
	"features" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"id" text PRIMARY KEY NOT NULL,
	"interval" "plan_interval" DEFAULT 'month' NOT NULL,
	"is_active" boolean DEFAULT true,
	"name" text NOT NULL,
	"price" integer NOT NULL,
	"slug" text NOT NULL,
	"storage_limit" integer DEFAULT 1024 NOT NULL,
	"type" "plan_type" DEFAULT 'individual' NOT NULL,
	"vector_limit" integer DEFAULT 0 NOT NULL,
	"accessed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "subscription_plans_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "user_extensions" (
	"accessed_at" timestamp DEFAULT now(),
	"clerk_created_at" timestamp,
	"admin_notes" text,
	"current_api_calls_used" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"current_plan" text DEFAULT 'free',
	"current_tokens_used" integer DEFAULT 0,
	"features" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"interests" text[],
	"is_onboarded" boolean DEFAULT false,
	"is_suspended" boolean DEFAULT false,
	"last_usage_reset" timestamp DEFAULT now(),
	"monthly_api_calls_limit" integer DEFAULT 0,
	"monthly_storage_limit" integer DEFAULT 1024,
	"monthly_token_limit" integer DEFAULT 0,
	"onboarding" jsonb,
	"plan_expires_at" timestamp,
	"preference" jsonb,
	"suspend_reason" text,
	"suspended_at" timestamp,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"user_id" text NOT NULL,
	CONSTRAINT "user_extensions_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "user_subscription_history" (
	"api_calls_limit" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"ended_at" timestamp,
	"features" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"id" text PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"payment_method" text,
	"plan_name" text NOT NULL,
	"plan_type" text NOT NULL,
	"price" integer DEFAULT 0,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"token_limit" integer DEFAULT 0,
	"transaction_id" text,
	"user_id" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "message_chunks" ALTER COLUMN "message_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "message_chunks" ALTER COLUMN "chunk_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "message_query_chunks" ALTER COLUMN "id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "message_query_chunks" ALTER COLUMN "query_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "message_query_chunks" ALTER COLUMN "chunk_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "file_chunks" ALTER COLUMN "file_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "file_chunks" ALTER COLUMN "chunk_id" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "ai_providers" ADD COLUMN "is_global" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "user_balances" ADD CONSTRAINT "user_balances_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_transactions" ADD CONSTRAINT "user_transactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "user_transactions_user_id_idx" ON "user_transactions" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "user_extension_user_id_idx" ON "user_extensions" USING btree ("user_id");--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "interests";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "is_onboarded";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "onboarding";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "clerk_created_at";--> statement-breakpoint
ALTER TABLE "users" DROP COLUMN "preference";