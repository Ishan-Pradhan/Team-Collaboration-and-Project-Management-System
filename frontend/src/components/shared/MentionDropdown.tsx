'use client';

import { avatarColor } from '@/lib/avatarColor';
import { cn } from '@/lib/utils';
import type { MentionCandidate } from '@/hooks/useMentionAutocomplete';

interface Props {
  candidates: MentionCandidate[];
  activeIndex: number;
  onHover: (index: number) => void;
  onSelect: (candidate: MentionCandidate) => void;
}

export default function MentionDropdown({ candidates, activeIndex, onHover, onSelect }: Props) {
  if (candidates.length === 0) return null;

  return (
    <div className="absolute bottom-full left-0 z-20 mb-1.5 max-h-52 w-64 overflow-y-auto rounded-lg border border-border-subtle bg-surface py-1 shadow-modal">
      {candidates.map((c, i) => (
        <button
          key={c.id}
          type="button"
          onMouseDown={(e) => e.preventDefault()}
          onMouseEnter={() => onHover(i)}
          onClick={() => onSelect(c)}
          className={cn(
            'flex w-full items-center gap-2.5 px-3 py-1.5 text-left text-sm transition-colors',
            i === activeIndex ? 'bg-surface-hover' : 'hover:bg-surface-hover',
          )}
        >
          {c.avatarUrl ? (
            <img src={c.avatarUrl} alt={c.name} className="h-6 w-6 shrink-0 rounded-full object-cover" />
          ) : (
            <span
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold text-white/90"
              style={{ backgroundColor: avatarColor(c.name) }}
            >
              {c.name.charAt(0).toUpperCase()}
            </span>
          )}
          <span className="truncate text-text-primary">{c.name}</span>
        </button>
      ))}
    </div>
  );
}
