/**
 * Create Trip Page
 *
 * Form to create a new trip.
 */

'use client';

import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { AppLayout } from '@/components/layout/app-layout';
import { TripForm } from '@/components/trips/trip-form';

export default function CreateTripPage() {
  return (
    <AppLayout>
      <div className="min-h-screen bg-background">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Back Link */}
          <Link
            href="/trips"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Trips
          </Link>

          {/* Header */}
          <div className="mb-8">
            <h1 className="text-3xl font-serif font-bold text-foreground">
              Create New Trip
            </h1>
            <p className="text-muted-foreground mt-2">
              Start organizing your travel memories
            </p>
          </div>

          {/* Form Card */}
          <div className="bg-card border border-border rounded-xl p-6 shadow-sm">
            <TripForm mode="create" />
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
