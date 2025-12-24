CREATE TYPE "public"."plan_interval" AS ENUM('month', 'year');--> statement-breakpoint
CREATE TYPE "public"."plan_type" AS ENUM('individual', 'team');--> statement-breakpoint
CREATE TABLE "model_pricings" (
	"id" text PRIMARY KEY NOT NULL,
	"model" text NOT NULL,
	"provider" text NOT NULL,
	"input_price" numeric(10, 6) DEFAULT '0',
	"output_price" numeric(10, 6) DEFAULT '0',
	"per_request_price" numeric(10, 6) DEFAULT '0',
	"accessed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subscription_plans" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"type" "plan_type" DEFAULT 'individual' NOT NULL,
	"price" integer NOT NULL,
	"currency" text DEFAULT 'CNY' NOT NULL,
	"interval" "plan_interval" DEFAULT 'month' NOT NULL,
	"credits" numeric(12, 2) DEFAULT '0' NOT NULL,
	"features" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"is_active" boolean DEFAULT true,
	"accessed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "subscription_plans_slug_unique" UNIQUE("slug")
);
