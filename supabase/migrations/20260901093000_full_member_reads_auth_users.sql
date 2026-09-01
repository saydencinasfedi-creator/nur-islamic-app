-- is_full_member() must read auth.users.is_anonymous (GoTrue keeps it current —
-- it flips to false when a guest confirms a linked email), not the stale
-- profiles.is_anonymous copy which is only written by the on-insert trigger.

create or replace function public.is_full_member()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from auth.users u
    where u.id = auth.uid()
      and coalesce(u.is_anonymous, false) = false
  );
$$;

revoke all on function public.is_full_member() from public, anon;
grant execute on function public.is_full_member() to authenticated;
