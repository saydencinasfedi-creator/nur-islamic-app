-- ============================================================================
-- Nur — Community: Dua Requests
--
-- A global feed (not per-group): a member posts a request for dua, others tap
-- "Ameen". `ameen_count` is denormalised and kept by a trigger. Requests may be
-- posted anonymously (author hidden in the UI, still stored for moderation).
-- Guests (anonymous sessions) cannot post or say Ameen — is_full_member().
-- ============================================================================

create table public.dua_requests (
  id           uuid primary key default gen_random_uuid(),
  author_id    uuid references public.profiles (id) on delete set null,
  body         text not null check (char_length(body) between 3 and 500),
  is_anonymous boolean not null default true,
  ameen_count  integer not null default 0,
  created_at   timestamptz not null default now(),
  deleted_at   timestamptz
);

create index dua_requests_created_idx
  on public.dua_requests (created_at desc)
  where deleted_at is null;

create table public.dua_ameens (
  dua_id     uuid not null references public.dua_requests (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (dua_id, user_id)
);

create or replace function public.tg_dua_ameen_count()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target uuid := coalesce(new.dua_id, old.dua_id);
begin
  update public.dua_requests d
     set ameen_count = (select count(*) from public.dua_ameens a where a.dua_id = target)
   where d.id = target;
  return null;
end;
$$;

create trigger dua_ameens_count
  after insert or delete on public.dua_ameens
  for each row execute function public.tg_dua_ameen_count();

-- ---- RLS -------------------------------------------------------------------
alter table public.dua_requests enable row level security;
alter table public.dua_ameens   enable row level security;

create policy dua_requests_read on public.dua_requests for select to authenticated
  using (deleted_at is null);
create policy dua_requests_insert on public.dua_requests for insert to authenticated
  with check (author_id = (select auth.uid()) and public.is_full_member());
create policy dua_requests_update on public.dua_requests for update to authenticated
  using (author_id = (select auth.uid()))
  with check (author_id = (select auth.uid()));

create policy dua_ameens_read on public.dua_ameens for select to authenticated
  using (true);
create policy dua_ameens_insert on public.dua_ameens for insert to authenticated
  with check (user_id = (select auth.uid()) and public.is_full_member());
create policy dua_ameens_delete on public.dua_ameens for delete to authenticated
  using (user_id = (select auth.uid()));

alter publication supabase_realtime add table public.dua_requests;

-- ---- reports can now target a dua request or a challenge -----------------
alter table public.reports drop constraint if exists reports_entity_type_check;
alter table public.reports add constraint reports_entity_type_check
  check (entity_type in ('message', 'reflection', 'comment', 'group', 'user', 'dua_request', 'challenge'));
