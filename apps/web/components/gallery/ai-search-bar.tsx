'use client';

import { useState, useCallback, type KeyboardEvent } from 'react';
import { cn } from '@/lib/utils';
import { Search, X, Tag } from 'lucide-react';

export interface AISearchBarProps {
  onSearch: (query: string, tags: string[]) => void;
  placeholder?: string;
  className?: string;
}

export function AISearchBar({
  onSearch,
  placeholder = 'Search photos by description or tags...',
  className,
}: AISearchBarProps) {
  const [query, setQuery] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [isTagMode, setIsTagMode] = useState(false);

  const handleSearch = useCallback(() => {
    onSearch(query.trim(), tags);
  }, [onSearch, query, tags]);

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSearch();
    }
  };

  const handleTagKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && tagInput.trim()) {
      e.preventDefault();
      addTag(tagInput.trim());
    } else if (e.key === 'Backspace' && !tagInput && tags.length > 0) {
      // Remove last tag when backspace is pressed on empty input
      const lastTag = tags[tags.length - 1];
      if (lastTag) {
        removeTag(lastTag);
      }
    } else if (e.key === 'Escape') {
      setIsTagMode(false);
      setTagInput('');
    }
  };

  const addTag = (tag: string) => {
    const normalizedTag = tag.toLowerCase().trim();
    if (normalizedTag && !tags.includes(normalizedTag)) {
      setTags([...tags, normalizedTag]);
    }
    setTagInput('');
  };

  const removeTag = (tagToRemove: string) => {
    setTags(tags.filter((t) => t !== tagToRemove));
  };

  const clearAll = () => {
    setQuery('');
    setTags([]);
    setTagInput('');
    onSearch('', []);
  };

  const hasContent = query.trim() || tags.length > 0;

  return (
    <div className={cn('w-full', className)}>
      <div className="flex flex-col gap-2">
        {/* Main search input */}
        <div className="relative flex items-center">
          <Search className="absolute left-3 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            className="w-full pl-10 pr-20 py-2.5 bg-background border border-input rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:border-transparent transition-all"
          />
          <div className="absolute right-2 flex items-center gap-1">
            {hasContent && (
              <button
                onClick={clearAll}
                className="p-1.5 text-muted-foreground hover:text-foreground rounded transition-colors"
                title="Clear search"
              >
                <X className="w-4 h-4" />
              </button>
            )}
            <button
              onClick={handleSearch}
              className="px-3 py-1.5 bg-primary text-primary-foreground text-sm rounded-md hover:bg-primary/90 transition-colors"
            >
              Search
            </button>
          </div>
        </div>

        {/* Tag input section */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Display selected tags */}
          {tags.map((tag) => (
            <span
              key={tag}
              className="inline-flex items-center gap-1 px-2 py-1 bg-primary/10 text-primary text-sm rounded-full"
            >
              <Tag className="w-3 h-3" />
              {tag}
              <button
                onClick={() => removeTag(tag)}
                className="ml-0.5 hover:text-destructive transition-colors"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}

          {/* Tag input toggle/field */}
          {isTagMode ? (
            <input
              type="text"
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              onKeyDown={handleTagKeyDown}
              onBlur={() => {
                if (tagInput.trim()) {
                  addTag(tagInput.trim());
                }
                setIsTagMode(false);
              }}
              placeholder="Type tag and press Enter"
              autoFocus
              className="flex-1 min-w-[150px] px-2 py-1 bg-background border border-input rounded text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            />
          ) : (
            <button
              onClick={() => setIsTagMode(true)}
              className="inline-flex items-center gap-1 px-2 py-1 text-sm text-muted-foreground hover:text-foreground border border-dashed border-muted-foreground/30 hover:border-muted-foreground rounded-full transition-colors"
            >
              <Tag className="w-3 h-3" />
              Add tag filter
            </button>
          )}
        </div>
      </div>

      {/* Help text */}
      {(query || tags.length > 0) && (
        <p className="mt-2 text-xs text-muted-foreground">
          {query && tags.length > 0
            ? `Searching for "${query}" with tags: ${tags.join(', ')}`
            : query
              ? `Searching for "${query}"`
              : `Filtering by tags: ${tags.join(', ')}`}
        </p>
      )}
    </div>
  );
}
