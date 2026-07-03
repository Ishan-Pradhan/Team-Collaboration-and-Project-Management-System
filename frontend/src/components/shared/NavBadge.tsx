export function NavBadge({ count }: { count?: number }) {
  if (!count) return null;
  return (
    <span className="ml-auto flex h-4 min-w-4 items-center justify-center rounded-full bg-white/20 px-1 text-[10px] font-semibold text-white">
      {count > 9 ? '9+' : count}
    </span>
  );
}
