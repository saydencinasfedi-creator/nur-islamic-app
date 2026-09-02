-- ============================================================================
-- Expand the reaction emoji set (was heart/dua/like only) so chat messages can
-- get a small Discord-style quick-react bar. Still a curated set, not free-text
-- emoji — keeps validation simple and the UI a fixed picker rather than a full
-- emoji keyboard.
-- ============================================================================

alter table public.community_reactions drop constraint community_reactions_emoji_check;
alter table public.community_reactions add constraint community_reactions_emoji_check
  check (emoji in ('heart', 'dua', 'like', 'laugh', 'wow', 'sad'));
