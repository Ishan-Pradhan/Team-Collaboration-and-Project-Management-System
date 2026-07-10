'use client';

import { CornerUpLeft, X } from 'lucide-react';
import { stripMentionTokens } from '@/lib/messageContent';

// Two roles: a dismissible bar shown above the composer while replying, and
// a small clickable reference shown above a message/comment that was a
// reply, jumping back to the original — same visual language either way.
interface Props {
  authorName: string;
  content: string;
  deleted?: boolean;
  onClick?: () => void;
  onDismiss?: () => void;
}

export default function ReplyQuote({ authorName, content, deleted, onClick, onDismiss }: Props) {
  const preview = deleted ? 'This message was deleted' : stripMentionTokens(content).slice(0, 120);

  // Every link in this flex chain needs its own min-w-0 — a flex item's
  // default min-width is `auto` (its content's natural width), not 0, so
  // without this at each level the innermost `truncate` span never actually
  // gets squeezed and instead grows the whole row to fit the full text.
  const inner = (
    <span className="flex min-w-0 items-center gap-1.5 text-xs text-text-muted">
      <CornerUpLeft size={11} className="shrink-0" />
      <span className="shrink-0 font-medium text-text-secondary">{authorName}</span>
      <span className="min-w-0 truncate italic">{preview}</span>
    </span>
  );

  if (onDismiss) {
    return (
      <div className="flex min-w-0 items-center justify-between gap-2 rounded-t-lg border border-b-0 border-border-subtle bg-surface-muted px-3 py-1.5">
        {inner}
        <button
          type="button"
          onClick={onDismiss}
          className="shrink-0 rounded p-0.5 text-text-muted hover:bg-surface-hover hover:text-text-primary"
        >
          <X size={13} />
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className="mb-0.5 flex min-w-0 max-w-[75%] items-center gap-1.5 rounded px-1 text-left hover:bg-surface-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {inner}
    </button>
  );
}
