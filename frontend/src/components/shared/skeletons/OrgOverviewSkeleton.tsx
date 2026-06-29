import { Skeleton } from '@/components/ui/skeleton';

export function OrgOverviewSkeleton() {
  return (
    <div className="space-y-6">
      {/* Header card */}
      <div className="rounded-xl border border-border-subtle bg-white p-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-12 w-12 rounded-lg flex-shrink-0" />
          <div className="space-y-2">
            <Skeleton className="h-5 w-44" />
            <Skeleton className="h-3 w-28" />
          </div>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1].map((i) => (
          <div key={i} className="rounded-xl border border-border-subtle bg-white p-5">
            <div className="flex items-center justify-between mb-3">
              <Skeleton className="h-3.5 w-28" />
              <Skeleton className="h-4 w-4 rounded" />
            </div>
            <Skeleton className="h-8 w-10" />
          </div>
        ))}
      </div>

      {/* Settings form + info sidebar */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 rounded-xl border border-border-subtle bg-white p-6 space-y-5">
          <Skeleton className="h-5 w-44" />
          <div className="space-y-1.5">
            <Skeleton className="h-3 w-36" />
            <Skeleton className="h-10 max-w-md" />
          </div>
          <div className="space-y-1.5">
            <Skeleton className="h-3 w-24" />
            <Skeleton className="h-20 max-w-md" />
          </div>
          <Skeleton className="h-9 w-28 rounded-md" />
        </div>

        <div className="rounded-xl border border-border-subtle bg-white p-6 space-y-4">
          <Skeleton className="h-4 w-40" />
          <div className="space-y-3">
            {[0, 1].map((i) => (
              <div key={i} className="space-y-1">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-4 w-28" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
