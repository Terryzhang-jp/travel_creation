'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/tailwind/ui/button';
import { Loader2, Globe, Lock, Calendar, MapPin, FileText } from 'lucide-react';
import type { CreateTripRequest, UpdateTripRequest, Trip } from '@/types/storage';

interface TripFormProps {
  trip?: Trip;
  mode: 'create' | 'edit';
  onSuccess?: (trip: Trip) => void;
  className?: string;
}

export function TripForm({ trip, mode, onSuccess, className = '' }: TripFormProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState(trip?.name || '');
  const [description, setDescription] = useState(trip?.description || '');
  const [startDate, setStartDate] = useState(trip?.startDate?.split('T')[0] || '');
  const [endDate, setEndDate] = useState(trip?.endDate?.split('T')[0] || '');
  const [isPublic, setIsPublic] = useState(trip?.isPublic || false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!name.trim()) {
      setError('Trip name is required');
      return;
    }
    setLoading(true);
    try {
      const payload: CreateTripRequest | UpdateTripRequest = {
        name: name.trim(),
        description: description.trim() || undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        isPublic,
      };
      const url = mode === 'create' ? '/api/trips' : `/api/trips/${trip?.id}`;
      const method = mode === 'create' ? 'POST' : 'PUT';
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to save trip');
      }
      const data = await response.json();
      if (onSuccess) {
        onSuccess(data.trip);
      } else {
        router.push(`/trips/${data.trip.id}`);
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className={`space-y-6 ${className}`}>
      {error && (
        <div className="rounded-lg bg-destructive/10 p-4 text-sm text-destructive">{error}</div>
      )}
      <div className="space-y-2">
        <label htmlFor="name" className="block text-sm font-medium text-foreground">
          Trip Name <span className="text-destructive">*</span>
        </label>
        <div className="relative">
          <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            id="name"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., Summer Road Trip 2024"
            className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-border bg-background text-foreground placeholder-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
            required
          />
        </div>
      </div>
      <div className="space-y-2">
        <label htmlFor="description" className="block text-sm font-medium text-foreground">
          Description
        </label>
        <div className="relative">
          <FileText className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
          <textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe your trip..."
            rows={3}
            className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-border bg-background text-foreground placeholder-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all resize-none"
          />
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <label htmlFor="startDate" className="block text-sm font-medium text-foreground">
            Start Date
          </label>
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              id="startDate"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-border bg-background text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
            />
          </div>
        </div>
        <div className="space-y-2">
          <label htmlFor="endDate" className="block text-sm font-medium text-foreground">
            End Date
          </label>
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              id="endDate"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              min={startDate}
              className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-border bg-background text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
            />
          </div>
        </div>
      </div>
      <div className="space-y-2">
        <label className="block text-sm font-medium text-foreground">Visibility</label>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => setIsPublic(false)}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg border transition-all ${
              !isPublic
                ? 'bg-primary/10 border-primary text-primary'
                : 'border-border text-muted-foreground hover:border-primary/50'
            }`}
          >
            <Lock className="w-4 h-4" />
            <span className="font-medium">Private</span>
          </button>
          <button
            type="button"
            onClick={() => setIsPublic(true)}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-lg border transition-all ${
              isPublic
                ? 'bg-green-500/10 border-green-500 text-green-600'
                : 'border-border text-muted-foreground hover:border-green-500/50'
            }`}
          >
            <Globe className="w-4 h-4" />
            <span className="font-medium">Public</span>
          </button>
        </div>
        <p className="text-xs text-muted-foreground">
          {isPublic ? 'Anyone can view this trip on the Explore page' : 'Only you can see this trip'}
        </p>
      </div>
      <div className="flex gap-3 pt-4">
        <Button type="button" variant="outline" onClick={() => router.back()} className="flex-1" disabled={loading}>
          Cancel
        </Button>
        <Button type="submit" className="flex-1" disabled={loading}>
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
              {mode === 'create' ? 'Creating...' : 'Saving...'}
            </>
          ) : mode === 'create' ? (
            'Create Trip'
          ) : (
            'Save Changes'
          )}
        </Button>
      </div>
    </form>
  );
}
