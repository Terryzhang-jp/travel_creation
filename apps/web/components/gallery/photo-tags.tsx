'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { RefreshCw, Loader2, AlertCircle, Clock, Tags } from 'lucide-react';

export interface PhotoTagsProps {
  tags: {
    scene?: string[];
    mood?: string[];
    lighting?: string[];
    color?: string[];
    subject?: string[];
    composition?: string[];
    usage?: string[];
    extra?: string[];
  };
  description?: string;
  status?: 'pending' | 'processing' | 'completed' | 'failed';
  onTagClick?: (tag: string) => void;
  onRegenerate?: () => void;
  className?: string;
}

const TAG_COLORS: Record<string, string> = {
  scene: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 hover:bg-blue-200 dark:hover:bg-blue-800',
  mood: 'bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200 hover:bg-pink-200 dark:hover:bg-pink-800',
  lighting: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200 hover:bg-yellow-200 dark:hover:bg-yellow-800',
  color: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200 hover:bg-purple-200 dark:hover:bg-purple-800',
  subject: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 hover:bg-green-200 dark:hover:bg-green-800',
  composition: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200 hover:bg-orange-200 dark:hover:bg-orange-800',
  usage: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200 hover:bg-cyan-200 dark:hover:bg-cyan-800',
  extra: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700',
};

const DIMENSION_LABELS: Record<string, string> = {
  scene: 'Scene',
  mood: 'Mood',
  lighting: 'Lighting',
  color: 'Color',
  subject: 'Subject',
  composition: 'Composition',
  usage: 'Usage',
  extra: 'Extra',
};

export function PhotoTags({
  tags,
  description,
  status = 'completed',
  onTagClick,
  onRegenerate,
  className,
}: PhotoTagsProps) {
  const [isRegenerating, setIsRegenerating] = useState(false);

  const handleRegenerate = async () => {
    if (!onRegenerate || isRegenerating) return;
    setIsRegenerating(true);
    try {
      await onRegenerate();
    } finally {
      setIsRegenerating(false);
    }
  };

  const handleTagClick = (tag: string) => {
    if (onTagClick) {
      onTagClick(tag);
    }
  };

  // Count total tags
  const totalTags = Object.values(tags).reduce(
    (sum, arr) => sum + (arr?.length || 0),
    0
  );

  // Render status indicator
  const renderStatus = () => {
    switch (status) {
      case 'pending':
        return (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Clock className="w-4 h-4" />
            <span className="text-sm">Waiting for AI tagging...</span>
          </div>
        );
      case 'processing':
        return (
          <div className="flex items-center gap-2 text-primary">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-sm">Generating tags...</span>
          </div>
        );
      case 'failed':
        return (
          <div className="flex items-center gap-2 text-destructive">
            <AlertCircle className="w-4 h-4" />
            <span className="text-sm">Tag generation failed</span>
            {onRegenerate && (
              <button
                onClick={handleRegenerate}
                disabled={isRegenerating}
                className="ml-2 text-sm text-primary hover:underline disabled:opacity-50"
              >
                Retry
              </button>
            )}
          </div>
        );
      default:
        return null;
    }
  };

  // If not completed, show status
  if (status !== 'completed') {
    return (
      <div className={cn('p-4 bg-card rounded-lg border border-border', className)}>
        {renderStatus()}
      </div>
    );
  }

  // If no tags, show empty state
  if (totalTags === 0 && !description) {
    return (
      <div className={cn('p-4 bg-card rounded-lg border border-border', className)}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Tags className="w-4 h-4" />
            <span className="text-sm">No tags generated yet</span>
          </div>
          {onRegenerate && (
            <button
              onClick={handleRegenerate}
              disabled={isRegenerating}
              className="flex items-center gap-1 px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              {isRegenerating ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <RefreshCw className="w-3 h-3" />
              )}
              Generate Tags
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={cn('p-4 bg-card rounded-lg border border-border space-y-4', className)}>
      {/* Header with regenerate button */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Tags className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-medium text-foreground">
            AI Tags ({totalTags})
          </span>
        </div>
        {onRegenerate && (
          <button
            onClick={handleRegenerate}
            disabled={isRegenerating}
            className="flex items-center gap-1 px-2 py-1 text-xs bg-muted text-muted-foreground rounded hover:bg-accent hover:text-foreground disabled:opacity-50 transition-colors"
            title="Regenerate tags"
          >
            {isRegenerating ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <RefreshCw className="w-3 h-3" />
            )}
            Regenerate
          </button>
        )}
      </div>

      {/* Description */}
      {description && (
        <p className="text-sm text-muted-foreground italic border-l-2 border-primary/30 pl-3">
          {description}
        </p>
      )}

      {/* Tags by dimension */}
      <div className="space-y-3">
        {Object.entries(tags).map(([dimension, dimensionTags]) => {
          if (!dimensionTags || dimensionTags.length === 0) return null;

          return (
            <div key={dimension} className="space-y-1.5">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                {DIMENSION_LABELS[dimension] || dimension}
              </span>
              <div className="flex flex-wrap gap-1.5">
                {dimensionTags.map((tag, index) => (
                  <button
                    key={`${dimension}-${tag}-${index}`}
                    onClick={() => handleTagClick(tag)}
                    disabled={!onTagClick}
                    className={cn(
                      'px-2 py-0.5 text-xs rounded-full transition-colors',
                      TAG_COLORS[dimension] || TAG_COLORS.extra,
                      onTagClick ? 'cursor-pointer' : 'cursor-default'
                    )}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
