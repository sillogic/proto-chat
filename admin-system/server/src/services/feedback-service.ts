import { db } from '../config/database';
import { userFeedbacks, type FeedbackStatus } from '../db/feedback-schema';

export type { FeedbackStatus };
import { desc, eq, and, like, or, SQL } from 'drizzle-orm';

export interface FeedbackListQuery {
    page?: number;
    pageSize?: number;
    status?: FeedbackStatus | 'all';
    search?: string;
}

export class FeedbackService {
    async getList({ page = 1, pageSize = 20, status, search }: FeedbackListQuery = {}) {
        const offset = (page - 1) * pageSize;

        const conditions: SQL[] = [];

        if (status && status !== 'all') {
            conditions.push(eq(userFeedbacks.status, status));
        }

        if (search?.trim()) {
            const kw = `%${search.trim()}%`;
            conditions.push(
                or(
                    like(userFeedbacks.title, kw),
                    like(userFeedbacks.message, kw),
                    like(userFeedbacks.userEmail, kw),
                )!,
            );
        }

        const where = conditions.length > 0 ? and(...conditions) : undefined;

        const [items, countResult] = await Promise.all([
            db
                .select()
                .from(userFeedbacks)
                .where(where)
                .orderBy(desc(userFeedbacks.createdAt))
                .limit(pageSize)
                .offset(offset),
            db.$count(userFeedbacks, where),
        ]);

        return { items, total: Number(countResult) };
    }

    async getById(id: string) {
        const result = await db
            .select()
            .from(userFeedbacks)
            .where(eq(userFeedbacks.id, id))
            .limit(1);
        return result[0] ?? null;
    }

    async updateStatus(id: string, status: FeedbackStatus, adminNote?: string) {
        const updates: Partial<typeof userFeedbacks.$inferInsert> = {
            status,
            updatedAt: new Date(),
        };
        if (adminNote !== undefined) updates.adminNote = adminNote;

        const result = await db
            .update(userFeedbacks)
            .set(updates)
            .where(eq(userFeedbacks.id, id))
            .returning();
        return result[0] ?? null;
    }

    async delete(id: string) {
        await db.delete(userFeedbacks).where(eq(userFeedbacks.id, id));
    }
}

export const feedbackService = new FeedbackService();
