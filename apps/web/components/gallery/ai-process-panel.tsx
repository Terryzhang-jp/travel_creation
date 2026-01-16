'use client';

import { useState, useEffect, useCallback } from 'react';
import { cn } from '@/lib/utils';
import {
  Sparkles,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Clock,
  RefreshCw,
  Play,
  Pause,
  BarChart3,
} from 'lucide-react';

export interface AIProcessPanelProps {
  className?: string;
}

interface ProcessingStatus {
  total: number;
  pending: number;
  processing: number;
  completed: number;
  failed: number;
}

interface BatchGenerateResponse {
  success: boolean;
  message: string;
  queued?: number;
}

export function AIProcessPanel({ className }: AIProcessPanelProps) {
  const [status, setStatus] = useState<ProcessingStatus | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // Fetch status from API
  const fetchStatus = useCallback(async () => {
    try {
      const response = await fetch('/api/photos/ai-metadata/status');
      if (!response.ok) {
        throw new Error('Failed to fetch status');
      }
      const data = await response.json();
      setStatus(data);
      setLastUpdated(new Date());
      setError(null);
    } catch (err) {
      console.error('Failed to fetch AI processing status:', err);
      setError('Failed to load status');
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  // Auto-refresh when processing
  useEffect(() => {
    if (status?.processing && status.processing > 0) {
      const interval = setInterval(fetchStatus, 5000);
      return () => clearInterval(interval);
    }
  }, [status?.processing, fetchStatus]);

  // Start batch generation
  const handleBatchGenerate = async () => {
    if (isGenerating) return;

    setIsGenerating(true);
    setError(null);

    try {
      const response = await fetch('/api/photos/ai-metadata/batch-generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      const data: BatchGenerateResponse = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to start batch generation');
      }

      // Refresh status after starting
      await fetchStatus();
    } catch (err) {
      console.error('Failed to start batch generation:', err);
      setError(err instanceof Error ? err.message : 'Failed to start batch generation');
    } finally {
      setIsGenerating(false);
    }
  };

  // Calculate progress percentage
  const progressPercentage = status
    ? Math.round(((status.completed + status.failed) / status.total) * 100) || 0
    : 0;

  // Check if there are photos to process
  const hasPhotosToProcess = status && (status.pending > 0 || status.processing > 0);
  const isProcessingActive = status && status.processing > 0;

  if (isLoading) {
    return (
      <div className={cn('p-4 bg-card rounded-lg border border-border', className)}>
        <div className="flex items-center justify-center gap-2 text-muted-foreground">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="text-sm">Loading status...</span>
        </div>
      </div>
    );
  }

  if (error && !status) {
    return (
      <div className={cn('p-4 bg-card rounded-lg border border-border', className)}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-destructive">
            <AlertCircle className="w-4 h-4" />
            <span className="text-sm">{error}</span>
          </div>
          <button
            onClick={fetchStatus}
            className="p-1.5 text-muted-foreground hover:text-foreground rounded transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('p-4 bg-card rounded-lg border border-border space-y-4', className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-primary" />
          <span className="text-sm font-medium text-foreground">AI Tag Generation</span>
        </div>
        <button
          onClick={fetchStatus}
          disabled={isLoading}
          className="p-1.5 text-muted-foreground hover:text-foreground rounded transition-colors disabled:opacity-50"
          title="Refresh status"
        >
          <RefreshCw className={cn('w-4 h-4', isLoading && 'animate-spin')} />
        </button>
      </div>

      {/* Stats Grid */}
      {status && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="flex flex-col items-center p-2 bg-muted/50 rounded-lg">
            <BarChart3 className="w-4 h-4 text-muted-foreground mb-1" />
            <span className="text-lg font-semibold text-foreground">{status.total}</span>
            <span className="text-xs text-muted-foreground">Total</span>
          </div>
          <div className="flex flex-col items-center p-2 bg-muted/50 rounded-lg">
            <Clock className="w-4 h-4 text-yellow-500 mb-1" />
            <span className="text-lg font-semibold text-foreground">{status.pending}</span>
            <span className="text-xs text-muted-foreground">Pending</span>
          </div>
          <div className="flex flex-col items-center p-2 bg-muted/50 rounded-lg">
            <CheckCircle2 className="w-4 h-4 text-green-500 mb-1" />
            <span className="text-lg font-semibold text-foreground">{status.completed}</span>
            <span className="text-xs text-muted-foreground">Completed</span>
          </div>
          <div className="flex flex-col items-center p-2 bg-muted/50 rounded-lg">
            <AlertCircle className="w-4 h-4 text-destructive mb-1" />
            <span className="text-lg font-semibold text-foreground">{status.failed}</span>
            <span className="text-xs text-muted-foreground">Failed</span>
          </div>
        </div>
      )}

      {/* Progress Bar */}
      {status && status.total > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">Overall Progress</span>
            <span className="text-foreground font-medium">{progressPercentage}%</span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div
              className={cn(
                'h-full transition-all duration-500',
                isProcessingActive ? 'bg-primary animate-pulse' : 'bg-primary'
              )}
              style={{ width: `${progressPercentage}%` }}
            />
          </div>
        </div>
      )}

      {/* Processing indicator */}
      {isProcessingActive && (
        <div className="flex items-center gap-2 p-2 bg-primary/10 rounded-lg">
          <Loader2 className="w-4 h-4 text-primary animate-spin" />
          <span className="text-sm text-primary">
            Processing {status.processing} photo{status.processing !== 1 ? 's' : ''}...
          </span>
        </div>
      )}

      {/* Error message */}
      {error && (
        <div className="flex items-center gap-2 p-2 bg-destructive/10 rounded-lg">
          <AlertCircle className="w-4 h-4 text-destructive" />
          <span className="text-sm text-destructive">{error}</span>
        </div>
      )}

      {/* Action Button */}
      <div className="flex flex-col gap-2">
        <button
          onClick={handleBatchGenerate}
          disabled={isGenerating || !hasPhotosToProcess}
          className={cn(
            'w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg font-medium transition-all',
            hasPhotosToProcess
              ? 'bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50'
              : 'bg-muted text-muted-foreground cursor-not-allowed'
          )}
        >
          {isGenerating ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Starting...
            </>
          ) : isProcessingActive ? (
            <>
              <Pause className="w-4 h-4" />
              Processing in Progress
            </>
          ) : hasPhotosToProcess ? (
            <>
              <Play className="w-4 h-4" />
              Generate Tags for {status?.pending || 0} Photos
            </>
          ) : (
            <>
              <CheckCircle2 className="w-4 h-4" />
              All Photos Processed
            </>
          )}
        </button>

        {/* Last updated */}
        {lastUpdated && (
          <p className="text-xs text-center text-muted-foreground">
            Last updated: {lastUpdated.toLocaleTimeString()}
          </p>
        )}
      </div>
    </div>
  );
}
