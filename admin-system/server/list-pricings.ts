import { db } from './src/config/database';
import { modelPricings } from './src/db/subscription-schema';

async function listPricings() {
    const all = await db.select().from(modelPricings);
    console.log("All Model Pricings:");
    console.log(JSON.stringify(all.map(p => ({
        model: p.model,
        provider: p.provider,
        input: p.inputPrice,
        output: p.outputPrice
    })), null, 2));
}

listPricings().catch(console.error);
