/**
 * Canvas Storage - Supabase 版本（无限画布）
 *
 * 负责 Canvas 项目的 CRUD 操作
 * 图片存储在 Supabase Storage，元数据存储在 Supabase Database
 */

import { v4 as uuidv4 } from "uuid";
import type {
  CanvasProject,
  CanvasProjectIndex,
  CanvasElement,
  CanvasViewport,
  CanvasSaveRequest,
  MagazinePage,
} from "@/types/storage";
import { VersionConflictError, CANVAS_CONFIG } from "@/types/storage";
import { NotFoundError, UnauthorizedError } from "./errors";
import { getDatabaseAdapter } from "@/lib/adapters/database";
import { getStorageAdapter } from "@/lib/adapters/storage";

// Storage bucket 名称
const CANVAS_BUCKET = "canvas-images";

// 默认视口
const DEFAULT_VIEWPORT: CanvasViewport = {
  x: 0,
  y: 0,
  zoom: 1,
};

/**
 * 数据验证错误
 */
export class DataValidationError extends Error {
  readonly code: string;

  constructor(message: string, code: string) {
    super(message);
    this.name = "DataValidationError";
    this.code = code;
  }
}

/**
 * Canvas 存储类
 */
export class CanvasStorage {
  private get db() {
    return getDatabaseAdapter();
  }

  private get storage() {
    return getStorageAdapter();
  }

