import { Skeleton } from '@/components/ui/skeleton';

export function SettingsSkeleton() {
  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center gap-4 rounded-xl border border-border-subtle bg-white p-6">
        <Skeleton className="h-14 w-14 shrink-0 rounded-xl" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-3 w-56" />
        </div>
      </div>

      <div className="rounded-xl border border-border-subtle bg-white p-6 space-y-4">
        <Skeleton className="h-4 w-20" />
        <div className="space-y-1.5">
          <Skeleton className="h-3 w-28" />
          <Skeleton className="h-10 w-full" />
        </div>
        <div className="space-y-1.5">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="h-20 w-full" />
        </div>
        <div className="flex justify-end">
          <Skeleton className="h-9 w-32 rounded-md" />
        </div>
      </div>
    </div>
  );
}
