/**
 * API Route: /api/photos/ai-metadata/status
 *
 * Get AI metadata processing status statistics
 *
 * GET - Retrieve counts of photos by processing status
 */

import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { photoAiMetadataStorage } from "@/lib/storage/photo-ai-metadata-storage";

export const runtime = "nodejs";

/**
 * GET /api/photos/ai-metadata/status
 * Get AI metadata processing status statistics
 */
export async function GET(req: Request) {
  try {
    // Verify user authentication
    const session = await requireAuth(req);

    // Get statistics
    const stats = await photoAiMetadataStorage.getStats(session.userId);

    return NextResponse.json({
      stats: {
        total: stats.total,
        pending: stats.pending,
        processing: stats.processing,
        completed: stats.completed,
        failed: stats.failed,
      },
      percentComplete:
        stats.total > 0
          ? Math.round((stats.completed / stats.total) * 100)
          : 0,
      isProcessing: stats.processing > 0,
    });
  } catch (error) {
    console.error("Get AI metadata status error:", error);

    if (error instanceof Error && error.message === "Unauthorized") {
      return NextResponse.json(
        { error: "Authentication required" },
        { status: 401 }
      );
    }

    return NextResponse.json(
      {
        error: "Failed to get AI metadata status",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
