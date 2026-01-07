ALTER TABLE "user_extensions" ADD COLUMN "next_plan_id" text;--> statement-breakpoint
ALTER TABLE "user_subscription_history" ADD COLUMN "auto_renew" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "user_subscription_history" ADD COLUMN "status" text DEFAULT 'active' NOT NULL;