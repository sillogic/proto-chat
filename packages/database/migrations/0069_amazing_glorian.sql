ALTER TABLE "model_pricings" ALTER COLUMN "input_price" SET DATA TYPE numeric(15, 6);--> statement-breakpoint
ALTER TABLE "model_pricings" ALTER COLUMN "input_price" SET DEFAULT '0';--> statement-breakpoint
ALTER TABLE "model_pricings" ALTER COLUMN "input_price" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "model_pricings" ALTER COLUMN "output_price" SET DATA TYPE numeric(15, 6);--> statement-breakpoint
ALTER TABLE "model_pricings" ALTER COLUMN "output_price" SET DEFAULT '0';--> statement-breakpoint
ALTER TABLE "model_pricings" ALTER COLUMN "output_price" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "model_pricings" ALTER COLUMN "per_request_price" SET DATA TYPE numeric(15, 6);--> statement-breakpoint
ALTER TABLE "model_pricings" ALTER COLUMN "per_request_price" SET DEFAULT '0';--> statement-breakpoint
ALTER TABLE "model_pricings" ALTER COLUMN "per_request_price" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "model_pricings" ADD COLUMN "memo" text;--> statement-breakpoint
CREATE UNIQUE INDEX "model_provider_idx" ON "model_pricings" USING btree ("model","provider");