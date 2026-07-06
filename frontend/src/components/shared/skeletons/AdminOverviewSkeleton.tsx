import { Skeleton } from '@/components/ui/skeleton';

export function AdminOverviewSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-6 w-40" />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 rounded-xl border border-border-subtle bg-white p-4">
            <Skeleton className="h-10 w-10 shrink-0 rounded-full" />
            <div className="space-y-1.5">
              <Skeleton className="h-5 w-12" />
              <Skeleton className="h-3 w-20" />
            </div>
          </div>
        ))}
      </div>
      <div className="rounded-xl border border-border-subtle bg-white p-5">
        <Skeleton className="h-4 w-64" />
        <Skeleton className="mt-4 h-48 w-full" />
      </div>
    </div>
  );
}
