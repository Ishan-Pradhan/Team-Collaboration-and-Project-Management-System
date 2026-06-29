import { Skeleton } from '@/components/ui/skeleton';

export function MembersSkeleton() {
  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div className="space-y-1.5">
          <Skeleton className="h-6 w-24" />
          <Skeleton className="h-3 w-64" />
        </div>
        <Skeleton className="h-9 w-36 rounded-md" />
      </div>

      {/* Members table */}
      <div className="overflow-hidden rounded-xl border border-border-subtle bg-white">
        {/* Table header */}
        <div className="grid grid-cols-4 gap-4 border-b border-border-subtle bg-surface-muted/50 px-6 py-4">
          {[80, 120, 60, 0].map((w, i) => (
            <Skeleton key={i} className={`h-3 rounded`} style={{ width: w || 0, visibility: w ? 'visible' : 'hidden' }} />
          ))}
        </div>

        {/* Table rows */}
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="grid grid-cols-4 gap-4 items-center px-6 py-4 border-b border-border-subtle last:border-0">
            <div className="flex items-center gap-3">
              <Skeleton className="h-8 w-8 rounded-full flex-shrink-0" />
              <Skeleton className="h-4 w-28" />
            </div>
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-5 w-16 rounded" />
            <div />
          </div>
        ))}
      </div>
    </div>
  );
}
