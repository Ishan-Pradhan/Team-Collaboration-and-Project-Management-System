const MENTION_REGEX = /@\[([^\]]+)\]\(user:([0-9a-fA-F-]{36})\)/g;

// Mentions are stored inline in message/comment content as
// @[Display Name](user:<uuid>) — the composer inserts this token when a
// user is picked from the autocomplete, so extraction never has to guess
// at name matches. Returns deduplicated, valid-among-`allowedUserIds` ids
// only, so a mention token naming someone outside the channel/project
// can't be used to notify or leak information about them.
export function extractMentionedUserIds(content: string, allowedUserIds: string[]): string[] {
  const allowed = new Set(allowedUserIds);
  const found = new Set<string>();
  let match: RegExpExecArray | null;
  MENTION_REGEX.lastIndex = 0;
  while ((match = MENTION_REGEX.exec(content)) !== null) {
    const userId = match[2];
    if (userId && allowed.has(userId)) found.add(userId);
  }
  return [...found];
}

// For plain-text contexts that reuse raw message/comment content — notification
// bodies, emails — where the full @[Name](user:id) token would otherwise leak
// through verbatim instead of rendering as a mention chip.
export function stripMentionTokens(content: string): string {
  return content.replace(MENTION_REGEX, '@$1');
}
