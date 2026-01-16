/**
 * API Route: /api/photos/[id]/ai-metadata
 *
 * Get AI-generated metadata for a single photo
 *
 * GET - Retrieve AI tags and description for a photo
 */

import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { photoStorage } from "@/lib/storage/photo-storage";
import { photoAiMetadataStorage } from "@/lib/storage/photo-ai-metadata-storage";

export const runtime = "nodejs";

/**
 * GET /api/photos/[id]/ai-metadata
 * Get AI metadata for a specific photo
 */
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Verify user authentication
    const session = await requireAuth(req);

    const { id: photoId } = await params;

    // Get the photo to verify ownership
    const photo = await photoStorage.findById(photoId);

    if (!photo) {
      return NextResponse.json({ error: "Photo not found" }, { status: 404 });
    }

    // Permission check: only allow access to own photos
    if (photo.userId !== session.userId) {
      return NextResponse.json(
        { error: "You don't have permission to access this photo" },
        { status: 403 }
      );
    }

    // Get AI metadata
    const aiMetadata = await photoAiMetadataStorage.findByPhotoId(photoId);

    if (!aiMetadata) {
      return NextResponse.json({
        exists: false,
        message: "AI metadata not generated yet",
      });
    }

    return NextResponse.json({
      exists: true,
      metadata: {
        id: aiMetadata.id,
        photoId: aiMetadata.photoId,
        tags: aiMetadata.tags,
        description: aiMetadata.description,
        status: aiMetadata.status,
        model: aiMetadata.model,
        errorMessage: aiMetadata.errorMessage,
        processedAt: aiMetadata.processedAt,
        createdAt: aiMetadata.createdAt,
        updatedAt: aiMetadata.updatedAt,
      },
    });
  } catch (error) {
    console.error("Get photo AI metadata error:", error);

    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    return NextResponse.json(
      {
        error: "Failed to get AI metadata",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
