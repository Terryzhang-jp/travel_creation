import { v4 as uuidv4 } from "uuid";
import exifr from "exifr";
import sharp from "sharp";
import type { JSONContent } from "novel";
import type { Photo, PhotoIndex, PhotoCategory, PhotoStats } from "@/types/storage";
import { NotFoundError, UnauthorizedError } from "./errors";
import { getDatabaseAdapter } from "@/lib/adapters/database";
import { getStorageAdapter } from "@/lib/adapters/storage";

// Thumbnail configuration
const THUMBNAIL_SIZE = 300; // 300x300 max dimension
const THUMBNAIL_QUALITY = 80; // JPEG quality

// Storage bucket name
const PHOTOS_BUCKET = "photos";

/**
 * 照片存储类
 * 负责照片的 CRUD 操作和 EXIF 提取
 */
export class PhotoStorage {
  private get db() {
    return getDatabaseAdapter();
  }

  private get storage() {
    return getStorageAdapter();
  }

  /**
   * 从 EXIF 数据中提取元数据
   */
  private async extractEXIF(buffer: Buffer, mimeType: string): Promise<{
    dateTime?: string;
    location?: {
      latitude: number;
      longitude: number;
      altitude?: number;
    };
    camera?: {
      make?: string;
      model?: string;
    };
    dimensions?: {
      width: number;
      height: number;
    };
  }> {
    try {
      const exif = await exifr.parse(buffer);

      if (!exif) {
        return {};
      }

      // 提取时间（优先级：DateTimeOriginal > DateTime > CreateDate）
      let dateTime: string | undefined;
      if (exif.DateTimeOriginal) {
        dateTime = new Date(exif.DateTimeOriginal).toISOString();
      } else if (exif.DateTime) {
        dateTime = new Date(exif.DateTime).toISOString();
      } else if (exif.CreateDate) {
        dateTime = new Date(exif.CreateDate).toISOString();
      }

      // 提取地理位置
      let location:
        | {
            latitude: number;
            longitude: number;
            altitude?: number;
          }
        | undefined;
      if (
        exif.latitude !== undefined &&
        exif.longitude !== undefined &&
        !Number.isNaN(exif.latitude) &&
        !Number.isNaN(exif.longitude)
      ) {
        location = {
          latitude: exif.latitude,
          longitude: exif.longitude,
        };
        if (exif.GPSAltitude !== undefined && !Number.isNaN(exif.GPSAltitude)) {
          location.altitude = exif.GPSAltitude;
        }
      }

      // 提取相机信息
      let camera:
        | {
            make?: string;
            model?: string;
          }
        | undefined;
      if (exif.Make || exif.Model) {
        camera = {
          make: exif.Make,
          model: exif.Model,
        };
      }

      // 提取图片尺寸
      let dimensions:
        | {
            width: number;
            height: number;
          }
        | undefined;
      const width = exif.ImageWidth || exif.ExifImageWidth;
      const height = exif.ImageHeight || exif.ExifImageHeight;
      if (width && height) {
        dimensions = { width, height };
      }

      return {
        dateTime,
        location,
        camera,
        dimensions,
      };
    } catch (error) {
      console.error("EXIF extraction error:", error);
      return {};
    }
  }

  /**
   * 根据元数据确定照片分类
   */
  private categorize(metadata: Photo["metadata"]): PhotoCategory {
    const hasTime = !!metadata.dateTime;
    const hasLocation = !!metadata.location;

    if (hasTime && hasLocation) return "time-location";
    if (hasTime) return "time-only";
    if (hasLocation) return "location-only";
    return "neither";
  }

  /**
   * 生成缩略图
   */
  private async generateThumbnail(buffer: Buffer): Promise<Buffer> {
    try {
      return await sharp(buffer)
        .resize(THUMBNAIL_SIZE, THUMBNAIL_SIZE, {
          fit: 'cover',
          position: 'centre',
        })
        .jpeg({ quality: THUMBNAIL_QUALITY })
        .toBuffer();
    } catch (error) {
      console.error('Thumbnail generation error:', error);
      throw error;
    }
  }

