'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth.store';
import { Loader2 } from 'lucide-react';

export default function RootPage() {
  const router = useRouter();
  const { isAuthenticated } = useAuthStore();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    if (isAuthenticated) {
      router.replace('/dashboard');
    } else {
      router.replace('/auth/login');
    }
  }, [mounted, isAuthenticated, router]);

  return (
    <div className="flex h-screen items-center justify-center bg-background">
      <Loader2 className="animate-spin text-text-secondary" size={24} />
    </div>
  );
}
