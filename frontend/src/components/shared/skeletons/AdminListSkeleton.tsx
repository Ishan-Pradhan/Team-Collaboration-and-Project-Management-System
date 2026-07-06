import { Skeleton } from '@/components/ui/skeleton';

export function AdminListSkeleton({ rows = 6, withToolbar = false }: { rows?: number; withToolbar?: boolean }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Skeleton className="h-6 w-32" />
        {withToolbar && <Skeleton className="h-9 w-64 rounded-md" />}
      </div>
      <div className="overflow-hidden rounded-xl border border-border-subtle bg-white">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 border-b border-border-subtle px-4 py-3 last:border-b-0">
            <Skeleton className="h-9 w-9 shrink-0 rounded-full" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-3 w-56" />
            </div>
            <Skeleton className="h-6 w-16 rounded-sm" />
          </div>
        ))}
      </div>
    </div>
  );
}
