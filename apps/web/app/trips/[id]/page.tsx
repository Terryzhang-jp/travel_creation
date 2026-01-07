/**
 * Trip Detail Page
 *
 * Shows trip details, photos, documents, and map.
 */

'use client';

import { useState, useEffect, use } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import {
  Loader2,
  ArrowLeft,
  Edit,
  Trash2,
  Globe,
  Lock,
  Calendar,
  Image as ImageIcon,
  FileText,
  MapPin,
  Plus,
  Map,
  X,
} from 'lucide-react';
import { Button } from '@/components/tailwind/ui/button';
import { AppLayout } from '@/components/layout/app-layout';
import { PhotoMap } from '@/components/maps/photo-map';
import { LocationPhotosModal } from '@/components/photos/location-photos-modal';
import { AddPhotosModal } from '@/components/trips/add-photos-modal';
import { AddDocumentsModal } from '@/components/trips/add-documents-modal';
import type { Trip, Photo, Document } from '@/types/storage';
import type { PhotoLocation } from '@/components/maps/photo-map';

interface TripDetailData extends Trip {
  photos: Photo[];
  documents: Document[];
}

export default function TripDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [trip, setTrip] = useState<TripDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<PhotoLocation | null>(null);
  const [activeTab, setActiveTab] = useState<'photos' | 'documents' | 'map'>('photos');
  const [showAddPhotosModal, setShowAddPhotosModal] = useState(false);
  const [showAddDocumentsModal, setShowAddDocumentsModal] = useState(false);

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
      // API returns { trip, photos, documents } - combine them
      setTrip({
        ...data.trip,
        photos: data.photos || [],
        documents: data.documents || [],
      });
    } catch (error) {
      console.error('Error fetching trip:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this trip? This action cannot be undone.')) {
      return;
    }

    try {
      setDeleting(true);
      const response = await fetch(`/api/trips/${id}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error('Failed to delete trip');
      }

      router.push('/trips');
      router.refresh();
    } catch (error) {
      console.error('Error deleting trip:', error);
      alert('Failed to delete trip');
    } finally {
      setDeleting(false);
    }
  };

  const handleRemovePhoto = async (photoId: string) => {
    if (!confirm('Remove this photo from the trip?')) return;

    try {
      const response = await fetch(`/api/trips/${id}/photos`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ photoId }),
      });

      if (!response.ok) {
        throw new Error('Failed to remove photo');
      }

      fetchTrip();
    } catch (error) {
      console.error('Error removing photo:', error);
      alert('Failed to remove photo from trip');
    }
  };

  const handleRemoveDocument = async (documentId: string) => {
    if (!confirm('Remove this document from the trip?')) return;

    try {
      const response = await fetch(`/api/trips/${id}/documents`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ documentId }),
      });

      if (!response.ok) {
        throw new Error('Failed to remove document');
      }

      fetchTrip();
    } catch (error) {
      console.error('Error removing document:', error);
      alert('Failed to remove document from trip');
    }
  };

  const formatDateRange = (startDate?: string, endDate?: string): string => {
    if (!startDate && !endDate) return 'No dates set';

    const formatDate = (dateStr: string) => {
      const date = new Date(dateStr);
      return date.toLocaleDateString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      });
    };

    if (startDate && endDate) {
      return `${formatDate(startDate)} - ${formatDate(endDate)}`;
    }

    if (startDate) {
      return `From ${formatDate(startDate)}`;
    }

    return `Until ${formatDate(endDate!)}`;
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

  const photosWithLocation = trip.photos.filter(p => p.metadata?.location);

  return (
    <AppLayout>
      <div className="min-h-screen bg-background">
        {/* Hero Section */}
        <div className="relative h-64 md:h-80 bg-muted">
          {trip.coverImageUrl ? (
            <Image
              src={trip.coverImageUrl}
              alt={trip.name}
              fill
              className="object-cover"
              priority
              unoptimized
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-muted to-muted/50">
              <MapPin className="w-20 h-20 text-muted-foreground/20" />
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />

          {/* Back Button */}
          <div className="absolute top-4 left-4">
            <Link
              href="/trips"
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/30 backdrop-blur-sm text-white text-sm hover:bg-black/40 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </Link>
          </div>

          {/* Actions */}
          <div className="absolute top-4 right-4 flex gap-2">
            <Link href={`/trips/${id}/edit`}>
              <Button variant="secondary" size="sm" className="gap-2">
                <Edit className="w-4 h-4" />
                Edit
              </Button>
            </Link>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleDelete}
              disabled={deleting}
              className="gap-2"
            >
              {deleting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Trash2 className="w-4 h-4" />
              )}
              Delete
            </Button>
          </div>

          {/* Title Overlay */}
          <div className="absolute inset-x-0 bottom-0 p-6">
            <div className="max-w-7xl mx-auto">
              <div className="flex items-center gap-2 mb-2">
                {trip.isPublic ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-500/90 text-white text-xs font-medium">
                    <Globe className="w-3 h-3" />
                    Public
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/20 backdrop-blur-sm text-white text-xs font-medium">
                    <Lock className="w-3 h-3" />
                    Private
                  </span>
                )}
              </div>
              <h1 className="text-3xl md:text-4xl font-serif font-bold text-white">
                {trip.name}
              </h1>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Meta Info */}
          <div className="flex flex-wrap items-center gap-6 mb-8 pb-8 border-b border-border">
            {trip.description && (
              <p className="w-full text-muted-foreground">{trip.description}</p>
            )}
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Calendar className="w-4 h-4" />
              <span>{formatDateRange(trip.startDate, trip.endDate)}</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <ImageIcon className="w-4 h-4" />
              <span>{trip.photoCount} photos</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <FileText className="w-4 h-4" />
              <span>{trip.documentCount} documents</span>
            </div>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 p-1 bg-muted/50 rounded-lg mb-6 w-fit">
            {[
              { id: 'photos', label: 'Photos', icon: ImageIcon },
              { id: 'documents', label: 'Documents', icon: FileText },
              { id: 'map', label: 'Map', icon: Map },
            ].map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as typeof activeTab)}
                  className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-all ${
                    activeTab === tab.id
                      ? 'bg-background text-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground hover:bg-background/50'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* Tab Content */}
          {activeTab === 'photos' && (
            <div>
              {trip.photos.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                  <ImageIcon className="w-12 h-12 text-muted-foreground/30 mb-4" />
                  <h3 className="text-lg font-semibold text-foreground mb-2">No photos yet</h3>
                  <p className="text-muted-foreground mb-4">
                    Add photos from your gallery to this trip
                  </p>
                  <Button className="gap-2" onClick={() => setShowAddPhotosModal(true)}>
                    <Plus className="w-4 h-4" />
                    Add Photos
                  </Button>
                </div>
              ) : (
                <>
                  <div className="flex justify-end mb-4">
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-2"
                      onClick={() => setShowAddPhotosModal(true)}
                    >
                      <Plus className="w-4 h-4" />
                      Add Photos
                    </Button>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {trip.photos.map((photo) => (
                      <div
                        key={photo.id}
                        className="relative aspect-square bg-muted rounded-lg overflow-hidden group"
                      >
                        <Image
                          src={photo.thumbnailUrl || photo.fileUrl}
                          alt={photo.fileName}
                          fill
                          className="object-cover transition-transform duration-300 group-hover:scale-105"
                          sizes="(max-width: 768px) 50vw, (max-width: 1200px) 33vw, 25vw"
                          unoptimized
                        />
                        {photo.metadata?.location && (
                          <div className="absolute bottom-2 left-2 px-2 py-1 rounded bg-black/50 backdrop-blur-sm">
                            <MapPin className="w-3 h-3 text-white" />
                          </div>
                        )}
                        {/* Remove button */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRemovePhoto(photo.id);
                          }}
                          className="absolute top-2 right-2 p-1.5 rounded-full bg-black/50 text-white opacity-0 group-hover:opacity-100 hover:bg-red-500 transition-all"
                          title="Remove from trip"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {activeTab === 'documents' && (
            <div>
              {trip.documents.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center">
                  <FileText className="w-12 h-12 text-muted-foreground/30 mb-4" />
                  <h3 className="text-lg font-semibold text-foreground mb-2">No documents yet</h3>
                  <p className="text-muted-foreground mb-4">
                    Add documents from your library to this trip
                  </p>
                  <Button className="gap-2" onClick={() => setShowAddDocumentsModal(true)}>
                    <Plus className="w-4 h-4" />
                    Add Documents
                  </Button>
                </div>
              ) : (
                <>
                  <div className="flex justify-end mb-4">
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-2"
                      onClick={() => setShowAddDocumentsModal(true)}
                    >
                      <Plus className="w-4 h-4" />
                      Add Documents
                    </Button>
                  </div>
                  <div className="space-y-3">
                    {trip.documents.map((doc) => (
                      <div
                        key={doc.id}
                        className="flex items-center gap-4 p-4 bg-card border border-border rounded-lg hover:border-primary/30 transition-colors group"
                      >
                        <Link
                          href={`/documents/${doc.id}`}
                          className="flex items-center gap-4 flex-1 min-w-0"
                        >
                          <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                            <FileText className="w-5 h-5 text-primary" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="font-medium text-foreground truncate">{doc.title}</h4>
                            <p className="text-sm text-muted-foreground">
                              Updated {new Date(doc.updatedAt).toLocaleDateString()}
                            </p>
                          </div>
                        </Link>
                        {/* Remove button */}
                        <button
                          onClick={() => handleRemoveDocument(doc.id)}
                          className="p-2 rounded-full text-muted-foreground opacity-0 group-hover:opacity-100 hover:bg-red-100 hover:text-red-500 transition-all flex-shrink-0"
                          title="Remove from trip"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {activeTab === 'map' && (
            <div className="h-[600px] rounded-xl overflow-hidden border border-border">
              {photosWithLocation.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center p-8">
                  <MapPin className="w-12 h-12 text-muted-foreground/30 mb-4" />
                  <h3 className="text-lg font-semibold text-foreground mb-2">
                    No location data
                  </h3>
                  <p className="text-muted-foreground">
                    Photos with GPS coordinates will appear on the map
                  </p>
                </div>
              ) : (
                <PhotoMap
                  photos={trip.photos}
                  userId={trip.userId}
                  onLocationClick={setSelectedLocation}
                  height="100%"
                />
              )}
            </div>
          )}
        </div>

        {/* Location Photos Modal */}
        <LocationPhotosModal
          isOpen={!!selectedLocation}
          location={selectedLocation}
          onClose={() => setSelectedLocation(null)}
        />

        {/* Add Photos Modal */}
        <AddPhotosModal
          isOpen={showAddPhotosModal}
          onClose={() => setShowAddPhotosModal(false)}
          tripId={id}
          existingPhotoIds={trip.photos.map((p) => p.id)}
          onSuccess={() => {
            setShowAddPhotosModal(false);
            fetchTrip();
          }}
        />

        {/* Add Documents Modal */}
        <AddDocumentsModal
          isOpen={showAddDocumentsModal}
          onClose={() => setShowAddDocumentsModal(false)}
          tripId={id}
          existingDocumentIds={trip.documents.map((d) => d.id)}
          onSuccess={() => {
            setShowAddDocumentsModal(false);
            fetchTrip();
          }}
        />
      </div>
    </AppLayout>
  );
}
