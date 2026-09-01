-- ============================================================================
-- Nur — Community: app-admin flag + "full member" helper
--
-- `is_app_admin` marks the founder / app-level moderators. It is set by hand:
--   update public.profiles set is_app_admin = true where id = '<founder uuid>';
--
-- `is_full_member()` is the guest gate: an anonymous (guest) session can browse
-- but cannot join/post/create until it links an email. Anonymous sessions have
-- profiles.is_anonymous = true (set by tg_handle_new_user from the auth
-- provider), and linkEmailToGuest() clears it on the next profile refresh —
-- but to stay correct immediately we also treat a session whose JWT is no
-- longer anonymous as full.
-- ============================================================================

alter table public.profiles
  add column if not exists is_app_admin boolean not null default false;

create or replace function public.is_app_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select p.is_app_admin from public.profiles p where p.id = auth.uid()),
    false
  );
$$;

create or replace function public.is_full_member()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid() is not null
     and coalesce(
           (select not p.is_anonymous from public.profiles p where p.id = auth.uid()),
           false
         );
$$;

revoke all on function public.is_app_admin()   from public, anon;
revoke all on function public.is_full_member()  from public, anon;
grant execute on function public.is_app_admin()  to authenticated;
grant execute on function public.is_full_member() to authenticated;
