-- ============================================================================
-- Verse of the Day — an optional, admin-set Qur'an reference pinned at the top
-- of a circle's chat. Stored as a full QuranReference snapshot (surah/ayah +
-- translation text), same shape as group_reflections.quran_refs entries, so
-- rendering it never needs a live Qur'an API call.
-- ============================================================================

alter table public.groups add column verse_of_day jsonb;

comment on column public.groups.verse_of_day is
  'Optional QuranReference snapshot ({surahNumber, surahName, ayahNumber, ayahText}) pinned in this circle''s chat. Set/cleared by a group admin via groups_update RLS (no new policy needed).';
