/**
 * Trips List Page
 *
 * Displays all trips for the current user.
 */

'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Loader2, Plus, Briefcase, Search } from 'lucide-react';
import { Button } from '@/components/tailwind/ui/button';
import { AppLayout } from '@/components/layout/app-layout';
import { TripCard } from '@/components/trips/trip-card';
import type { TripIndex } from '@/types/storage';

export default function TripsPage() {
  const [trips, setTrips] = useState<TripIndex[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchTrips();
  }, []);

  const fetchTrips = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/trips');

      if (!response.ok) {
        throw new Error('Failed to fetch trips');
      }

      const data = await response.json();
      setTrips(data.trips);
    } catch (error) {
      console.error('Error fetching trips:', error);
    } finally {
      setLoading(false);
    }
  };

  // Filter trips by search query
  const filteredTrips = trips.filter((trip) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      trip.name.toLowerCase().includes(query) ||
      trip.description?.toLowerCase().includes(query)
    );
  });

  if (loading) {
    return (
      <AppLayout>
        <div className="min-h-screen bg-background flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto mb-4" />
            <p className="text-muted-foreground">Loading your trips...</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="min-h-screen bg-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Header */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
            <div>
              <h1 className="text-3xl font-serif font-bold text-foreground">
                My Trips
              </h1>
              <p className="text-muted-foreground mt-1">
                Organize your photos and documents by trip
              </p>
            </div>
            <Link href="/trips/create">
              <Button className="gap-2">
                <Plus className="w-4 h-4" />
                New Trip
              </Button>
            </Link>
          </div>

          {/* Search */}
          {trips.length > 0 && (
            <div className="relative mb-6">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Search trips..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full md:w-80 pl-10 pr-4 py-2 rounded-lg border border-border bg-background text-foreground placeholder-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
              />
            </div>
          )}

          {/* Trips Grid */}
          {trips.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="w-20 h-20 bg-muted rounded-full flex items-center justify-center mb-6">
                <Briefcase className="w-10 h-10 text-muted-foreground" />
              </div>
              <h2 className="text-xl font-semibold text-foreground mb-2">
                No trips yet
              </h2>
              <p className="text-muted-foreground mb-6 max-w-md">
                Create your first trip to start organizing your travel photos and documents.
              </p>
              <Link href="/trips/create">
                <Button className="gap-2">
                  <Plus className="w-4 h-4" />
                  Create Your First Trip
                </Button>
              </Link>
            </div>
          ) : filteredTrips.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <Search className="w-12 h-12 text-muted-foreground mb-4" />
              <h2 className="text-lg font-semibold text-foreground mb-2">
                No trips found
              </h2>
              <p className="text-muted-foreground">
                Try a different search term
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredTrips.map((trip) => (
                <TripCard key={trip.id} trip={trip} />
              ))}
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}
