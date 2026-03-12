import { userFeedbacks } from '@lobechat/database';
import { z } from 'zod';

import { authedProcedure, router } from '@/libs/trpc/lambda';
import { serverDatabase } from '@/libs/trpc/lambda/middleware';

const authedFeedbackProcedure = authedProcedure.use(serverDatabase);

export const feedbackRouter = router({
  submit: authedFeedbackProcedure
    .input(
      z.object({
        clientInfo: z
          .object({
            language: z.string().optional(),
            timezone: z.string().optional(),
            url: z.string().optional(),
            userAgent: z.string().optional(),
          })
          .optional(),
        message: z.string().min(1).max(5000),
        screenshotUrl: z.string().url().optional().nullable(),
        title: z.string().min(1).max(200),
        userEmail: z.string().email().optional().nullable(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const [result] = await ctx.serverDB
        .insert(userFeedbacks)
        .values({
          adminNote: null,
          clientInfo: input.clientInfo ?? {},
          message: input.message,
          screenshotUrl: input.screenshotUrl ?? null,
          status: 'pending',
          title: input.title,
          userEmail: input.userEmail ?? null,
          userId: ctx.userId,
        })
        .returning({ id: userFeedbacks.id });

      return { id: result.id };
    }),
});

export type FeedbackRouter = typeof feedbackRouter;
