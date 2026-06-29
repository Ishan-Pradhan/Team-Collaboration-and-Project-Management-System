import { Skeleton } from '@/components/ui/skeleton';

const CARDS_PER_COLUMN = [3, 2, 4];

export function KanbanSkeleton() {
  return (
    <div className="flex h-full flex-col">
      {/* Project header */}
      <div className="flex items-center justify-between px-8 pt-6 pb-3">
        <Skeleton className="h-7 w-52" />
        <div className="flex items-center gap-3">
          <Skeleton className="h-7 w-20 rounded-md" />
          <Skeleton className="h-7 w-20 rounded-md" />
        </div>
      </div>

      {/* Tab bar */}
      <div className="border-b border-gray-200 px-8">
        <div className="flex gap-5 pb-px">
          {[56, 40, 44, 72].map((w, i) => (
            <Skeleton key={i} className="h-7 mb-1 rounded" style={{ width: w }} />
          ))}
        </div>
      </div>

      {/* Kanban columns */}
      <div className="flex-1 overflow-x-auto overflow-y-hidden px-6 py-5">
        <div className="flex h-full items-start gap-3">
          {CARDS_PER_COLUMN.map((cardCount, colIdx) => (
            <div key={colIdx} className="w-[280px] shrink-0 rounded-xl bg-[#f1f2f4] p-2.5 space-y-2">
              {/* Column header */}
              <div className="flex items-center gap-2 px-1 py-1">
                <Skeleton className="h-3.5 w-3.5 rounded flex-shrink-0" />
                <Skeleton className="h-4 flex-1" />
                <Skeleton className="h-5 w-6 rounded-full flex-shrink-0" />
                <Skeleton className="h-5 w-5 rounded flex-shrink-0" />
              </div>

              {/* Cards */}
              {Array.from({ length: cardCount }).map((_, cardIdx) => (
                <div
                  key={cardIdx}
                  className="relative rounded-lg border border-gray-200 bg-white px-3.5 pb-3 pt-3 space-y-2.5"
                >
                  {/* Priority bar */}
                  <span className="absolute left-0 top-4 bottom-4 w-[3px] rounded-r-full bg-surface-muted" />
                  <Skeleton className="h-3.5 w-full pl-3" />
                  <Skeleton className="h-3 w-3/4 pl-3" />
                  <div className="flex items-center justify-between pl-3">
                    <Skeleton className="h-5 w-5 rounded-full" />
                    <Skeleton className="h-4 w-16 rounded" />
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
