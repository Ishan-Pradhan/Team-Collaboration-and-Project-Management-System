'use client';

import { use, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useOrganizationBySlug } from '@/hooks/useOrganization';
import { useOrgProjects, useCreateProject } from '@/hooks/useProject';
import { useAuthStore } from '@/store/auth.store';
import { toast } from 'sonner';
import {
  Archive,
  FolderPlus,
  Loader2,
  MoreHorizontal,
  Plus,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import type { Project } from '@/types/project.types';

interface PageProps {
  params: Promise<{ slug: string }>;
}

const statusColors: Record<Project['status'], string> = {
  ACTIVE: 'bg-success/10 text-success border-success/20',
  ARCHIVED: 'bg-surface-muted text-text-muted border-border-subtle',
};

function getProjectInitials(name: string) {
  return name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join('');
}

const PROJECT_COLORS = [
  '#22302a', '#d4a84f', '#6f8c78', '#a86c58', '#4b7f52', '#c38a2d',
];

function getProjectColor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return PROJECT_COLORS[Math.abs(hash) % PROJECT_COLORS.length];
}

export default function ProjectsPage({ params }: PageProps) {
  const { slug } = use(params);
  const router = useRouter();
  const { user } = useAuthStore();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const { data: org, isLoading: orgLoading } = useOrganizationBySlug(slug);
  const { data: projects, isLoading: projectsLoading } = useOrgProjects(org?.id || '');
  const createProject = useCreateProject();

  const [showModal, setShowModal] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  const isLoading = orgLoading || projectsLoading;

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !org?.id) return;

    createProject.mutate(
      {
        organizationId: org.id,
        name: name.trim(),
        description: description.trim() || null,
      },
      {
        onSuccess: (project) => {
          toast.success('Project created!');
          setShowModal(false);
          setName('');
          setDescription('');
          router.push(`/org/${slug}/projects/${project.id}`);
        },
        onError: (err: any) => {
          toast.error(err.response?.data?.message || 'Failed to create project');
        },
      }
    );
  };

  if (!mounted || isLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="animate-spin text-text-secondary" size={24} />
      </div>
    );
  }

  const activeProjects = projects?.filter((p) => p.status === 'ACTIVE') ?? [];
  const archivedProjects = projects?.filter((p) => p.status === 'ARCHIVED') ?? [];
  const isAdmin =
    org?.ownerId === user?.id;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-text-primary">Projects</h1>
          <p className="mt-0.5 text-xs text-text-secondary">
            {activeProjects.length} active project{activeProjects.length !== 1 ? 's' : ''} in {org?.name}
          </p>
        </div>
        <Button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-1.5"
        >
          <Plus size={16} />
          New Project
        </Button>
      </div>

      {/* Active Projects Grid */}
      {activeProjects.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border-subtle bg-white py-16 text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-surface-muted">
            <FolderPlus size={24} className="text-text-muted" />
          </div>
          <h2 className="text-base font-semibold text-text-primary">No projects yet</h2>
          <p className="mt-1.5 max-w-xs text-sm text-text-secondary">
            Create your first project to start organizing your team's work.
          </p>
          <Button className="mt-6" onClick={() => setShowModal(true)}>
            <Plus size={16} className="mr-1.5" />
            Create Project
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {activeProjects.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              slug={slug}
              onNavigate={() => router.push(`/org/${slug}/projects/${project.id}`)}
            />
          ))}
        </div>
      )}

      {/* Archived Projects */}
      {archivedProjects.length > 0 && (
        <div className="space-y-3">
          <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-text-muted">
            <Archive size={14} />
            Archived
          </h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {archivedProjects.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                slug={slug}
                onNavigate={() => router.push(`/org/${slug}/projects/${project.id}`)}
                archived
              />
            ))}
          </div>
        </div>
      )}

      {/* Create Project Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
          <div className="relative w-full max-w-md rounded-xl border border-border bg-white p-6 shadow-modal">
            <button
              onClick={() => setShowModal(false)}
              className="absolute right-4 top-4 rounded p-1 text-text-secondary hover:bg-surface-muted transition-colors"
            >
              <X size={16} />
            </button>

            <h2 className="flex items-center gap-2 text-base font-semibold text-text-primary">
              <FolderPlus size={18} className="text-brand" />
              New Project
            </h2>
            <p className="mt-1 text-xs text-text-secondary">
              Create a project to manage tasks and collaborate.
            </p>

            <form onSubmit={handleCreate} className="mt-5 space-y-4">
              <div className="space-y-1.5">
                <label htmlFor="proj-name" className="text-xs font-semibold text-text-secondary">
                  Project Name *
                </label>
                <Input
                  id="proj-name"
                  placeholder="e.g. Mobile App Redesign"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={createProject.isPending}
                  autoFocus
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="proj-desc" className="text-xs font-semibold text-text-secondary">
                  Description <span className="font-normal text-text-muted">(optional)</span>
                </label>
                <textarea
                  id="proj-desc"
                  placeholder="What is this project about?"
                  rows={3}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  disabled={createProject.isPending}
                  className="w-full rounded-md border border-border-subtle bg-white px-3 py-2 text-sm text-text-primary placeholder-text-muted focus:border-brand focus:outline-none focus:ring-1 focus:ring-brand/20 disabled:opacity-50 resize-none"
                />
              </div>

              <div className="flex justify-end gap-2.5 pt-1">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowModal(false)}
                  disabled={createProject.isPending}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={createProject.isPending || !name.trim()}>
                  {createProject.isPending ? (
                    <>
                      <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    'Create Project'
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function ProjectCard({
  project,
  slug,
  onNavigate,
  archived = false,
}: {
  project: Project;
  slug: string;
  onNavigate: () => void;
  archived?: boolean;
}) {
  const color = getProjectColor(project.name);
  const initials = getProjectInitials(project.name);

  return (
    <button
      onClick={onNavigate}
      className={cn(
        'group relative w-full rounded-xl border bg-white p-5 text-left shadow-card transition-all duration-150 hover:shadow-md hover:border-border',
        archived ? 'border-border-subtle opacity-60' : 'border-border-subtle'
      )}
    >
      <div className="flex items-start gap-3">
        <div
          className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg text-sm font-bold text-white"
          style={{ backgroundColor: color }}
        >
          {initials}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-text-primary group-hover:text-primary transition-colors">
            {project.name}
          </p>
          {project.description && (
            <p className="mt-0.5 line-clamp-2 text-xs text-text-secondary">
              {project.description}
            </p>
          )}
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between">
        <span
          className={cn(
            'inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
            statusColors[project.status]
          )}
        >
          {project.status}
        </span>
        <span className="text-[10px] text-text-muted">
          {new Date(project.createdAt).toLocaleDateString()}
        </span>
      </div>

      {/* Hover highlight bar */}
      <span
        className="absolute inset-y-0 left-0 w-1 rounded-l-xl opacity-0 transition-opacity duration-150 group-hover:opacity-100"
        style={{ backgroundColor: color }}
      />
    </button>
  );
}
