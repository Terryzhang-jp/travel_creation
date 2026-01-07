"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/tailwind/ui/button";
import { AppLayout } from "@/components/layout/app-layout";
import { Palette, BookOpen, Grid3X3, ArrowLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface Trip {
  id: string;
  name: string;
}

export default function NewCanvasPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tripIdFromUrl = searchParams.get("tripId");

  const [title, setTitle] = useState("");
  const [isMagazineMode, setIsMagazineMode] = useState(true);
  const [tripId, setTripId] = useState(tripIdFromUrl || "");
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(false);
  const [tripsLoading, setTripsLoading] = useState(true);

  // Fetch trips for the dropdown
  useEffect(() => {
    const fetchTrips = async () => {
      try {
        const response = await fetch("/api/trips");
        if (response.ok) {
          const data = await response.json();
          setTrips(data.trips || []);
        }
      } catch (error) {
        console.error("Failed to fetch trips:", error);
      } finally {
        setTripsLoading(false);
      }
    };
    fetchTrips();
  }, []);

  const handleCreate = async () => {
    if (!title.trim()) {
      toast.error("Please enter a project title");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch("/api/canvas", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: title.trim(),
          isMagazineMode,
          tripId: tripId || undefined,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        toast.success("Canvas project created!");
        router.push(`/canvas/${data.project.id}`);
      } else if (response.status === 401) {
        router.push("/login");
      } else {
        const errorData = await response.json();
        toast.error(errorData.error || "Failed to create project");
      }
    } catch (error) {
      console.error("Failed to create project:", error);
      toast.error("An error occurred while creating the project");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AppLayout>
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
        {/* Header */}
        <div className="sticky top-0 z-10 border-b border-border/40 bg-background/80 backdrop-blur-xl transition-all">
          <div className="mx-auto max-w-3xl px-4 py-4 sm:px-6 lg:px-8">
            <div className="flex items-center gap-3">
              <button
                onClick={() => router.push("/canvas")}
                className="p-2 rounded-lg hover:bg-muted transition-colors"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Palette className="h-5 w-5" />
              </div>
              <div>
                <h1 className="text-xl font-serif font-bold text-foreground tracking-tight">
                  New Canvas Project
                </h1>
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-widest">
                  Create a new visual project
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="bg-card border border-border/50 rounded-xl p-6 shadow-sm">
            {/* Project Title */}
            <div className="mb-6">
              <label htmlFor="title" className="block text-sm font-medium text-foreground mb-2">
                Project Title
              </label>
              <input
                id="title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Enter a title for your project..."
                className="w-full h-12 px-4 rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                autoFocus
              />
            </div>

            {/* Canvas Type Selection */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-foreground mb-3">
                Canvas Type
              </label>
              <div className="grid grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={() => setIsMagazineMode(true)}
                  className={`p-4 rounded-xl border-2 transition-all ${
                    isMagazineMode
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/50"
                  }`}
                >
                  <div className="flex flex-col items-center">
                    <BookOpen
                      className={`w-10 h-10 mb-3 ${
                        isMagazineMode ? "text-primary" : "text-muted-foreground"
                      }`}
                    />
                    <h3 className={`font-medium ${isMagazineMode ? "text-primary" : "text-foreground"}`}>
                      Magazine Mode
                    </h3>
                    <p className="text-xs text-muted-foreground mt-1 text-center">
                      A4 pages with dual-spread preview. Great for photo journals and magazines.
                    </p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setIsMagazineMode(false)}
                  className={`p-4 rounded-xl border-2 transition-all ${
                    !isMagazineMode
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/50"
                  }`}
                >
                  <div className="flex flex-col items-center">
                    <Grid3X3
                      className={`w-10 h-10 mb-3 ${
                        !isMagazineMode ? "text-primary" : "text-muted-foreground"
                      }`}
                    />
                    <h3 className={`font-medium ${!isMagazineMode ? "text-primary" : "text-foreground"}`}>
                      Infinite Canvas
                    </h3>
                    <p className="text-xs text-muted-foreground mt-1 text-center">
                      Unlimited pan and zoom canvas. Great for mind maps and free-form layouts.
                    </p>
                  </div>
                </button>
              </div>
            </div>

            {/* Trip Association */}
            <div className="mb-8">
              <label htmlFor="trip" className="block text-sm font-medium text-foreground mb-2">
                Associated Trip (Optional)
              </label>
              <select
                id="trip"
                value={tripId}
                onChange={(e) => setTripId(e.target.value)}
                className="w-full h-12 px-4 rounded-lg border border-border bg-background text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                disabled={tripsLoading}
              >
                <option value="">No trip association</option>
                {trips.map((trip) => (
                  <option key={trip.id} value={trip.id}>
                    {trip.name}
                  </option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground mt-2">
                Link this canvas to a trip to organize your travel memories.
              </p>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-3">
              <Button
                variant="outline"
                onClick={() => router.push("/canvas")}
                className="rounded-lg"
              >
                Cancel
              </Button>
              <Button
                onClick={handleCreate}
                disabled={loading || !title.trim()}
                className="rounded-lg min-w-[120px]"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  "Create Canvas"
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
