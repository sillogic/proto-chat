ALTER TABLE "model_pricings" ALTER COLUMN "input_price" SET DATA TYPE numeric(12, 4);--> statement-breakpoint
ALTER TABLE "model_pricings" ALTER COLUMN "input_price" SET DEFAULT '0';--> statement-breakpoint
ALTER TABLE "model_pricings" ALTER COLUMN "output_price" SET DATA TYPE numeric(12, 4);--> statement-breakpoint
ALTER TABLE "model_pricings" ALTER COLUMN "output_price" SET DEFAULT '0';--> statement-breakpoint
ALTER TABLE "model_pricings" ALTER COLUMN "per_request_price" SET DATA TYPE numeric(12, 4);--> statement-breakpoint
ALTER TABLE "model_pricings" ALTER COLUMN "per_request_price" SET DEFAULT '0';--> statement-breakpoint
ALTER TABLE "user_extensions" ADD COLUMN "plan_id" text;--> statement-breakpoint
ALTER TABLE "user_subscription_history" ADD COLUMN "plan_id" text;--> statement-breakpoint
ALTER TABLE "user_subscription_history" ADD COLUMN "slug" text;--> statement-breakpoint
ALTER TABLE "user_extensions" DROP COLUMN "current_api_calls_used";--> statement-breakpoint
ALTER TABLE "user_extensions" DROP COLUMN "current_tokens_used";--> statement-breakpoint
ALTER TABLE "user_extensions" DROP COLUMN "monthly_api_calls_limit";--> statement-breakpoint
ALTER TABLE "user_extensions" DROP COLUMN "monthly_storage_limit";--> statement-breakpoint
ALTER TABLE "user_extensions" DROP COLUMN "monthly_token_limit";--> statement-breakpoint
ALTER TABLE "user_subscription_history" DROP COLUMN "api_calls_limit";--> statement-breakpoint
ALTER TABLE "user_subscription_history" DROP COLUMN "token_limit";