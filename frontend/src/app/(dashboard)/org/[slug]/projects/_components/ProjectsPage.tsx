'use client';

import { use, useRef, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useOrganizationBySlug, useOrganizationMembers } from '@/hooks/useOrganization';
import { useOrgProjects, useCreateProject, useArchiveProject, useUnarchiveProject, useDeleteProject } from '@/hooks/useProject';
import { useAuthStore } from '@/store/auth.store';
import { parseApiError } from '@/lib/axios';
import { avatarColor } from '@/lib/avatarColor';
import { toast } from 'sonner';
import {
  Archive, ArchiveRestore, ChevronDown, ChevronRight,
  FolderOpen, Loader2, MoreHorizontal, Plus, Search, Trash2, Users, X,
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

type SortOption = 'name' | 'updated' | 'role';

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: 'name', label: 'Name' },
  { value: 'updated', label: 'Updated' },
  { value: 'role', label: 'My role' },
];

// Column widths shared by the list header and every row, so the two stay
// pixel-aligned regardless of content.
const ROW_GRID = 'sm:grid-cols-[minmax(0,1fr)_88px_84px_150px_92px]';

function getInitials(name: string) {
  return name.split(' ').slice(0, 2).map((w) => w[0]?.toUpperCase()).join('');
}

function matchesSearch(project: Project, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return project.name.toLowerCase().includes(q) || (project.description ?? '').toLowerCase().includes(q);
}

function sortProjects(list: Project[], sortBy: SortOption): Project[] {
  const copy = [...list];
  if (sortBy === 'name') {
    copy.sort((a, b) => a.name.localeCompare(b.name));
  } else if (sortBy === 'updated') {
    copy.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  } else {
    copy.sort((a, b) => Number(b.myRole === 'PROJECT_MANAGER') - Number(a.myRole === 'PROJECT_MANAGER'));
  }
  return copy;
}

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
}

