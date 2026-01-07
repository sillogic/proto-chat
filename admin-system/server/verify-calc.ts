import { db } from './src/config/database';
import { sql } from 'drizzle-orm';

async function verify() {
    console.log('--- Model Pricing ---');
    const pricing = await db.execute(sql`SELECT * FROM model_pricings WHERE model = 'deepseek-chat'`);
    console.log(JSON.stringify(pricing, null, 2));

    console.log('\n--- Latest Message for zzj ---');
    const message = await db.execute(sql`
        SELECT id, model, metadata FROM messages 
        WHERE user_id = 'user_oeV7aiLXSYrs6Rldts5QKscG8eh' 
        ORDER BY created_at DESC LIMIT 1
    `);
    console.log(JSON.stringify(message, null, 2));
}

verify().catch(console.error);
