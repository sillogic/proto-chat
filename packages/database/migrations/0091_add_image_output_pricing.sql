ALTER TABLE "model_pricings" ADD COLUMN "image_output_price" numeric(15, 6) DEFAULT '0' NOT NULL;
ALTER TABLE "model_pricings" ADD COLUMN "user_image_output_price" numeric(15, 6) DEFAULT '0' NOT NULL;
