/**
 * Edit Trip Page
 *
 * Form to edit an existing trip.
 */

'use client';

import { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { AppLayout } from '@/components/layout/app-layout';
import { TripForm } from '@/components/trips/trip-form';
import type { Trip } from '@/types/storage';

export default function EditTripPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [trip, setTrip] = useState<Trip | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTrip();
  }, [id]);

  const fetchTrip = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/trips/${id}`);

      if (!response.ok) {
        if (response.status === 404) {
          router.push('/trips');
          return;
        }
        throw new Error('Failed to fetch trip');
      }

      const data = await response.json();
      setTrip(data.trip);
    } catch (error) {
      console.error('Error fetching trip:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="min-h-screen bg-background flex items-center justify-center">
          <div className="text-center">
            <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto mb-4" />
            <p className="text-muted-foreground">Loading trip...</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  if (!trip) {
    return (
      <AppLayout>
        <div className="min-h-screen bg-background flex items-center justify-center">
          <div className="text-center">
            <p className="text-muted-foreground">Trip not found</p>
            <Link href="/trips" className="text-primary hover:underline mt-2 inline-block">
              Back to Trips
            </Link>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="min-h-screen bg-background">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Back Link */}
          <Link
            href={`/trips/${id}`}
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Trip
          </Link>

          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-serif font-bold text-foreground">
              Edit Trip
            </h1>
            <p className="text-muted-foreground mt-2">
              Update your trip details
            </p>
          </div>

          {/* Form Card */}
          <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
            <TripForm
              trip={trip}
              mode="edit"
              onSuccess={(updatedTrip) => {
                router.push(`/trips/${updatedTrip.id}`);
                router.refresh();
              }}
            />
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
