export default function SettingsLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-7 w-48 rounded bg-surface-muted" />
      <div className="rounded-xl border border-border-subtle bg-white p-6 space-y-4">
        <div className="h-4 w-32 rounded bg-surface-muted" />
        <div className="h-10 rounded bg-surface-muted" />
        <div className="h-20 rounded bg-surface-muted" />
        <div className="h-9 w-24 rounded bg-surface-muted" />
      </div>
    </div>
  );
}
