'use client';

import { useCallback, useState } from 'react';

export interface MentionCandidate {
  id: string;
  name: string;
  avatarUrl?: string | null;
}

// Mentions are stored inline as @[Display Name](user:<uuid>) — see
// backend/src/utils/mentions.ts. This hook only tracks the "@query" the
// user is currently typing and turns a selection into that token; it knows
// nothing about where the text lives (input vs textarea), so it works for
// both the chat composer and the comment composer.
export function useMentionAutocomplete(candidates: MentionCandidate[]) {
  const [query, setQuery] = useState<string | null>(null);
  const [triggerIndex, setTriggerIndex] = useState<number | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const filtered =
    query === null
      ? []
      : candidates
          .filter((c) => c.name.toLowerCase().includes(query.toLowerCase()))
          .slice(0, 6);

  const isOpen = query !== null && filtered.length > 0;

  const close = useCallback(() => {
    setQuery(null);
    setTriggerIndex(null);
    setActiveIndex(0);
  }, []);

  // Call on every keystroke with the field's current value and caret position.
  const handleTextChange = useCallback((value: string, caretPos: number) => {
    const uptoCaret = value.slice(0, caretPos);
    const atIndex = uptoCaret.lastIndexOf('@');
    if (atIndex === -1) {
      setQuery(null);
      return;
    }
    const between = uptoCaret.slice(atIndex + 1);
    if (/\s/.test(between)) {
      setQuery(null);
      return;
    }
    setTriggerIndex(atIndex);
    setQuery(between);
    setActiveIndex(0);
  }, []);

  // Replaces the "@query" currently being typed with the mention token.
  // Returns the new field value and where the caret should land, or null
  // if there's nothing open to apply.
  const applyMention = useCallback(
    (value: string, candidate: MentionCandidate): { value: string; caretPos: number } | null => {
      if (triggerIndex === null || query === null) return null;
      const token = `@[${candidate.name}](user:${candidate.id})`;
      const before = value.slice(0, triggerIndex);
      const after = value.slice(triggerIndex + 1 + query.length);
      const nextValue = `${before}${token} ${after}`;
      const caretPos = (before + token + ' ').length;
      close();
      return { value: nextValue, caretPos };
    },
    [triggerIndex, query, close],
  );

  return { isOpen, filtered, activeIndex, setActiveIndex, handleTextChange, applyMention, close };
}
