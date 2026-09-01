-- ============================================================================
-- Nur — Community & Groups: schema
-- Phase 0 foundation. Tables, constraints, indexes, denormalization triggers.
-- RLS policies, helper functions and RPCs live in the next migration.
-- ============================================================================

-- --------------------------------------------------------------------------
-- Shared helpers
-- --------------------------------------------------------------------------

-- Generic updated_at bump, attached to every table that has the column.
create or replace function public.tg_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- --------------------------------------------------------------------------
-- profiles — one row per auth user. Public directory (display name / avatar /
-- bio / age range / languages). NO gender, NO birthdate ever stored here.
-- --------------------------------------------------------------------------
create table public.profiles (
  id                   uuid primary key references auth.users (id) on delete cascade,
  display_name         text not null default '',
  avatar_url           text,
  bio                  text check (bio is null or char_length(bio) <= 280),
  age_range            text check (age_range in ('teens', '18-24', '25-34', '35+')),
  languages            text[] not null default '{}',
  interests            text[] not null default '{}',
  preferred_group_type text check (preferred_group_type in ('public', 'private', 'invite_only')),
  is_anonymous         boolean not null default false,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now()
);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.tg_set_updated_at();

-- Auto-create a profile row whenever an auth user is created. display_name
-- defaults to the email local-part (or 'Guest' for anonymous); the user edits
-- it in ProfileSetup.
create or replace function public.tg_handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, is_anonymous)
  values (
    new.id,
    coalesce(nullif(split_part(new.email, '@', 1), ''), 'Guest'),
    coalesce((new.raw_app_meta_data ->> 'provider') = 'anonymous', false)
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.tg_handle_new_user();

-- --------------------------------------------------------------------------
-- groups
-- --------------------------------------------------------------------------
create table public.groups (
  id               uuid primary key default gen_random_uuid(),
  slug             text unique not null,
  name             text not null check (char_length(name) between 2 and 80),
  description      text check (description is null or char_length(description) <= 2000),
  avatar_url       text,
  category         text not null check (category in (
                     'quran', 'salah', 'hadith', 'ramadan', 'self_dev', 'brotherhood',
                     'sisters', 'memorization', 'arabic', 'general', 'other')),
  tags             text[] not null default '{}',
  privacy          text not null default 'public' check (privacy in ('public', 'private', 'invite_only')),
  group_gender     text not null default 'mixed' check (group_gender in ('mixed', 'brothers', 'sisters')),
  age_focus        text check (age_focus in ('teens', '18-24', '25-34', '35+', 'all')),
  primary_language text,
  owner_id         uuid not null references public.profiles (id) on delete restrict,
  member_count     integer not null default 0,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  archived_at      timestamptz,
  -- Full-text search vector over name + description (both plain text, so the
  -- expression stays IMMUTABLE as a generated column requires). Tag matching is
  -- handled separately via the GIN index on `tags`.
  tsv tsvector generated always as (
    to_tsvector('simple'::regconfig,
      coalesce(name, '') || ' ' || coalesce(description, ''))
  ) stored
);

create index groups_tsv_idx        on public.groups using gin (tsv);
create index groups_tags_idx       on public.groups using gin (tags);
create index groups_category_idx   on public.groups (category);
create index groups_privacy_idx    on public.groups (privacy);
create index groups_owner_idx      on public.groups (owner_id);
create index groups_active_idx     on public.groups (created_at desc) where archived_at is null;

create trigger groups_set_updated_at
  before update on public.groups
  for each row execute function public.tg_set_updated_at();

-- slugify(name) + short random suffix, assigned on insert when slug is blank.
create or replace function public.tg_groups_slug()
returns trigger
language plpgsql
as $$
declare
  base text;
begin
  if new.slug is null or new.slug = '' then
    base := lower(regexp_replace(coalesce(new.name, 'group'), '[^a-zA-Z0-9]+', '-', 'g'));
    base := trim(both '-' from base);
    if base = '' then base := 'group'; end if;
    new.slug := left(base, 40) || '-' || substr(md5(gen_random_uuid()::text), 1, 6);
  end if;
  return new;
end;
$$;

create trigger groups_slug
  before insert on public.groups
  for each row execute function public.tg_groups_slug();

-- --------------------------------------------------------------------------
-- group_members
-- --------------------------------------------------------------------------
create table public.group_members (
  group_id    uuid not null references public.groups (id) on delete cascade,
  user_id     uuid not null references public.profiles (id) on delete cascade,
  role        text not null default 'member' check (role in ('owner', 'admin', 'moderator', 'member')),
  status      text not null default 'active' check (status in ('active', 'pending', 'banned', 'muted')),
  joined_at   timestamptz not null default now(),
  muted_until timestamptz,
  primary key (group_id, user_id)
);

create index group_members_user_idx          on public.group_members (user_id);
create index group_members_group_status_idx  on public.group_members (group_id, status);

-- Keep groups.member_count = count of active members.
create or replace function public.tg_group_member_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  gid uuid := coalesce(new.group_id, old.group_id);
begin
  update public.groups g
     set member_count = (
       select count(*) from public.group_members m
        where m.group_id = gid and m.status = 'active')
   where g.id = gid;
  return null;
end;
$$;

create trigger group_members_count
  after insert or update or delete on public.group_members
  for each row execute function public.tg_group_member_count();

-- --------------------------------------------------------------------------
-- group_invites
-- --------------------------------------------------------------------------
create table public.group_invites (
  id         uuid primary key default gen_random_uuid(),
  group_id   uuid not null references public.groups (id) on delete cascade,
  code       text not null unique,
  created_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz,       -- forward-compat, not enforced in MVP
  max_uses   integer,           -- forward-compat, not enforced in MVP
  use_count  integer not null default 0,
  revoked_at timestamptz
);

create index group_invites_group_idx on public.group_invites (group_id);

-- --------------------------------------------------------------------------
-- group_messages
-- --------------------------------------------------------------------------
create table public.group_messages (
  id         uuid primary key default gen_random_uuid(),
  group_id   uuid not null references public.groups (id) on delete cascade,
  author_id  uuid references public.profiles (id) on delete set null,
  body       text not null check (char_length(body) between 1 and 4000),
  reply_to   uuid references public.group_messages (id) on delete set null,
  created_at timestamptz not null default now(),
  edited_at  timestamptz,
  deleted_at timestamptz,
  deleted_by uuid references public.profiles (id) on delete set null
);

create index group_messages_group_created_idx on public.group_messages (group_id, created_at desc);

-- --------------------------------------------------------------------------
-- group_reflections — a group-scoped copy of the personal Reflection shape.
-- source_local_id references the on-device personal reflection it was shared
-- from (a hint for the "already shared" UI, not a hard link).
-- --------------------------------------------------------------------------
create table public.group_reflections (
  id             uuid primary key default gen_random_uuid(),
  group_id       uuid not null references public.groups (id) on delete cascade,
  author_id      uuid references public.profiles (id) on delete set null,
  title          text check (title is null or char_length(title) <= 200),
  content        text not null default '' check (char_length(content) <= 20000),
  quran_refs     jsonb not null default '[]',
  tags           text[] not null default '{}',
  source_local_id text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  deleted_at     timestamptz
);

create index group_reflections_group_created_idx on public.group_reflections (group_id, created_at desc);

create trigger group_reflections_set_updated_at
  before update on public.group_reflections
  for each row execute function public.tg_set_updated_at();

-- --------------------------------------------------------------------------
-- group_reflection_comments
-- --------------------------------------------------------------------------
create table public.group_reflection_comments (
  id            uuid primary key default gen_random_uuid(),
  reflection_id uuid not null references public.group_reflections (id) on delete cascade,
  author_id     uuid references public.profiles (id) on delete set null,
  body          text not null check (char_length(body) between 1 and 4000),
  created_at    timestamptz not null default now(),
  deleted_at    timestamptz
);

create index group_reflection_comments_reflection_idx
  on public.group_reflection_comments (reflection_id, created_at);

-- --------------------------------------------------------------------------
-- community_reactions — polymorphic (message | reflection | comment).
-- --------------------------------------------------------------------------
create table public.community_reactions (
  entity_type text not null check (entity_type in ('message', 'reflection', 'comment')),
  entity_id   uuid not null,
  user_id     uuid not null references public.profiles (id) on delete cascade,
  emoji       text not null check (emoji in ('heart', 'dua', 'like')),
  created_at  timestamptz not null default now(),
  primary key (entity_type, entity_id, user_id, emoji)
);

create index community_reactions_entity_idx on public.community_reactions (entity_type, entity_id);

-- --------------------------------------------------------------------------
-- group_challenges
-- --------------------------------------------------------------------------
create table public.group_challenges (
  id          uuid primary key default gen_random_uuid(),
  group_id    uuid not null references public.groups (id) on delete cascade,
  creator_id  uuid references public.profiles (id) on delete set null,
  title       text not null check (char_length(title) between 2 and 120),
  description text check (description is null or char_length(description) <= 2000),
  type        text not null default 'custom' check (type in ('quran', 'salah', 'memorization', 'dhikr', 'custom')),
  starts_on   date not null default current_date,
  ends_on     date not null,
  goal_total  integer check (goal_total is null or goal_total > 0),
  daily_goal  integer check (daily_goal is null or daily_goal > 0),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  archived_at timestamptz,
  check (ends_on >= starts_on)
);

create index group_challenges_group_idx on public.group_challenges (group_id, starts_on desc);

create trigger group_challenges_set_updated_at
  before update on public.group_challenges
  for each row execute function public.tg_set_updated_at();

-- --------------------------------------------------------------------------
-- challenge_participants — progress numbers are private by default (spec §13).
-- --------------------------------------------------------------------------
create table public.challenge_participants (
  challenge_id     uuid not null references public.group_challenges (id) on delete cascade,
  user_id          uuid not null references public.profiles (id) on delete cascade,
  joined_at        timestamptz not null default now(),
  progress_count   integer not null default 0 check (progress_count >= 0),
  last_progress_on date,
  share_detail     boolean not null default false,
  primary key (challenge_id, user_id)
);

create index challenge_participants_challenge_idx on public.challenge_participants (challenge_id);

-- --------------------------------------------------------------------------
-- reports — structure ready for a future moderation dashboard.
-- --------------------------------------------------------------------------
create table public.reports (
  id          uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles (id) on delete cascade,
  entity_type text not null check (entity_type in ('message', 'reflection', 'comment', 'group', 'user')),
  entity_id   uuid not null,
  group_id    uuid references public.groups (id) on delete set null,
  reason      text not null check (reason in ('spam', 'harassment', 'inappropriate', 'hate', 'misinfo', 'other')),
  detail      text check (detail is null or char_length(detail) <= 2000),
  status      text not null default 'open' check (status in ('open', 'reviewing', 'resolved', 'dismissed')),
  created_at  timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references public.profiles (id) on delete set null
);

create index reports_group_status_idx on public.reports (group_id, status);
create index reports_reporter_idx     on public.reports (reporter_id);

-- --------------------------------------------------------------------------
-- blocked_users
-- --------------------------------------------------------------------------
create table public.blocked_users (
  blocker_id uuid not null references public.profiles (id) on delete cascade,
  blocked_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);

create index blocked_users_blocker_idx on public.blocked_users (blocker_id);

-- --------------------------------------------------------------------------
-- community_notifications — cross-device inbox, mirrored client-side into the
-- existing local AppNotification list.
-- --------------------------------------------------------------------------
create table public.community_notifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles (id) on delete cascade,
  type        text not null check (type in (
                'invite', 'join_request', 'join_approved', 'message', 'mention',
                'challenge_starting', 'challenge_reminder', 'reflection_reaction')),
  title       text not null,
  body        text not null default '',
  entity_type text,
  entity_id   uuid,
  read        boolean not null default false,
  created_at  timestamptz not null default now()
);

create index community_notifications_user_idx
  on public.community_notifications (user_id, read, created_at desc);

-- --------------------------------------------------------------------------
-- Realtime: only group_messages and community_notifications are streamed.
-- --------------------------------------------------------------------------
alter publication supabase_realtime add table public.group_messages;
alter publication supabase_realtime add table public.community_notifications;
