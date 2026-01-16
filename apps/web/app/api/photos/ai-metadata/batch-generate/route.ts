/**
 * API Route: /api/photos/ai-metadata/batch-generate
 *
 * Batch trigger AI metadata generation for multiple photos
 *
 * POST - Queue multiple photos for AI metadata generation
 */

import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { photoStorage } from "@/lib/storage/photo-storage";
import { photoAiMetadataStorage } from "@/lib/storage/photo-ai-metadata-storage";
import { getPhotoTagger } from "@/lib/ai";

export const runtime = "nodejs";

interface BatchGenerateResult {
  photoId: string;
  status: "queued" | "processing" | "completed" | "failed" | "skipped";
  message?: string;
}

/**
 * POST /api/photos/ai-metadata/batch-generate
 * Batch trigger AI metadata generation for multiple photos
 *
 * Body: {
 *   photoIds: string[],
 *   force?: boolean  // Re-generate even if already completed
 * }
 */
export async function POST(req: Request) {
  try {
    // Verify user authentication
    const session = await requireAuth(req);

    // Parse request body
    const body = await req.json();
    const { photoIds, force = false } = body;

    // Validate input
    if (!Array.isArray(photoIds) || photoIds.length === 0) {
      return NextResponse.json(
        { error: "photoIds must be a non-empty array" },
        { status: 400 }
      );
    }

    // Limit batch size to prevent overload
    const maxBatchSize = 50;
    if (photoIds.length > maxBatchSize) {
      return NextResponse.json(
        { error: `Batch size exceeds maximum of ${maxBatchSize}` },
        { status: 400 }
      );
    }

    // Get PhotoTagger service
    const photoTagger = getPhotoTagger();

    if (!photoTagger.isAvailable()) {
      return NextResponse.json(
        { error: "AI service not available" },
        { status: 503 }
      );
    }

    const results: BatchGenerateResult[] = [];
    let queued = 0;
    let skipped = 0;
    let failed = 0;

    // Process each photo
    for (const photoId of photoIds) {
      try {
        // Get the photo to verify ownership
        const photo = await photoStorage.findById(photoId);

        if (!photo) {
          results.push({
            photoId,
            status: "failed",
            message: "Photo not found",
          });
          failed++;
          continue;
        }

        // Permission check
        if (photo.userId !== session.userId) {
          results.push({
            photoId,
            status: "failed",
            message: "Permission denied",
          });
          failed++;
          continue;
        }

        // Check if metadata already exists
        let aiMetadata = await photoAiMetadataStorage.findByPhotoId(photoId);

        // Skip if already processing
        if (aiMetadata && aiMetadata.status === "processing") {
          results.push({
            photoId,
            status: "processing",
            message: "Already processing",
          });
          skipped++;
          continue;
        }

        // Skip if completed and not forcing
        if (aiMetadata && aiMetadata.status === "completed" && !force) {
          results.push({
            photoId,
            status: "skipped",
            message: "Already completed",
          });
          skipped++;
          continue;
        }

        // Create or update metadata record
        if (!aiMetadata) {
          aiMetadata = await photoAiMetadataStorage.create({
            photoId,
            userId: session.userId,
          });
        }

        // Update status to pending (will be processed)
        await photoAiMetadataStorage.update(aiMetadata.id, {
          status: "pending",
          errorMessage: undefined,
        });

        results.push({
          photoId,
          status: "queued",
          message: "Queued for processing",
        });
        queued++;
      } catch (error) {
        console.error(`Error processing photo ${photoId}:`, error);
        results.push({
          photoId,
          status: "failed",
          message: error instanceof Error ? error.message : "Unknown error",
        });
        failed++;
      }
    }

    // Start background processing for queued photos
    // Note: In a production system, this would be handled by a job queue
    processQueuedPhotos(session.userId, photoTagger).catch((error) => {
      console.error("Background processing error:", error);
    });

    return NextResponse.json({
      total: photoIds.length,
      queued,
      skipped,
      failed,
      results,
      message: `Batch processing started: ${queued} queued, ${skipped} skipped, ${failed} failed`,
    });
  } catch (error) {
    console.error("Batch generate AI metadata error:", error);

    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    return NextResponse.json(
      {
        error: "Failed to start batch generation",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}

/**
 * Background function to process queued photos
 */
async function processQueuedPhotos(
  userId: string,
  photoTagger: ReturnType<typeof getPhotoTagger>
) {
  try {
    // Get pending photos
    const pendingMetadata = await photoAiMetadataStorage.findPending(userId);

    for (const metadata of pendingMetadata) {
      try {
        // Update status to processing
        await photoAiMetadataStorage.update(metadata.id, {
          status: "processing",
        });

        // Get photo details
        const photo = await photoStorage.findById(metadata.photoId);

        if (!photo) {
          await photoAiMetadataStorage.update(metadata.id, {
            status: "failed",
            errorMessage: "Photo not found",
          });
          continue;
        }

        // Analyze the photo
        const result = await photoTagger.analyzePhoto(photo.fileUrl);

        if (!result.success || !result.data) {
          await photoAiMetadataStorage.update(metadata.id, {
            status: "failed",
            errorMessage: result.error || "Unknown error",
          });
          continue;
        }

        // Update with successful result
        await photoAiMetadataStorage.update(metadata.id, {
          tags: result.data.tags,
          description: result.data.description,
          status: "completed",
          model: result.model,
          processedAt: new Date().toISOString(),
        });
      } catch (error) {
        console.error(`Error processing metadata ${metadata.id}:`, error);
        await photoAiMetadataStorage.update(metadata.id, {
          status: "failed",
          errorMessage: error instanceof Error ? error.message : "Unknown error",
        });
      }

      // Small delay between processing to avoid rate limiting
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  } catch (error) {
    console.error("processQueuedPhotos error:", error);
  }
}
