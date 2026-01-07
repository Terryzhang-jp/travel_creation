import { v4 as uuidv4 } from "uuid";
import type { Trip, TripIndex, CreateTripRequest, UpdateTripRequest } from "@/types/storage";
import { NotFoundError, UnauthorizedError, ConflictError } from "./errors";
import { getDatabaseAdapter } from "@/lib/adapters/database";

/**
 * 旅行存储类
 * 负责旅行的 CRUD 操作和照片/文档关联管理
 */
export class TripStorage {
  private get db() {
    return getDatabaseAdapter();
  }

  /**
   * 创建新旅行
   */
  async create(userId: string, data: CreateTripRequest): Promise<Trip> {
    return this.db.trips.create({
      id: uuidv4(),
      userId,
      name: data.name,
      description: data.description,
      startDate: data.startDate,
      endDate: data.endDate,
      isPublic: data.isPublic ?? false,
    });
  }

  /**
   * 根据 ID 获取旅行
   */
  async findById(tripId: string): Promise<Trip | null> {
    return this.db.trips.findById(tripId);
  }

  /**
   * 获取用户的所有旅行
   */
  async findByUserId(userId: string): Promise<TripIndex[]> {
    const trips = await this.db.trips.findByUserId(userId, {
      orderBy: 'updatedAt',
      orderDirection: 'desc',
    });

    return trips.map((trip) => ({
      id: trip.id,
      name: trip.name,
      description: trip.description,
      coverImageUrl: trip.coverImageUrl,
      startDate: trip.startDate,
      endDate: trip.endDate,
      isPublic: trip.isPublic,
      photoCount: trip.photoCount,
      documentCount: trip.documentCount,
      updatedAt: trip.updatedAt,
    }));
  }

  /**
   * 更新旅行
   */
  async update(
    tripId: string,
    userId: string,
    data: UpdateTripRequest
  ): Promise<Trip> {
    const trip = await this.findById(tripId);
    if (!trip) {
      throw new NotFoundError("Trip");
    }

    if (trip.userId !== userId) {
      throw new UnauthorizedError("You don't have permission to edit this trip");
    }

    // Validate share_slug uniqueness
    if (data.shareSlug !== undefined && data.shareSlug) {
      const existing = await this.findByShareSlug(data.shareSlug);
      if (existing && existing.id !== tripId) {
        throw new ConflictError("This share URL is already taken");
      }
    }

    return this.db.trips.update(tripId, {
      name: data.name,
      description: data.description,
      coverImageUrl: data.coverImageUrl,
      startDate: data.startDate,
      endDate: data.endDate,
      isPublic: data.isPublic,
      shareSlug: data.shareSlug,
    });
  }

  /**
   * 删除旅行
   */
  async delete(tripId: string, userId: string): Promise<void> {
    const trip = await this.findById(tripId);
    if (!trip) {
      throw new NotFoundError("Trip");
    }

    if (trip.userId !== userId) {
      throw new UnauthorizedError("You don't have permission to delete this trip");
    }

    // Remove trip association from photos (don't delete them)
    const photos = await this.db.photos.findByTripId(tripId);
    if (photos.length > 0) {
      await this.db.photos.updateMany(
        photos.map(p => p.id),
        { tripId: undefined }
      );
    }

    // Remove trip association from documents (don't delete them)
    const documents = await this.db.documents.findByTripId(tripId);
    for (const doc of documents) {
      await this.db.documents.update(doc.id, { tripId: undefined });
    }

    await this.db.trips.delete(tripId);
  }

  /**
   * 添加照片到旅行
   */
  async addPhoto(tripId: string, userId: string, photoId: string): Promise<void> {
    const trip = await this.findById(tripId);
    if (!trip) {
      throw new NotFoundError("Trip");
    }
    if (trip.userId !== userId) {
      throw new UnauthorizedError("You don't have permission to modify this trip");
    }

    // Verify photo belongs to user
    const photo = await this.db.photos.findById(photoId);
    if (!photo || photo.userId !== userId) {
      throw new NotFoundError("Photo");
    }

    await this.db.photos.update(photoId, { tripId });

    // Update photo count
    await this.updateCounts(tripId);
  }

  /**
   * 批量添加照片到旅行
   */
  async addPhotos(
    tripId: string,
    userId: string,
    photoIds: string[]
  ): Promise<{ success: number; failed: number }> {
    const trip = await this.findById(tripId);
    if (!trip) {
      throw new NotFoundError("Trip");
    }
    if (trip.userId !== userId) {
      throw new UnauthorizedError("You don't have permission to modify this trip");
    }

    // Filter photos that belong to user
    const validPhotoIds: string[] = [];
    for (const photoId of photoIds) {
      const photo = await this.db.photos.findById(photoId);
      if (photo && photo.userId === userId) {
        validPhotoIds.push(photoId);
      }
    }

    // Batch update all valid photos
    if (validPhotoIds.length > 0) {
      await this.db.photos.updateMany(validPhotoIds, { tripId });
    }

    const success = validPhotoIds.length;
    const failed = photoIds.length - success;

    // Update photo count
    await this.updateCounts(tripId);

    return { success, failed };
  }

