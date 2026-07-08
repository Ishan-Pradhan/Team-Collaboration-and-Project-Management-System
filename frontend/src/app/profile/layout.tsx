'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { useAuthStore } from '@/store/auth.store';
import { Loader2 } from 'lucide-react';
import Logo from '@/components/shared/Logo';

export default function ProfileLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { isAuthenticated } = useAuthStore();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (mounted && !isAuthenticated) router.push('/auth/login');
  }, [mounted, isAuthenticated, router]);

  if (!mounted || !isAuthenticated) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <Loader2 className="animate-spin text-text-secondary" size={24} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 flex h-14 items-center gap-4 border-b border-border-subtle bg-surface px-4 lg:px-6">
        <button
          onClick={() => router.back()}
          className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm text-text-secondary hover:bg-surface-muted hover:text-text-primary transition-colors"
        >
          <ArrowLeft size={16} />
          Back
        </button>
        <div className="h-4 w-px bg-border-subtle" />
        <Logo />
      </header>
      <main className="mx-auto max-w-2xl px-4 py-8 lg:px-0">
        {children}
      </main>
    </div>
  );
}
