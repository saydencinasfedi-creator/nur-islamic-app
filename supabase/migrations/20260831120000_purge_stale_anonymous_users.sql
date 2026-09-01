-- Guest (anonymous) accounts can't delete themselves on sign-out: removing an
-- auth.users row needs the service_role key, which never ships in the client. So
-- the client only drops the local session and the row lingers.
--
-- This adds a nightly server-side sweep that deletes anonymous users with no
-- activity for 30 days. profiles.id -> auth.users(id) is ON DELETE CASCADE, and
-- every Community table cascades / sets-null from profiles, so deleting the auth
-- user cleans up the profile and all downstream rows automatically.

create extension if not exists pg_cron;

-- Deletes anonymous auth users whose most recent touch (creation, last sign-in,
-- or token refresh) is older than 30 days. A guest who still opens the app keeps
-- refreshing their token, which bumps updated_at and spares them.
create or replace function public.purge_stale_anonymous_users()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  removed integer;
begin
  with doomed as (
    delete from auth.users u
    where u.is_anonymous is true
      and greatest(
            u.created_at,
            coalesce(u.last_sign_in_at, u.created_at),
            coalesce(u.updated_at,      u.created_at)
          ) < now() - interval '30 days'
    returning 1
  )
  select count(*) into removed from doomed;
  return removed;
end;
$$;

-- Cron-only: not callable by app roles.
revoke all on function public.purge_stale_anonymous_users() from public;
revoke all on function public.purge_stale_anonymous_users() from anon;
revoke all on function public.purge_stale_anonymous_users() from authenticated;

-- Re-runnable: drop any prior schedule before (re)creating it.
select cron.unschedule('purge-stale-anonymous-users')
where exists (select 1 from cron.job where jobname = 'purge-stale-anonymous-users');

-- Every day at 03:17 UTC.
select cron.schedule(
  'purge-stale-anonymous-users',
  '17 3 * * *',
  $$select public.purge_stale_anonymous_users();$$
);
