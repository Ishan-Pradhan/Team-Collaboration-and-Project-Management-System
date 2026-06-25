'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useOrgStore } from '@/store/org.store';
import { Loader2 } from 'lucide-react';

export default function DashboardPage() {
  const router = useRouter();
  const { currentOrg } = useOrgStore();

  useEffect(() => {
    if (currentOrg) {
      router.replace(`/org/${currentOrg.slug}`);
    } else {
      router.replace('/auth/workspace');
    }
  }, [currentOrg, router]);

  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <Loader2 className="animate-spin text-text-secondary" size={24} />
    </div>
  );
}
