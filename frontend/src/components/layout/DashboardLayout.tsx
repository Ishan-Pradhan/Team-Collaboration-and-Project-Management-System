'use client';

import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import {
  Bell,
  BellOff,
  CalendarDays,
  ChevronDown,
  FolderOpen,
  LayoutDashboard,
  LogOut,
  Menu,
  MessageSquare,
  Plus,
  Settings,
  Users,
  X,
} from 'lucide-react';
import Link from 'next/link';

import Logo from '@/components/shared/Logo';
import { useMyOrganizations, useMutedOrganizations, useMuteOrganization } from '@/hooks/useOrganization';
import { useOrgStore } from '@/store/org.store';
import { useAuthStore } from '@/store/auth.store';
import { useLogout } from '@/hooks/useAuth';
import { useOrgProjects } from '@/hooks/useProject';
import { useChatSocket } from '@/hooks/useChatSocket';
import { useNotificationSocket } from '@/hooks/useNotificationSocket';
import { useUnreadCount, useUnreadChannels } from '@/hooks/useNotification';
import { NavBadge } from '@/components/shared/NavBadge';
import { cn } from '@/lib/utils';


function getOrgColor(name: string): string {
  const colors = [
    '#22302a', // Forest green
    '#d4a84f', // Gold
    '#6f8c78', // Sage
    '#a86c58', // Terracotta
    '#4b7f52', // Success green
    '#c38a2d', // Warning amber
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

function getProjectColor(name: string): string {
  const colors = [
    '#8B5CF6', // Purple/Violet
    '#F97316', // Orange
    '#F59E0B', // Amber
    '#10B981', // Emerald
    '#3B82F6', // Blue
    '#EC4899', // Pink
    '#EF4444', // Red
    '#06B6D4', // Cyan
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [orgDropdownOpen, setOrgDropdownOpen] = useState(false);





  // Parse organization slug from the pathname
  const match = pathname.match(/^\/org\/([^/]+)/);
  const urlSlug = match ? match[1] : null;

  const { data: orgs, isLoading: orgsLoading } = useMyOrganizations();
  const { data: mutedOrgIds } = useMutedOrganizations();
  const muteOrganization = useMuteOrganization();
  const mutedOrgSet = new Set(mutedOrgIds ?? []);
  const { currentOrg, setCurrentOrg } = useOrgStore();
  const { user } = useAuthStore();
  const logout = useLogout();

  // On routes with no org in the URL (e.g. /notifications), fall back to the
  // last-active org so the sidebar keeps showing Projects/Chat/Members instead
  // of degrading to a slug-less state.
  const activeOrg = (urlSlug ? orgs?.find((o) => o.slug === urlSlug) : currentOrg) || null;
  const currentSlug = activeOrg?.slug ?? null;
  const { data: projects, isLoading: projectsLoading } = useOrgProjects(activeOrg?.id || '');
  const { connected: chatConnected } = useChatSocket(activeOrg?.id);
  useNotificationSocket();
  const { data: unreadNotificationCount } = useUnreadCount();
  const { data: unreadChannels } = useUnreadChannels();

  // Sync workspace store with the URL's current slug
  useEffect(() => {
    if (activeOrg) {
      setCurrentOrg(activeOrg);
    }
  }, [activeOrg, setCurrentOrg]);

  const handleOrgSwitch = (org: { slug: string }) => {
    setOrgDropdownOpen(false);
    router.push(`/org/${org.slug}`);
  };

  const handleLogout = () => {
    logout.mutate(undefined, {
      onSettled: () => router.push('/auth/login'),
    });
  };

  // Sidebar links derived directly from URL slug to ensure SSR matches client
  const navItems = [
    {
      name: 'Overview',
      href: currentSlug ? `/org/${currentSlug}` : '/dashboard',
      icon: LayoutDashboard,
      exact: true,
    },
    {
      name: 'Notifications',
      href: '/notifications',
      icon: Bell,
      badgeCount: unreadNotificationCount,
    },
    {
      name: 'Members',
      href: currentSlug ? `/org/${currentSlug}/members` : '#',
      icon: Users,
      disabled: !currentSlug,
    },
    {
      name: 'Calendar',
      href: currentSlug ? `/org/${currentSlug}/calendar` : '#',
      icon: CalendarDays,
      disabled: !currentSlug,
    },
    {
      name: 'Chat',
      href: currentSlug ? `/org/${currentSlug}/chat` : '#',
      icon: MessageSquare,
      disabled: !currentSlug,
      badgeCount: currentSlug ? unreadChannels?.length : undefined,
    },
    ...(activeOrg?.ownerId === user?.id
      ? [{
        name: 'Settings',
        href: `/org/${currentSlug}/settings`,
        icon: Settings,
        disabled: false,
      }]
      : []),
  ];

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-border-subtle bg-primary transition-transform duration-200 ease-in-out lg:static lg:translate-x-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Sidebar Header */}
        <div className="flex h-14 items-center justify-between border-b border-border-subtle px-4">
          <Logo />
          <button
            className="rounded p-1 text-white hover:bg-surface-muted lg:hidden"
            onClick={() => setSidebarOpen(false)}
          >
            <X size={18} />
          </button>
        </div>

        {/* Organization Switcher */}
        <div className="relative border-b border-border-subtle p-3">
          <button
            onClick={() => setOrgDropdownOpen(!orgDropdownOpen)}
            className="flex w-full items-center justify-between rounded-lg border border-border-subtle bg-surface px-3 py-2 text-left hover:bg-surface-hover transition-colors"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              {activeOrg ? (
                <>
                  <div
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded text-xs font-semibold text-white"
                    style={{ backgroundColor: getOrgColor(activeOrg.name) }}
                  >
                    {activeOrg.name.charAt(0).toUpperCase()}
                  </div>
                  <span className="truncate text-sm font-medium text-text-primary">
                    {activeOrg.name}
                  </span>
                </>
              ) : (
                <span className="text-sm font-medium text-white">
                  {currentSlug || 'Choose Workspace'}
                </span>
              )}
            </div>
            <ChevronDown size={14} className="text-text-muted" />
          </button>

          {/* Dropdown Menu */}
          {orgDropdownOpen && (
            <div className="absolute left-3 right-3 z-50 mt-1 max-h-60 overflow-y-auto rounded-lg border border-border bg-white p-1 shadow-dropdown">
              {orgsLoading ? (
                <div className="p-2 text-center text-xs text-text-muted">Loading workspaces...</div>
              ) : (
                <>
                  {orgs?.map((org) => (
                    <div
                      key={org.id}
                      className={cn(
                        'flex items-center gap-1 rounded-md pr-1 hover:bg-surface-muted transition-colors',
                        activeOrg?.id === org.id ? 'bg-surface font-medium' : ''
                      )}
                    >
                      <button
                        onClick={() => handleOrgSwitch(org)}
                        className="flex flex-1 min-w-0 items-center gap-2.5 rounded-md px-3 py-2 text-left text-sm"
                      >
                        <div
                          className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded text-[10px] font-semibold text-white"
                          style={{ backgroundColor: getOrgColor(org.name) }}
                        >
                          {org.name.charAt(0).toUpperCase()}
                        </div>
                        <span className="truncate text-primary">{org.name}</span>
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          muteOrganization.mutate({ organizationId: org.id, isMuted: !mutedOrgSet.has(org.id) });
                        }}
                        className="shrink-0 rounded p-1 text-text-muted hover:bg-surface-hover hover:text-text-secondary transition-colors"
                        title={mutedOrgSet.has(org.id) ? 'Unmute workspace' : 'Mute workspace'}
                      >
                        {mutedOrgSet.has(org.id) ? <BellOff size={13} /> : <Bell size={13} />}
                      </button>
                    </div>
                  ))}
                  <div className="my-1 border-t border-border-subtle" />
                  <button
                    onClick={() => {
                      setOrgDropdownOpen(false);
                      router.push('/auth/workspace');
                    }}
                    className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-brand font-medium hover:bg-surface-muted rounded-md transition-colors"
                  >
                    Create Workspace
                  </button>
                </>
              )}
            </div>
          )}
        </div>

        {/* Sidebar Navigation */}
        <nav className="flex-1 space-y-6 p-3 overflow-y-auto">
          {/* Main Navigation */}
          <div className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = item.href !== '#' && (item.exact ? pathname === item.href : pathname.startsWith(item.href));
              if (item.disabled) return null;

              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={cn(
                    'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-all',
                    active
                      ? 'bg-white text-primary font-medium'
                      : 'text-white hover:bg-primary-foreground  hover:text-primary'
                  )}
                >
                  <Icon size={18} />
                  <span>{item.name}</span>
                  <NavBadge count={item.badgeCount} />
                </Link>
              );
            })}
          </div>

          {/* Projects Section */}
          {currentSlug && (
            <div className="space-y-1.5">
              <div className="px-3 py-1">
                <span className="text-xs font-semibold text-text-muted uppercase tracking-wider">
                  Projects
                </span>
              </div>
              <div className="space-y-1">
                {projectsLoading ? (
                  <span className="block px-3 py-1.5 text-xs text-text-muted">Loading projects...</span>
                ) : (
                  <>
                    {projects && projects.filter((project) => project.status === 'ACTIVE').slice(0, 4).map((project) => {
                      const projectHref = `/org/${currentSlug}/projects/${project.id}`;
                      const isProjectActive = pathname.startsWith(projectHref);
                      const color = getProjectColor(project.name);
                      return (
                        <Link
                          key={project.id}
                          href={projectHref}
                          className={cn(
                            'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-all truncate',
                            isProjectActive
                              ? 'bg-primary-foreground text-primary   font-medium'
                              : 'text-white hover:bg-surface-muted hover:text-text-primary'
                          )}
                        >
                          <div
                            className="flex h-5 w-5 shrink-0 items-center justify-center rounded text-[10px] font-semibold text-white uppercase"
                            style={{ backgroundColor: color }}
                          >
                            {project.name.charAt(0)}
                          </div>
                          <span className="truncate">{project.name}</span>
                        </Link>
                      );
                    })}
                    {(!projects || projects.length === 0) && (
                      <span className="block px-3 py-1.5 text-xs text-text-muted italic">
                        No projects yet
                      </span>
                    )}
                    <Link
                      href={`/org/${currentSlug}/projects`}
                      className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium hover:text-primary text-white hover:bg-surface-muted transition-all group"
                    >
                      <Plus size={16} className="text-white group-hover:text-primary transition-all" />
                      <span>View all projects</span>
                    </Link>
                  </>
                )}
              </div>
            </div>
          )}
        </nav>

        {/* Sidebar Footer */}
        <div className="border-t border-border-subtle p-3">
          <div className="flex items-center justify-between rounded-lg bg-surface-muted p-2.5">
            <Link href="/profile" className="flex items-center gap-2.5 min-w-0 flex-1 hover:opacity-80 transition-opacity">
              {user?.avatarUrl ? (
                <img
                  src={user.avatarUrl}
                  alt={user.name}
                  className="h-8 w-8 flex-shrink-0 rounded-full object-cover"
                />
              ) : (
                <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-primary text-white font-medium text-sm">
                  {user?.name?.charAt(0).toUpperCase() || 'U'}
                </div>
              )}
              <div className="min-w-0">
                <p className="truncate text-xs font-semibold text-text-primary">
                  {user?.name || 'User'}
                </p>
                <p className="truncate text-[10px] text-text-muted">
                  {user?.email || 'user@example.com'}
                </p>
              </div>
            </Link>
            <button
              onClick={handleLogout}
              className="rounded p-1.5 text-primary cursor-pointer hover:bg-surface-hover hover:text-danger transition-colors"
              title="Logout"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content wrapper */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Topbar */}
        <header className="flex h-14 items-center justify-between border-b border-border-subtle bg-white px-4 lg:px-6 sm:hidden">
          <div className="flex items-center gap-4">
            <button
              className="rounded p-1 text-primary hover:bg-surface-muted lg:hidden"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu size={20} />
            </button>
            <div className="flex items-center gap-2 text-xs text-text-muted">
              {currentOrg ? (
                <span className="font-medium text-primary">{currentOrg.name}</span>
              ) : (
                'Dashboard'
              )}
              {currentOrg && !chatConnected && (
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-700">
                  Reconnecting…
                </span>
              )}
            </div>
          </div>
        </header>

        {/* Children content area */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-6 bg-transparent">
          <div className="mx-auto h-[90vh] bg-transparent">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
