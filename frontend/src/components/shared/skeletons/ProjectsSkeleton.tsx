import { Skeleton } from '@/components/ui/skeleton';

export function ProjectsSkeleton() {
  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div className="space-y-1.5">
          <Skeleton className="h-6 w-24" />
          <Skeleton className="h-3 w-64" />
        </div>
        <Skeleton className="h-9 w-32 rounded-md" />
      </div>

      {/* Search + sort */}
      <div className="flex items-center justify-between gap-3">
        <Skeleton className="h-9 w-full max-w-sm rounded-md" />
        <Skeleton className="h-8 w-48 rounded-md" />
      </div>

      {/* Project list */}
      <div className="overflow-hidden rounded-xl border border-border-subtle bg-surface divide-y divide-border-subtle">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="flex items-center gap-4 px-6 py-4">
            <Skeleton className="h-9 w-9 rounded-md flex-shrink-0" />
            <div className="flex-1 min-w-0 space-y-2">
              <Skeleton className="h-3.5 w-1/3" />
              <Skeleton className="h-3 w-2/3" />
            </div>
            <Skeleton className="hidden h-3 w-16 sm:block" />
            <Skeleton className="hidden h-1.5 w-24 rounded-full sm:block" />
            <Skeleton className="hidden h-3 w-12 sm:block" />
          </div>
        ))}
      </div>
    </div>
  );
}
