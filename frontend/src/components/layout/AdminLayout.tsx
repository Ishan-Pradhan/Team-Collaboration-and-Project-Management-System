'use client';

import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { LayoutDashboard, Building2, Users, ScrollText, LogOut, ArrowLeft } from 'lucide-react';
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

  const handleLogout = () => {
    logout.mutate(undefined, { onSettled: () => router.push('/auth/login') });
  };

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <aside className="flex w-64 shrink-0 flex-col border-r border-border-subtle bg-primary">
        <div className="flex h-14 items-center gap-2 border-b border-border-subtle px-4">
          <Logo />
          <span className="text-xs font-semibold uppercase tracking-wider text-white/70">Super Admin</span>
        </div>

        <nav className="flex-1 space-y-1 p-3">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
            return (
              <Link
                key={item.name}
                href={item.href}
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

      <main className="flex-1 overflow-y-auto p-6">{children}</main>
    </div>
  );
}
