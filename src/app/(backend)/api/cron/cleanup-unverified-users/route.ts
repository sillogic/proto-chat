/**
 * Cron job to clean up unverified users
 *
 * This endpoint deletes users who:
 * 1. Have not verified their email (emailVerified = false)
 * 2. Were created more than X days ago (default: 7 days)
 * 3. Have no associated user_extensions record (not initialized)
 *
 * Security: Requires CRON_SECRET header to prevent unauthorized access
 *
 * Usage:
 * - Set up external cron service (e.g., cron-job.org, Vercel Cron) to call this endpoint daily
 * - Or use system crontab: curl -H "Authorization: Bearer $CRON_SECRET" https://your-domain/api/cron/cleanup-unverified-users
 */

import { serverDB } from '@lobechat/database';
import { and, eq, isNull, lt, sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';

import { users } from '@/database/schemas/user';
import { userExtensions } from '@/database/schemas/userExtension';

// How many days to wait before deleting unverified users
const UNVERIFIED_USER_RETENTION_DAYS = 7;

export async function GET(request: Request) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    return NextResponse.json(
      { error: 'CRON_SECRET not configured' },
      { status: 500 }
    );
  }

  const token = authHeader?.replace('Bearer ', '');
  if (token !== cronSecret) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - UNVERIFIED_USER_RETENTION_DAYS);

    // Find unverified users without user_extensions (not initialized)
    // These are users who registered but never verified their email
    const unverifiedUsers = await serverDB
      .select({
        id: users.id,
        email: users.email,
        createdAt: users.createdAt,
      })
      .from(users)
      .leftJoin(userExtensions, eq(users.id, userExtensions.userId))
      .where(
        and(
          eq(users.emailVerified, false),
          lt(users.createdAt, cutoffDate),
          isNull(userExtensions.userId) // No user_extensions = not initialized
        )
      );

    if (unverifiedUsers.length === 0) {
      return NextResponse.json({
        message: 'No unverified users to clean up',
        deleted: 0,
      });
    }

    // Delete unverified users
    // Due to CASCADE, related records in accounts, auth_sessions, etc. will be deleted automatically
    const userIds = unverifiedUsers.map((u) => u.id);

    const result = await serverDB
      .delete(users)
      .where(
        and(
          eq(users.emailVerified, false),
          lt(users.createdAt, cutoffDate),
          sql`${users.id} = ANY(${userIds})`
        )
      );

    console.log(
      `[Cron] Cleaned up ${unverifiedUsers.length} unverified users:`,
      unverifiedUsers.map((u) => u.email)
    );

    return NextResponse.json({
      message: `Successfully cleaned up ${unverifiedUsers.length} unverified users`,
      deleted: unverifiedUsers.length,
      emails: unverifiedUsers.map((u) => u.email),
      cutoffDate: cutoffDate.toISOString(),
    });
  } catch (error) {
    console.error('[Cron] Failed to clean up unverified users:', error);
    return NextResponse.json(
      { error: 'Failed to clean up unverified users' },
      { status: 500 }
    );
  }
}

// Also support POST for compatibility with some cron services
export const POST = GET;
