'use client';

export default function CalendarLoading() {
  return (
    <div className="flex h-full flex-col rounded-xl border border-border-subtle bg-white overflow-hidden animate-pulse">
      {/* Header skeleton */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border-subtle">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded bg-surface-muted" />
          <div className="h-6 w-36 rounded bg-surface-muted" />
          <div className="h-8 w-8 rounded bg-surface-muted" />
        </div>
        <div className="h-8 w-16 rounded bg-surface-muted" />
      </div>
      {/* Day headers */}
      <div className="grid grid-cols-7 border-b border-border-subtle">
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="py-3 px-4">
            <div className="h-4 w-8 rounded bg-surface-muted" />
          </div>
        ))}
      </div>
      {/* Calendar cells */}
      <div className="flex-1 grid grid-cols-7">
        {Array.from({ length: 42 }).map((_, i) => (
          <div key={i} className="border-r border-b border-border-subtle p-2 min-h-[100px]">
            <div className="h-5 w-5 rounded bg-surface-muted mb-2" />
            {i % 5 === 0 && <div className="h-6 w-full rounded bg-surface-muted" />}
            {i % 7 === 2 && <div className="h-6 w-3/4 rounded bg-surface-muted mt-1" />}
          </div>
        ))}
      </div>
    </div>
  );
}
