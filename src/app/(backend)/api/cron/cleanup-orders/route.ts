/**
 * Payment Orders Cleanup Cron Job
 *
 * Cleans up old pending/closed orders to prevent storage bloat
 * Run frequency: Weekly (every Sunday at 3 AM Beijing time)
 *
 * Retention policy:
 * - pending orders: 7 days (QR code expires in 2 hours, 7 days is enough for debugging)
 * - closed orders: 7 days (user cancelled or timeout, no financial value)
 * - paid orders: NEVER deleted (financial/audit records)
 */

import { paymentOrders, serverDB } from '@lobechat/database';
import { and, lt, or, eq } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';

// Configuration
const RETENTION_DAYS = 7; // Keep pending/closed orders for 7 days
const CRON_SECRET = process.env.CRON_SECRET || 'your-secret-key';

export async function POST(request: NextRequest) {
  try {
    // 1. Verify cron secret to prevent unauthorized access
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');

    if (token !== CRON_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 2. Calculate cutoff date
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - RETENTION_DAYS);

    console.log(`[Cleanup] Starting cleanup for orders before ${cutoffDate.toISOString()}`);

    // 3. Count orders to be deleted (for logging)
    const ordersToDelete = await serverDB
      .select({ count: paymentOrders.id })
      .from(paymentOrders)
      .where(
        and(
          or(eq(paymentOrders.status, 'pending'), eq(paymentOrders.status, 'closed')),
          lt(paymentOrders.createdAt, cutoffDate),
        ),
      );

    const count = ordersToDelete.length;

    if (count === 0) {
      console.log('[Cleanup] No orders to clean up');
      return NextResponse.json({
        deleted: 0,
        message: 'No orders to clean up',
        success: true,
      });
    }

    // 4. Delete old pending/closed orders
    await serverDB
      .delete(paymentOrders)
      .where(
        and(
          or(eq(paymentOrders.status, 'pending'), eq(paymentOrders.status, 'closed')),
          lt(paymentOrders.createdAt, cutoffDate),
        ),
      );

    console.log(`[Cleanup] Successfully deleted ${count} old orders`);

    return NextResponse.json({
      cutoffDate: cutoffDate.toISOString(),
      deleted: count,
      message: `Deleted ${count} old pending/closed orders`,
      success: true,
    });
  } catch (error) {
    console.error('[Cleanup] Error cleaning up orders:', error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : 'Unknown error',
        success: false,
      },
      { status: 500 },
    );
  }
}

/**
 * Vercel Cron configuration (vercel.json):
 *
 * {
 *   "crons": [
 *     {
 *       "path": "/api/cron/cleanup-orders",
 *       "schedule": "0 19 * * 6"
 *     }
 *   ]
 * }
 *
 * Schedule: "0 19 * * 6" = Every Saturday 19:00 UTC = Sunday 03:00 Beijing time
 *
 * Cleanup policy:
 * - Deletes pending/closed orders older than 7 days
 * - Paid orders are NEVER deleted (financial records)
 */
