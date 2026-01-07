import * as dotenv from 'dotenv';
import { db } from './admin-system/server/src/config/database';
import { sql } from 'drizzle-orm';

dotenv.config();

const statements = [
    `ALTER TABLE "model_pricings" ALTER COLUMN "input_price" SET DATA TYPE numeric(15, 6)`,
    `ALTER TABLE "model_pricings" ALTER COLUMN "input_price" SET DEFAULT '0'`,
    `ALTER TABLE "model_pricings" ALTER COLUMN "input_price" SET NOT NULL`,
    `ALTER TABLE "model_pricings" ALTER COLUMN "output_price" SET DATA TYPE numeric(15, 6)`,
    `ALTER TABLE "model_pricings" ALTER COLUMN "output_price" SET DEFAULT '0'`,
    `ALTER TABLE "model_pricings" ALTER COLUMN "output_price" SET NOT NULL`,
    `ALTER TABLE "model_pricings" ALTER COLUMN "per_request_price" SET DATA TYPE numeric(15, 6)`,
    `ALTER TABLE "model_pricings" ALTER COLUMN "per_request_price" SET DEFAULT '0'`,
    `ALTER TABLE "model_pricings" ALTER COLUMN "per_request_price" SET NOT NULL`,
    `ALTER TABLE "model_pricings" ADD COLUMN "memo" text`,
    `CREATE UNIQUE INDEX "model_provider_idx" ON "model_pricings" USING btree ("model","provider")`
];

async function runLineByLine() {
    for (let i = 0; i < statements.length; i++) {
        const statement = statements[i];
        console.log(`Executing [${i + 1}/${statements.length}]: ${statement}`);
        try {
            await db.execute(sql.raw(statement));
            console.log('✅ Success');
        } catch (error: any) {
            console.error(`❌ Failed: ${error.message}`);
            console.error(JSON.stringify(error, null, 2));
            break;
        }
    }
    process.exit(0);
}

runLineByLine();
