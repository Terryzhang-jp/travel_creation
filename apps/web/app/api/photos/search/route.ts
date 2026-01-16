/**
 * API Route: /api/photos/search
 *
 * Search photos by AI-generated tags and metadata
 *
 * GET - Search photos with various filter options
 */

import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { photoStorage } from "@/lib/storage/photo-storage";
import { photoAiMetadataStorage } from "@/lib/storage/photo-ai-metadata-storage";

export const runtime = "nodejs";

/**
 * GET /api/photos/search
 * Search photos by AI tags and metadata
 *
 * Query Parameters:
 * - tags: string (comma-separated) - General tag search
 * - scene: string (comma-separated) - Scene tags
 * - mood: string (comma-separated) - Mood tags
 * - lighting: string (comma-separated) - Lighting tags
 * - color: string (comma-separated) - Color tags
 * - subject: string (comma-separated) - Subject tags
 * - composition: string (comma-separated) - Composition tags
 * - usage: string (comma-separated) - Usage tags
 * - q: string - Free text search in description
 * - limit: number - Maximum results (default: 50)
 * - offset: number - Pagination offset (default: 0)
 */
export async function GET(req: Request) {
  try {
    // Verify user authentication
    const session = await requireAuth(req);

    // Parse query parameters
    const { searchParams } = new URL(req.url);

    // Parse comma-separated values into arrays
    const parseArray = (param: string | null): string[] | undefined => {
      if (!param) return undefined;
      return param.split(",").map((s) => s.trim()).filter(Boolean);
    };

    const searchOptions = {
      userId: session.userId,
      tags: parseArray(searchParams.get("tags")),
      scene: parseArray(searchParams.get("scene")),
      mood: parseArray(searchParams.get("mood")),
      lighting: parseArray(searchParams.get("lighting")),
      color: parseArray(searchParams.get("color")),
      subject: parseArray(searchParams.get("subject")),
      composition: parseArray(searchParams.get("composition")),
      usage: parseArray(searchParams.get("usage")),
      q: searchParams.get("q") || undefined,
      limit: parseInt(searchParams.get("limit") || "50", 10),
      offset: parseInt(searchParams.get("offset") || "0", 10),
    };

    // Validate limit and offset
    if (searchOptions.limit < 1 || searchOptions.limit > 100) {
      searchOptions.limit = 50;
    }
    if (searchOptions.offset < 0) {
      searchOptions.offset = 0;
    }

    // Check if any search criteria provided
    const hasSearchCriteria =
      searchOptions.tags ||
      searchOptions.scene ||
      searchOptions.mood ||
      searchOptions.lighting ||
      searchOptions.color ||
      searchOptions.subject ||
      searchOptions.composition ||
      searchOptions.usage ||
      searchOptions.q;

    if (!hasSearchCriteria) {
      return NextResponse.json(
        { error: "At least one search parameter is required" },
        { status: 400 }
      );
    }

    // Search for matching photo IDs
    const { photoIds, total } = await photoAiMetadataStorage.search(searchOptions);

    // Get full photo details for matched photos
    const photos = await Promise.all(
      photoIds.map(async (photoId) => {
        const photo = await photoStorage.findById(photoId);
        const aiMetadata = await photoAiMetadataStorage.findByPhotoId(photoId);
        return photo ? { ...photo, aiMetadata } : null;
      })
    );

    // Filter out any null results (photos that no longer exist)
    const validPhotos = photos.filter((p) => p !== null);

    return NextResponse.json({
      photos: validPhotos,
      total,
      limit: searchOptions.limit,
      offset: searchOptions.offset,
      hasMore: searchOptions.offset + validPhotos.length < total,
    });
  } catch (error) {
    console.error("Search photos error:", error);

    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    return NextResponse.json(
      {
        error: "Failed to search photos",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
