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

import { cronJobLogs, serverDB } from '@lobechat/database';
import { and, eq, inArray, isNull, lt } from 'drizzle-orm';
import { NextResponse } from 'next/server';

import { users } from '@/database/schemas/user';
import { userExtensions } from '@/database/schemas/userExtension';

// How many days to wait before deleting unverified users
const UNVERIFIED_USER_RETENTION_DAYS = 7;

async function runCleanup() {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - UNVERIFIED_USER_RETENTION_DAYS);

  // Find unverified users without user_extensions (not initialized)
  // These are users who registered but never verified their email
  const unverifiedUsers = await serverDB
    .select({
      createdAt: users.createdAt,
      email: users.email,
      id: users.id,
    })
    .from(users)
    .leftJoin(userExtensions, eq(users.id, userExtensions.userId))
    .where(
      and(
        eq(users.emailVerified, false),
        lt(users.createdAt, cutoffDate),
        isNull(userExtensions.userId), // No user_extensions = not initialized
      ),
    );

  if (unverifiedUsers.length === 0) {
    return { cutoffDate, deleted: 0, emails: [] };
  }

  const userIds = unverifiedUsers.map((u) => u.id);

  // Delete unverified users
  // Due to CASCADE, related records in accounts, auth_sessions, etc. will be deleted automatically
  await serverDB
    .delete(users)
    .where(
      and(
        eq(users.emailVerified, false),
        lt(users.createdAt, cutoffDate),
        inArray(users.id, userIds),
      ),
    );

  console.info(
    `[Cron] Cleaned up ${unverifiedUsers.length} unverified users:`,
    unverifiedUsers.map((u) => u.email),
  );

  return {
    cutoffDate,
    deleted: unverifiedUsers.length,
    emails: unverifiedUsers.map((u) => u.email),
  };
}

async function handler(request: Request) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    return NextResponse.json({ error: 'CRON_SECRET not configured', success: false }, { status: 500 });
  }

  const token = authHeader?.replace('Bearer ', '');
  if (token !== cronSecret) {
    return NextResponse.json({ error: 'Unauthorized', success: false }, { status: 401 });
  }

  const startTime = Date.now();

  try {
    const { cutoffDate, deleted, emails } = await runCleanup();

    const durationMs = Date.now() - startTime;
    const result = {
      cutoffDate: cutoffDate.toISOString(),
      deleted,
      emails,
      message:
        deleted === 0
          ? 'No unverified users to clean up'
          : `Successfully cleaned up ${deleted} unverified users`,
      success: true,
    };

    await serverDB.insert(cronJobLogs).values({
      durationMs,
      jobName: 'cleanup-users',
      jobPath: '/api/cron/cleanup-unverified-users',
      result,
      status: 'success',
    });

    return NextResponse.json(result);
  } catch (error) {
    const durationMs = Date.now() - startTime;
    const errorMsg = error instanceof Error ? error.message : 'Unknown error';

    console.error('[Cron] Failed to clean up unverified users:', error);

    await serverDB.insert(cronJobLogs).values({
      durationMs,
      error: errorMsg,
      jobName: 'cleanup-users',
      jobPath: '/api/cron/cleanup-unverified-users',
      status: 'error',
    }).catch(() => {}); // Ignore log write failure

    return NextResponse.json({ error: 'Failed to clean up unverified users', success: false }, { status: 500 });
  }
}

export const GET = handler;
// Also support POST for compatibility with some cron services
export const POST = handler;
