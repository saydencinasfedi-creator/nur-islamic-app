-- ============================================================================
-- Let a reaction be any emoji, not just the curated set from the previous
-- migration. The quick-react bar is now personalized (client-side, per-viewer
-- "most used" tracking) with a "+" to pick anything via the device's own emoji
-- keyboard, so the server no longer needs to enforce a fixed list — just a
-- sane length bound (multi-codepoint emoji: skin tones, ZWJ sequences, flags
-- can run a few UTF-16 units long, but nothing legitimate needs more than 8).
-- ============================================================================

alter table public.community_reactions drop constraint community_reactions_emoji_check;
alter table public.community_reactions add constraint community_reactions_emoji_check
  check (char_length(emoji) between 1 and 8);
