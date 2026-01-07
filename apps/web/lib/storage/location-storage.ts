/**
 * Location Storage Layer
 *
 * Manages CRUD operations for user locations in the location library.
 * Each location represents a place that users can associate with their photos.
 */

import { v4 as uuidv4 } from "uuid";
import type { Location, LocationIndex } from "@/types/storage";
import type { GeocodingResult } from "@/lib/maps/types";
import { NotFoundError } from "./errors";
import { getDatabaseAdapter } from "@/lib/adapters/database";

/**
 * Location Storage Class
 *
 * Provides CRUD operations for location library entries.
 */
export class LocationStorage {
  private get db() {
    return getDatabaseAdapter();
  }

  /**
   * Create a new location
   *
   * @param userId - Owner of the location
   * @param name - User-defined name (e.g., "Home", "Eiffel Tower")
   * @param coordinates - Latitude and longitude
   * @param address - Optional address information from geocoding
   * @param options - Optional metadata (placeId, category, notes, isPublic)
   * @returns Created location
   */
  async create(
    userId: string,
    name: string,
    coordinates: { latitude: number; longitude: number },
    address?: GeocodingResult,
    options?: {
      placeId?: string;
      category?: string;
      notes?: string;
      isPublic?: boolean;
    }
  ): Promise<Location> {
    return this.db.locations.create({
      id: uuidv4(),
      userId,
      name: name.trim(),
      coordinates,
      address: address
        ? {
            formattedAddress: address.formattedAddress,
            country: address.country,
            state: address.state,
            city: address.city,
            postalCode: address.postalCode,
          }
        : undefined,
      placeId: options?.placeId,
      category: options?.category,
      notes: options?.notes,
      isPublic: options?.isPublic ?? false,
    });
  }

  /**
   * Find a location by ID
   *
   * @param locationId - Location ID
   * @param userId - User ID (for authorization)
   * @returns Location or null if not found
   */
  async findById(locationId: string, userId: string): Promise<Location | null> {
    const location = await this.db.locations.findById(locationId);
    if (!location || location.userId !== userId) {
      return null;
    }
    return location;
  }

  /**
   * Get all locations for a user (returns index list)
   *
   * @param userId - User ID
   * @returns Array of location indexes, sorted by usage count (descending)
   */
  async findByUserId(userId: string): Promise<LocationIndex[]> {
    const locations = await this.db.locations.findByUserId(userId, {
      orderBy: 'usage_count',
      orderDirection: 'desc',
    });

    return locations.map(location => ({
      id: location.id,
      userId: location.userId,
      name: location.name,
      coordinates: location.coordinates,
      formattedAddress: location.address?.formattedAddress,
      usageCount: location.usageCount,
      lastUsedAt: location.lastUsedAt,
      isPublic: location.isPublic,
      updatedAt: location.updatedAt,
    }));
  }

  /**
   * Update a location
   *
   * @param locationId - Location ID
   * @param userId - User ID (for authorization)
   * @param updates - Fields to update
   * @returns Updated location
   */
  async update(
    locationId: string,
    userId: string,
    updates: Partial<
      Pick<Location, "name" | "coordinates" | "address" | "category" | "notes" | "isPublic">
    >
  ): Promise<Location> {
    // Verify ownership first
    const existing = await this.findById(locationId, userId);
    if (!existing) {
      throw new NotFoundError("Location");
    }

    return this.db.locations.update(locationId, {
      name: updates.name,
      coordinates: updates.coordinates,
      address: updates.address,
      category: updates.category,
      notes: updates.notes,
      isPublic: updates.isPublic,
    });
  }

  /**
   * Delete a location
   *
   * Note: This does NOT remove the location from photos that reference it.
   * Photos will keep their location data but lose the library link.
   *
   * @param locationId - Location ID
   * @param userId - User ID (for authorization)
   */
  async delete(locationId: string, userId: string): Promise<void> {
    // Verify ownership first
    const existing = await this.findById(locationId, userId);
    if (!existing) {
      throw new NotFoundError("Location");
    }

    await this.db.locations.delete(locationId);
  }

  /**
   * Search locations by name
   *
   * @param userId - User ID
   * @param query - Search query (case-insensitive)
   * @returns Matching locations
   */
  async search(userId: string, query: string): Promise<LocationIndex[]> {
    const locations = await this.db.locations.search(userId, query);

    return locations.map(location => ({
      id: location.id,
      userId: location.userId,
      name: location.name,
      coordinates: location.coordinates,
      formattedAddress: location.address?.formattedAddress,
      usageCount: location.usageCount,
      lastUsedAt: location.lastUsedAt,
      isPublic: location.isPublic,
      updatedAt: location.updatedAt,
    }));
  }

  /**
   * Increment usage count for a location
   * This is called when a photo is associated with this location.
   *
   * @param locationId - Location ID
   * @param userId - User ID (for authorization)
   */
  async incrementUsage(locationId: string, userId: string): Promise<void> {
    // Verify ownership first
    const location = await this.findById(locationId, userId);
    if (!location) {
      throw new NotFoundError("Location");
    }

    await this.db.locations.incrementUsage(locationId);
  }

  /**
   * Decrement usage count for a location
   * This is called when a photo's association with this location is removed.
   *
   * @param locationId - Location ID
   * @param userId - User ID (for authorization)
   */
  async decrementUsage(locationId: string, userId: string): Promise<void> {
    // Get existing location
    const location = await this.findById(locationId, userId);
    if (!location) {
      // Location might have been deleted, silently return
      return;
    }

    await this.db.locations.decrementUsage(locationId);
  }

  /**
   * Get all public locations (shared by all users)
   *
   * @returns Array of public location indexes, sorted by usage count (descending)
   */
  async findPublicLocations(): Promise<LocationIndex[]> {
    const locations = await this.db.locations.findPublic();

    return locations.map(location => ({
      id: location.id,
      userId: location.userId,
      name: location.name,
      coordinates: location.coordinates,
      formattedAddress: location.address?.formattedAddress,
      usageCount: location.usageCount,
      lastUsedAt: location.lastUsedAt,
      isPublic: location.isPublic,
      updatedAt: location.updatedAt,
    }));
  }

  /**
   * Get all available locations for a user (their own + public locations)
   *
   * @param userId - User ID
   * @returns Array of location indexes (user's own + public), sorted by usage count
   */
  async findAvailableLocations(userId: string): Promise<LocationIndex[]> {
    const locations = await this.db.locations.findAvailable(userId);

    return locations.map(location => ({
      id: location.id,
      userId: location.userId,
      name: location.name,
      coordinates: location.coordinates,
      formattedAddress: location.address?.formattedAddress,
      usageCount: location.usageCount,
      lastUsedAt: location.lastUsedAt,
      isPublic: location.isPublic,
      updatedAt: location.updatedAt,
    }));
  }
}

// Export singleton
export const locationStorage = new LocationStorage();
