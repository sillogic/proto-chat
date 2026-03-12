import { jsonb, pgEnum, pgTable, text } from 'drizzle-orm/pg-core';

import { idGenerator } from '../utils/idGenerator';
import { createdAt, updatedAt } from './_helpers';

export const feedbackStatusEnum = pgEnum('feedback_status', ['pending', 'read', 'resolved']);

export const userFeedbacks = pgTable('user_feedbacks', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => idGenerator('feedbacks')),

  userId: text('user_id').notNull(),
  userEmail: text('user_email'),

  title: text('title').notNull(),
  message: text('message').notNull(),
  screenshotUrl: text('screenshot_url'),

  // Browser/client context: { url, userAgent, language, timezone }
  clientInfo: jsonb('client_info').default({}),

  status: feedbackStatusEnum('status').notNull().default('pending'),
  adminNote: text('admin_note'),

  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export type NewUserFeedback = typeof userFeedbacks.$inferInsert;
export type UserFeedbackItem = typeof userFeedbacks.$inferSelect;
