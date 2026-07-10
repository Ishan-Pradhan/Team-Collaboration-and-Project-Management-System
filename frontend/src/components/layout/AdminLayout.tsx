'use client';

import { useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { LayoutDashboard, Building2, Users, ScrollText, LogOut, ArrowLeft, Menu, X } from 'lucide-react';
import Logo from '@/components/shared/Logo';
import { useAuthStore } from '@/store/auth.store';
import { useLogout } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';

const NAV_ITEMS = [
  { name: 'Overview', href: '/admin', icon: LayoutDashboard, exact: true },
  { name: 'Organizations', href: '/admin/organizations', icon: Building2, exact: false },
  { name: 'Users', href: '/admin/users', icon: Users, exact: false },
  { name: 'Audit Log', href: '/admin/audit-log', icon: ScrollText, exact: false },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useAuthStore();
  const logout = useLogout();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = () => {
    logout.mutate(undefined, { onSettled: () => router.push('/auth/login') });
  };

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-64 shrink-0 flex-col border-r border-border-subtle bg-primary transition-transform duration-200 ease-in-out lg:static lg:translate-x-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="flex h-14 items-center justify-between gap-2 border-b border-border-subtle px-4">
          <div className="flex items-center gap-2">
            <Logo />
            <span className="text-xs font-semibold uppercase tracking-wider text-white/70">Super Admin</span>
          </div>
          <button
            className="rounded p-1 text-white hover:bg-surface-muted lg:hidden"
            onClick={() => setSidebarOpen(false)}
          >
            <X size={18} />
          </button>
        </div>

        <nav className="flex-1 space-y-1 p-3">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
            return (
              <Link
                key={item.name}
                href={item.href}
                onClick={() => setSidebarOpen(false)}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-all',
                  active
                    ? 'bg-surface text-primary font-medium'
                    : 'text-white hover:bg-primary-foreground hover:text-primary'
                )}
              >
                <Icon size={18} />
                <span>{item.name}</span>
              </Link>
            );
          })}
        </nav>

        <div className="space-y-1 border-t border-border-subtle p-3">
          <Link
            href="/"
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-white hover:bg-primary-foreground hover:text-primary transition-all"
          >
            <ArrowLeft size={18} />
            <span>Back to app</span>
          </Link>
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-white hover:bg-primary-foreground hover:text-primary transition-all"
          >
            <LogOut size={18} />
            <span>Logout{user?.name ? ` (${user.name})` : ''}</span>
          </button>
        </div>
      </aside>

      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex h-14 items-center gap-3 border-b border-border-subtle bg-surface px-4 lg:hidden">
          <button
            className="rounded p-1 text-primary hover:bg-surface-muted"
            onClick={() => setSidebarOpen(true)}
          >
            <Menu size={20} />
          </button>
          <span className="text-sm font-medium text-text-primary">Super Admin</span>
        </header>
        <main className="flex-1 overflow-y-auto p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
