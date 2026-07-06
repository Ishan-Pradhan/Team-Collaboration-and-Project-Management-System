import { Skeleton } from '@/components/ui/skeleton';

export function NotificationsSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-6 w-40" />
      <div className="flex gap-4 border-b border-border-subtle pb-2.5">
        <Skeleton className="h-5 w-10" />
        <Skeleton className="h-5 w-16" />
      </div>
      <div className="space-y-1 rounded-xl border border-border-subtle bg-white p-2">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="flex items-center gap-3 px-2 py-2.5">
            <Skeleton className="h-9 w-9 shrink-0 rounded-full" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
