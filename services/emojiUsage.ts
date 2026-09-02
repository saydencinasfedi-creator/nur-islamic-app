// Per-device "most used reactions" tracker for the chat quick-react bar. Purely a
// local convenience (which emoji show up first for *this* viewer) — never synced,
// so localStorage is the right fit rather than a server table. Falls back to /
// pads out with ReactionBar's curated default set for a new user with no history.

import { EMOJI as DEFAULT_EMOJI } from '../components/ReactionBar';

const STORAGE_KEY = 'nurEmojiUsage';

const readCounts = (): Record<string, number> => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
};

export const recordEmojiUse = (emoji: string): void => {
  try {
    const counts = readCounts();
    counts[emoji] = (counts[emoji] ?? 0) + 1;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(counts));
  } catch {
    // Private browsing / storage disabled — the quick-bar just stays on defaults.
  }
};

export const getTopEmojis = (limit = 6): string[] => {
  const counts = readCounts();
  const used = Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .map(([emoji]) => emoji);
  const padded = [...used, ...DEFAULT_EMOJI.map(e => e.char)];
  return [...new Set(padded)].slice(0, limit);
};
