import { db } from './src/config/database';
import { userBalances } from './src/db/credit-schema';
import { eq, sql } from 'drizzle-orm';

async function checkBalance() {
    const usersResult = await db.execute(sql`SELECT id, email, username FROM users WHERE email LIKE '%zzj%' OR username LIKE '%zzj%' LIMIT 1`);
    const user = (usersResult.rows || usersResult)[0] as any;

    if (!user) {
        console.log("User 'zzj' not found.");
        return;
    }
    console.log(`Checking balance for User: ${user.id}`);

    const balance = await db.select().from(userBalances).where(eq(userBalances.userId, user.id)).limit(1);
    if (balance.length > 0) {
        console.log("Balance Found:");
        console.log(JSON.stringify(balance[0], null, 2));
    } else {
        console.log("NO BALANCE RECORD FOUND for this user!");
    }
}

checkBalance().catch(console.error);
