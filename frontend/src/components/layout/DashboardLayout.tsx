'use client';

import { useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import {
  ChevronDown,
  Folder,
  FolderOpen,
  LayoutDashboard,
  LogOut,
  Menu,
  Users,
  X,
} from 'lucide-react';
import Link from 'next/link';

import Logo from '@/components/shared/Logo';
import { useMyOrganizations } from '@/hooks/useOrganization';
import { useOrgStore } from '@/store/org.store';
import { useAuthStore } from '@/store/auth.store';
import { useLogout } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';

// Helper to determine org avatar background color deterministically
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

import { useEffect } from 'react';

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [orgDropdownOpen, setOrgDropdownOpen] = useState(false);
  const [mounted, setMounted] = useState(false);





  // Parse organization slug from the pathname
  const match = pathname.match(/^\/org\/([^/]+)/);
  const currentSlug = match ? match[1] : null;

  const { data: orgs, isLoading: orgsLoading } = useMyOrganizations();
  const { currentOrg, setCurrentOrg } = useOrgStore();
  const { user } = useAuthStore();
  const logout = useLogout();

  const activeOrg = orgs?.find((o) => o.slug === currentSlug) || null;

  useEffect(() => {
    setMounted(true);
  }, []);


  // Sync workspace store with the URL's current slug
  useEffect(() => {
    if (activeOrg) {
      setCurrentOrg(activeOrg);
    }
  }, [activeOrg, setCurrentOrg]);

  if (!mounted) return null;

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
      name: 'Projects',
      href: currentSlug ? `/org/${currentSlug}/projects` : '#',
      icon: FolderOpen,
      disabled: !currentSlug,
    },
    {
      name: 'Members',
      href: currentSlug ? `/org/${currentSlug}/members` : '#',
      icon: Users,
      disabled: !currentSlug,
    },
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
          'fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-border-subtle bg-white transition-transform duration-200 ease-in-out lg:static lg:translate-x-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Sidebar Header */}
        <div className="flex h-14 items-center justify-between border-b border-border-subtle px-4">
          <Logo />
          <button
            className="rounded p-1 text-text-secondary hover:bg-surface-muted lg:hidden"
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
              {mounted && activeOrg ? (
                <>
                  <div
                    className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded text-xs font-semibold text-white"
                    style={{ backgroundColor: getOrgColor(activeOrg.name) }}
                  >
                    {activeOrg.name.charAt(0).toUpperCase()}
                  </div>
                  <span className="truncate text-sm font-medium text-text-primary">
                    {activeOrg.name}
                  </span>
                </>
              ) : (
                <span className="text-sm font-medium text-text-secondary">
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
                    <button
                      key={org.id}
                      onClick={() => handleOrgSwitch(org)}
                      className={cn(
                        'flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left text-sm hover:bg-surface-muted transition-colors',
                        activeOrg?.id === org.id ? 'bg-surface font-medium' : ''
                      )}
                    >
                      <div
                        className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded text-[10px] font-semibold text-white"
                        style={{ backgroundColor: getOrgColor(org.name) }}
                      >
                        {org.name.charAt(0).toUpperCase()}
                      </div>
                      <span className="truncate text-text-primary">{org.name}</span>
                    </button>
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
        <nav className="flex-1 space-y-1 p-3">
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
                    ? 'bg-primary/5 text-primary font-medium'
                    : 'text-text-secondary hover:bg-surface-muted hover:text-text-primary'
                )}
              >
                <Icon size={18} />
                <span>{item.name}</span>
              </Link>
            );
          })}
        </nav>

        {/* Sidebar Footer */}
        <div className="border-t border-border-subtle p-3">
          <div className="flex items-center justify-between rounded-lg bg-surface-muted p-2.5">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-primary text-white font-medium text-sm">
                {user?.name?.charAt(0).toUpperCase() || 'U'}
              </div>
              <div className="min-w-0">
                <p className="truncate text-xs font-semibold text-text-primary">
                  {user?.name || 'User'}
                </p>
                <p className="truncate text-[10px] text-text-muted">
                  {user?.email || 'user@example.com'}
                </p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="rounded p-1.5 text-text-secondary hover:bg-surface-hover hover:text-danger transition-colors"
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
        <header className="flex h-14 items-center justify-between border-b border-border-subtle bg-white px-4 lg:px-6">
          <div className="flex items-center gap-4">
            <button
              className="rounded p-1 text-text-secondary hover:bg-surface-muted lg:hidden"
              onClick={() => setSidebarOpen(true)}
            >
              <Menu size={20} />
            </button>
            <div className="text-xs text-text-muted">
              {currentOrg ? (
                <span className="font-medium text-text-secondary">{currentOrg.name}</span>
              ) : (
                'Dashboard'
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
