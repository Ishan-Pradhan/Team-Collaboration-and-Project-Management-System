'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import AdminLayout from '@/components/layout/AdminLayout';
import { useAuthStore } from '@/store/auth.store';
import { getCurrentUserProfile } from '@/services/auth.service';

export default function ProtectedAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const { user, isAuthenticated, setAuth } = useAuthStore();
  const [mounted, setMounted] = useState(false);
  const [isVerifying, setIsVerifying] = useState(true);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;

    if (!isAuthenticated) {
      router.push('/auth/login');
      return;
    }

    if (user?.role === 'SUPER_ADMIN') {
      setIsVerifying(false);
      return;
    }

    // If local state doesn't reflect SUPER_ADMIN, verify with backend before redirecting
    getCurrentUserProfile()
      .then((profile) => {
        if (profile.role === 'SUPER_ADMIN') {
          if (user) {
            setAuth({
              ...user,
              name: profile.name,
              avatarUrl: profile.avatarUrl,
              role: profile.role,
              isVerified: profile.isVerified,
            });
          }
          setIsVerifying(false);
        } else {
          router.push('/');
        }
      })
      .catch(() => {
        router.push('/');
      });
  }, [mounted, isAuthenticated, user, router, setAuth]);

  if (!mounted || isVerifying || !isAuthenticated || user?.role !== 'SUPER_ADMIN') {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <Loader2 className="animate-spin text-text-secondary" size={24} />
      </div>
    );
  }

  return <AdminLayout>{children}</AdminLayout>;
}
