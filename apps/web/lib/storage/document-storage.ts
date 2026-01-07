import { v4 as uuidv4 } from "uuid";
import type { Document, DocumentIndex, JSONContent } from "@/types/storage";
import { NotFoundError, UnauthorizedError } from "./errors";
import { getDatabaseAdapter } from "@/lib/adapters/database";
import { getStorageAdapter } from "@/lib/adapters/storage";
import { extractImageUrls, getDeletedImages, parseSupabaseImagePath } from "@/lib/utils/image-cleanup";

/**
 * 文档存储类
 * 负责文档的 CRUD 操作
 */
export class DocumentStorage {
  private get db() {
    return getDatabaseAdapter();
  }

  /**
   * 创建新文档
   */
  async create(
    userId: string,
    title: string,
    content?: JSONContent
  ): Promise<Document> {
    const defaultContent: JSONContent = {
      type: "doc",
      content: [],
    };

    const docContent = content || defaultContent;

    return this.db.documents.create({
      id: uuidv4(),
      userId,
      title,
      content: docContent,
      images: content ? this.extractImages(content) : [],
      tags: [],
      preview: content ? this.generatePreview(content) : "",
    });
  }

  /**
   * 根据 ID 读取文档
   */
  async findById(docId: string): Promise<Document | null> {
    return this.db.documents.findById(docId);
  }

  /**
   * 更新文档
   */
  async update(
    docId: string,
    userId: string,
    data: Partial<Omit<Document, "id" | "userId" | "createdAt">>
  ): Promise<Document> {
    // 验证权限
    const doc = await this.findById(docId);
    if (!doc) {
      throw new NotFoundError("Document");
    }

    if (doc.userId !== userId) {
      throw new UnauthorizedError(
        "You don't have permission to edit this document"
      );
    }

    // Clean up deleted images if content is being updated
    if (data.content !== undefined) {
      try {
        const oldUrls = extractImageUrls(doc.content);
        const newUrls = extractImageUrls(data.content);
        const deletedUrls = getDeletedImages(oldUrls, newUrls);

        // Delete images from Storage (don't block document update if deletion fails)
        const storage = getStorageAdapter();
        for (const url of deletedUrls) {
          const parsed = parseSupabaseImagePath(url);
          if (parsed) {
            try {
              await storage.delete(parsed.bucket, parsed.path);
              console.log(`Deleted image: ${parsed.bucket}/${parsed.path}`);
            } catch (error) {
              console.error(`Failed to delete image: ${url}`, error);
            }
          }
        }
      } catch (error) {
        console.error('Error during image cleanup:', error);
      }
    }

    // 准备更新数据
    const updateInput: Parameters<typeof this.db.documents.update>[1] = {};

    if (data.title !== undefined) updateInput.title = data.title;
    if (data.content !== undefined) {
      updateInput.content = data.content;
      updateInput.images = this.extractImages(data.content);
      updateInput.preview = this.generatePreview(data.content);
    }
    if (data.tags !== undefined) updateInput.tags = data.tags;

    return this.db.documents.update(docId, updateInput);
  }

  /**
   * 删除文档
   */
  async delete(docId: string, userId: string): Promise<void> {
    // 验证权限
    const doc = await this.findById(docId);
    if (!doc) {
      throw new NotFoundError("Document");
    }

    if (doc.userId !== userId) {
      throw new UnauthorizedError(
        "You don't have permission to delete this document"
      );
    }

    // 删除关联的图片文件
    if (doc.content) {
      try {
        const storage = getStorageAdapter();
        const imageUrls = extractImageUrls(doc.content);
        for (const url of imageUrls) {
          const parsed = parseSupabaseImagePath(url);
          if (parsed) {
            try {
              await storage.delete(parsed.bucket, parsed.path);
              console.log(`Deleted image on document delete: ${parsed.bucket}/${parsed.path}`);
            } catch (error) {
              console.error(`Failed to delete image: ${url}`, error);
            }
          }
        }
      } catch (error) {
        console.error('Error during image cleanup on document delete:', error);
      }
    }

    await this.db.documents.delete(docId);
  }

  /**
   * 获取用户的所有文档（返回索引列表）
   */
  async findByUserId(userId: string): Promise<DocumentIndex[]> {
    const documents = await this.db.documents.findByUserId(userId, {
      orderBy: 'updatedAt',
      orderDirection: 'desc',
    });

    return documents.map(doc => ({
      id: doc.id,
      title: doc.title,
      preview: doc.preview || "",
      tags: doc.tags || [],
      updatedAt: doc.updatedAt,
    }));
  }

  /**
   * 从 Tiptap JSONContent 中提取图片 URL
   */
  private extractImages(content: JSONContent): string[] {
    const images: string[] = [];

    const traverse = (node: any) => {
      if (node.type === "image" && node.attrs?.src) {
        // 提取图片文件名
        // 例如：/images/user-123/abc.png -> abc.png
        const match = node.attrs.src.match(/\/images\/[^/]+\/([^/]+)$/);
        if (match) {
          images.push(match[1]);
        }
      }

      // 递归遍历子节点
      if (node.content && Array.isArray(node.content)) {
        node.content.forEach(traverse);
      }
    };

    traverse(content);

    // 去重
    return Array.from(new Set(images));
  }

  /**
   * 生成文档预览文本（提取纯文本，前100个字符）
   */
  private generatePreview(content: JSONContent): string {
    let text = "";

    const traverse = (node: any) => {
      if (node.type === "text" && node.text) {
        text += node.text + " ";
      }

      // 递归遍历子节点
      if (node.content && Array.isArray(node.content)) {
        node.content.forEach(traverse);
      }
    };

    traverse(content);

    // 返回前100个字符
    return text.trim().substring(0, 100);
  }

  /**
   * 搜索文档
   */
  async search(userId: string, query: string): Promise<DocumentIndex[]> {
    const documents = await this.db.documents.search(userId, query);

    return documents.map(doc => ({
      id: doc.id,
      title: doc.title,
      preview: doc.preview || "",
      tags: doc.tags || [],
      updatedAt: doc.updatedAt,
    }));
  }

  /**
   * 按标签获取文档
   */
  async findByTag(userId: string, tag: string): Promise<DocumentIndex[]> {
    const documents = await this.db.documents.findByTag(userId, tag);

    return documents.map(doc => ({
      id: doc.id,
      title: doc.title,
      preview: doc.preview || "",
      tags: doc.tags || [],
      updatedAt: doc.updatedAt,
    }));
  }
}

// 导出单例
export const documentStorage = new DocumentStorage();
