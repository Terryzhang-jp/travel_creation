import { getStorageAdapter } from "@/lib/adapters/storage";
import { NextResponse } from "next/server";

// Use Node.js runtime for better compatibility with Buffer/Stream handling
export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    // 1. Check for file
    if (!req.body) {
      return NextResponse.json(
        { error: "No file provided" },
        { status: 400 }
      );
    }

    // 2. Get metadata
    const filename = req.headers.get("x-vercel-filename") || "image.png";
    const contentType = req.headers.get("content-type") || "application/octet-stream";

    // 3. Prepare file for upload
    // Convert stream to Buffer for reliable upload
    const arrayBuffer = await req.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // 4. Generate unique path
    // documents/timestamp-random-filename
    const uniqueId = crypto.randomUUID();
    const path = `uploads/${Date.now()}-${uniqueId}-${filename}`;
    const bucket = "documents";

    // 5. Upload to Storage
    const storage = getStorageAdapter();
    const { publicUrl } = await storage.upload(bucket, path, buffer, {
      contentType,
      upsert: false
    });

    return NextResponse.json({ url: publicUrl });
  } catch (error: unknown) {
    console.error("Upload error:", error);
    const message = error instanceof Error ? error.message : "Failed to upload file";
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
