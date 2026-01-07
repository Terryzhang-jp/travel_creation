import { NextRequest, NextResponse } from "next/server";
import { tripStorage } from "@/lib/storage/trip-storage";

/**
 * GET /api/public/trips
 * 获取公开旅行列表（无需认证）
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "20");

    const trips = await tripStorage.getPublicTrips(Math.min(limit, 50));

    return NextResponse.json({ trips });
  } catch (error) {
    console.error("Get public trips error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
