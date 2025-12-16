import { NextRequest, NextResponse } from 'next/server';
import { createCallerFactory } from '@trpc/server';
import { appRouter } from '@/server/routers/lambda';
import { createTRPCContext } from '@/server/routers/context';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    // 解析查询参数
    const current = parseInt(searchParams.get('current') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '20');
    const keyword = searchParams.get('keyword') || undefined;
    const planType = searchParams.get('planType') || undefined;
    const status = searchParams.get('status') || undefined;

    // 创建 tRPC caller
    const createCaller = createCallerFactory<typeof appRouter>();
    const ctx = await createTRPCContext({
      req: request,
      resHeaders: new Headers(),
    });
    const caller = createCaller(ctx);

    // 调用 tRPC 用户列表方法
    const result = await caller.admin.users.list({
      current,
      pageSize,
      keyword,
      planType,
      status,
    });

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Get users error:', error);
    return NextResponse.json({
      success: false,
      message: error.message || '获取用户列表失败',
    });
  }
}