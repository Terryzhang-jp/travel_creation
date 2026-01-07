/**
 * AI Magic Storage - Database Adapter Version
 *
 * 管理 AI Magic 生成历史的存储层
 * 使用 Database Adapter 和 Storage Adapter 抽象层
 */

import { v4 as uuidv4 } from "uuid";
import { getDatabaseAdapter } from "@/lib/adapters/database";
import { getStorageAdapter } from "@/lib/adapters/storage";
import type { AiMagicHistoryItem, AiMagicHistoryIndex } from "@/types/storage";

const MAX_HISTORY_ITEMS = 50; // 每个用户最多保存 50 条历史
const AI_MAGIC_BUCKET = "ai-magic-images";

/**
 * AI Magic 存储类
 */
export class AiMagicStorage {
  private get db() {
    return getDatabaseAdapter();
  }

  private get storage() {
    return getStorageAdapter();
  }

  /**
   * 从 base64 data URL 提取数据
   */
  private extractBase64Data(dataUrl: string): {
    data: string;
    mimeType: string;
    extension: string;
  } | null {
    const match = dataUrl.match(
      /^data:image\/(png|jpeg|jpg|webp|gif);base64,(.+)$/
    );
    if (!match || !match[1] || !match[2]) return null;

    const type = match[1];
    const data = match[2];
    const mimeType = type === "jpg" ? "image/jpeg" : `image/${type}`;
    const extension = type === "jpg" ? "jpeg" : type;

    return { data, mimeType, extension };
  }

  /**
   * 上传 AI 生成的图片到 Storage
   */
  private async uploadResultImage(
    userId: string,
    historyId: string,
    resultImage: string
  ): Promise<string> {
    const extracted = this.extractBase64Data(resultImage);
    if (!extracted) {
      throw new Error("Invalid image data URL");
    }

    const { data, mimeType, extension } = extracted;
    const buffer = Buffer.from(data, "base64");
    const storagePath = `${userId}/ai-magic/${historyId}.${extension}`;

    const { publicUrl } = await this.storage.upload(AI_MAGIC_BUCKET, storagePath, buffer, {
      contentType: mimeType,
      upsert: true,
    });

    return publicUrl;
  }

  /**
   * 获取用户的所有历史记录
   */
  async getHistory(userId: string): Promise<AiMagicHistoryItem[]> {
    return this.db.aiMagicHistory.findByUserId(userId, {
      orderBy: 'createdAt',
      orderDirection: 'desc',
      limit: MAX_HISTORY_ITEMS,
    });
  }

  /**
   * 获取历史记录索引（用于快速显示列表）
   */
  async getHistoryIndex(userId: string): Promise<AiMagicHistoryIndex[]> {
    const items = await this.db.aiMagicHistory.findByUserId(userId, {
      orderBy: 'createdAt',
      orderDirection: 'desc',
      limit: MAX_HISTORY_ITEMS,
    });

    return items.map((item) => ({
      id: item.id,
      userPrompt:
        item.userPrompt.length > 50
          ? `${item.userPrompt.substring(0, 50)}...`
          : item.userPrompt,
      createdAt: item.createdAt,
    }));
  }

  /**
   * 添加新的历史记录
   */
  async addHistoryItem(
    userId: string,
    item: Omit<AiMagicHistoryItem, "id" | "userId" | "createdAt">
  ): Promise<AiMagicHistoryItem> {
    const historyId = uuidv4();

    // 上传图片到 Storage，获取 URL
    let resultImageUrl = item.resultImage;
    if (item.resultImage && item.resultImage.startsWith("data:image/")) {
      resultImageUrl = await this.uploadResultImage(userId, historyId, item.resultImage);
    }

    const result = await this.db.aiMagicHistory.create({
      id: historyId,
      userId,
      userPrompt: item.userPrompt,
      inputImageCount: item.inputImageCount,
      styleImageCount: item.styleImageCount,
      optimizedPrompt: item.optimizedPrompt,
      reasoning: item.reasoning,
      resultImage: resultImageUrl, // 现在存储的是 URL 而不是 base64
      model: item.model,
    });

    // 清理旧记录（保持最多 MAX_HISTORY_ITEMS 条）
    await this.cleanupOldHistory(userId);

    return result;
  }

  /**
   * 清理超出数量限制的旧历史记录
   */
  private async cleanupOldHistory(userId: string): Promise<void> {
    const count = await this.db.aiMagicHistory.count(userId);

    if (count > MAX_HISTORY_ITEMS) {
      await this.db.aiMagicHistory.deleteOldest(userId, MAX_HISTORY_ITEMS);
    }
  }

  /**
   * 获取单条历史记录
   */
  async getHistoryItem(
    userId: string,
    itemId: string
  ): Promise<AiMagicHistoryItem | null> {
    const item = await this.db.aiMagicHistory.findById(itemId);

    // 验证权限
    if (item && item.userId !== userId) {
      return null;
    }

    return item;
  }

  /**
   * 删除历史记录
   */
  async deleteHistoryItem(userId: string, itemId: string): Promise<boolean> {
    // 验证权限
    const item = await this.db.aiMagicHistory.findById(itemId);
    if (!item || item.userId !== userId) {
      return false;
    }

    try {
      await this.db.aiMagicHistory.delete(itemId);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * 清空用户所有历史记录
   */
  async clearHistory(userId: string): Promise<void> {
    await this.db.aiMagicHistory.deleteByUserId(userId);
  }
}

// 导出单例
export const aiMagicStorage = new AiMagicStorage();

// 为了向后兼容，导出独立函数
export const getHistory = (userId: string) => aiMagicStorage.getHistory(userId);
export const getHistoryIndex = (userId: string) => aiMagicStorage.getHistoryIndex(userId);
export const addHistoryItem = (
  userId: string,
  item: Omit<AiMagicHistoryItem, "id" | "userId" | "createdAt">
) => aiMagicStorage.addHistoryItem(userId, item);
export const getHistoryItem = (userId: string, itemId: string) =>
  aiMagicStorage.getHistoryItem(userId, itemId);
export const deleteHistoryItem = (userId: string, itemId: string) =>
  aiMagicStorage.deleteHistoryItem(userId, itemId);
export const clearHistory = (userId: string) => aiMagicStorage.clearHistory(userId);
