-- ============================================================================
-- Direct Messages — 1:1 chat between two users, entered from a shared circle's
-- Members list. Mirrors group_messages' shape (soft-delete, reply_to, edited_at)
-- scoped to a thread instead of a group. No moderator concept: only the two
-- participants can ever read/write a thread.
-- ============================================================================

create table public.dm_threads (
  id               uuid primary key default gen_random_uuid(),
  user_a_id        uuid not null references public.profiles (id) on delete cascade,
  user_b_id        uuid not null references public.profiles (id) on delete cascade,
  created_at       timestamptz not null default now(),
  last_message_at  timestamptz not null default now(),
  -- Canonical ordering (a < b) makes the pair unique regardless of who started it;
  -- enforced here and in get_or_create_dm_thread below, which is the only writer.
  constraint dm_threads_ordered check (user_a_id < user_b_id),
  constraint dm_threads_unique unique (user_a_id, user_b_id)
);

create table public.dm_messages (
  id         uuid primary key default gen_random_uuid(),
  thread_id  uuid not null references public.dm_threads (id) on delete cascade,
  author_id  uuid references public.profiles (id) on delete set null,
  body       text not null check (char_length(body) between 1 and 4000),
  reply_to   uuid references public.dm_messages (id) on delete set null,
  created_at timestamptz not null default now(),
  edited_at  timestamptz,
  deleted_at timestamptz
);

create index dm_messages_thread_created_idx on public.dm_messages (thread_id, created_at desc);

-- Per-user "last read" marker, used client-side for a simple unread dot on the
-- inbox row (lastMessageAt > my last_read_at). Not an exact unread count.
create table public.dm_thread_reads (
  thread_id    uuid not null references public.dm_threads (id) on delete cascade,
  user_id      uuid not null references public.profiles (id) on delete cascade,
  last_read_at timestamptz not null default now(),
  primary key (thread_id, user_id)
);

-- --------------------------------------------------------------------------
-- Bump last_message_at whenever a message lands, so the inbox can sort by it
-- without scanning dm_messages. Mirrors tg_group_member_count's style.
-- --------------------------------------------------------------------------
create or replace function public.tg_dm_thread_bump()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  update public.dm_threads set last_message_at = new.created_at where id = new.thread_id;
  return null;
end;
$$;

create trigger dm_messages_bump_thread
  after insert on public.dm_messages
  for each row execute function public.tg_dm_thread_bump();

-- --------------------------------------------------------------------------
-- RLS
-- --------------------------------------------------------------------------
alter table public.dm_threads enable row level security;
alter table public.dm_messages enable row level security;
alter table public.dm_thread_reads enable row level security;

-- No insert/update/delete policy on dm_threads: the only writer is the
-- SECURITY DEFINER RPC below, which bypasses RLS.
create policy dm_threads_read on public.dm_threads for select to authenticated using (
  (select auth.uid()) in (user_a_id, user_b_id)
);

create policy dm_messages_read on public.dm_messages for select to authenticated using (
  exists (
    select 1 from public.dm_threads t
    where t.id = thread_id and (select auth.uid()) in (t.user_a_id, t.user_b_id)
  )
);
create policy dm_messages_insert on public.dm_messages for insert to authenticated
  with check (
    author_id = (select auth.uid())
    and exists (
      select 1 from public.dm_threads t
      where t.id = thread_id and (select auth.uid()) in (t.user_a_id, t.user_b_id)
    )
  );
-- Author-only: unlike group_messages, there is no moderator who can edit/delete
-- the other participant's messages in a DM.
create policy dm_messages_update on public.dm_messages for update to authenticated
  using (author_id = (select auth.uid()))
  with check (author_id = (select auth.uid()));
-- No delete policy: soft-delete only, same as group_messages.

create policy dm_thread_reads_rw on public.dm_thread_reads for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- --------------------------------------------------------------------------
-- get_or_create_dm_thread — the only way a dm_threads row is created. Sorts
-- the pair so (me, other) and (other, me) always resolve to the same thread.
-- --------------------------------------------------------------------------
create or replace function public.get_or_create_dm_thread(p_other_user_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  me uuid := (select auth.uid());
  a uuid;
  b uuid;
  tid uuid;
begin
  if me is null then raise exception 'not_authenticated'; end if;
  if p_other_user_id is null or p_other_user_id = me then raise exception 'invalid_recipient'; end if;
  if not exists (select 1 from public.profiles where id = p_other_user_id) then
    raise exception 'user_not_found' using errcode = 'P0002';
  end if;

  if me < p_other_user_id then a := me; b := p_other_user_id; else a := p_other_user_id; b := me; end if;

  select id into tid from public.dm_threads where user_a_id = a and user_b_id = b;
  if tid is null then
    insert into public.dm_threads (user_a_id, user_b_id) values (a, b) returning id into tid;
  end if;
  return tid;
end;
$$;

-- --------------------------------------------------------------------------
-- dm_threads_view — one row per thread with the other participant's id and
-- the latest message preview, for the inbox list. security_invoker = false
-- (like challenge_participants_public) so it can join across both users'
-- rows; the WHERE clause below is what actually restricts it to my threads.
-- --------------------------------------------------------------------------
create view public.dm_threads_view
with (security_invoker = false) as
select
  t.id,
  case when t.user_a_id = (select auth.uid()) then t.user_b_id else t.user_a_id end as other_user_id,
  t.last_message_at,
  (
    select m.body from public.dm_messages m
    where m.thread_id = t.id and m.deleted_at is null
    order by m.created_at desc limit 1
  ) as last_message_body,
  (
    select m.author_id from public.dm_messages m
    where m.thread_id = t.id
    order by m.created_at desc limit 1
  ) as last_message_author_id
from public.dm_threads t
where (select auth.uid()) in (t.user_a_id, t.user_b_id);

grant select on public.dm_threads_view to authenticated;

-- --------------------------------------------------------------------------
-- Realtime
-- --------------------------------------------------------------------------
alter publication supabase_realtime add table public.dm_messages;
