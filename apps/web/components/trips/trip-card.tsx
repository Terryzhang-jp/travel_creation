'use client';

import Link from 'next/link';
import Image from 'next/image';
import { Calendar, Image as ImageIcon, FileText, Globe, Lock, MapPin } from 'lucide-react';
import type { TripIndex } from '@/types/storage';

interface TripCardProps {
  trip: TripIndex;
  className?: string;
}

function formatDateRange(startDate?: string, endDate?: string): string {
  if (!startDate && !endDate) return 'No dates set';
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };
  if (startDate && endDate) return `${formatDate(startDate)} - ${formatDate(endDate)}`;
  if (startDate) return `From ${formatDate(startDate)}`;
  return `Until ${formatDate(endDate!)}`;
}

export function TripCard({ trip, className = '' }: TripCardProps) {
  return (
    <Link
      href={`/trips/${trip.id}`}
      className={`group block bg-card border border-border rounded-xl overflow-hidden hover:shadow-lg hover:border-primary/30 transition-all duration-300 ${className}`}
    >
      <div className="relative aspect-[16/9] bg-muted overflow-hidden">
        {trip.coverImageUrl ? (
          <Image
            src={trip.coverImageUrl}
            alt={trip.name}
            fill
            className="object-cover transition-transform duration-500 group-hover:scale-105"
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            unoptimized
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-muted to-muted/50">
            <MapPin className="w-12 h-12 text-muted-foreground/30" />
          </div>
        )}
        <div className="absolute top-3 right-3">
          <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${trip.isPublic ? 'bg-green-500/90 text-white' : 'bg-background/90 text-muted-foreground'}`}>
            {trip.isPublic ? (
              <><Globe className="w-3 h-3" /><span>Public</span></>
            ) : (
              <><Lock className="w-3 h-3" /><span>Private</span></>
            )}
          </div>
        </div>
        <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/60 to-transparent" />
        <div className="absolute inset-x-0 bottom-0 p-4">
          <h3 className="text-lg font-serif font-bold text-white line-clamp-1">{trip.name}</h3>
        </div>
      </div>
      <div className="p-4 space-y-3">
        {trip.description && <p className="text-sm text-muted-foreground line-clamp-2">{trip.description}</p>}
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Calendar className="w-3.5 h-3.5" />
          <span>{formatDateRange(trip.startDate, trip.endDate)}</span>
        </div>
        <div className="flex items-center gap-4 pt-2 border-t border-border/50">
          <div className="flex items-center gap-1.5 text-sm">
            <ImageIcon className="w-4 h-4 text-primary" />
            <span className="font-medium">{trip.photoCount}</span>
            <span className="text-muted-foreground">photos</span>
          </div>
          <div className="flex items-center gap-1.5 text-sm">
            <FileText className="w-4 h-4 text-primary" />
            <span className="font-medium">{trip.documentCount}</span>
            <span className="text-muted-foreground">docs</span>
          </div>
        </div>
      </div>
    </Link>
  );
}
