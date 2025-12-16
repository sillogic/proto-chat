import { NextRequest, NextResponse } from 'next/server';
import { createCallerFactory } from '@trpc/server';
import { appRouter } from '@/server/routers/lambda';
import { createTRPCContext } from '@/server/routers/context';

export async function GET(request: NextRequest) {
  try {
    // 创建 tRPC caller
    const createCaller = createCallerFactory<typeof appRouter>();
    const ctx = await createTRPCContext({
      req: request,
      resHeaders: new Headers(),
    });
    const caller = createCaller(ctx);

    // 调用 tRPC 仪表盘统计方法
    const result = await caller.admin.dashboard.stats();

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Get dashboard stats error:', error);
    return NextResponse.json({
      success: false,
      message: error.message || '获取仪表盘数据失败',
    });
  }
}