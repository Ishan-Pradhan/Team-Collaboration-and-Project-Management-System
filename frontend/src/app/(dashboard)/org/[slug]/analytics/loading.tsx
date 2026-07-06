'use client';

export default function AnalyticsLoading() {
  return (
    <div className="flex flex-col gap-6 animate-pulse">
      <div className="h-8 w-40 rounded bg-surface-muted" />
      <div className="h-64 rounded-lg border border-border-subtle bg-white" />
      <div className="grid gap-5 lg:grid-cols-2">
        <div className="h-48 rounded-lg border border-border-subtle bg-white" />
        <div className="h-48 rounded-lg border border-border-subtle bg-white" />
      </div>
      <div className="h-40 rounded-lg border border-border-subtle bg-white" />
    </div>
  );
}
