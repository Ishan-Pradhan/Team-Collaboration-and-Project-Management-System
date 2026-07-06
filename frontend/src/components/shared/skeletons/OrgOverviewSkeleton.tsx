import { Skeleton } from '@/components/ui/skeleton';

export function OrgOverviewSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-end justify-between">
        <div className="space-y-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-7 w-40" />
        </div>
        <div className="hidden items-center gap-2.5 sm:flex">
          <div className="space-y-1.5 text-right">
            <Skeleton className="ml-auto h-3 w-32" />
            <Skeleton className="ml-auto h-3 w-24" />
          </div>
          <Skeleton className="h-9 w-9 shrink-0 rounded-full" />
        </div>
      </div>

      <div className="grid grid-cols-2 rounded-lg border border-border-subtle bg-white overflow-hidden divide-x divide-y sm:grid-cols-4 sm:divide-y-0 divide-border-subtle">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="flex items-center gap-3 px-6 py-5">
            <Skeleton className="h-10 w-10 shrink-0 rounded-full" />
            <div className="space-y-1.5">
              <Skeleton className="h-6 w-8" />
              <Skeleton className="h-3 w-14" />
            </div>
          </div>
        ))}
      </div>

      {[0, 1].map((row) => (
        <div key={row} className="grid gap-5 lg:grid-cols-5">
          <div className="lg:col-span-3 rounded-lg border border-border-subtle bg-white">
            <div className="border-b border-border-subtle px-5 py-3.5">
              <Skeleton className="h-4 w-32" />
            </div>
            <div className="space-y-4 p-5">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          </div>
          <div className="lg:col-span-2 rounded-lg border border-border-subtle bg-white">
            <div className="border-b border-border-subtle px-5 py-3.5">
              <Skeleton className="h-4 w-24" />
            </div>
            <div className="space-y-4 p-5">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
