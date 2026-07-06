import { Skeleton } from '@/components/ui/skeleton';

export function AnalyticsSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <div className="space-y-2">
        <Skeleton className="h-7 w-32" />
        <Skeleton className="h-4 w-56" />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 rounded-lg border border-border-subtle bg-white overflow-hidden divide-x divide-y sm:divide-y-0 divide-border-subtle">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="flex items-center gap-3 px-6 py-5">
            <Skeleton className="h-10 w-10 shrink-0 rounded-full" />
            <div className="space-y-1.5">
              <Skeleton className="h-6 w-10" />
              <Skeleton className="h-3 w-16" />
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-lg border border-border-subtle bg-white">
        <div className="border-b border-border-subtle px-5 py-3.5">
          <Skeleton className="h-4 w-40" />
        </div>
        <div className="p-5">
          <Skeleton className="h-48 w-full" />
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        {[0, 1].map((i) => (
          <div key={i} className="rounded-lg border border-border-subtle bg-white">
            <div className="border-b border-border-subtle px-5 py-3.5">
              <Skeleton className="h-4 w-32" />
            </div>
            <div className="space-y-3 p-5">
              {[0, 1, 2, 3].map((j) => (
                <div key={j} className="flex items-center gap-3">
                  <Skeleton className="h-4 w-24 shrink-0" />
                  <Skeleton className="h-4 flex-1 rounded-full" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="rounded-lg border border-border-subtle bg-white">
        <div className="border-b border-border-subtle px-5 py-3.5">
          <Skeleton className="h-4 w-28" />
        </div>
        <div className="grid grid-cols-1 gap-4 p-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="overflow-hidden rounded-lg border border-border-subtle">
              <Skeleton className="h-1.5 w-full rounded-none" />
              <div className="space-y-2.5 p-4">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-5 w-20 rounded-sm" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