  /**
   * 创建新照片记录（上传照片）
   */
  async create(
    userId: string,
    file: File
  ): Promise<Photo> {
    // 读取文件内容
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // 生成唯一文件名
    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substring(7);
    const fileExtension = file.name.split(".").pop();
    const fileName = `${timestamp}-${randomString}.${fileExtension}`;

    // 提取 EXIF 元数据
    const exifData = await this.extractEXIF(buffer, file.type);

    // 创建完整的元数据
    const metadata: Photo["metadata"] = {
      ...exifData,
      fileSize: buffer.length,
      mimeType: file.type,
    };

    // 确定分类
    const category = this.categorize(metadata);

    // 上传原图到 Storage
    const storagePath = `${userId}/gallery/${fileName}`;
    const { publicUrl: fileUrl } = await this.storage.upload(PHOTOS_BUCKET, storagePath, buffer, {
      contentType: file.type,
      upsert: false,
    });

    // 生成并上传缩略图
    let thumbnailUrl: string | undefined;
    try {
      const thumbnailBuffer = await this.generateThumbnail(buffer);
      const thumbnailFileName = `thumb_${fileName.replace(/\.[^.]+$/, '.jpg')}`;
      const thumbnailPath = `${userId}/thumbnails/${thumbnailFileName}`;

      const { publicUrl } = await this.storage.upload(PHOTOS_BUCKET, thumbnailPath, thumbnailBuffer, {
        contentType: 'image/jpeg',
        upsert: false,
      });

      thumbnailUrl = publicUrl;
    } catch (error) {
      console.error('Failed to generate thumbnail, using original:', error);
      // 如果缩略图生成失败，继续使用原图
    }

    // 创建照片记录
    return this.db.photos.create({
      id: uuidv4(),
      userId,
      fileName,
      originalName: file.name,
      fileUrl,
      thumbnailUrl,
      metadata,
      category,
      isPublic: true,
    });
  }

  /**
   * 根据 ID 获取照片
   */
  async findById(photoId: string): Promise<Photo | null> {
    return this.db.photos.findById(photoId);
  }

  /**
   * 获取用户的所有照片（返回完整照片列表）
   * @param userId 用户ID
   * @param options 分页选项 { limit?: number, offset?: number, sortOrder?: 'newest' | 'oldest' }
   */
  async findByUserId(
    userId: string,
    options?: { limit?: number; offset?: number; sortOrder?: 'newest' | 'oldest' }
  ): Promise<Photo[]> {
    return this.db.photos.findByUserId(
      userId,
      { trashed: false },
      {
        limit: options?.limit,
        offset: options?.offset,
        orderBy: 'dateTime',
        orderDirection: options?.sortOrder === 'oldest' ? 'asc' : 'desc',
      }
    );
  }

  /**
   * 按分类获取照片（返回完整照片列表）
   * @param userId 用户ID
   * @param category 照片分类
   * @param options 分页选项 { limit?: number, offset?: number, sortOrder?: 'newest' | 'oldest' }
   */
  async findByCategory(
    userId: string,
    category: PhotoCategory,
    options?: { limit?: number; offset?: number; sortOrder?: 'newest' | 'oldest' }
  ): Promise<Photo[]> {
    return this.db.photos.findByUserId(
      userId,
      { category, trashed: false },
      {
        limit: options?.limit,
        offset: options?.offset,
        orderBy: 'dateTime',
        orderDirection: options?.sortOrder === 'oldest' ? 'asc' : 'desc',
      }
    );
  }

  /**
   * 删除照片
   */
  async delete(photoId: string, userId: string): Promise<void> {
    const photo = await this.findById(photoId);
    if (!photo) {
      throw new NotFoundError("Photo");
    }

    // 权限检查
    if (photo.userId !== userId) {
      throw new UnauthorizedError(
        "You don't have permission to delete this photo"
      );
    }

    // 删除 Storage 中的文件
    const storagePath = `${userId}/gallery/${photo.fileName}`;
    try {
      await this.storage.delete(PHOTOS_BUCKET, storagePath);
    } catch (error) {
      console.error('Failed to delete file from storage:', error);
    }

    // 删除数据库记录
    await this.db.photos.delete(photoId);
  }

  /**
   * 获取照片统计信息
   */
  async getStats(userId: string): Promise<PhotoStats> {
    return this.db.photos.getStats(userId);
  }

