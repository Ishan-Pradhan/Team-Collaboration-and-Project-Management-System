'use client';

import { useEffect } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function KanbanError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[KanbanError]', error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-5 text-center p-6">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-danger-soft">
        <AlertTriangle className="text-danger" size={22} />
      </div>
      <div>
        <h2 className="text-base font-semibold text-text-primary">Failed to load board</h2>
        <p className="mt-1 max-w-xs text-sm text-text-secondary">
          {error.message || 'Could not load the kanban board. Check your connection and try again.'}
        </p>
      </div>
      <Button variant="outline" onClick={reset}>
        Try again
      </Button>
    </div>
  );
}
