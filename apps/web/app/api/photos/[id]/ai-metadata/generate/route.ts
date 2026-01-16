/**
 * API Route: /api/photos/[id]/ai-metadata/generate
 *
 * Trigger AI metadata generation for a single photo
 *
 * POST - Generate AI tags and description for a photo
 */

import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { photoStorage } from "@/lib/storage/photo-storage";
import { photoAiMetadataStorage } from "@/lib/storage/photo-ai-metadata-storage";
import { getPhotoTagger } from "@/lib/ai";

export const runtime = "nodejs";

/**
 * POST /api/photos/[id]/ai-metadata/generate
 * Trigger AI metadata generation for a specific photo
 */
export async function POST(
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

    // Check if metadata already exists
    let aiMetadata = await photoAiMetadataStorage.findByPhotoId(photoId);

    // If processing or completed recently, return current status
    if (aiMetadata && aiMetadata.status === "processing") {
      return NextResponse.json({
        status: "processing",
        message: "AI metadata generation is already in progress",
        metadata: aiMetadata,
      });
    }

    // Create or update metadata record
    if (!aiMetadata) {
      aiMetadata = await photoAiMetadataStorage.create({
        photoId,
        userId: session.userId,
      });
    }

    // Update status to processing
    aiMetadata = await photoAiMetadataStorage.update(aiMetadata.id, {
      status: "processing",
    });

    // Get PhotoTagger service
    const photoTagger = getPhotoTagger();

    if (!photoTagger.isAvailable()) {
      await photoAiMetadataStorage.update(aiMetadata.id, {
        status: "failed",
        errorMessage: "No AI service available",
      });

      return NextResponse.json(
        { error: "AI service not available" },
        { status: 503 }
      );
    }

    // Build the image URL
    const imageUrl = photo.fileUrl;

    // Analyze the photo
    const result = await photoTagger.analyzePhoto(imageUrl);

    if (!result.success || !result.data) {
      // Update with error
      const updatedMetadata = await photoAiMetadataStorage.update(
        aiMetadata.id,
        {
          status: "failed",
          errorMessage: result.error || "Unknown error",
        }
      );

      return NextResponse.json(
        {
          status: "failed",
          error: result.error || "Failed to analyze photo",
          metadata: updatedMetadata,
        },
        { status: 500 }
      );
    }

    // Update with successful result
    const updatedMetadata = await photoAiMetadataStorage.update(aiMetadata.id, {
      tags: result.data.tags,
      description: result.data.description,
      status: "completed",
      model: result.model,
      processedAt: new Date().toISOString(),
    });

    return NextResponse.json({
      status: "completed",
      message: "AI metadata generated successfully",
      metadata: updatedMetadata,
    });
  } catch (error) {
    console.error("Generate photo AI metadata error:", error);

    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    return NextResponse.json(
      {
        error: "Failed to generate AI metadata",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
