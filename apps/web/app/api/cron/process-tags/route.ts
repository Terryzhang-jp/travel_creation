/**
 * POST /api/cron/process-tags
 *
 * 后台处理队列 API，可通过 Vercel Cron 或手动调用触发批量处理
 *
 * 认证方式（二选一）：
 * 1. 用户认证：通过 session 获取 userId
 * 2. Cron 认证：通过 CRON_SECRET header 验证，需要在 body 中提供 userId
 *
 * Request Body:
 * {
 *   userId?: string;   // 仅在 Cron 模式下需要
 *   limit?: number;    // 处理数量限制，默认 10
 *   retry?: boolean;   // 是否重试失败的记录
 * }
 *
 * Response:
 * {
 *   success: boolean;
 *   processed: number;
 *   failed: number;
 *   errors?: string[];
 * }
 */

import { NextResponse } from 'next/server';
import { getSessionFromRequest } from '@/lib/auth/helpers';
import { processTaggingQueue, retryFailedItems, getQueueStatus } from '@/lib/ai/tagging-queue';

export const runtime = 'nodejs';
export const maxDuration = 60; // 最大执行时间 60 秒

/**
 * POST - 处理标签队列
 */
export async function POST(req: Request) {
  try {
    // 获取请求体
    let body: { userId?: string; limit?: number; retry?: boolean } = {};
    try {
      body = await req.json();
    } catch {
      // 空 body 也是有效的
    }

    const { limit = 10, retry = false } = body;

    // 认证方式 1: Cron Secret
    const cronSecret = req.headers.get('x-cron-secret') || req.headers.get('authorization')?.replace('Bearer ', '');
    const envCronSecret = process.env.CRON_SECRET;

    let userId: string | undefined;

    if (envCronSecret && cronSecret === envCronSecret) {
      // Cron 模式：从 body 中获取 userId
      userId = body.userId;
      if (!userId) {
        return NextResponse.json(
          { error: 'userId is required in Cron mode' },
          { status: 400 }
        );
      }
    } else {
      // 用户认证模式：从 session 获取 userId
      const session = await getSessionFromRequest(req);
      if (!session) {
        return NextResponse.json(
          { error: 'Authentication required' },
          { status: 401 }
        );
      }
      userId = session.user.id;
    }

    // 执行处理
    let result;
    if (retry) {
      result = await retryFailedItems(userId!, limit);
    } else {
      result = await processTaggingQueue({
        userId: userId!,
        limit,
      });
    }

    return NextResponse.json({
      success: true,
      processed: result.processed,
      failed: result.failed,
      errors: result.errors.length > 0 ? result.errors : undefined,
    });
  } catch (error) {
    console.error('[POST /api/cron/process-tags] Error:', error);
    return NextResponse.json(
      { error: 'Failed to process tagging queue' },
      { status: 500 }
    );
  }
}

/**
 * GET - 获取队列状态
 */
export async function GET(req: Request) {
  try {
    // 认证
    const cronSecret = req.headers.get('x-cron-secret') || req.headers.get('authorization')?.replace('Bearer ', '');
    const envCronSecret = process.env.CRON_SECRET;

    let userId: string | undefined;

    if (envCronSecret && cronSecret === envCronSecret) {
      // Cron 模式：从 query 中获取 userId
      const url = new URL(req.url);
      userId = url.searchParams.get('userId') || undefined;
      if (!userId) {
        return NextResponse.json(
          { error: 'userId is required in Cron mode' },
          { status: 400 }
        );
      }
    } else {
      // 用户认证模式
      const session = await getSessionFromRequest(req);
      if (!session) {
        return NextResponse.json(
          { error: 'Authentication required' },
          { status: 401 }
        );
      }
      userId = session.user.id;
    }

    const status = await getQueueStatus(userId!);

    return NextResponse.json({
      success: true,
      status,
    });
  } catch (error) {
    console.error('[GET /api/cron/process-tags] Error:', error);
    return NextResponse.json(
      { error: 'Failed to get queue status' },
      { status: 500 }
    );
  }
}
