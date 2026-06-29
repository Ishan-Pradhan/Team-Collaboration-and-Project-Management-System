'use client';

import { useEffect } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[DashboardError]', error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-5 p-6 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-danger-soft">
        <AlertTriangle className="text-danger" size={26} />
      </div>
      <div>
        <h2 className="text-lg font-semibold text-text-primary">Something went wrong</h2>
        <p className="mt-1 max-w-sm text-sm text-text-secondary">
          {error.message || 'An unexpected error occurred. Try again or refresh the page.'}
        </p>
        {error.digest && (
          <p className="mt-2 text-xs text-text-muted font-mono">Error ID: {error.digest}</p>
        )}
      </div>
      <Button variant="outline" onClick={reset}>
        Try again
      </Button>
    </div>
  );
}
