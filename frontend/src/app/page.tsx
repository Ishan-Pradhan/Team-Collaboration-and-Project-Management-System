'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth.store';
import { getCurrentUserProfile } from '@/services/auth.service';
import { Loader2 } from 'lucide-react';

export default function RootPage() {
  const router = useRouter();
  const { setAuth, clearAuth } = useAuthStore();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;

    // Always verify against the live cookie session instead of trusting the
    // cached user. A different account can log in (e.g. switching OAuth
    // accounts without logging out first), which overwrites the session
    // cookies while localStorage still holds the previous account's identity
    // and org selection. setAuth() detects an identity change and clears any
    // stale org selection; /dashboard then re-checks the (now-correct) org
    // store and routes to the workspace picker or straight into the org.
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
        router.replace('/dashboard');
      })
      .catch(() => {
        clearAuth();
        router.replace('/auth/login');
      });
  }, [mounted, setAuth, clearAuth, router]);

  return (
    <div className="flex h-screen items-center justify-center bg-background">
      <Loader2 className="animate-spin text-text-secondary" size={24} />
    </div>
  );
}
