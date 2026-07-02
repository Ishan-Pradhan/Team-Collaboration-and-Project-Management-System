import { Skeleton } from '@/components/ui/skeleton';

export function ChatSkeleton() {
  return (
    <div className="flex h-full gap-4">
      <div className="w-64 shrink-0 space-y-2 rounded-xl border border-border-subtle bg-white p-3">
        <Skeleton className="h-4 w-20 mb-2" />
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-8 w-full rounded-md" />
        ))}
      </div>
      <div className="flex-1 rounded-xl border border-border-subtle bg-white p-4 space-y-3">
        <Skeleton className="h-5 w-40" />
        {[0, 1, 2].map((i) => (
          <Skeleton key={i} className="h-12 w-2/3 rounded-lg" />
        ))}
      </div>
    </div>
  );
}
