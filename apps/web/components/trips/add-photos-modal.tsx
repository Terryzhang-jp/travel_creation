"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Image from "next/image";
import { X, Loader2, Check, ImageIcon } from "lucide-react";
import { Button } from "@/components/tailwind/ui/button";
import type { Photo } from "@/types/storage";

interface AddPhotosModalProps {
  isOpen: boolean;
  onClose: () => void;
  tripId: string;
  existingPhotoIds: string[];
  onSuccess: () => void;
}

const PAGE_SIZE = 50;

export function AddPhotosModal({
  isOpen,
  onClose,
  tripId,
  existingPhotoIds,
  onSuccess,
}: AddPhotosModalProps) {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [offset, setOffset] = useState(0);

  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);

  // Filter out photos already in the trip
  const existingIdsSet = new Set(existingPhotoIds);
  const availablePhotos = photos.filter((p) => !existingIdsSet.has(p.id));

  // Fetch photos
  const fetchPhotos = useCallback(async (reset = false) => {
    try {
      if (reset) {
        setLoading(true);
        setOffset(0);
        setHasMore(true);
      } else {
        setLoadingMore(true);
      }

      const currentOffset = reset ? 0 : offset;
      const response = await fetch(
        `/api/photos?limit=${PAGE_SIZE}&offset=${currentOffset}&sortOrder=newest`
      );

      if (!response.ok) throw new Error("Failed to fetch photos");

      const data = await response.json();

      if (reset) {
        setPhotos(data.photos);
      } else {
        setPhotos((prev) => [...prev, ...data.photos]);
      }

      setHasMore(data.photos.length === PAGE_SIZE);
      setOffset(currentOffset + data.photos.length);
    } catch (error) {
      console.error("Error fetching photos:", error);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [offset]);

  // Fetch on open
  useEffect(() => {
    if (isOpen) {
      setSelectedIds(new Set());
      fetchPhotos(true);
    }
  }, [isOpen]);

  // Infinite scroll
  useEffect(() => {
    if (!isOpen) return;

    if (observerRef.current) {
      observerRef.current.disconnect();
    }

    observerRef.current = new IntersectionObserver(
      (entries) => {
        const target = entries[0];
        if (target?.isIntersecting && hasMore && !loadingMore && !loading) {
          fetchPhotos(false);
        }
      },
      { threshold: 0.1 }
    );

    if (loadMoreRef.current) {
      observerRef.current.observe(loadMoreRef.current);
    }

    return () => {
      observerRef.current?.disconnect();
    };
  }, [hasMore, loadingMore, loading, isOpen, fetchPhotos]);

  // Toggle selection
  const toggleSelection = (photoId: string) => {
    setSelectedIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(photoId)) {
        newSet.delete(photoId);
      } else {
        newSet.add(photoId);
      }
      return newSet;
    });
  };

  // Select all available
  const selectAll = () => {
    setSelectedIds(new Set(availablePhotos.map((p) => p.id)));
  };

  // Clear selection
  const clearSelection = () => {
    setSelectedIds(new Set());
  };

  // Submit selected photos
  const handleSubmit = async () => {
    if (selectedIds.size === 0) return;

    try {
      setSubmitting(true);

      const response = await fetch(`/api/trips/${tripId}/photos`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photoIds: Array.from(selectedIds) }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to add photos");
      }

      onSuccess();
      onClose();
    } catch (error) {
      console.error("Error adding photos:", error);
      alert(error instanceof Error ? error.message : "Failed to add photos");
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-background w-full max-w-5xl h-[85vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-border">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div>
            <h2 className="text-xl font-semibold">Add Photos to Trip</h2>
            <p className="text-sm text-muted-foreground mt-1">
              {selectedIds.size > 0
                ? `${selectedIds.size} photo${selectedIds.size > 1 ? "s" : ""} selected`
                : "Select photos to add"}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-accent rounded-full transition-colors"
            disabled={submitting}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Selection Actions */}
        {availablePhotos.length > 0 && (
          <div className="flex items-center gap-2 px-6 py-3 border-b border-border bg-muted/30">
            <Button
              variant="outline"
              size="sm"
              onClick={selectAll}
              disabled={submitting}
            >
              Select All ({availablePhotos.length})
            </Button>
            {selectedIds.size > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearSelection}
                disabled={submitting}
              >
                Clear Selection
              </Button>
            )}
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : availablePhotos.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <ImageIcon className="w-12 h-12 text-muted-foreground/30 mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-2">
                No available photos
              </h3>
              <p className="text-muted-foreground">
                {photos.length === 0
                  ? "Upload some photos to your gallery first"
                  : "All your photos are already in this trip"}
              </p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                {availablePhotos.map((photo) => {
                  const isSelected = selectedIds.has(photo.id);
                  return (
                    <button
                      key={photo.id}
                      onClick={() => toggleSelection(photo.id)}
                      disabled={submitting}
                      className={`relative aspect-square bg-muted rounded-lg overflow-hidden group transition-all ${
                        isSelected
                          ? "ring-2 ring-primary ring-offset-2 ring-offset-background"
                          : "hover:ring-2 hover:ring-muted-foreground/30"
                      }`}
                    >
                      <Image
                        src={photo.thumbnailUrl || photo.fileUrl}
                        alt={photo.fileName}
                        fill
                        className="object-cover"
                        sizes="(max-width: 768px) 33vw, (max-width: 1200px) 25vw, 20vw"
                        unoptimized
                      />
                      {/* Selection indicator */}
                      <div
                        className={`absolute top-2 right-2 w-6 h-6 rounded-full flex items-center justify-center transition-all ${
                          isSelected
                            ? "bg-primary text-primary-foreground"
                            : "bg-black/50 text-white opacity-0 group-hover:opacity-100"
                        }`}
                      >
                        {isSelected ? (
                          <Check className="w-4 h-4" />
                        ) : (
                          <div className="w-3 h-3 rounded-full border-2 border-white" />
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Load More */}
              <div ref={loadMoreRef} className="py-8 flex justify-center">
                {loadingMore && (
                  <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                )}
                {!hasMore && photos.length > 0 && (
                  <p className="text-sm text-muted-foreground">
                    No more photos
                  </p>
                )}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-border bg-muted/30">
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={selectedIds.size === 0 || submitting}
          >
            {submitting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Adding...
              </>
            ) : (
              `Add ${selectedIds.size} Photo${selectedIds.size !== 1 ? "s" : ""}`
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
