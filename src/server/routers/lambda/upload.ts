import { z } from 'zod';

import { authedProcedure, router } from '@/libs/trpc/lambda';
import { S3 } from '@/server/modules/S3';

export const uploadRouter = router({
  createS3PreSignedUrl: authedProcedure
    .input(z.object({ contentType: z.string().optional(), pathname: z.string() }))
    .mutation(async ({ input }) => {
      const s3 = new S3();

      const contentType = input.contentType || 'application/octet-stream';
      const preSignUrl = await s3.createPreSignedUrl(input.pathname, contentType);
      return { preSignUrl, setAcl: s3.setAcl };
    }),
});

export type FileRouter = typeof uploadRouter;
