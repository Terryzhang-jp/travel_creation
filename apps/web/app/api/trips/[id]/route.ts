import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { tripStorage } from "@/lib/storage/trip-storage";
import { StorageError, NotFoundError } from "@/lib/storage/errors";

/**
 * GET /api/trips/[id]
 * 获取单个旅行详情
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth(request);
    const { id } = await params;

    const trip = await tripStorage.findById(id);

    if (!trip) {
      return NextResponse.json({ error: "Trip not found" }, { status: 404 });
    }

    // Check permission - user can only view their own trips or public trips
    if (trip.userId !== session.userId && !trip.isPublic) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
    }

    // Get additional data
    const photos = await tripStorage.getTripPhotos(id, { limit: 50 });
    const documents = await tripStorage.getTripDocuments(id);
    const defaultCenter = await tripStorage.calculateDefaultCenter(id);

    return NextResponse.json({
      trip: {
        ...trip,
        defaultCenter: trip.defaultCenter || defaultCenter,
      },
      photos,
      documents,
    });
  } catch (error) {
    if (error instanceof StorageError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode }
      );
    }

    console.error("Get trip error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/trips/[id]
 * 更新旅行信息
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth(request);
    const { id } = await params;
    const body = await request.json();

    const trip = await tripStorage.update(id, session.userId, body);

    return NextResponse.json({ trip });
  } catch (error) {
    if (error instanceof StorageError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode }
      );
    }

    console.error("Update trip error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/trips/[id]
 * 删除旅行
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireAuth(request);
    const { id } = await params;

    await tripStorage.delete(id, session.userId);

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof StorageError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode }
      );
    }

    console.error("Delete trip error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
