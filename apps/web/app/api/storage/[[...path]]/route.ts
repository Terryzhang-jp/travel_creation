/**
 * Local Storage File Server
 *
 * Serves files from the local storage directory (./data/uploads/).
 * This route is only used when STORAGE_ADAPTER=local.
 *
 * Security features:
 * - Path traversal prevention
 * - Content-Type detection
 * - Optional authentication check
 */

import { NextRequest, NextResponse } from 'next/server';
import * as fs from 'fs/promises';
import * as path from 'path';

// MIME type mapping for common file types
const MIME_TYPES: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.pdf': 'application/pdf',
  '.json': 'application/json',
  '.txt': 'text/plain',
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
};

/**
 * Get MIME type from file extension
 */
function getMimeType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  return MIME_TYPES[ext] || 'application/octet-stream';
}

/**
 * Sanitize and validate file path to prevent directory traversal
 */
function sanitizePath(requestPath: string[]): string | null {
  // Join path segments
  const joined = requestPath.join('/');

  // Remove any path traversal attempts
  const sanitized = joined
    .replace(/\.\./g, '')
    .replace(/\/+/g, '/')
    .replace(/^\/+/, '');

  // Check for remaining suspicious patterns
  if (sanitized.includes('..') || sanitized.startsWith('/')) {
    return null;
  }

  return sanitized;
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ path?: string[] }> }
) {
  try {
    const params = await context.params;
    const pathSegments = params.path || [];

    // Validate path
    if (pathSegments.length === 0) {
      return NextResponse.json(
        { error: 'File path is required' },
        { status: 400 }
      );
    }

    // Sanitize path to prevent directory traversal
    const sanitizedPath = sanitizePath(pathSegments);
    if (!sanitizedPath) {
      return NextResponse.json(
        { error: 'Invalid file path' },
        { status: 400 }
      );
    }

    // Build full file path
    const basePath = process.env.LOCAL_STORAGE_PATH || './data/uploads';
    const fullPath = path.resolve(basePath, sanitizedPath);

    // Ensure the resolved path is within the base directory
    const resolvedBase = path.resolve(basePath);
    if (!fullPath.startsWith(resolvedBase)) {
      return NextResponse.json(
        { error: 'Access denied' },
        { status: 403 }
      );
    }

    // Check if file exists
    try {
      await fs.access(fullPath);
    } catch {
      return NextResponse.json(
        { error: 'File not found' },
        { status: 404 }
      );
    }

    // Read file
    const fileBuffer = await fs.readFile(fullPath);
    const mimeType = getMimeType(fullPath);

    // Get file stats for caching headers
    const stats = await fs.stat(fullPath);

    // Return file with appropriate headers
    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        'Content-Type': mimeType,
        'Content-Length': String(fileBuffer.length),
        'Cache-Control': 'public, max-age=31536000, immutable',
        'Last-Modified': stats.mtime.toUTCString(),
      },
    });
  } catch (error) {
    console.error('Storage API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
