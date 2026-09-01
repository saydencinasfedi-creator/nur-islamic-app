-- ============================================================================
-- Nur — Community: challenges v2
--
--  * group_id becomes NULLABLE  -> a NULL group_id is a *global* challenge
--  * icon / duration_days / notify_frequency / notify_at  -> creation form fields
--  * status ('pending' | 'active' | 'rejected' | 'archived')
--      - admins / moderators (or app-admins for global) create -> 'active'
--      - a plain member proposes -> 'pending', visible only to them + admins,
--        until an admin flips it to 'active' or 'rejected'
--  * is_full_member() gate on creation and on joining
-- ============================================================================

alter table public.group_challenges
  alter column group_id drop not null,
  add column if not exists icon             text,
  add column if not exists duration_days    integer check (duration_days is null or duration_days > 0),
  add column if not exists status           text not null default 'active'
                            check (status in ('pending', 'active', 'rejected', 'archived')),
  add column if not exists notify_frequency text not null default 'none'
                            check (notify_frequency in ('none', 'daily', 'fridays')),
  add column if not exists notify_at        time;

create index if not exists group_challenges_global_idx
  on public.group_challenges (starts_on desc)
  where group_id is null and status = 'active';

-- ---- policies (replace the three from 20260830230100) --------------------
drop policy if exists challenges_read   on public.group_challenges;
drop policy if exists challenges_insert on public.group_challenges;
drop policy if exists challenges_update on public.group_challenges;

-- Read: active challenges to anyone who can see their scope; pending/rejected
-- only to the proposer and the admins who moderate that scope.
create policy challenges_read on public.group_challenges for select to authenticated using (
  (status = 'active' and (
      group_id is null
      or public.can_access_group_content(group_id, (select auth.uid()))
  ))
  or creator_id = (select auth.uid())
  or (group_id is not null and public.is_group_admin(group_id, (select auth.uid())))
  or (group_id is null and public.is_app_admin())
);

-- Insert: full members only. Admins/mods (or app-admins for global) create
-- 'active'; plain members of the scope create 'pending'.
create policy challenges_insert on public.group_challenges for insert to authenticated with check (
  creator_id = (select auth.uid())
  and public.is_full_member()
  and (
    (group_id is not null and (
        (status = 'active'  and public.is_group_moderator(group_id, (select auth.uid())))
        or (status = 'pending' and public.is_group_member(group_id, (select auth.uid())))
    ))
    or (group_id is null and (
        (status = 'active'  and public.is_app_admin())
        or (status = 'pending')
    ))
  )
);

-- Update: admins of the scope can set any status; the creator may edit their own
-- proposal while it is still pending, or withdraw it (archived), but cannot
-- self-approve to 'active'.
create policy challenges_update on public.group_challenges for update to authenticated
using (
  (group_id is not null and (
      public.is_group_admin(group_id, (select auth.uid()))
      or creator_id = (select auth.uid())
  ))
  or (group_id is null and (
      public.is_app_admin()
      or creator_id = (select auth.uid())
  ))
)
with check (
  (group_id is not null and public.is_group_admin(group_id, (select auth.uid())))
  or (group_id is null and public.is_app_admin())
  or (creator_id = (select auth.uid()) and status in ('pending', 'archived'))
);

-- ---- challenge_participants: allow joining a global challenge ------------
drop policy if exists cp_insert on public.challenge_participants;
create policy cp_insert on public.challenge_participants for insert to authenticated with check (
  user_id = (select auth.uid())
  and public.is_full_member()
  and (
    public.challenge_group(challenge_id) is null
    or public.can_access_group_content(public.challenge_group(challenge_id), (select auth.uid()))
  )
);

-- ---- privacy-preserving participant view (recreate for NULL group) ------
drop view if exists public.challenge_participants_public;
create view public.challenge_participants_public
with (security_invoker = false) as
select
  cp.challenge_id,
  cp.user_id,
  cp.joined_at,
  cp.share_detail,
  (cp.last_progress_on = current_date)                                       as completed_today,
  case when cp.share_detail or cp.user_id = (select auth.uid())
       then cp.progress_count end                                            as progress_count,
  case when cp.share_detail or cp.user_id = (select auth.uid())
       then cp.last_progress_on end                                          as last_progress_on
from public.challenge_participants cp
where public.challenge_group(cp.challenge_id) is null
   or public.can_access_group_content(public.challenge_group(cp.challenge_id), (select auth.uid()));

grant select on public.challenge_participants_public to authenticated;

-- ---- log_challenge_progress (recreate for NULL group) ------------------
create or replace function public.log_challenge_progress(p_challenge_id uuid, p_amount integer default 1)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  gid uuid := public.challenge_group(p_challenge_id);
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  if p_amount is null or p_amount < 1 then raise exception 'bad_amount'; end if;
  if gid is not null and not public.can_access_group_content(gid, uid) then
    raise exception 'forbidden';
  end if;

  insert into public.challenge_participants (challenge_id, user_id, progress_count, last_progress_on)
  values (p_challenge_id, uid, p_amount, current_date)
  on conflict (challenge_id, user_id) do update
    set progress_count   = public.challenge_participants.progress_count + p_amount,
        last_progress_on = current_date;
end;
$$;
