ALTER TABLE "user_balances" ALTER COLUMN "balance" SET DATA TYPE numeric(15, 4);--> statement-breakpoint
ALTER TABLE "user_balances" ALTER COLUMN "balance" SET DEFAULT '0';--> statement-breakpoint
ALTER TABLE "user_balances" ALTER COLUMN "total_purchased" SET DATA TYPE numeric(15, 4);--> statement-breakpoint
ALTER TABLE "user_balances" ALTER COLUMN "total_purchased" SET DEFAULT '0';--> statement-breakpoint
ALTER TABLE "user_transactions" ALTER COLUMN "amount" SET DATA TYPE numeric(15, 4);--> statement-breakpoint
ALTER TABLE "user_transactions" ALTER COLUMN "balance_after" SET DATA TYPE numeric(15, 4);--> statement-breakpoint
ALTER TABLE "ai_providers" ADD COLUMN "is_global" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "subscription_plans" ADD COLUMN "storage_limit" integer DEFAULT 1024 NOT NULL;--> statement-breakpoint
ALTER TABLE "subscription_plans" ADD COLUMN "vector_limit" integer DEFAULT 0 NOT NULL;