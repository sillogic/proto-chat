import { NextRequest, NextResponse } from 'next/server';
import { createCallerFactory } from '@trpc/server';
import { appRouter } from '@/server/routers/lambda';
import { createTRPCContext } from '@/server/routers/context';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (!body.userId || !body.planType) {
      return NextResponse.json({
        success: false,
        message: '用户ID和套餐类型不能为空',
      });
    }

    // 创建 tRPC caller
    const createCaller = createCallerFactory<typeof appRouter>();
    const ctx = await createTRPCContext({
      req: request,
      resHeaders: new Headers(),
    });
    const caller = createCaller(ctx);

    // 调用 tRPC 更新用户套餐方法
    const result = await caller.admin.users.updatePlan(body);

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Update user plan error:', error);
    return NextResponse.json({
      success: false,
      message: error.message || '更新用户套餐失败',
    });
  }
}