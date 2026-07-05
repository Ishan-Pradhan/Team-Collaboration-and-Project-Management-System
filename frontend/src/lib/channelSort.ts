import type { Channel } from '@/types/channel.types';

/**
 * Sorts channels so that PUBLIC channels come first, then PRIVATE,
 * with each group sorted alphabetically by name (case-insensitive).
 */
export function sortChannels(channels: Channel[]): Channel[] {
  return [...channels].sort((a, b) => {
    // PUBLIC = 0, PRIVATE = 1  (DM never goes through here but safe to handle)
    const typeOrder = (t: Channel['type']) => (t === 'PUBLIC' ? 0 : t === 'PRIVATE' ? 1 : 2);
    const typeDiff = typeOrder(a.type) - typeOrder(b.type);
    if (typeDiff !== 0) return typeDiff;
    return (a.name ?? '').localeCompare(b.name ?? '', undefined, { sensitivity: 'base' });
  });
}
