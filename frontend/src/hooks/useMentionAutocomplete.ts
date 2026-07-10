'use client';

import { useCallback, useRef, useState } from 'react';

export interface MentionCandidate {
  id: string;
  name: string;
  avatarUrl?: string | null;
}

interface MentionRange {
  id: string;
  name: string;
  start: number;
  end: number; // exclusive
}

// The compose box only ever shows plain "@Name" — never the raw
// @[Name](user:<uuid>) wire format, which would be an ugly, unreadable
// UUID sitting in the middle of what you're typing. The full token only
// gets reconstructed by serialize(), right before sending.
//
// This means the visible text and the "real" mention data can drift apart
// as the user keeps typing, so every keystroke is reconciled against the
// previously tracked mention ranges: edits entirely before/after a mention
// just shift its position, but an edit that touches inside a mention's own
// text invalidates it — it reverts to being plain, unlinked text, same as
// if you'd never selected it from the dropdown. That mirrors how Discord/
// Slack degrade a broken mention, and avoids needing a full contenteditable
// rich-text editor just to hide one substring.
export function useMentionAutocomplete(candidates: MentionCandidate[]) {
  const [query, setQuery] = useState<string | null>(null);
  const [triggerIndex, setTriggerIndex] = useState<number | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const mentionsRef = useRef<MentionRange[]>([]);

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

  // Call with (previousValue, newValue) before applying a plain text edit,
  // so tracked mention ranges stay aligned with the text around them.
  const reconcileMentions = useCallback((oldValue: string, newValue: string) => {
    if (oldValue === newValue || mentionsRef.current.length === 0) return;

    let prefix = 0;
    const maxPrefix = Math.min(oldValue.length, newValue.length);
    while (prefix < maxPrefix && oldValue[prefix] === newValue[prefix]) prefix++;

    let suffix = 0;
    const maxSuffix = Math.min(oldValue.length, newValue.length) - prefix;
    while (
      suffix < maxSuffix &&
      oldValue[oldValue.length - 1 - suffix] === newValue[newValue.length - 1 - suffix]
    ) {
      suffix++;
    }

    const oldChangeEnd = oldValue.length - suffix;
    const delta = newValue.length - oldValue.length;

    mentionsRef.current = mentionsRef.current
      .map((m): MentionRange | null => {
        if (m.end <= prefix) return m;
        if (m.start >= oldChangeEnd) return { ...m, start: m.start + delta, end: m.end + delta };
        return null;
      })
      .filter((m): m is MentionRange => m !== null);
  }, []);

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

  // Replaces the "@query" currently being typed with plain "@Name" and
  // records the mention range. Returns the new field value and where the
  // caret should land, or null if there's nothing open to apply.
  const applyMention = useCallback(
    (value: string, candidate: MentionCandidate): { value: string; caretPos: number } | null => {
      if (triggerIndex === null || query === null) return null;
      const display = `@${candidate.name}`;
      const before = value.slice(0, triggerIndex);
      const after = value.slice(triggerIndex + 1 + query.length);
      const nextValue = `${before}${display} ${after}`;
      const start = triggerIndex;
      const end = triggerIndex + display.length;

      mentionsRef.current = [
        ...mentionsRef.current.filter((m) => m.end <= start),
        { id: candidate.id, name: candidate.name, start, end },
      ];

      const caretPos = end + 1;
      close();
      return { value: nextValue, caretPos };
    },
    [triggerIndex, query, close],
  );

  // Turns the currently tracked mentions back into @[Name](user:id) tokens
  // for sending. Works back-to-front so earlier ranges' indices stay valid
  // as later ones are expanded into longer token text.
  const serialize = useCallback((value: string): string => {
    let result = value;
    const sorted = [...mentionsRef.current].sort((a, b) => b.start - a.start);
    for (const m of sorted) {
      if (result.slice(m.start, m.end) !== `@${m.name}`) continue;
      const token = `@[${m.name}](user:${m.id})`;
      result = result.slice(0, m.start) + token + result.slice(m.end);
    }
    return result;
  }, []);

  const resetMentions = useCallback(() => {
    mentionsRef.current = [];
  }, []);

  return {
    isOpen,
    filtered,
    activeIndex,
    setActiveIndex,
    handleTextChange,
    applyMention,
    close,
    reconcileMentions,
    serialize,
    resetMentions,
  };
}
