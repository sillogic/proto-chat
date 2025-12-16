import { NextRequest, NextResponse } from 'next/server';
import { createCallerFactory } from '@trpc/server';
import { appRouter } from '@/server/routers/lambda';
import { createTRPCContext } from '@/server/routers/context';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const { status } = await request.json();

    if (!status) {
      return NextResponse.json({
        success: false,
        message: '状态不能为空',
      });
    }

    // 创建 tRPC caller
    const createCaller = createCallerFactory<typeof appRouter>();
    const ctx = await createTRPCContext({
      req: request,
      resHeaders: new Headers(),
    });
    const caller = createCaller(ctx);

    // 调用 tRPC 更新用户状态方法
    const result = await caller.admin.users.updateStatus({ userId: id, status });

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Update user status error:', error);
    return NextResponse.json({
      success: false,
      message: error.message || '更新用户状态失败',
    });
  }
}