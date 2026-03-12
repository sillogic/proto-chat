import { jsonb, pgEnum, pgTable, text, timestamp } from 'drizzle-orm/pg-core';

export const feedbackStatusEnum = pgEnum('feedback_status', ['pending', 'read', 'resolved']);

const timestamptz = (name: string) => timestamp(name, { withTimezone: true });

export const userFeedbacks = pgTable('user_feedbacks', {
    id: text('id').primaryKey(),
    userId: text('user_id').notNull(),
    userEmail: text('user_email'),
    title: text('title').notNull(),
    message: text('message').notNull(),
    screenshotUrl: text('screenshot_url'),
    clientInfo: jsonb('client_info').default({}),
    status: feedbackStatusEnum('status').notNull().default('pending'),
    adminNote: text('admin_note'),
    createdAt: timestamptz('created_at').notNull().defaultNow(),
    updatedAt: timestamptz('updated_at').notNull().defaultNow(),
});

export type UserFeedbackItem = typeof userFeedbacks.$inferSelect;
export type FeedbackStatus = 'pending' | 'read' | 'resolved';