  /**
   * 从旅行移除照片
   */
  async removePhoto(tripId: string, userId: string, photoId: string): Promise<void> {
    const trip = await this.findById(tripId);
    if (!trip) {
      throw new NotFoundError("Trip");
    }
    if (trip.userId !== userId) {
      throw new UnauthorizedError("You don't have permission to modify this trip");
    }

    // Verify photo is in this trip
    const photo = await this.db.photos.findById(photoId);
    if (photo && photo.tripId === tripId) {
      await this.db.photos.update(photoId, { tripId: undefined });
    }

    await this.updateCounts(tripId);
  }

  /**
   * 添加文档到旅行
   */
  async addDocument(tripId: string, userId: string, documentId: string): Promise<void> {
    const trip = await this.findById(tripId);
    if (!trip) {
      throw new NotFoundError("Trip");
    }
    if (trip.userId !== userId) {
      throw new UnauthorizedError("You don't have permission to modify this trip");
    }

    // Verify document belongs to user
    const doc = await this.db.documents.findById(documentId);
    if (!doc || doc.userId !== userId) {
      throw new NotFoundError("Document");
    }

    await this.db.documents.update(documentId, { tripId });

    await this.updateCounts(tripId);
  }

  /**
   * 从旅行移除文档
   */
  async removeDocument(tripId: string, userId: string, documentId: string): Promise<void> {
    const trip = await this.findById(tripId);
    if (!trip) {
      throw new NotFoundError("Trip");
    }
    if (trip.userId !== userId) {
      throw new UnauthorizedError("You don't have permission to modify this trip");
    }

    // Verify document is in this trip
    const doc = await this.db.documents.findById(documentId);
    if (doc && doc.tripId === tripId) {
      await this.db.documents.update(documentId, { tripId: undefined });
    }

    await this.updateCounts(tripId);
  }

  /**
   * 获取公开旅行列表
   */
  async getPublicTrips(limit = 50): Promise<TripIndex[]> {
    const trips = await this.db.trips.findPublic({
      limit,
      orderBy: 'updatedAt',
      orderDirection: 'desc',
    });

    // Filter trips with photos
    return trips
      .filter(trip => trip.photoCount > 0)
      .map(trip => ({
        id: trip.id,
        name: trip.name,
        description: trip.description,
        coverImageUrl: trip.coverImageUrl,
        startDate: trip.startDate,
        endDate: trip.endDate,
        isPublic: trip.isPublic,
        photoCount: trip.photoCount,
        documentCount: trip.documentCount,
        updatedAt: trip.updatedAt,
      }));
  }

  /**
   * 通过 share_slug 获取公开旅行
   */
  async findByShareSlug(slug: string): Promise<Trip | null> {
    return this.db.trips.findByShareSlug(slug);
  }

  /**
   * 获取旅行的照片列表
   */
  async getTripPhotos(tripId: string, options?: { limit?: number; offset?: number }) {
    const photos = await this.db.photos.findByTripId(tripId, {
      limit: options?.limit,
      offset: options?.offset,
      orderBy: 'dateTime',
      orderDirection: 'desc',
    });

    // Filter out trashed photos
    return photos.filter(p => !p.trashed);
  }

  /**
   * 获取旅行的文档列表
   */
  async getTripDocuments(tripId: string) {
    const documents = await this.db.documents.findByTripId(tripId, {
      orderBy: 'updatedAt',
      orderDirection: 'desc',
    });

    return documents.map(doc => ({
      id: doc.id,
      title: doc.title,
      preview: doc.preview,
      tags: doc.tags,
      updated_at: doc.updatedAt,
    }));
  }

  /**
   * 计算旅行的默认地图中心（基于照片位置）
   */
  async calculateDefaultCenter(
    tripId: string
  ): Promise<{ latitude: number; longitude: number } | null> {
    const photos = await this.db.photos.findByTripId(tripId);

    let totalLat = 0;
    let totalLng = 0;
    let count = 0;

    for (const photo of photos) {
      if (photo.metadata?.location) {
        totalLat += photo.metadata.location.latitude;
        totalLng += photo.metadata.location.longitude;
        count++;
      }
    }

    if (count === 0) return null;

    return {
      latitude: totalLat / count,
      longitude: totalLng / count,
    };
  }

  /**
   * 更新旅行的照片/文档计数
   */
  private async updateCounts(tripId: string): Promise<void> {
    await this.db.trips.updateCounts(tripId);
  }

  /**
   * 设置旅行封面图（使用旅行中的第一张照片）
   */
  async setDefaultCover(tripId: string, userId: string): Promise<Trip | null> {
    const trip = await this.findById(tripId);
    if (!trip || trip.userId !== userId) {
      return null;
    }

    // Get the first photo with a thumbnail
    const photos = await this.db.photos.findByTripId(tripId, {
      limit: 1,
      orderBy: 'dateTime',
      orderDirection: 'asc',
    });

    const firstPhoto = photos.find(p => !p.trashed);
    if (!firstPhoto) {
      return trip;
    }

    const coverUrl = firstPhoto.thumbnailUrl || firstPhoto.fileUrl;

    return this.update(tripId, userId, { coverImageUrl: coverUrl });
  }
}

// Export singleton instance
export const tripStorage = new TripStorage();
