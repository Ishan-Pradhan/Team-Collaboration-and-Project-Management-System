import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

export type ContentToken =
  | { type: 'text'; value: string }
  | { type: 'code'; value: string }
  | { type: 'link'; value: string }
  | { type: 'mention'; name: string; userId: string };

// Mentions are stored inline as @[Display Name](user:<uuid>) — the
// composer inserts this token (see useMentionAutocomplete), so rendering
// never has to guess at a name match the way a bare @word would.
const TOKEN_REGEX = /`([^`]+)`|(https?:\/\/[^\s]+)|@\[([^\]]+)\]\(user:([0-9a-fA-F-]{36})\)/g;
const MENTION_ONLY_REGEX = /@\[([^\]]+)\]\(user:[0-9a-fA-F-]{36}\)/g;

// For plain-text contexts that reuse raw content but can't render JSX chips
// (reply-quote previews, etc.) — collapses the token down to plain @Name.
export function stripMentionTokens(content: string): string {
  return content.replace(MENTION_ONLY_REGEX, '@$1');
}

export function tokenizeContent(content: string): ContentToken[] {
  const tokens: ContentToken[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  TOKEN_REGEX.lastIndex = 0;
  while ((match = TOKEN_REGEX.exec(content)) !== null) {
    if (match.index > lastIndex) {
      tokens.push({ type: 'text', value: content.slice(lastIndex, match.index) });
    }
    if (match[1] !== undefined) {
      tokens.push({ type: 'code', value: match[1] });
    } else if (match[2] !== undefined) {
      tokens.push({ type: 'link', value: match[2] });
    } else if (match[3] !== undefined && match[4] !== undefined) {
      tokens.push({ type: 'mention', name: match[3], userId: match[4] });
    }
    lastIndex = TOKEN_REGEX.lastIndex;
  }
  if (lastIndex < content.length) tokens.push({ type: 'text', value: content.slice(lastIndex) });
  return tokens;
}

export function renderContent(
  content: string,
  opts?: { onMentionClick?: (userId: string) => void; currentUserId?: string },
): ReactNode[] {
  return tokenizeContent(content).map((token, i) => {
    if (token.type === 'code') {
      return (
        <code key={i} className="rounded bg-surface px-1 py-0.5 font-mono text-[0.8em]">
          {token.value}
        </code>
      );
    }
    if (token.type === 'link') {
      return (
        <a key={i} href={token.value} target="_blank" rel="noreferrer" className="text-primary underline hover:no-underline">
          {token.value}
        </a>
      );
    }
    if (token.type === 'mention') {
      const isMe = !!opts?.currentUserId && opts.currentUserId === token.userId;
      return (
        <button
          key={i}
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            opts?.onMentionClick?.(token.userId);
          }}
          className={cn(
            'rounded px-1 font-medium hover:underline',
            isMe ? 'bg-brand-soft text-brand-hover' : 'bg-primary/10 text-primary',
          )}
        >
          @{token.name}
        </button>
      );
    }
    return token.value;
  });
}
