/**
 * Tagging Queue
 *
 * 后台处理队列，处理 pending 状态的照片 AI 标签
 */

import { photoAiMetadataStorage } from '@/lib/storage/photo-ai-metadata-storage';
import { photoStorage } from '@/lib/storage/photo-storage';
import { getPhotoTagger } from './photo-tagger';

export interface ProcessQueueOptions {
  userId: string;
  limit?: number;
  onProgress?: (processed: number, total: number) => void;
}

export interface ProcessQueueResult {
  processed: number;
  failed: number;
  errors: string[];
}

/**
 * 处理单个照片的 AI 标签
 */
async function processPhoto(
  photoId: string,
  metadataId: string
): Promise<{ success: boolean; error?: string }> {
  const tagger = getPhotoTagger();

  // 检查 tagger 是否可用
  if (!tagger.isAvailable()) {
    return { success: false, error: 'No AI service available' };
  }

  // 获取照片信息
  const photo = await photoStorage.findById(photoId);
  if (!photo) {
    return { success: false, error: `Photo not found: ${photoId}` };
  }

  if (!photo.fileUrl) {
    return { success: false, error: `Photo has no URL: ${photoId}` };
  }

  // 更新状态为 processing
  await photoAiMetadataStorage.update(metadataId, {
    status: 'processing',
  });

  try {
    // 调用 AI 分析
    const result = await tagger.analyzePhoto(photo.fileUrl);

    if (result.success && result.data) {
      // 更新为 completed
      await photoAiMetadataStorage.update(metadataId, {
        tags: result.data.tags,
        description: result.data.description,
        status: 'completed',
        model: result.model,
        processedAt: new Date().toISOString(),
      });
      return { success: true };
    } else {
      // 更新为 failed
      await photoAiMetadataStorage.update(metadataId, {
        status: 'failed',
        errorMessage: result.error || 'Unknown error',
      });
      return { success: false, error: result.error || 'Unknown error' };
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    await photoAiMetadataStorage.update(metadataId, {
      status: 'failed',
      errorMessage,
    });
    return { success: false, error: errorMessage };
  }
}

/**
 * 处理待处理的标签队列
 */
export async function processTaggingQueue(
  options: ProcessQueueOptions
): Promise<ProcessQueueResult> {
  const { userId, limit = 10, onProgress } = options;

  // 获取 pending 状态的记录
  const pendingItems = await photoAiMetadataStorage.findPending(userId, limit);

  if (pendingItems.length === 0) {
    return {
      processed: 0,
      failed: 0,
      errors: [],
    };
  }

  let processed = 0;
  let failed = 0;
  const errors: string[] = [];

  // 逐个处理（避免同时发送过多请求）
  for (let i = 0; i < pendingItems.length; i++) {
    const item = pendingItems[i];
    if (!item) continue;

    const result = await processPhoto(item.photoId, item.id);

    if (result.success) {
      processed++;
    } else {
      failed++;
      if (result.error) {
        errors.push(`${item.photoId}: ${result.error}`);
      }
    }

    // 回调进度
    onProgress?.(i + 1, pendingItems.length);

    // 处理间隔，避免触发限流（每处理一个等待 300ms）
    if (i < pendingItems.length - 1) {
      await new Promise((resolve) => setTimeout(resolve, 300));
    }
  }

  return {
    processed,
    failed,
    errors,
  };
}

/**
 * 重试失败的记录
 */
export async function retryFailedItems(
  userId: string,
  limit: number = 10
): Promise<ProcessQueueResult> {
  // 获取 failed 状态的记录
  const { getDatabaseAdapter } = await import('@/lib/adapters/database');
  const db = await getDatabaseAdapter();
  const failedItems = await db.photoAiMetadata.findByStatus(userId, 'failed', limit);

  if (failedItems.length === 0) {
    return {
      processed: 0,
      failed: 0,
      errors: [],
    };
  }

  // 将状态重置为 pending
  for (const item of failedItems) {
    await photoAiMetadataStorage.update(item.id, {
      status: 'pending',
      errorMessage: undefined,
    });
  }

  // 然后调用 processTaggingQueue 处理
  return processTaggingQueue({
    userId,
    limit,
  });
}

/**
 * 获取队列状态
 */
export async function getQueueStatus(userId: string): Promise<{
  pending: number;
  processing: number;
  completed: number;
  failed: number;
  total: number;
}> {
  return photoAiMetadataStorage.getStats(userId);
}
