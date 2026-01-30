/**
 * Payment Orders Cleanup Cron Job
 *
 * Cleans up old pending/closed orders to prevent storage bloat
 * Run frequency: Weekly or monthly (e.g., every Sunday at 3 AM)
 *
 * Safety: Only deletes pending/closed orders older than RETENTION_DAYS
 * Paid orders are NEVER deleted (financial records)
 */

import { serverDB } from '@/database/client';
import { paymentOrders } from '@lobechat/database';
import { and, lt, or, eq } from 'drizzle-orm';
import { NextRequest, NextResponse } from 'next/server';

// Configuration
const RETENTION_DAYS = 90; // Keep orders for 90 days
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
 *       "schedule": "0 3 * * 0"
 *     }
 *   ]
 * }
 *
 * Schedule explanation: "0 3 * * 0" = Every Sunday at 3:00 AM UTC
 */
