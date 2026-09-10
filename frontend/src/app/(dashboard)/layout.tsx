'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import { useAuthStore } from '@/store/auth.store';

import { getCurrentUserProfile } from '@/services/auth.service';

export default function ProtectedDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { isAuthenticated, setAuth, clearAuth } = useAuthStore();
  const [loading, setLoading] = useState(!isAuthenticated);

  useEffect(() => {
    if (isAuthenticated) {
      setLoading(false);
      return;
    }

    // Verify against live cookie session
    getCurrentUserProfile()
      .then((profile) => {
        setAuth({
          id: profile.id,
          name: profile.name,
          email: profile.email,
          avatarUrl: profile.avatarUrl,
          role: profile.role as 'USER' | 'SUPER_ADMIN',
          isVerified: profile.isVerified,
          isActive: true,
          authProvider: 'local',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        });
        setLoading(false);
      })
      .catch(() => {
        clearAuth();
        router.replace('/auth/login');
      });
  }, [isAuthenticated, setAuth, clearAuth, router]);

  if (loading || !isAuthenticated) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <Loader2 className="animate-spin text-text-secondary" size={24} />
      </div>
    );
  }

  return <DashboardLayout>{children}</DashboardLayout>;
}