// ─── ProjectRow ───────────────────────────────────────────────
function ProjectRow({
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
  const color = avatarColor(project.name);
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

  const progressPct = project.taskCount > 0
    ? Math.round((project.completedTaskCount / project.taskCount) * 100)
    : null;

  return (
    <div className={cn('group relative', archived && 'opacity-60')}>
      <div
        className={cn(
          'grid grid-cols-1 items-start gap-x-4 gap-y-2 px-6 py-4 transition-colors hover:bg-surface-hover sm:items-center',
          ROW_GRID,
          isAdmin && 'sm:pr-11',
        )}
      >
        {/* Identity + name + description */}
        <button
          onClick={onNavigate}
          className="flex min-w-0 items-center gap-3 rounded text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-xs font-bold text-white/90 select-none"
            style={{ backgroundColor: color }}
          >
            {initials}
          </span>
          <span className="min-w-0">
            <span className="flex items-center gap-2">
              <span className="truncate text-sm font-semibold text-text-primary">{project.name}</span>
              {archived && (
                <span className="shrink-0 rounded px-1.5 py-0.5 text-[0.65rem] font-semibold uppercase tracking-wide bg-surface-muted text-text-muted">
                  Archived
                </span>
              )}
            </span>
            <span className="block truncate text-xs text-text-muted">
              {project.description || 'No description'}
            </span>
          </span>
        </button>

        {/* Meta cluster — wraps into a chip row on mobile, becomes discrete
           grid cells on sm+ via `sm:contents` so it inherits ROW_GRID's columns. */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 pl-12 text-xs sm:contents sm:pl-0">
          <span className={cn(
            'font-semibold sm:text-right sm:text-sm',
            project.myRole === 'PROJECT_MANAGER' ? 'text-brand-hover' : 'text-text-muted',
          )}>
            {project.myRole === 'PROJECT_MANAGER' ? 'Manager' : '—'}
          </span>

          <span className="flex items-center gap-1 text-text-muted sm:justify-end">
            <Users size={11} />
            {project.memberCount}
          </span>

          <span className="flex items-center gap-2 sm:w-full">
            {progressPct === null ? (
              <span className="text-text-muted">No tasks</span>
            ) : (
              <>
                <span className="h-1.5 w-16 shrink-0 overflow-hidden rounded-full bg-surface-muted sm:w-full">
                  <span
                    className="block h-full rounded-full bg-success"
                    style={{ width: `${progressPct}%` }}
                  />
                </span>
                <span className="shrink-0 tabular-nums text-text-muted">
                  {project.completedTaskCount}/{project.taskCount}
                </span>
              </>
            )}
          </span>

          <span className="text-text-muted sm:text-right">
            {timeAgo(project.updatedAt)}
          </span>
        </div>
      </div>

      {/* ⋯ menu — always reachable on mobile, hover-revealed on desktop */}
      {isAdmin && (
        <div ref={menuRef} className="absolute right-3 top-3.5 sm:right-4">
          <button
            onClick={(e) => { e.stopPropagation(); setMenuOpen((o) => !o); }}
            className={cn(
              'rounded-md p-1 text-text-muted transition-colors',
              'sm:opacity-0 sm:group-hover:opacity-100',
              menuOpen && 'opacity-100 bg-surface-hover text-text-secondary',
              'hover:bg-surface-hover hover:text-text-secondary',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:opacity-100',
            )}
          >
            <MoreHorizontal size={15} />
          </button>

          {menuOpen && (
            <div className="absolute right-0 top-full z-50 mt-1 w-44 rounded-lg border border-border-subtle bg-surface py-1 shadow-lg">
              {!archived && (
                <>
                  <button
                    onClick={(e) => { e.stopPropagation(); onManageMembers(); setMenuOpen(false); }}
                    className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-text-primary hover:bg-surface-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <Users size={13} className="text-text-muted" /> Manage Members
                  </button>
                  <div className="mx-2 my-0.5 border-t border-border-subtle" />
                  <button
                    onClick={(e) => { e.stopPropagation(); setShowArchiveConfirm(true); setMenuOpen(false); }}
                    disabled={archiveMutation.isPending}
                    className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-text-secondary hover:bg-surface-muted transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <Archive size={13} className="text-text-muted" /> Archive
                  </button>
                </>
              )}
              {archived && (
                <>
                  <button
                    onClick={(e) => { e.stopPropagation(); unarchiveMutation.mutate(undefined, { onSuccess: () => toast.success('Restored'), onError: (err) => toast.error(parseApiError(err).message) }); setMenuOpen(false); }}
                    disabled={unarchiveMutation.isPending}
                    className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-text-primary hover:bg-surface-muted transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <ArchiveRestore size={13} className="text-text-muted" /> Restore
                  </button>
                  <div className="mx-2 my-0.5 border-t border-border-subtle" />
                  <button
                    onClick={(e) => { e.stopPropagation(); setShowDeleteConfirm(true); setMenuOpen(false); }}
                    disabled={deleteMutation.isPending}
                    className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-danger hover:bg-danger-soft transition-colors disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <Trash2 size={13} /> Delete permanently
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      )}

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
      <div className="relative w-full max-w-md rounded-xl border border-border bg-surface p-6 shadow-modal">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-md p-1 text-text-secondary hover:bg-surface-muted transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <X size={15} />
        </button>

        <h2 className="text-base font-semibold text-text-primary">New Project</h2>
        <p className="mt-0.5 text-xs text-text-secondary">Create a project to manage tasks and collaborate with your team.</p>

        <form
          onSubmit={(e) => { e.preventDefault(); if (name.trim()) onSubmit(name.trim(), description.trim()); }}
          className="mt-5 space-y-4"
        >
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-text-secondary" htmlFor="new-proj-name">
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
            <label className="text-xs font-semibold text-text-secondary" htmlFor="new-proj-desc">
              Description <span className="font-normal text-text-muted">(optional)</span>
            </label>
            <textarea
              id="new-proj-desc"
              placeholder="What is this project about?"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={isPending}
              className="w-full resize-none rounded-lg border border-border-subtle bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
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

// ─── ProjectList ──────────────────────────────────────────────
function ProjectList({
  projects,
  organizationId,
  isAdmin,
  slug,
  router,
  archived,
  onManageMembers,
  trailingAction,
}: {
  projects: Project[];
  organizationId: string;
  isAdmin: boolean;
  slug: string;
  router: ReturnType<typeof useRouter>;
  archived?: boolean;
  onManageMembers: (project: Project) => void;
  trailingAction?: React.ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-border-subtle bg-surface">
      <div className={cn('hidden px-6 py-2.5 text-xs font-semibold text-text-secondary bg-surface-muted/50 border-b border-border-subtle sm:grid sm:items-center sm:gap-4', ROW_GRID, isAdmin && 'sm:pr-11')}>
        <span>Project</span>
        <span className="text-right">Role</span>
        <span className="text-right">Members</span>
        <span>Progress</span>
        <span className="text-right">Updated</span>
      </div>
      <div className="divide-y divide-border-subtle">
        {projects.map((project) => (
          <ProjectRow
            key={project.id}
            project={project}
            organizationId={organizationId}
            isAdmin={isAdmin}
            onNavigate={() => router.push(`/org/${slug}/projects/${project.id}`)}
            onManageMembers={() => onManageMembers(project)}
            archived={archived}
          />
        ))}
        {trailingAction}
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
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('name');

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

  const allProjects = projects ?? [];
  const activeProjects = allProjects.filter((p) => p.status === 'ACTIVE');
  const archivedProjects = allProjects.filter((p) => p.status === 'ARCHIVED');
  const currentMembership = orgMembers?.find((m) => m.userId === user?.id);
  const isAdmin = org.ownerId === user?.id || currentMembership?.role === 'ORG_ADMIN';

  const visibleActiveProjects = sortProjects(activeProjects.filter((p) => matchesSearch(p, search)), sortBy);
  const visibleArchivedProjects = archivedProjects.filter((p) => matchesSearch(p, search));

  const managedCount = allProjects.filter((p) => p.myRole === 'PROJECT_MANAGER').length;

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
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-text-primary">Projects</h1>
          <p className="mt-0.5 text-sm text-text-secondary">
            {activeProjects.length} active project{activeProjects.length !== 1 ? 's' : ''} · {managedCount} you manage · {archivedProjects.length} archived
          </p>
        </div>
        {isAdmin && (
          <Button onClick={() => setShowModal(true)} className="gap-1.5 shrink-0">
            <Plus size={15} /> New Project
          </Button>
        )}
      </div>

      {/* Search + sort */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative w-full max-w-sm">
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
          <Input
            placeholder="Search projects..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="inline-flex items-center gap-0.5 rounded-md border border-border-subtle bg-surface p-0.5">
          {SORT_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setSortBy(opt.value)}
              className={cn(
                'rounded px-2.5 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                sortBy === opt.value
                  ? 'bg-brand-soft text-brand-hover'
                  : 'text-text-muted hover:text-text-secondary',
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Active projects list */}
      {visibleActiveProjects.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-border-subtle bg-surface py-16 text-center">
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-surface-muted">
            <FolderOpen size={20} className="text-text-muted" />
          </div>
          <div>
            <h2 className="text-sm font-medium text-text-secondary">
              {search ? 'No projects match your search' : 'No projects yet'}
            </h2>
            <p className="mt-1 max-w-xs text-sm text-text-secondary/70">
              {search
                ? 'Try a different search term.'
                : "Create your first project to start organizing your team's work."}
            </p>
          </div>
          {isAdmin && !search && (
            <Button className="mt-1" onClick={() => setShowModal(true)}>
              <Plus size={15} className="mr-1.5" /> Create Project
            </Button>
          )}
        </div>
      ) : (
        <ProjectList
          projects={visibleActiveProjects}
          organizationId={org.id}
          isAdmin={isAdmin}
          slug={slug}
          router={router}
          onManageMembers={setManagingProject}
          trailingAction={isAdmin && !search ? (
            <button
              onClick={() => setShowModal(true)}
              className="flex w-full items-center gap-3 px-6 py-3.5 text-left text-sm font-medium text-text-muted transition-colors hover:bg-surface-hover hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-md border border-dashed border-border-muted">
                <Plus size={15} />
              </span>
              New project
            </button>
          ) : null}
        />
      )}

      {/* Archived section */}
      {visibleArchivedProjects.length > 0 && (
        <div className="space-y-3">
          <button
            onClick={() => setArchivedOpen((o) => !o)}
            className="flex items-center gap-2 text-xs font-semibold text-text-muted hover:text-text-secondary uppercase tracking-widest transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {archivedOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
            Archived ({visibleArchivedProjects.length})
          </button>

          {archivedOpen && (
            <ProjectList
              projects={visibleArchivedProjects}
              organizationId={org.id}
              isAdmin={isAdmin}
              slug={slug}
              router={router}
              archived
              onManageMembers={setManagingProject}
            />
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
