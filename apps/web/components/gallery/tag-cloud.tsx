'use client';

import { useState, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { Tag, Grid, List } from 'lucide-react';

export interface TagCloudProps {
  tags: Array<{ tag: string; count: number; dimension?: string }>;
  onTagClick?: (tag: string) => void;
  maxTags?: number;
  className?: string;
}

const DIMENSION_COLORS: Record<string, string> = {
  scene: 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-200 hover:bg-blue-200 dark:hover:bg-blue-800',
  mood: 'bg-pink-100 text-pink-800 dark:bg-pink-900/50 dark:text-pink-200 hover:bg-pink-200 dark:hover:bg-pink-800',
  lighting: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-200 hover:bg-yellow-200 dark:hover:bg-yellow-800',
  color: 'bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-200 hover:bg-purple-200 dark:hover:bg-purple-800',
  subject: 'bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-200 hover:bg-green-200 dark:hover:bg-green-800',
  composition: 'bg-orange-100 text-orange-800 dark:bg-orange-900/50 dark:text-orange-200 hover:bg-orange-200 dark:hover:bg-orange-800',
  usage: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/50 dark:text-cyan-200 hover:bg-cyan-200 dark:hover:bg-cyan-800',
  extra: 'bg-gray-100 text-gray-800 dark:bg-gray-800/50 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700',
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

type ViewMode = 'mixed' | 'grouped';

export function TagCloud({
  tags,
  onTagClick,
  maxTags = 50,
  className,
}: TagCloudProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('mixed');
  const [selectedDimension, setSelectedDimension] = useState<string | null>(null);

  // Sort tags by count and limit
  const sortedTags = useMemo(() => {
    return [...tags]
      .sort((a, b) => b.count - a.count)
      .slice(0, maxTags);
  }, [tags, maxTags]);

  // Group tags by dimension
  const groupedTags = useMemo(() => {
    const groups: Record<string, typeof tags> = {};
    sortedTags.forEach((tag) => {
      const dim = tag.dimension || 'extra';
      if (!groups[dim]) {
        groups[dim] = [];
      }
      groups[dim].push(tag);
    });
    return groups;
  }, [sortedTags]);

  // Get available dimensions
  const availableDimensions = useMemo(() => {
    return Object.keys(groupedTags).sort();
  }, [groupedTags]);

  // Filter tags based on selected dimension
  const displayTags = useMemo(() => {
    if (selectedDimension) {
      return sortedTags.filter((t) => (t.dimension || 'extra') === selectedDimension);
    }
    return sortedTags;
  }, [sortedTags, selectedDimension]);

  // Calculate font size based on count (for visual weight)
  const getTagSize = (count: number): string => {
    const maxCount = Math.max(...tags.map((t) => t.count), 1);
    const ratio = count / maxCount;

    if (ratio > 0.8) return 'text-base font-semibold';
    if (ratio > 0.5) return 'text-sm font-medium';
    if (ratio > 0.2) return 'text-sm';
    return 'text-xs';
  };

  const handleTagClick = (tag: string) => {
    if (onTagClick) {
      onTagClick(tag);
    }
  };

  if (tags.length === 0) {
    return (
      <div className={cn('p-6 bg-card rounded-lg border border-border', className)}>
        <div className="flex flex-col items-center justify-center text-center text-muted-foreground">
          <Tag className="w-8 h-8 mb-2" />
          <p className="text-sm">No tags available yet</p>
          <p className="text-xs mt-1">Process some photos to generate tags</p>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('p-4 bg-card rounded-lg border border-border', className)}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Tag className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-medium text-foreground">
            Popular Tags ({tags.length})
          </span>
        </div>

        {/* View mode toggle */}
        <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
          <button
            onClick={() => setViewMode('mixed')}
            className={cn(
              'p-1.5 rounded transition-colors',
              viewMode === 'mixed'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
            title="Mixed view"
          >
            <Grid className="w-4 h-4" />
          </button>
          <button
            onClick={() => setViewMode('grouped')}
            className={cn(
              'p-1.5 rounded transition-colors',
              viewMode === 'grouped'
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            )}
            title="Grouped by dimension"
          >
            <List className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Dimension filter */}
      {availableDimensions.length > 1 && (
        <div className="flex flex-wrap gap-1.5 mb-4">
          <button
            onClick={() => setSelectedDimension(null)}
            className={cn(
              'px-2 py-1 text-xs rounded-full transition-colors',
              selectedDimension === null
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground hover:bg-accent hover:text-foreground'
            )}
          >
            All
          </button>
          {availableDimensions.map((dim) => (
            <button
              key={dim}
              onClick={() => setSelectedDimension(dim)}
              className={cn(
                'px-2 py-1 text-xs rounded-full transition-colors',
                selectedDimension === dim
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-muted-foreground hover:bg-accent hover:text-foreground'
              )}
            >
              {DIMENSION_LABELS[dim] || dim}
            </button>
          ))}
        </div>
      )}

      {/* Tags display */}
      {viewMode === 'mixed' ? (
        // Mixed view - all tags together
        <div className="flex flex-wrap gap-2">
          {displayTags.map((tagItem, index) => (
            <button
              key={`${tagItem.tag}-${index}`}
              onClick={() => handleTagClick(tagItem.tag)}
              disabled={!onTagClick}
              className={cn(
                'px-2.5 py-1 rounded-full transition-all',
                getTagSize(tagItem.count),
                DIMENSION_COLORS[tagItem.dimension || 'extra'],
                onTagClick ? 'cursor-pointer' : 'cursor-default'
              )}
              title={`${tagItem.tag} (${tagItem.count} photos)`}
            >
              {tagItem.tag}
              <span className="ml-1 opacity-60 text-[10px]">
                {tagItem.count}
              </span>
            </button>
          ))}
        </div>
      ) : (
        // Grouped view - by dimension
        <div className="space-y-4">
          {Object.entries(groupedTags)
            .filter(([dim]) => !selectedDimension || dim === selectedDimension)
            .map(([dimension, dimensionTags]) => (
              <div key={dimension}>
                <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                  {DIMENSION_LABELS[dimension] || dimension} ({dimensionTags.length})
                </h4>
                <div className="flex flex-wrap gap-1.5">
                  {dimensionTags.map((tagItem, index) => (
                    <button
                      key={`${tagItem.tag}-${index}`}
                      onClick={() => handleTagClick(tagItem.tag)}
                      disabled={!onTagClick}
                      className={cn(
                        'px-2 py-0.5 rounded-full transition-all',
                        getTagSize(tagItem.count),
                        DIMENSION_COLORS[dimension],
                        onTagClick ? 'cursor-pointer' : 'cursor-default'
                      )}
                      title={`${tagItem.tag} (${tagItem.count} photos)`}
                    >
                      {tagItem.tag}
                      <span className="ml-1 opacity-60 text-[10px]">
                        {tagItem.count}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}
