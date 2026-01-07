"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/tailwind/ui/button";
import { Plus, Search, Trash2, Palette, BookOpen, Grid3X3 } from "lucide-react";
import { AppLayout } from "@/components/layout/app-layout";
import { toast } from "sonner";
import type { CanvasProjectIndex } from "@/types/storage";

export default function CanvasListPage() {
  const [projects, setProjects] = useState<CanvasProjectIndex[]>([]);
  const [filteredProjects, setFilteredProjects] = useState<CanvasProjectIndex[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState<{ id: string; title: string } | null>(null);
  const router = useRouter();

  useEffect(() => {
    fetchProjects();
  }, []);

  useEffect(() => {
    if (searchQuery.trim() === "") {
      setFilteredProjects(projects);
    } else {
      const query = searchQuery.toLowerCase();
      const filtered = projects.filter((project) =>
        project.title.toLowerCase().includes(query)
      );
      setFilteredProjects(filtered);
    }
  }, [searchQuery, projects]);

  const fetchProjects = async () => {
    try {
      setLoading(true);
      const response = await fetch("/api/canvas");

      if (response.ok) {
        const data = await response.json();
        setProjects(data.projects || []);
        setFilteredProjects(data.projects || []);
      } else if (response.status === 401) {
        router.push("/login");
      } else {
        setError("Failed to load canvas projects");
      }
    } catch (err) {
      setError("An error occurred while loading projects");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateProject = () => {
    router.push("/canvas/new");
  };

  const handleDeleteProject = (id: string, title: string) => {
    setDeleteConfirm({ id, title });
  };

  const confirmDelete = async () => {
    if (!deleteConfirm) return;

    const { id, title } = deleteConfirm;
    setDeleteConfirm(null);

    try {
      const response = await fetch(`/api/canvas/${id}`, {
        method: "DELETE",
      });

      if (response.ok) {
        setProjects((prev) => prev.filter((p) => p.id !== id));
        toast.success(`"${title}" has been deleted`);
      } else {
        toast.error("Failed to delete project");
      }
    } catch (err) {
      toast.error("An error occurred while deleting the project");
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins} minutes ago`;
    if (diffHours < 24) return `${diffHours} hours ago`;
    if (diffDays < 7) return `${diffDays} days ago`;
    return date.toLocaleDateString();
  };

  return (
    <AppLayout>
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
        {/* Header */}
        <div className="sticky top-0 z-10 border-b border-border/40 bg-background/80 backdrop-blur-xl transition-all">
          <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Palette className="h-5 w-5" />
                </div>
                <div>
                  <h1 className="text-xl font-serif font-bold text-foreground tracking-tight">
                    Canvas Studio
                  </h1>
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-widest">
                    {projects.length} {projects.length === 1 ? 'Project' : 'Projects'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 flex-1 md:justify-end">
                {/* Search */}
                <div className="relative w-full md:w-64 group">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground group-focus-within:text-primary transition-colors" />
                  <input
                    type="text"
                    placeholder="Search projects..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="h-10 w-full rounded-full border border-border bg-muted/50 pl-9 pr-4 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                  />
                </div>

                <Button onClick={handleCreateProject} className="h-10 rounded-full px-4 shadow-lg shadow-primary/20">
                  <Plus className="mr-2 h-4 w-4" />
                  New Canvas
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          {/* Error Message */}
          {error && (
            <div className="mb-6 rounded-lg bg-red-50 p-4 text-sm text-red-800">
              {error}
            </div>
          )}

          {/* Loading State */}
          {loading && (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <div className="mb-4 inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent"></div>
                <p className="text-gray-600">Loading projects...</p>
              </div>
            </div>
          )}

          {/* Empty State */}
          {!loading && filteredProjects.length === 0 && searchQuery === "" && (
            <div className="flex flex-col items-center justify-center py-20 text-center animate-in fade-in zoom-in duration-500">
              <div className="w-20 h-20 bg-muted/50 rounded-full flex items-center justify-center mb-6">
                <Palette className="h-10 w-10 text-muted-foreground/50" />
              </div>
              <h3 className="mb-2 text-xl font-serif font-bold text-foreground">
                No Canvas Projects Yet
              </h3>
              <p className="mb-8 text-muted-foreground max-w-sm mx-auto">
                Create your first canvas project to start designing visual stories, journals, or creative compositions.
              </p>
              <Button onClick={handleCreateProject} size="lg" className="rounded-full shadow-xl shadow-primary/20">
                <Plus className="mr-2 h-5 w-5" />
                Create First Canvas
              </Button>
            </div>
          )}

          {/* No Search Results */}
          {!loading && filteredProjects.length === 0 && searchQuery !== "" && (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <Search className="mb-4 h-12 w-12 text-muted-foreground/30" />
              <h3 className="mb-2 text-lg font-medium text-foreground">
                No matches found
              </h3>
              <p className="text-muted-foreground">
                Try searching for a different keyword.
              </p>
            </div>
          )}

          {/* Project Grid */}
          {!loading && filteredProjects.length > 0 && (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {filteredProjects.map((project) => (
                <div
                  key={project.id}
                  className="group relative flex flex-col bg-card hover:bg-card/80 border border-border/50 hover:border-primary/50 rounded-xl shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 overflow-hidden"
                >
                  <Link href={`/canvas/${project.id}`} className="flex-1 flex flex-col">
                    {/* Thumbnail or Placeholder */}
                    <div className="aspect-[4/3] bg-gradient-to-br from-primary/5 to-primary/10 flex items-center justify-center relative overflow-hidden">
                      {project.thumbnailUrl ? (
                        <img
                          src={project.thumbnailUrl}
                          alt={project.title}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="flex flex-col items-center justify-center text-muted-foreground/40">
                          {project.isMagazineMode ? (
                            <BookOpen className="w-12 h-12 mb-2" />
                          ) : (
                            <Grid3X3 className="w-12 h-12 mb-2" />
                          )}
                          <span className="text-xs font-medium">
                            {project.isMagazineMode ? "Magazine" : "Infinite Canvas"}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Content */}
                    <div className="p-4 flex-1 flex flex-col">
                      <div className="flex items-start justify-between mb-2">
                        <h3 className="text-base font-serif font-bold text-foreground leading-tight group-hover:text-primary transition-colors line-clamp-2 flex-1">
                          {project.title || "Untitled Canvas"}
                        </h3>
                      </div>

                      <div className="flex items-center gap-2 mt-auto pt-2 border-t border-border/30">
                        <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground/70 bg-muted/50 px-2 py-1 rounded-md">
                          {formatDate(project.updatedAt)}
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          {project.elementCount} elements
                        </span>
                      </div>
                    </div>
                  </Link>

                  {/* Delete Button */}
                  <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        handleDeleteProject(project.id, project.title);
                      }}
                      className="p-2 rounded-lg bg-background/80 backdrop-blur-sm text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors shadow-sm border border-border/50"
                      title="Delete project"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Project Count */}
          {!loading && filteredProjects.length > 0 && (
            <div className="mt-12 text-center">
              <p className="text-xs font-mono text-muted-foreground/50 uppercase tracking-widest">
                {searchQuery
                  ? `Found ${filteredProjects.length} of ${projects.length} projects`
                  : `End of Gallery • ${projects.length} projects`}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-card border border-border rounded-xl p-6 shadow-2xl max-w-md w-full mx-4 animate-in fade-in zoom-in duration-200">
            <h3 className="text-lg font-semibold text-foreground mb-2">Delete Canvas Project</h3>
            <p className="text-muted-foreground mb-6">
              Are you sure you want to delete "{deleteConfirm.title}"? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <Button
                variant="outline"
                onClick={() => setDeleteConfirm(null)}
                className="rounded-lg"
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={confirmDelete}
                className="rounded-lg"
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete
              </Button>
            </div>
          </div>
        </div>
      )}
    </AppLayout>
  );
}