  /**
   * 为照片设置地点（关联地点库）
   */
  async setLocation(
    photoId: string,
    userId: string,
    locationId: string
  ): Promise<Photo> {
    // 获取照片
    const photo = await this.findById(photoId);
    if (!photo) {
      throw new NotFoundError("Photo");
    }

    // 权限检查
    if (photo.userId !== userId) {
      throw new UnauthorizedError(
        "You don't have permission to update this photo"
      );
    }

    // 获取地点信息
    const location = await this.db.locations.findById(locationId);
    if (!location || location.userId !== userId) {
      throw new NotFoundError("Location");
    }

    // 更新照片的元数据
    const updatedMetadata = {
      ...photo.metadata,
      location: {
        latitude: location.coordinates.latitude,
        longitude: location.coordinates.longitude,
        altitude: photo.metadata.location?.altitude,
        source: "location-library" as const,
      },
    };

    // 重新计算分类
    const category = this.categorize(updatedMetadata);

    // 更新照片
    const updatedPhoto = await this.db.photos.update(photoId, {
      locationId,
      metadata: updatedMetadata,
      category,
    });

    // 增加地点的使用计数
    await this.db.locations.incrementUsage(locationId);

    return updatedPhoto;
  }

  /**
   * 移除照片的地点关联
   */
  async removeLocation(photoId: string, userId: string): Promise<Photo> {
    const photo = await this.findById(photoId);
    if (!photo) {
      throw new NotFoundError("Photo");
    }

    if (photo.userId !== userId) {
      throw new UnauthorizedError(
        "You don't have permission to update this photo"
      );
    }

    const oldLocationId = photo.locationId;

    // 更新元数据
    const updatedMetadata = {
      ...photo.metadata,
      location:
        photo.metadata.location?.source === "location-library"
          ? undefined
          : photo.metadata.location
          ? {
              ...photo.metadata.location,
              source: "exif" as const,
            }
          : undefined,
    };

    const category = this.categorize(updatedMetadata);

    const updatedPhoto = await this.db.photos.update(photoId, {
      locationId: undefined,
      metadata: updatedMetadata,
      category,
    });

    // 减少地点的使用计数
    if (oldLocationId) {
      await this.db.locations.decrementUsage(oldLocationId);
    }

    return updatedPhoto;
  }

  /**
   * 批量为多张照片设置地点
   */
  async batchSetLocation(
    photoIds: string[],
    userId: string,
    locationId: string
  ): Promise<{ success: number; failed: number }> {
    let success = 0;
    let failed = 0;

    for (const photoId of photoIds) {
      try {
        await this.setLocation(photoId, userId, locationId);
        success++;
      } catch (error) {
        console.error(`Failed to set location for photo ${photoId}:`, error);
        failed++;
      }
    }

    return { success, failed };
  }

  /**
   * 更新照片的描述（用于旅行日记功能）
   */
  async updateDescription(
    photoId: string,
    userId: string,
    description: JSONContent
  ): Promise<Photo> {
    const photo = await this.findById(photoId);
    if (!photo) {
      throw new NotFoundError("Photo");
    }

    if (photo.userId !== userId) {
      throw new UnauthorizedError(
        "You don't have permission to update this photo"
      );
    }

    return this.db.photos.update(photoId, { description });
  }

  /**
   * 更新照片的时间
   */
  async updateDateTime(
    photoId: string,
    userId: string,
    dateTime: string | null
  ): Promise<Photo> {
    const photo = await this.findById(photoId);
    if (!photo) {
      throw new NotFoundError("Photo");
    }

    if (photo.userId !== userId) {
      throw new UnauthorizedError(
        "You don't have permission to update this photo"
      );
    }

    // 更新元数据
    const updatedMetadata = {
      ...photo.metadata,
      dateTime: dateTime || undefined,
    };

    const category = this.categorize(updatedMetadata);

    return this.db.photos.update(photoId, {
      metadata: updatedMetadata,
      category,
    });
  }