  /**
   * 验证元素数据
   */
  private validateElements(elements: CanvasElement[]): void {
    // 检查元素数量
    if (elements.length > CANVAS_CONFIG.MAX_ELEMENTS) {
      throw new DataValidationError(
        `元素数量超出限制 (${elements.length}/${CANVAS_CONFIG.MAX_ELEMENTS})`,
        "MAX_ELEMENTS_EXCEEDED"
      );
    }

    // 检查单个图片大小
    for (const element of elements) {
      if (element.type === "image" && element.src?.startsWith("data:image/")) {
        const sizeInBytes = (element.src.length * 3) / 4; // Base64 大约是原始大小的 4/3
        const sizeInMB = sizeInBytes / (1024 * 1024);

        if (sizeInMB > CANVAS_CONFIG.MAX_IMAGE_SIZE_MB) {
          throw new DataValidationError(
            `图片大小超出限制 (${sizeInMB.toFixed(2)}MB/${CANVAS_CONFIG.MAX_IMAGE_SIZE_MB}MB)`,
            "MAX_IMAGE_SIZE_EXCEEDED"
          );
        }
      }
    }

    // 检查总数据大小
    const totalSize = JSON.stringify(elements).length;
    const totalSizeMB = totalSize / (1024 * 1024);

    if (totalSizeMB > CANVAS_CONFIG.MAX_PAYLOAD_SIZE_MB) {
      throw new DataValidationError(
        `数据大小超出限制 (${totalSizeMB.toFixed(2)}MB/${CANVAS_CONFIG.MAX_PAYLOAD_SIZE_MB}MB)`,
        "MAX_PAYLOAD_SIZE_EXCEEDED"
      );
    }
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
   * 上传图片到 Storage
   */
  private async uploadImage(
    userId: string,
    projectId: string,
    base64DataUrl: string
  ): Promise<string> {
    const extracted = this.extractBase64Data(base64DataUrl);
    if (!extracted) {
      throw new Error("Invalid image data URL");
    }

    const { data, mimeType, extension } = extracted;
    const buffer = Buffer.from(data, "base64");

    // 生成唯一文件名
    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substring(7);
    const fileName = `${timestamp}-${randomString}.${extension}`;

    // 上传路径: userId/projectId/fileName
    const storagePath = `${userId}/${projectId}/${fileName}`;

    const { publicUrl } = await this.storage.upload(CANVAS_BUCKET, storagePath, buffer, {
      contentType: mimeType,
      upsert: false,
    });

    return publicUrl;
  }

  /**
   * 公开的图片上传方法
   * 用于客户端即时上传图片（解决保存时 payload 过大的问题）
   */
  async uploadImagePublic(
    userId: string,
    projectId: string,
    base64DataUrl: string
  ): Promise<string> {
    return this.uploadImage(userId, projectId, base64DataUrl);
  }

  /**
   * 从 Buffer 上传图片
   * 用于 FormData 上传（避免 JSON 序列化大型 base64 导致栈溢出）
   */
  async uploadImageBuffer(
    userId: string,
    projectId: string,
    buffer: Buffer,
    mimeType: string
  ): Promise<string> {
    // 从 mimeType 提取扩展名
    const extensionMap: Record<string, string> = {
      "image/png": "png",
      "image/jpeg": "jpeg",
      "image/jpg": "jpeg",
      "image/webp": "webp",
      "image/gif": "gif",
    };
    const extension = extensionMap[mimeType] || "png";

    // 生成唯一文件名
    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substring(7);
    const fileName = `${timestamp}-${randomString}.${extension}`;

    // 上传路径: userId/projectId/fileName
    const storagePath = `${userId}/${projectId}/${fileName}`;

    const { publicUrl } = await this.storage.upload(CANVAS_BUCKET, storagePath, buffer, {
      contentType: mimeType,
      upsert: false,
    });

    return publicUrl;
  }

  /**
   * 处理元素中的图片：将 base64 转换为 Storage URL
   * 使用事务化处理：如果任何上传失败，清理已上传的文件
   */
  private async processElementImages(
    userId: string,
    projectId: string,
    elements: CanvasElement[]
  ): Promise<CanvasElement[]> {
    const processedElements: CanvasElement[] = [];
    const uploadedPaths: string[] = []; // 跟踪已上传的文件路径

    try {
      for (const element of elements) {
        if (element.type === "image" && element.src) {
          // 检查是否是 base64 data URL
          if (element.src.startsWith("data:image/")) {
            // 上传图片并获取 URL
            const { url, path } = await this.uploadImageWithPath(
              userId,
              projectId,
              element.src
            );
            uploadedPaths.push(path);
            processedElements.push({
              ...element,
              src: url,
              originalSrc: undefined, // 清除临时数据
            });
          } else {
            // 已经是 URL，保持不变
            processedElements.push(element);
          }
        } else {
          processedElements.push(element);
        }
      }

      return processedElements;
    } catch (error) {
      // 上传失败，清理已上传的文件
      console.error("Image upload failed, cleaning up uploaded files:", error);
      await this.cleanupUploadedFiles(uploadedPaths);
      throw error;
    }
  }

  /**
   * 上传图片并返回路径（用于事务化处理）
   */
  private async uploadImageWithPath(
    userId: string,
    projectId: string,
    base64DataUrl: string
  ): Promise<{ url: string; path: string }> {
    const extracted = this.extractBase64Data(base64DataUrl);
    if (!extracted) {
      throw new Error("Invalid image data URL");
    }

    const { data, mimeType, extension } = extracted;
    const buffer = Buffer.from(data, "base64");

    // 生成唯一文件名
    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substring(7);
    const fileName = `${timestamp}-${randomString}.${extension}`;

    // 上传路径: userId/projectId/fileName
    const storagePath = `${userId}/${projectId}/${fileName}`;

    const { publicUrl } = await this.storage.upload(CANVAS_BUCKET, storagePath, buffer, {
      contentType: mimeType,
      upsert: false,
    });

    return {
      url: publicUrl,
      path: storagePath,
    };
  }

  /**
   * 清理已上传的文件（用于事务回滚）
   */
  private async cleanupUploadedFiles(paths: string[]): Promise<void> {
    if (paths.length === 0) return;

    try {
      await this.storage.deleteMany(CANVAS_BUCKET, paths);
      console.log(`Cleaned up ${paths.length} uploaded files`);
    } catch (error) {
      // 清理失败不应该阻止主流程
      console.error("Failed to cleanup uploaded files:", error);
    }
  }

  /**
   * 从元素数组中提取所有图片 URL
   */
  private extractImageUrls(elements: CanvasElement[]): string[] {
    return elements
      .filter((el) => el.type === "image" && el.src && !el.src.startsWith("data:"))
      .map((el) => el.src as string);
  }

  /**
   * 从 pages 数组中提取所有图片 URL
   */
  private extractImageUrlsFromPages(pages: MagazinePage[]): string[] {
    const urls: string[] = [];
    for (const page of pages) {
      if (page.elements) {
        urls.push(...this.extractImageUrls(page.elements));
      }
    }
    return urls;
  }

  /**
   * 清理不再使用的图片
   * 比较新旧 URL，删除不再引用的图片
   */
  private async cleanupUnusedImages(
    oldUrls: string[],
    newUrls: string[]
  ): Promise<void> {
    const newUrlSet = new Set(newUrls);
    const deletedUrls = oldUrls.filter((url) => !newUrlSet.has(url));

    if (deletedUrls.length === 0) return;

    console.log(`[Canvas] Cleaning up ${deletedUrls.length} unused images`);

    for (const url of deletedUrls) {
      try {
        // 解析 Storage URL
        const urlObj = new URL(url);
        const pathParts = urlObj.pathname.split("/");
        const publicIndex = pathParts.indexOf("public");

        if (publicIndex !== -1 && publicIndex < pathParts.length - 2) {
          const bucket = pathParts[publicIndex + 1];
          const path = pathParts.slice(publicIndex + 2).join("/");

          if (bucket === CANVAS_BUCKET) {
            await this.storage.delete(bucket, path);
            console.log(`[Canvas] Deleted unused image: ${path}`);
          }
        }
      } catch (error) {
        console.error(`[Canvas] Failed to delete image: ${url}`, error);
      }
    }
  }

  /**
   * 创建新的 Canvas 项目
   */
  async create(
    userId: string,
    data: CanvasSaveRequest & { tripId?: string }
  ): Promise<CanvasProject> {
    // 验证数据
    if (data.elements) {
      this.validateElements(data.elements);
    }

    const projectId = uuidv4();

    // 处理图片上传
    const processedElements = data.elements
      ? await this.processElementImages(userId, projectId, data.elements)
      : [];

    // 插入数据库
    return this.db.canvas.create({
      id: projectId,
      userId,
      tripId: data.tripId,
      title: data.title || "Untitled Canvas",
      viewport: data.viewport || DEFAULT_VIEWPORT,
      elements: processedElements,
      isMagazineMode: data.isMagazineMode ?? true,
    });
  }

  /**
   * 根据 ID 获取项目
   */
  async findById(projectId: string): Promise<CanvasProject | null> {
    return this.db.canvas.findById(projectId);
  }

  /**
   * 获取用户的所有项目列表
   * 兼容旧的 pages 结构和新的 elements 结构
   */
  async findByUserId(userId: string): Promise<CanvasProjectIndex[]> {
    const projects = await this.db.canvas.findByUserId(userId, {
      orderBy: 'updatedAt',
      orderDirection: 'desc',
    });

    return projects.map((project) => {
      // 计算元素数量：优先使用 elements，否则从 pages 计算
      let elementCount = 0;
      if (Array.isArray(project.elements)) {
        elementCount = project.elements.length;
      } else if (Array.isArray(project.pages)) {
        elementCount = project.pages.reduce(
          (sum: number, page: MagazinePage) =>
            sum + (Array.isArray(page.elements) ? page.elements.length : 0),
          0
        );
      }

      return {
        id: project.id,
        tripId: project.tripId,
        title: project.title,
        thumbnailUrl: project.thumbnailUrl,
        elementCount,
        isMagazineMode: project.isMagazineMode,
        updatedAt: project.updatedAt,
      };
    });
  }

  /**
   * 根据旅行 ID 获取项目列表
   */
  async findByTripId(tripId: string): Promise<CanvasProjectIndex[]> {
    const projects = await this.db.canvas.findByTripId(tripId, {
      orderBy: 'updatedAt',
      orderDirection: 'desc',
    });

    return projects.map((project) => {
      let elementCount = 0;
      if (Array.isArray(project.elements)) {
        elementCount = project.elements.length;
      } else if (Array.isArray(project.pages)) {
        elementCount = project.pages.reduce(
          (sum: number, page: MagazinePage) =>
            sum + (Array.isArray(page.elements) ? page.elements.length : 0),
          0
        );
      }

      return {
        id: project.id,
        tripId: project.tripId,
        title: project.title,
        thumbnailUrl: project.thumbnailUrl,
        elementCount,
        isMagazineMode: project.isMagazineMode,
        updatedAt: project.updatedAt,
      };
    });
  }

  /**
   * 更新项目
   */
  async update(
    projectId: string,
    userId: string,
    data: Partial<CanvasSaveRequest> & { tripId?: string }
  ): Promise<CanvasProject> {
    // 验证数据
    if (data.elements) {
      this.validateElements(data.elements);
    }

    // 验证权限
    const existing = await this.findById(projectId);
    if (!existing) {
      throw new NotFoundError("Canvas project");
    }
    if (existing.userId !== userId) {
      throw new UnauthorizedError(
        "You don't have permission to update this project"
      );
    }

    // 收集旧的图片 URL（用于后续清理）
    let oldImageUrls: string[] = [];
    if (existing.isMagazineMode && existing.pages) {
      oldImageUrls = this.extractImageUrlsFromPages(existing.pages);
    } else if (existing.elements) {
      oldImageUrls = this.extractImageUrls(existing.elements);
    }

    // 收集新的图片 URL
    let newImageUrls: string[] = [];

    // 准备更新数据
    const updateInput: Parameters<typeof this.db.canvas.update>[1] = {};

    if (data.tripId !== undefined) {
      updateInput.tripId = data.tripId;
    }

    if (data.title !== undefined) {
      updateInput.title = data.title;
    }

    if (data.viewport !== undefined) {
      updateInput.viewport = data.viewport;
    }

    if (data.elements !== undefined) {
      // 处理图片上传
      updateInput.elements = await this.processElementImages(
        userId,
        projectId,
        data.elements
      );
      newImageUrls.push(...this.extractImageUrls(updateInput.elements));
    }

    // 杂志模式字段
    if ((data as any).isMagazineMode !== undefined) {
      updateInput.isMagazineMode = (data as any).isMagazineMode;
    }

    if ((data as any).currentPageIndex !== undefined) {
      updateInput.currentPageIndex = (data as any).currentPageIndex;
    }

    // 处理 pages（杂志模式）
    if ((data as any).pages !== undefined) {
      const pages = (data as any).pages as MagazinePage[];
      // 处理每个页面中的图片
      const processedPages: MagazinePage[] = [];
      for (const page of pages) {
        // 安全检查：确保 page.elements 存在
        const pageElements = page.elements || [];
        const processedElements = await this.processElementImages(
          userId,
          projectId,
          pageElements
        );
        processedPages.push({
          ...page,
          elements: processedElements,
        });
      }
      updateInput.pages = processedPages;
      newImageUrls.push(...this.extractImageUrlsFromPages(processedPages));
    }

    // 更新数据库
    const updatedProject = await this.db.canvas.update(projectId, updateInput);

    // 清理不再使用的图片（在数据库更新成功后执行，不阻塞返回）
    if (oldImageUrls.length > 0) {
      this.cleanupUnusedImages(oldImageUrls, newImageUrls).catch((err) => {
        console.error("[Canvas] Background image cleanup failed:", err);
      });
    }

    return updatedProject;
  }

  /**
   * 删除项目
   */
  async delete(projectId: string, userId: string): Promise<void> {
    const project = await this.findById(projectId);
    if (!project) {
      throw new NotFoundError("Canvas project");
    }
    if (project.userId !== userId) {
      throw new UnauthorizedError(
        "You don't have permission to delete this project"
      );
    }

    // 删除 Storage 中的所有图片
    try {
      const files = await this.storage.list(CANVAS_BUCKET, `${userId}/${projectId}`);

      if (files.length > 0) {
        const filePaths = files.map((f) => `${userId}/${projectId}/${f.name}`);
        await this.storage.deleteMany(CANVAS_BUCKET, filePaths);
      }
    } catch (error) {
      console.error("Failed to delete canvas images:", error);
    }

    // 删除数据库记录
    await this.db.canvas.delete(projectId);
  }

  /**
   * 更新缩略图
   */
  async updateThumbnail(
    projectId: string,
    userId: string,
    thumbnailBase64: string
  ): Promise<string> {
    const project = await this.findById(projectId);
    if (!project) {
      throw new NotFoundError("Canvas project");
    }
    if (project.userId !== userId) {
      throw new UnauthorizedError("Unauthorized");
    }

    // 上传缩略图
    const extracted = this.extractBase64Data(thumbnailBase64);
    if (!extracted) {
      throw new Error("Invalid thumbnail data");
    }

    const { data, mimeType, extension } = extracted;
    const buffer = Buffer.from(data, "base64");
    const storagePath = `${userId}/${projectId}/thumbnail.${extension}`;

    const { publicUrl: thumbnailUrl } = await this.storage.upload(CANVAS_BUCKET, storagePath, buffer, {
      contentType: mimeType,
      upsert: true, // 覆盖旧的缩略图
    });

    // 更新数据库
    await this.db.canvas.update(projectId, {
      thumbnailUrl,
    });

    return thumbnailUrl;
  }

  /**
   * 获取或创建用户的默认项目
   * 如果用户没有项目，自动创建一个杂志模式项目
   */
  async getOrCreateDefault(userId: string): Promise<CanvasProject> {
    // 查找用户的最近项目
    const projects = await this.findByUserId(userId);

    if (projects.length > 0 && projects[0]) {
      // 返回最近的项目
      const latestProject = await this.findById(projects[0].id);
      if (latestProject) {
        return latestProject;
      }
    }

    // 创建默认杂志模式项目（带一个封面页）
    return this.createMagazineProject(userId, {
      title: "My Journal",
    });
  }

  /**
   * 创建杂志模式项目
   */
  async createMagazineProject(
    userId: string,
    data: { title?: string }
  ): Promise<CanvasProject> {
    const projectId = uuidv4();

    // 创建初始封面页
    const initialPages: MagazinePage[] = [
      {
        id: uuidv4(),
        index: 0,
        elements: [],
      },
    ];

    // 插入数据库
    return this.db.canvas.create({
      id: projectId,
      userId,
      title: data.title || "My Journal",
      viewport: DEFAULT_VIEWPORT,
      elements: [], // 杂志模式下为空
      pages: initialPages,
      isMagazineMode: true,
      currentPageIndex: 0,
    });
  }

}

// 导出单例
export const canvasStorage = new CanvasStorage();
