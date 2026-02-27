import { eq } from 'drizzle-orm';

import { getServerDB } from '@/database/core/db-adaptor';
import { publicProcedure } from '@/libs/trpc/lambda';
import { systemDefaultModelConfig } from '@lobechat/database';

export const businessConfigEndpoints = {
  getVideoDefaultModel: publicProcedure.query(async () => {
    const db = await getServerDB();
    const [config] = await db
      .select({
        displayName: systemDefaultModelConfig.displayName,
        modelId: systemDefaultModelConfig.modelId,
        providerId: systemDefaultModelConfig.providerId,
      })
      .from(systemDefaultModelConfig)
      .where(eq(systemDefaultModelConfig.id, 'video_default'))
      .limit(1);
    return config ?? null;
  }),
};