  /**
   * 替换照片文件（编辑照片）
   * 保留原始照片，上传编辑后的新版本
   */
  async replacePhoto(
    photoId: string,
    userId: string,
    editedFile: File
  ): Promise<Photo> {
    // 获取现有照片记录
    const photo = await this.findById(photoId);
    if (!photo) {
      throw new NotFoundError("Photo");
    }

    // 权限检查
    if (photo.userId !== userId) {
      throw new UnauthorizedError(
        "You don't have permission to edit this photo"
      );
    }

    // 读取编辑后的文件
    const arrayBuffer = await editedFile.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // 生成新文件名（保持相同扩展名）
    const timestamp = Date.now();
    const randomString = Math.random().toString(36).substring(7);
    const fileExtension = photo.fileName.split(".").pop();
    const newFileName = `${timestamp}-${randomString}.${fileExtension}`;

    // 如果是第一次编辑，保存原始文件URL
    const originalFileUrl = photo.originalFileUrl || photo.fileUrl;
    const wasEdited = photo.edited || false;

    // 上传新文件到 Storage
    const newStoragePath = `${userId}/gallery/${newFileName}`;
    const { publicUrl: newFileUrl } = await this.storage.upload(PHOTOS_BUCKET, newStoragePath, buffer, {
      contentType: editedFile.type,
      upsert: false,
    });

    // 如果之前已经编辑过，删除旧的编辑版本文件
    if (wasEdited && photo.fileName !== photo.originalFileUrl?.split('/').pop()) {
      const oldEditedPath = `${userId}/gallery/${photo.fileName}`;
      try {
        await this.storage.delete(PHOTOS_BUCKET, oldEditedPath);
      } catch (error) {
        console.error(`Failed to delete old edited file: ${error}`);
        // 继续执行，不阻塞流程
      }
    }

    // 更新数据库记录
    const now = new Date().toISOString();
    return this.db.photos.update(photoId, {
      fileName: newFileName,
      fileUrl: newFileUrl,
      originalFileUrl,
      edited: true,
      editedAt: now,
    });
  }

  /**
   * 同步 location 坐标到所有关联的照片
   * 当 location 的坐标被更新时调用
   */
  async syncLocationCoordinatesToPhotos(
    locationId: string,
    newCoordinates: { latitude: number; longitude: number }
  ): Promise<number> {
    // 获取所有引用这个 locationId 的照片
    const photos = await this.db.photos.findByLocationId(locationId);

    if (photos.length === 0) {
      return 0; // 没有照片需要更新
    }

    // 批量更新所有照片的坐标
    let updatedCount = 0;
    for (const photo of photos) {
      const updatedMetadata = {
        ...photo.metadata,
        location: {
          latitude: newCoordinates.latitude,
          longitude: newCoordinates.longitude,
          altitude: photo.metadata?.location?.altitude,
          source: photo.metadata?.location?.source || "location-library",
        },
      };

      // 重新计算分类
      const category = this.categorize(updatedMetadata);

      try {
        await this.db.photos.update(photo.id, {
          metadata: updatedMetadata,
          category,
        });
        updatedCount++;
      } catch (error) {
        console.error(`Failed to update photo ${photo.id}:`, error);
      }
    }

    return updatedCount;
  }

  /**
   * 获取所有公开的照片（用于公共地图）
   */
  async getAllPublicPhotos(): Promise<Photo[]> {
    const photos = await this.db.photos.findPublic();
    // Filter photos with location
    return photos.filter(p => p.metadata?.location);
  }

  /**
   * 移入回收站
   */
  async trash(photoId: string, userId: string): Promise<void> {
    const photo = await this.findById(photoId);
    if (!photo) {
      throw new NotFoundError("Photo");
    }

    // 权限检查
    if (photo.userId !== userId) {
      throw new UnauthorizedError(
        "You don't have permission to trash this photo"
      );
    }

    // 更新数据库记录
    const now = new Date().toISOString();
    await this.db.photos.update(photoId, {
      trashed: true,
      trashedAt: now,
    });
  }

  /**
   * 从回收站恢复
   */
  async restore(photoId: string, userId: string): Promise<void> {
    const photo = await this.findById(photoId);
    if (!photo) {
      throw new NotFoundError("Photo");
    }

    // 权限检查
    if (photo.userId !== userId) {
      throw new UnauthorizedError(
        "You don't have permission to restore this photo"
      );
    }

    // 更新数据库记录
    await this.db.photos.update(photoId, {
      trashed: false,
      trashedAt: undefined,
    });
  }

  /**
   * 获取回收站照片列表
   */
  async getTrashedPhotos(userId: string): Promise<Photo[]> {
    return this.db.photos.findTrashed(userId);
  }

  /**
   * 清空回收站（永久删除所有回收站照片）
   */
  async emptyTrash(userId: string): Promise<void> {
    // 获取所有回收站照片
    const trashedPhotos = await this.getTrashedPhotos(userId);

    // 逐个永久删除
    for (const photo of trashedPhotos) {
      await this.delete(photo.id, userId);
    }
  }
}

// 导出单例
export const photoStorage = new PhotoStorage();
