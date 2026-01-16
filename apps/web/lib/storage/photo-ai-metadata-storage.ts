/**
 * Photo AI Metadata Storage
 *
 * 管理照片 AI 标签的存储和查询
 */

import type { PhotoTags } from '@/lib/ai/prompts';

export interface PhotoAiMetadata {
  id: string;
  photoId: string;
  userId: string;
  tags: PhotoTags;
  description: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  model?: string;
  errorMessage?: string;
  processedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateMetadataInput {
  photoId: string;
  userId: string;
}

export interface UpdateMetadataInput {
  tags?: PhotoTags;
  description?: string;
  status?: 'pending' | 'processing' | 'completed' | 'failed';
  model?: string;
  errorMessage?: string;
  processedAt?: string;
}

export interface SearchOptions {
  userId: string;
  tags?: string[];
  scene?: string[];
  mood?: string[];
  lighting?: string[];
  color?: string[];
  subject?: string[];
  composition?: string[];
  usage?: string[];
  q?: string;
  limit?: number;
  offset?: number;
}

/**
 * Photo AI Metadata Storage Class
 */
export class PhotoAiMetadataStorage {
  /**
   * 创建待处理记录
   */
  async create(input: CreateMetadataInput): Promise<PhotoAiMetadata> {
    const { getDatabaseAdapter } = await import('@/lib/adapters/database');
    const db = await getDatabaseAdapter();

    const now = new Date().toISOString();
    const id = crypto.randomUUID();

    const metadata: PhotoAiMetadata = {
      id,
      photoId: input.photoId,
      userId: input.userId,
      tags: {
        scene: [],
        mood: [],
        lighting: [],
        color: [],
        subject: [],
        composition: [],
        usage: [],
        extra: [],
      },
      description: '',
      status: 'pending',
      createdAt: now,
      updatedAt: now,
    };

    await db.photoAiMetadata.create(metadata);
    return metadata;
  }

  /**
   * 根据照片 ID 查找
   */
  async findByPhotoId(photoId: string): Promise<PhotoAiMetadata | null> {
    const { getDatabaseAdapter } = await import('@/lib/adapters/database');
    const db = await getDatabaseAdapter();
    return db.photoAiMetadata.findByPhotoId(photoId);
  }

  /**
   * 根据用户 ID 查找所有
   */
  async findByUserId(userId: string): Promise<PhotoAiMetadata[]> {
    const { getDatabaseAdapter } = await import('@/lib/adapters/database');
    const db = await getDatabaseAdapter();
    return db.photoAiMetadata.findByUserId(userId);
  }

  /**
   * 更新记录
   */
  async update(id: string, input: UpdateMetadataInput): Promise<PhotoAiMetadata> {
    const { getDatabaseAdapter } = await import('@/lib/adapters/database');
    const db = await getDatabaseAdapter();

    const now = new Date().toISOString();
    return db.photoAiMetadata.update(id, {
      ...input,
      updatedAt: now,
    });
  }

  /**
   * 获取待处理的记录
   */
  async findPending(userId: string, limit: number = 50): Promise<PhotoAiMetadata[]> {
    const { getDatabaseAdapter } = await import('@/lib/adapters/database');
    const db = await getDatabaseAdapter();
    return db.photoAiMetadata.findByStatus(userId, 'pending', limit);
  }

  /**
   * 搜索照片（按标签）
   */
  async search(options: SearchOptions): Promise<{ photoIds: string[]; total: number }> {
    const { getDatabaseAdapter } = await import('@/lib/adapters/database');
    const db = await getDatabaseAdapter();
    return db.photoAiMetadata.search(options);
  }

  /**
   * 获取统计信息
   */
  async getStats(userId: string): Promise<{
    total: number;
    pending: number;
    processing: number;
    completed: number;
    failed: number;
  }> {
    const { getDatabaseAdapter } = await import('@/lib/adapters/database');
    const db = await getDatabaseAdapter();
    return db.photoAiMetadata.getStats(userId);
  }

  /**
   * 删除记录
   */
  async delete(id: string): Promise<void> {
    const { getDatabaseAdapter } = await import('@/lib/adapters/database');
    const db = await getDatabaseAdapter();
    await db.photoAiMetadata.delete(id);
  }

  /**
   * 根据照片 ID 删除
   */
  async deleteByPhotoId(photoId: string): Promise<void> {
    const { getDatabaseAdapter } = await import('@/lib/adapters/database');
    const db = await getDatabaseAdapter();
    await db.photoAiMetadata.deleteByPhotoId(photoId);
  }
}

/**
 * 默认实例
 */
export const photoAiMetadataStorage = new PhotoAiMetadataStorage();
