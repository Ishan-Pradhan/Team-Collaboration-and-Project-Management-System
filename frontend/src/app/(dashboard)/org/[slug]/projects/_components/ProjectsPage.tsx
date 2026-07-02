'use client';

import { use, useRef, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useOrganizationBySlug, useOrganizationMembers } from '@/hooks/useOrganization';
import { useOrgProjects, useCreateProject, useArchiveProject, useUnarchiveProject, useDeleteProject } from '@/hooks/useProject';
import { useAuthStore } from '@/store/auth.store';
import { parseApiError } from '@/lib/axios';
import { toast } from 'sonner';
import {
  Archive, ArchiveRestore, ChevronDown, ChevronRight,
  FolderOpen, Loader2, MoreHorizontal, Plus, Trash2, Users, X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import type { Project } from '@/types/project.types';
import { ProjectsSkeleton } from '@/components/shared/skeletons/ProjectsSkeleton';
import { ErrorState } from '@/components/shared/ErrorState';
import ManageProjectMembersModal from '@/components/shared/ManageProjectMembersModal';
import ConfirmationDialog from '@/components/shared/ConfirmationDialog';

interface Props {
  params: Promise<{ slug: string }>;
}

const BANNER_COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#f59e0b',
  '#10b981', '#3b82f6', '#ef4444', '#14b8a6',
];

function getColor(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return BANNER_COLORS[Math.abs(h) % BANNER_COLORS.length];
}

function getInitials(name: string) {
  return name.split(' ').slice(0, 2).map((w) => w[0]?.toUpperCase()).join('');
}

