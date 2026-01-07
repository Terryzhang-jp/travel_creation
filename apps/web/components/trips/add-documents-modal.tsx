"use client";

import { useState, useEffect } from "react";
import { X, Loader2, Check, FileText } from "lucide-react";
import { Button } from "@/components/tailwind/ui/button";
import type { Document } from "@/types/storage";

interface AddDocumentsModalProps {
  isOpen: boolean;
  onClose: () => void;
  tripId: string;
  existingDocumentIds: string[];
  onSuccess: () => void;
}

export function AddDocumentsModal({
  isOpen,
  onClose,
  tripId,
  existingDocumentIds,
  onSuccess,
}: AddDocumentsModalProps) {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Filter out documents already in the trip
  const existingIdsSet = new Set(existingDocumentIds);
  const availableDocuments = documents.filter((d) => !existingIdsSet.has(d.id));

  // Fetch documents
  const fetchDocuments = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/documents");

      if (!response.ok) throw new Error("Failed to fetch documents");

      const data = await response.json();
      setDocuments(data.documents || []);
    } catch (error) {
      console.error("Error fetching documents:", error);
    } finally {
      setLoading(false);
    }
  };

  // Fetch on open
  useEffect(() => {
    if (isOpen) {
      setSelectedIds(new Set());
      fetchDocuments();
    }
  }, [isOpen]);

  // Toggle selection
  const toggleSelection = (docId: string) => {
    setSelectedIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(docId)) {
        newSet.delete(docId);
      } else {
        newSet.add(docId);
      }
      return newSet;
    });
  };

  // Select all available
  const selectAll = () => {
    setSelectedIds(new Set(availableDocuments.map((d) => d.id)));
  };

  // Clear selection
  const clearSelection = () => {
    setSelectedIds(new Set());
  };

  // Submit selected documents
  const handleSubmit = async () => {
    if (selectedIds.size === 0) return;

    try {
      setSubmitting(true);

      // Add documents one by one (API accepts single documentId)
      const results = await Promise.allSettled(
        Array.from(selectedIds).map((documentId) =>
          fetch(`/api/trips/${tripId}/documents`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ documentId }),
          })
        )
      );

      const failed = results.filter((r) => r.status === "rejected").length;
      if (failed > 0) {
        console.warn(`${failed} document(s) failed to add`);
      }

      onSuccess();
      onClose();
    } catch (error) {
      console.error("Error adding documents:", error);
      alert(error instanceof Error ? error.message : "Failed to add documents");
    } finally {
      setSubmitting(false);
    }
  };

  // Format date
  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-background w-full max-w-3xl max-h-[85vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-border">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div>
            <h2 className="text-xl font-semibold">Add Documents to Trip</h2>
            <p className="text-sm text-muted-foreground mt-1">
              {selectedIds.size > 0
                ? `${selectedIds.size} document${selectedIds.size > 1 ? "s" : ""} selected`
                : "Select documents to add"}
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
        {availableDocuments.length > 0 && (
          <div className="flex items-center gap-2 px-6 py-3 border-b border-border bg-muted/30">
            <Button
              variant="outline"
              size="sm"
              onClick={selectAll}
              disabled={submitting}
            >
              Select All ({availableDocuments.length})
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
            <div className="flex items-center justify-center h-64">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : availableDocuments.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 text-center">
              <FileText className="w-12 h-12 text-muted-foreground/30 mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-2">
                No available documents
              </h3>
              <p className="text-muted-foreground">
                {documents.length === 0
                  ? "Create some documents first"
                  : "All your documents are already in this trip"}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {availableDocuments.map((doc) => {
                const isSelected = selectedIds.has(doc.id);
                return (
                  <button
                    key={doc.id}
                    onClick={() => toggleSelection(doc.id)}
                    disabled={submitting}
                    className={`w-full flex items-center gap-4 p-4 rounded-lg border transition-all text-left ${
                      isSelected
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-muted-foreground/30 hover:bg-accent/50"
                    }`}
                  >
                    {/* Selection indicator */}
                    <div
                      className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 transition-all ${
                        isSelected
                          ? "bg-primary text-primary-foreground"
                          : "border-2 border-muted-foreground/30"
                      }`}
                    >
                      {isSelected && <Check className="w-4 h-4" />}
                    </div>

                    {/* Icon */}
                    <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                      <FileText className="w-5 h-5 text-primary" />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-foreground truncate">
                        {doc.title}
                      </h4>
                      {doc.preview && (
                        <p className="text-sm text-muted-foreground truncate mt-0.5">
                          {doc.preview}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground mt-1">
                        Updated {formatDate(doc.updatedAt)}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
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
              `Add ${selectedIds.size} Document${selectedIds.size !== 1 ? "s" : ""}`
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
