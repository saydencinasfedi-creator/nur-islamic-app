-- ============================================================================
-- Nur — Community & Groups: security
-- SECURITY DEFINER helpers (bypass RLS -> no policy recursion), RLS policies,
-- RPCs, notification triggers, seed. Depends on 20260830230000_community_schema.
-- ============================================================================

-- --------------------------------------------------------------------------
-- Helper functions. All SECURITY DEFINER with an empty search_path and fully
-- qualified references, so membership checks inside RLS policies never recurse
-- back through RLS on group_members / groups.
-- --------------------------------------------------------------------------

create or replace function public.group_role(p_group uuid, p_user uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select m.role
  from public.group_members m
  where m.group_id = p_group
    and m.user_id = p_user
    and m.status in ('active', 'muted');
$$;

create or replace function public.is_group_member(p_group uuid, p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.group_members m
    where m.group_id = p_group
      and m.user_id = p_user
      and m.status in ('active', 'muted')
  );
$$;

create or replace function public.is_group_admin(p_group uuid, p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.group_members m
    where m.group_id = p_group
      and m.user_id = p_user
      and m.status = 'active'
      and m.role in ('owner', 'admin')
  );
$$;

create or replace function public.is_group_moderator(p_group uuid, p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.group_members m
    where m.group_id = p_group
      and m.user_id = p_user
      and m.status = 'active'
      and m.role in ('owner', 'admin', 'moderator')
  );
$$;

-- Can read a group's members/content: active or muted member (not pending/banned).
create or replace function public.can_access_group_content(p_group uuid, p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.group_members m
    where m.group_id = p_group
      and m.user_id = p_user
      and m.status in ('active', 'muted')
  );
$$;

-- Can post: active member, not muted (respecting a timed mute that has lapsed).
create or replace function public.can_post_in_group(p_group uuid, p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.group_members m
    where m.group_id = p_group
      and m.user_id = p_user
      and m.status = 'active'
      and (m.muted_until is null or m.muted_until < now())
  );
$$;

create or replace function public.reflection_group(p_reflection uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select r.group_id from public.group_reflections r where r.id = p_reflection;
$$;

create or replace function public.challenge_group(p_challenge uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select c.group_id from public.group_challenges c where c.id = p_challenge;
$$;

-- Resolve the owning group of a reaction target (message | reflection | comment).
create or replace function public.entity_group(p_type text, p_id uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select case p_type
    when 'message'    then (select gm.group_id from public.group_messages gm where gm.id = p_id)
    when 'reflection' then (select gr.group_id from public.group_reflections gr where gr.id = p_id)
    when 'comment'    then (
      select gr.group_id
      from public.group_reflection_comments c
      join public.group_reflections gr on gr.id = c.reflection_id
      where c.id = p_id)
  end;
$$;

-- --------------------------------------------------------------------------
-- Owner membership row: added automatically when a group is created.
-- --------------------------------------------------------------------------
create or replace function public.tg_groups_after_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.group_members (group_id, user_id, role, status)
  values (new.id, new.owner_id, 'owner', 'active')
  on conflict (group_id, user_id) do nothing;
  return new;
end;
$$;

create trigger groups_owner_membership
  after insert on public.groups
  for each row execute function public.tg_groups_after_insert();

-- --------------------------------------------------------------------------
-- Notifications: internal helper + join-request / join-approved triggers.
-- --------------------------------------------------------------------------
create or replace function public.push_notification(
  p_user uuid, p_type text, p_title text, p_body text,
  p_entity_type text default null, p_entity_id uuid default null)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.community_notifications (user_id, type, title, body, entity_type, entity_id)
  values (p_user, p_type, p_title, coalesce(p_body, ''), p_entity_type, p_entity_id);
$$;

create or replace function public.tg_group_members_notify()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  g_name text;
  admin_id uuid;
begin
  select name into g_name from public.groups where id = new.group_id;

  -- New pending request -> notify every admin/owner.
  if tg_op = 'INSERT' and new.status = 'pending' then
    for admin_id in
      select user_id from public.group_members
      where group_id = new.group_id and status = 'active' and role in ('owner', 'admin')
    loop
      perform public.push_notification(
        admin_id, 'join_request', g_name,
        'Alguien solicitó unirse', 'group', new.group_id);
    end loop;
  end if;

  -- Request approved -> notify the requester.
  if tg_op = 'UPDATE' and old.status = 'pending' and new.status = 'active' then
    perform public.push_notification(
      new.user_id, 'join_approved', g_name,
      'Tu solicitud fue aprobada', 'group', new.group_id);
  end if;

  return null;
end;
$$;

create trigger group_members_notify
  after insert or update on public.group_members
  for each row execute function public.tg_group_members_notify();

-- ============================================================================
-- Row Level Security
-- ============================================================================
alter table public.profiles                  enable row level security;
alter table public.groups                    enable row level security;
alter table public.group_members             enable row level security;
alter table public.group_invites             enable row level security;
alter table public.group_messages            enable row level security;
alter table public.group_reflections         enable row level security;
alter table public.group_reflection_comments enable row level security;
alter table public.community_reactions       enable row level security;
alter table public.group_challenges          enable row level security;
alter table public.challenge_participants    enable row level security;
alter table public.reports                   enable row level security;
alter table public.blocked_users             enable row level security;
alter table public.community_notifications   enable row level security;

-- ---- profiles -------------------------------------------------------------
create policy profiles_read   on public.profiles for select to authenticated using (true);
create policy profiles_insert on public.profiles for insert to authenticated with check (id = (select auth.uid()));
create policy profiles_update on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- ---- groups -------------------------------------------------------------
-- invite_only groups are invisible here; they are resolved only via preview_invite().
create policy groups_read on public.groups for select to authenticated using (
  privacy in ('public', 'private')
  or public.is_group_member(id, (select auth.uid()))
);
create policy groups_insert on public.groups for insert to authenticated
  with check (owner_id = (select auth.uid()));
create policy groups_update on public.groups for update to authenticated
  using (public.is_group_admin(id, (select auth.uid())))
  with check (public.is_group_admin(id, (select auth.uid())));
create policy groups_delete on public.groups for delete to authenticated
  using (owner_id = (select auth.uid()));

-- ---- group_members ----------------------------------------------------------
create policy group_members_read on public.group_members for select to authenticated using (
  user_id = (select auth.uid())
  or (status = 'active' and public.is_group_member(group_id, (select auth.uid())))
  or public.is_group_admin(group_id, (select auth.uid()))
);
-- Self-join: public group -> active; private group -> pending. Always role 'member'.
-- invite_only never matches (the groups sub-select is RLS-filtered), so those joins
-- must go through redeem_invite().
create policy group_members_self_join on public.group_members for insert to authenticated
with check (
  user_id = (select auth.uid())
  and role = 'member'
  and (
    (status = 'active'  and exists (
      select 1 from public.groups g
      where g.id = group_id and g.privacy = 'public' and g.archived_at is null))
    or
    (status = 'pending' and exists (
      select 1 from public.groups g
      where g.id = group_id and g.privacy = 'private' and g.archived_at is null))
  )
);
-- Admins manage roles/status; the owner row is untouchable here and nobody can be
-- set to 'owner' via a plain UPDATE (see transfer_ownership()).
create policy group_members_admin_update on public.group_members for update to authenticated
  using (public.is_group_admin(group_id, (select auth.uid())) and role <> 'owner')
  with check (public.is_group_admin(group_id, (select auth.uid())) and role <> 'owner');
-- Leave (not the owner), or an admin removing a member/moderator.
create policy group_members_delete on public.group_members for delete to authenticated using (
  (user_id = (select auth.uid()) and role <> 'owner')
  or (public.is_group_admin(group_id, (select auth.uid())) and role not in ('owner', 'admin'))
);

-- ---- group_invites --------------------------------------------------------
create policy group_invites_admin on public.group_invites for all to authenticated
  using (public.is_group_admin(group_id, (select auth.uid())))
  with check (public.is_group_admin(group_id, (select auth.uid())));

-- ---- group_messages -----------------------------------------------------------
create policy group_messages_read on public.group_messages for select to authenticated using (
  public.can_access_group_content(group_id, (select auth.uid()))
  and (deleted_at is null or public.is_group_moderator(group_id, (select auth.uid())))
);
create policy group_messages_insert on public.group_messages for insert to authenticated
  with check (author_id = (select auth.uid()) and public.can_post_in_group(group_id, (select auth.uid())));
create policy group_messages_update on public.group_messages for update to authenticated
  using (author_id = (select auth.uid()) or public.is_group_moderator(group_id, (select auth.uid())))
  with check (author_id = (select auth.uid()) or public.is_group_moderator(group_id, (select auth.uid())));
-- no delete policy: hard delete is impossible from the client; moderators soft-delete.

-- ---- group_reflections --------------------------------------------------------
create policy group_reflections_read on public.group_reflections for select to authenticated using (
  public.can_access_group_content(group_id, (select auth.uid()))
  and (deleted_at is null or public.is_group_moderator(group_id, (select auth.uid())))
);
create policy group_reflections_insert on public.group_reflections for insert to authenticated
  with check (author_id = (select auth.uid()) and public.can_post_in_group(group_id, (select auth.uid())));
create policy group_reflections_update on public.group_reflections for update to authenticated
  using (author_id = (select auth.uid()) or public.is_group_moderator(group_id, (select auth.uid())))
  with check (author_id = (select auth.uid()) or public.is_group_moderator(group_id, (select auth.uid())));

-- ---- group_reflection_comments ----------------------------------------------
create policy grc_read on public.group_reflection_comments for select to authenticated using (
  public.can_access_group_content(public.reflection_group(reflection_id), (select auth.uid()))
  and (deleted_at is null
       or public.is_group_moderator(public.reflection_group(reflection_id), (select auth.uid())))
);
create policy grc_insert on public.group_reflection_comments for insert to authenticated
  with check (author_id = (select auth.uid())
              and public.can_post_in_group(public.reflection_group(reflection_id), (select auth.uid())));
create policy grc_update on public.group_reflection_comments for update to authenticated
  using (author_id = (select auth.uid())
         or public.is_group_moderator(public.reflection_group(reflection_id), (select auth.uid())))
  with check (author_id = (select auth.uid())
              or public.is_group_moderator(public.reflection_group(reflection_id), (select auth.uid())));

-- ---- community_reactions ---------------------------------------------------
create policy reactions_read on public.community_reactions for select to authenticated using (
  public.can_access_group_content(public.entity_group(entity_type, entity_id), (select auth.uid()))
);
create policy reactions_insert on public.community_reactions for insert to authenticated with check (
  user_id = (select auth.uid())
  and public.can_post_in_group(public.entity_group(entity_type, entity_id), (select auth.uid()))
);
create policy reactions_delete on public.community_reactions for delete to authenticated
  using (user_id = (select auth.uid()));

-- ---- group_challenges ----------------------------------------------------------
create policy challenges_read on public.group_challenges for select to authenticated
  using (public.can_access_group_content(group_id, (select auth.uid())));
create policy challenges_insert on public.group_challenges for insert to authenticated
  with check (creator_id = (select auth.uid()) and public.is_group_moderator(group_id, (select auth.uid())));
create policy challenges_update on public.group_challenges for update to authenticated
  using (creator_id = (select auth.uid()) or public.is_group_admin(group_id, (select auth.uid())))
  with check (creator_id = (select auth.uid()) or public.is_group_admin(group_id, (select auth.uid())));

-- ---- challenge_participants ------------------------------------------------
-- Raw table: only self + group admins. Everyone else reads the *_public view.
create policy cp_read on public.challenge_participants for select to authenticated using (
  user_id = (select auth.uid())
  or public.is_group_admin(public.challenge_group(challenge_id), (select auth.uid()))
);
create policy cp_insert on public.challenge_participants for insert to authenticated with check (
  user_id = (select auth.uid())
  and public.can_access_group_content(public.challenge_group(challenge_id), (select auth.uid()))
);
create policy cp_update on public.challenge_participants for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy cp_delete on public.challenge_participants for delete to authenticated
  using (user_id = (select auth.uid()));

-- Privacy-preserving projection: presence + "completed today" for everyone in the
-- group; the running number only for the participant themselves or those who opted
-- to share it (spec §13). Runs as owner (security_invoker = false) so the WHERE
-- clause is the access gate.
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
       then cp.last_progress_on end                                         as last_progress_on
from public.challenge_participants cp
where public.can_access_group_content(public.challenge_group(cp.challenge_id), (select auth.uid()));

grant select on public.challenge_participants_public to authenticated;

-- ---- reports ------------------------------------------------------------------
create policy reports_insert on public.reports for insert to authenticated
  with check (reporter_id = (select auth.uid()));
create policy reports_read on public.reports for select to authenticated using (
  reporter_id = (select auth.uid())
  or (group_id is not null and public.is_group_admin(group_id, (select auth.uid())))
);
create policy reports_update on public.reports for update to authenticated
  using (group_id is not null and public.is_group_admin(group_id, (select auth.uid())))
  with check (group_id is not null and public.is_group_admin(group_id, (select auth.uid())));

-- ---- blocked_users -------------------------------------------------------------
create policy blocked_users_all on public.blocked_users for all to authenticated
  using (blocker_id = (select auth.uid())) with check (blocker_id = (select auth.uid()));

-- ---- community_notifications --------------------------------------------------
create policy notif_read on public.community_notifications for select to authenticated
  using (user_id = (select auth.uid()));
create policy notif_update on public.community_notifications for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy notif_delete on public.community_notifications for delete to authenticated
  using (user_id = (select auth.uid()));
-- inserts are made only by SECURITY DEFINER code (push_notification).

-- ============================================================================
-- RPCs (SECURITY DEFINER) — the privileged operations. All validate the caller.
-- ============================================================================

-- Limited public view of a group behind an invite code. No private content.
create or replace function public.preview_invite(invite_code text)
returns table (
  group_id uuid, name text, description text, avatar_url text,
  privacy text, group_gender text, member_count integer
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  inv public.group_invites;
begin
  select * into inv from public.group_invites where code = invite_code;
  if inv.id is null or inv.revoked_at is not null then
    raise exception 'invite_invalid' using errcode = 'P0002';
  end if;
  if inv.expires_at is not null and inv.expires_at < now() then
    raise exception 'invite_expired' using errcode = 'P0002';
  end if;

  return query
    select g.id, g.name, g.description, g.avatar_url, g.privacy, g.group_gender, g.member_count
    from public.groups g
    where g.id = inv.group_id and g.archived_at is null;
end;
$$;

-- Join a group via invite code. Bypasses approval; idempotent for existing members.
create or replace function public.redeem_invite(invite_code text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  inv public.group_invites;
  existing public.group_members;
begin
  if uid is null then raise exception 'not_authenticated'; end if;

  select * into inv from public.group_invites where code = invite_code;
  if inv.id is null or inv.revoked_at is not null then
    raise exception 'invite_invalid' using errcode = 'P0002';
  end if;
  if inv.expires_at is not null and inv.expires_at < now() then
    raise exception 'invite_expired' using errcode = 'P0002';
  end if;
  if inv.max_uses is not null and inv.use_count >= inv.max_uses then
    raise exception 'invite_exhausted' using errcode = 'P0002';
  end if;

  select * into existing from public.group_members
   where group_id = inv.group_id and user_id = uid;
  if existing.user_id is not null then
    if existing.status = 'banned' then raise exception 'banned'; end if;
    if existing.status = 'pending' then
      update public.group_members set status = 'active'
       where group_id = inv.group_id and user_id = uid;
    end if;
    return inv.group_id;
  end if;

  insert into public.group_members (group_id, user_id, role, status)
  values (inv.group_id, uid, 'member', 'active');

  update public.group_invites set use_count = use_count + 1 where id = inv.id;
  return inv.group_id;
end;
$$;

-- Request to join a private group (public groups are a plain self-join).
create or replace function public.request_join(p_group_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  g public.groups;
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  select * into g from public.groups where id = p_group_id and archived_at is null;
  if g.id is null then raise exception 'group_not_found' using errcode = 'P0002'; end if;
  if g.privacy <> 'private' then raise exception 'not_a_private_group'; end if;

  insert into public.group_members (group_id, user_id, role, status)
  values (p_group_id, uid, 'member', 'pending')
  on conflict (group_id, user_id) do nothing;
end;
$$;

create or replace function public.approve_join(p_group_id uuid, p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_group_admin(p_group_id, (select auth.uid())) then
    raise exception 'forbidden';
  end if;
  update public.group_members set status = 'active'
   where group_id = p_group_id and user_id = p_user_id and status = 'pending';
end;
$$;

create or replace function public.reject_join(p_group_id uuid, p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_group_admin(p_group_id, (select auth.uid())) then
    raise exception 'forbidden';
  end if;
  delete from public.group_members
   where group_id = p_group_id and user_id = p_user_id and status = 'pending';
end;
$$;

-- Role changes. Owner may set admin/moderator/member; admin may set moderator/member.
-- 'owner' is never assignable here (use transfer_ownership).
create or replace function public.set_member_role(p_group_id uuid, p_user_id uuid, p_role text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_role text := public.group_role(p_group_id, (select auth.uid()));
  target_role text := public.group_role(p_group_id, p_user_id);
begin
  if p_role not in ('admin', 'moderator', 'member') then raise exception 'bad_role'; end if;
  if target_role = 'owner' then raise exception 'cannot_change_owner'; end if;
  if caller_role = 'owner' then
    -- ok for any of admin/moderator/member
  elsif caller_role = 'admin' then
    if p_role = 'admin' or target_role = 'admin' then raise exception 'forbidden'; end if;
  else
    raise exception 'forbidden';
  end if;

  update public.group_members set role = p_role
   where group_id = p_group_id and user_id = p_user_id and status = 'active';
end;
$$;

create or replace function public.transfer_ownership(p_group_id uuid, p_new_owner uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
begin
  if public.group_role(p_group_id, uid) <> 'owner' then raise exception 'forbidden'; end if;
  if not public.is_group_member(p_group_id, p_new_owner) then raise exception 'new_owner_not_member'; end if;

  update public.group_members set role = 'admin'
   where group_id = p_group_id and user_id = uid;
  update public.group_members set role = 'owner'
   where group_id = p_group_id and user_id = p_new_owner;
  update public.groups set owner_id = p_new_owner where id = p_group_id;
end;
$$;

-- Moderation: caller must outrank the target.
create or replace function public._require_outranks(p_group_id uuid, p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  rank_of text[] := array['member', 'moderator', 'admin', 'owner'];
  caller_role text := public.group_role(p_group_id, (select auth.uid()));
  target_role text := public.group_role(p_group_id, p_user_id);
begin
  if caller_role is null or not public.is_group_moderator(p_group_id, (select auth.uid())) then
    raise exception 'forbidden';
  end if;
  if array_position(rank_of, coalesce(target_role, 'member'))
     >= array_position(rank_of, caller_role) then
    raise exception 'cannot_moderate_peer_or_senior';
  end if;
end;
$$;

create or replace function public.kick_member(p_group_id uuid, p_user_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform public._require_outranks(p_group_id, p_user_id);
  delete from public.group_members where group_id = p_group_id and user_id = p_user_id;
end; $$;

create or replace function public.ban_member(p_group_id uuid, p_user_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform public._require_outranks(p_group_id, p_user_id);
  update public.group_members set status = 'banned', role = 'member'
   where group_id = p_group_id and user_id = p_user_id;
  if not found then
    insert into public.group_members (group_id, user_id, role, status)
    values (p_group_id, p_user_id, 'member', 'banned');
  end if;
end; $$;

create or replace function public.mute_member(p_group_id uuid, p_user_id uuid, p_until timestamptz)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform public._require_outranks(p_group_id, p_user_id);
  update public.group_members set muted_until = p_until
   where group_id = p_group_id and user_id = p_user_id;
end; $$;

create or replace function public.generate_invite(p_group_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_code text := substr(replace(encode(gen_random_bytes(8), 'base64'), '/', '_'), 1, 10);
begin
  if not public.is_group_admin(p_group_id, (select auth.uid())) then raise exception 'forbidden'; end if;
  new_code := regexp_replace(new_code, '[^a-zA-Z0-9_-]', '', 'g');
  insert into public.group_invites (group_id, code, created_by)
  values (p_group_id, new_code, (select auth.uid()));
  return new_code;
end;
$$;

create or replace function public.revoke_invite(p_invite_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  gid uuid;
begin
  select group_id into gid from public.group_invites where id = p_invite_id;
  if gid is null then raise exception 'not_found' using errcode = 'P0002'; end if;
  if not public.is_group_admin(gid, (select auth.uid())) then raise exception 'forbidden'; end if;
  update public.group_invites set revoked_at = now() where id = p_invite_id;
end;
$$;

-- Log progress in a challenge (own row only; numbers stay private unless shared).
create or replace function public.log_challenge_progress(p_challenge_id uuid, p_amount integer default 1)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  if p_amount is null or p_amount < 1 then raise exception 'bad_amount'; end if;
  if not public.can_access_group_content(public.challenge_group(p_challenge_id), uid) then
    raise exception 'forbidden';
  end if;

  insert into public.challenge_participants (challenge_id, user_id, progress_count, last_progress_on)
  values (p_challenge_id, uid, p_amount, current_date)
  on conflict (challenge_id, user_id) do update
    set progress_count   = public.challenge_participants.progress_count + p_amount,
        last_progress_on = current_date;
end;
$$;

grant execute on function
  public.preview_invite(text),
  public.redeem_invite(text),
  public.request_join(uuid),
  public.approve_join(uuid, uuid),
  public.reject_join(uuid, uuid),
  public.set_member_role(uuid, uuid, text),
  public.transfer_ownership(uuid, uuid),
  public.kick_member(uuid, uuid),
  public.ban_member(uuid, uuid),
  public.mute_member(uuid, uuid, timestamptz),
  public.generate_invite(uuid),
  public.revoke_invite(uuid),
  public.log_challenge_progress(uuid, integer)
to authenticated;

-- Internal helpers must not be callable directly by clients.
revoke execute on function public.push_notification(uuid, text, text, text, text, uuid) from public, anon, authenticated;
revoke execute on function public._require_outranks(uuid, uuid) from public, anon, authenticated;
