import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/session";
import { tripStorage } from "@/lib/storage/trip-storage";
import { StorageError } from "@/lib/storage/errors";

/**
 * GET /api/trips
 * 获取当前用户的所有旅行列表
 */
export async function GET(request: Request) {
  try {
    const session = await requireAuth(request);
    const trips = await tripStorage.findByUserId(session.userId);

    return NextResponse.json({ trips });
  } catch (error) {
    if (error instanceof StorageError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode }
      );
    }

    console.error("Get trips error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/trips
 * 创建新旅行
 */
export async function POST(request: Request) {
  try {
    const session = await requireAuth(request);
    const body = await request.json();

    const { name, description, startDate, endDate, isPublic } = body;

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json(
        { error: "Trip name is required" },
        { status: 400 }
      );
    }

    const trip = await tripStorage.create(session.userId, {
      name: name.trim(),
      description,
      startDate,
      endDate,
      isPublic,
    });

    return NextResponse.json({ trip }, { status: 201 });
  } catch (error) {
    if (error instanceof StorageError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode }
      );
    }

    console.error("Create trip error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
