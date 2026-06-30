'use client';

import { useEffect } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function CalendarError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[CalendarError]', error);
  }, [error]);

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-5 text-center p-6">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-danger-soft">
        <AlertTriangle className="text-danger" size={22} />
      </div>
      <div>
        <h2 className="text-base font-semibold text-text-primary">Failed to load calendar</h2>
        <p className="mt-1 max-w-xs text-sm text-text-secondary">
          {error.message || 'Could not load calendar data. Check your connection and try again.'}
        </p>
        {error.digest && (
          <p className="mt-1 text-xs text-text-muted font-mono">{error.digest}</p>
        )}
      </div>
      <Button variant="outline" onClick={reset}>
        Try again
      </Button>
    </div>
  );
}