// ─── ProjectCard ──────────────────────────────────────────────
function ProjectCard({
  project,
  organizationId,
  isAdmin,
  onNavigate,
  onManageMembers,
  archived = false,
}: {
  project: Project;
  organizationId: string;
  isAdmin: boolean;
  onNavigate: () => void;
  onManageMembers: () => void;
  archived?: boolean;
}) {
  const color = getColor(project.name);
  const initials = getInitials(project.name);
  const [menuOpen, setMenuOpen] = useState(false);
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const archiveMutation = useArchiveProject(project.id, organizationId);
  const unarchiveMutation = useUnarchiveProject(project.id, organizationId);
  const deleteMutation = useDeleteProject(project.id, organizationId);

  useEffect(() => {
    function outside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    }
    if (menuOpen) document.addEventListener('mousedown', outside);
    return () => document.removeEventListener('mousedown', outside);
  }, [menuOpen]);

  return (
    <div className={cn(
      'group relative flex flex-col rounded-xl bg-white border border-gray-200/80',
      'shadow-[0_1px_3px_rgba(0,0,0,0.07)] hover:shadow-[0_4px_16px_rgba(0,0,0,0.10)]',
      'transition-shadow duration-150 overflow-hidden',
      archived && 'opacity-60',
    )}>
      {/* Colored banner */}
      <button
        onClick={onNavigate}
        className="flex h-[72px] w-full items-center justify-center shrink-0"
        style={{ backgroundColor: color }}
      >
        <span className="text-[1.5rem] font-bold text-white/90 tracking-wide select-none">
          {initials}
        </span>
      </button>

      {/* Content */}
      <div className="flex flex-col flex-1 px-4 pt-3.5 pb-4 gap-1.5">
        {/* Name row + menu */}
        <div className="flex items-start justify-between gap-2">
          <button
            onClick={onNavigate}
            className="min-w-0 flex-1 text-left"
          >
            <h3 className="truncate text-sm font-semibold text-gray-800 hover:text-gray-600 transition-colors leading-snug">
              {project.name}
            </h3>
          </button>

          {/* ⋯ menu — always visible on mobile, hover on desktop */}
          {isAdmin && (
            <div ref={menuRef} className="relative shrink-0">
              <button
                onClick={(e) => { e.stopPropagation(); setMenuOpen((o) => !o); }}
                className={cn(
                  'rounded-md p-1 text-gray-400 transition-colors',
                  'opacity-0 group-hover:opacity-100',
                  menuOpen && 'opacity-100 bg-gray-100 text-gray-600',
                  'hover:bg-gray-100 hover:text-gray-600',
                )}
              >
                <MoreHorizontal size={15} />
              </button>

              {menuOpen && (
                <div className="absolute right-0 top-full z-50 mt-1 w-44 rounded-lg border border-gray-100 bg-white py-1 shadow-lg">
                  {!archived && (
                    <button
                      onClick={(e) => { e.stopPropagation(); onManageMembers(); setMenuOpen(false); }}
                      className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                    >
                      <Users size={13} className="text-gray-400" /> Manage Members
                    </button>
                  )}
                  {!archived && (
                    <>
                      <div className="mx-2 my-0.5 border-t border-gray-100" />
                      <button
                        onClick={(e) => { e.stopPropagation(); setShowArchiveConfirm(true); setMenuOpen(false); }}
                        disabled={archiveMutation.isPending}
                        className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-gray-500 hover:bg-gray-50 transition-colors disabled:opacity-50"
                      >
                        <Archive size={13} className="text-gray-400" /> Archive
                      </button>
                    </>
                  )}
                  {archived && (
                    <>
                      <button
                        onClick={(e) => { e.stopPropagation(); unarchiveMutation.mutate(undefined, { onSuccess: () => toast.success('Restored'), onError: (err) => toast.error(parseApiError(err).message) }); setMenuOpen(false); }}
                        disabled={unarchiveMutation.isPending}
                        className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
                      >
                        <ArchiveRestore size={13} className="text-gray-400" /> Restore
                      </button>
                      <div className="mx-2 my-0.5 border-t border-gray-100" />
                      <button
                        onClick={(e) => { e.stopPropagation(); setShowDeleteConfirm(true); setMenuOpen(false); }}
                        disabled={deleteMutation.isPending}
                        className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-red-500 hover:bg-red-50 transition-colors disabled:opacity-50"
                      >
                        <Trash2 size={13} /> Delete permanently
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Description */}
        {project.description ? (
          <p className="text-xs text-gray-400 line-clamp-2 leading-relaxed">
            {project.description}
          </p>
        ) : (
          <p className="text-xs text-gray-300 italic">No description</p>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between mt-auto pt-2 border-t border-gray-100">
          <span className="text-xs text-gray-400">
            {new Date(project.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          </span>
          {project.myRole === 'PROJECT_MANAGER' && (
            <span className="rounded px-1.5 py-0.5 text-[0.7rem] font-semibold bg-violet-50 text-violet-600">
              Manager
            </span>
          )}
          {archived && (
            <span className="rounded px-1.5 py-0.5 text-[0.7rem] font-semibold bg-gray-100 text-gray-500">
              Archived
            </span>
          )}
        </div>
      </div>

      <ConfirmationDialog
        isOpen={showArchiveConfirm}
        onClose={() => setShowArchiveConfirm(false)}
        onConfirm={() => archiveMutation.mutate(undefined, {
          onSuccess: () => { toast.success(`"${project.name}" archived`); setShowArchiveConfirm(false); },
          onError: (err) => toast.error(parseApiError(err).message),
        })}
        title="Archive Project"
        description={`Archive "${project.name}"? It will be hidden from active projects.`}
        confirmText="Archive"
        isLoading={archiveMutation.isPending}
      />
      <ConfirmationDialog
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={() => deleteMutation.mutate(undefined, {
          onSuccess: () => { toast.success(`"${project.name}" deleted`); setShowDeleteConfirm(false); },
          onError: (err) => toast.error(parseApiError(err).message),
        })}
        title="Delete Project"
        description={`Permanently delete "${project.name}"? This cannot be undone.`}
        confirmText="Delete"
        isDestructive
        isLoading={deleteMutation.isPending}
      />
    </div>
  );
}

// ─── CreateModal ──────────────────────────────────────────────
function CreateModal({
  onClose,
  onSubmit,
  isPending,
}: {
  onClose: () => void;
  onSubmit: (name: string, description: string) => void;
  isPending: boolean;
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="relative w-full max-w-md rounded-xl border border-gray-200 bg-white p-6 shadow-xl">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-md p-1 text-gray-400 hover:bg-gray-100 transition-colors"
        >
          <X size={15} />
        </button>

        <h2 className="text-base font-semibold text-gray-800">New Project</h2>
        <p className="mt-0.5 text-xs text-gray-400">Create a project to manage tasks and collaborate with your team.</p>

        <form
          onSubmit={(e) => { e.preventDefault(); if (name.trim()) onSubmit(name.trim(), description.trim()); }}
          className="mt-5 space-y-4"
        >
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-600" htmlFor="new-proj-name">
              Project name
            </label>
            <Input
              id="new-proj-name"
              placeholder="e.g. Mobile App Redesign"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isPending}
              autoFocus
              required
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-600" htmlFor="new-proj-desc">
              Description <span className="font-normal text-gray-400">(optional)</span>
            </label>
            <textarea
              id="new-proj-desc"
              placeholder="What is this project about?"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={isPending}
              className="w-full resize-none rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-800 placeholder:text-gray-400 focus:border-gray-400 focus:outline-none disabled:opacity-50"
            />
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" onClick={onClose} disabled={isPending}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending || !name.trim()}>
              {isPending ? <><Loader2 size={14} className="animate-spin mr-1.5" />Creating…</> : 'Create Project'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────
export default function ProjectsPage({ params }: Props) {
  const { slug } = use(params);
  const router = useRouter();
  const { user } = useAuthStore();

  const { data: org, isLoading: orgLoading, error: orgError, refetch } = useOrganizationBySlug(slug);
  const { data: projects, isLoading: projectsLoading } = useOrgProjects(org?.id ?? '');
  const { data: orgMembers } = useOrganizationMembers(org?.id ?? '');
  const createProject = useCreateProject();

  const [showModal, setShowModal] = useState(false);
  const [managingProject, setManagingProject] = useState<Project | null>(null);
  const [archivedOpen, setArchivedOpen] = useState(false);

  if (orgLoading || projectsLoading) return <ProjectsSkeleton />;
  if (orgError || !org) {
    return (
      <ErrorState
        title="Failed to load projects"
        message="Could not load workspace data."
        onRetry={() => refetch()}
      />
    );
  }

  const activeProjects = projects?.filter((p) => p.status === 'ACTIVE') ?? [];
  const archivedProjects = projects?.filter((p) => p.status === 'ARCHIVED') ?? [];
  const currentMembership = orgMembers?.find((m) => m.userId === user?.id);
  const isAdmin = org.ownerId === user?.id || currentMembership?.role === 'ORG_ADMIN';

  const handleCreate = (name: string, description: string) => {
    createProject.mutate(
      { organizationId: org.id, name, description: description || null },
      {
        onSuccess: (project) => {
          toast.success('Project created');
          setShowModal(false);
          router.push(`/org/${slug}/projects/${project.id}`);
        },
        onError: (err: unknown) => toast.error(parseApiError(err).message),
      }
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Projects</h1>
          <p className="mt-0.5 text-sm text-gray-500">
            {activeProjects.length} active project{activeProjects.length !== 1 ? 's' : ''} in {org.name}
          </p>
        </div>
        {isAdmin && (
          <Button onClick={() => setShowModal(true)} className="gap-1.5">
            <Plus size={15} /> New Project
          </Button>
        )}
      </div>

      {/* Active projects grid */}
      {activeProjects.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-200 bg-white py-20 text-center">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-gray-100">
            <FolderOpen size={22} className="text-gray-400" />
          </div>
          <h2 className="text-sm font-semibold text-gray-700">No projects yet</h2>
          <p className="mt-1 max-w-xs text-sm text-gray-400">
            Create your first project to start organizing your team&apos;s work.
          </p>
          {isAdmin && (
            <Button className="mt-5" onClick={() => setShowModal(true)}>
              <Plus size={15} className="mr-1.5" /> Create Project
            </Button>
          )}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {activeProjects.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              organizationId={org.id}
              isAdmin={isAdmin}
              onNavigate={() => router.push(`/org/${slug}/projects/${project.id}`)}
              onManageMembers={() => setManagingProject(project)}
            />
          ))}
          {/* Inline "New Project" card for admins */}
          {isAdmin && (
            <button
              onClick={() => setShowModal(true)}
              className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-200 bg-transparent h-[168px] text-gray-400 hover:border-gray-300 hover:text-gray-500 hover:bg-white/60 transition-all duration-150"
            >
              <Plus size={20} strokeWidth={1.5} />
              <span className="mt-2 text-sm font-medium">New Project</span>
            </button>
          )}
        </div>
      )}

      {/* Archived section */}
      {archivedProjects.length > 0 && (
        <div className="space-y-3">
          <button
            onClick={() => setArchivedOpen((o) => !o)}
            className="flex items-center gap-2 text-xs font-semibold text-gray-400 hover:text-gray-600 uppercase tracking-widest transition-colors"
          >
            {archivedOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
            Archived ({archivedProjects.length})
          </button>

          {archivedOpen && (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {archivedProjects.map((project) => (
                <ProjectCard
                  key={project.id}
                  project={project}
                  organizationId={org.id}
                  isAdmin={isAdmin}
                  onNavigate={() => router.push(`/org/${slug}/projects/${project.id}`)}
                  onManageMembers={() => setManagingProject(project)}
                  archived
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Create modal */}
      {showModal && (
        <CreateModal
          onClose={() => setShowModal(false)}
          onSubmit={handleCreate}
          isPending={createProject.isPending}
        />
      )}

      {/* Manage members modal */}
      {managingProject && (
        <ManageProjectMembersModal
          projectId={managingProject.id}
          organizationId={org.id}
          createdById={managingProject.createdById}
          isOpen
          isOrgAdmin={isAdmin}
          canManageMembers={isAdmin || managingProject.myRole === 'PROJECT_MANAGER'}
          onClose={() => setManagingProject(null)}
        />
      )}
    </div>
  );
}
