-- ============================================================================
-- Nur — Community: guest gate
--
-- Anonymous (guest) sessions may browse but not participate. Every write path
-- into a group now also requires public.is_full_member(). Guests link an email
-- (linkEmailToGuest) to become full members.
--
-- Salawat taps (add_salawat) and dua-request reads stay open to guests on
-- purpose — the Salawat counter carries no identity.
-- ============================================================================

-- ---- group_members: self-join / request ---------------------------------
drop policy if exists group_members_self_join on public.group_members;
create policy group_members_self_join on public.group_members for insert to authenticated
with check (
  user_id = (select auth.uid())
  and public.is_full_member()
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

-- ---- group_messages / group_reflections / comments / reactions ---------
drop policy if exists group_messages_insert on public.group_messages;
create policy group_messages_insert on public.group_messages for insert to authenticated
  with check (
    author_id = (select auth.uid())
    and public.is_full_member()
    and public.can_post_in_group(group_id, (select auth.uid()))
  );

drop policy if exists group_reflections_insert on public.group_reflections;
create policy group_reflections_insert on public.group_reflections for insert to authenticated
  with check (
    author_id = (select auth.uid())
    and public.is_full_member()
    and public.can_post_in_group(group_id, (select auth.uid()))
  );

drop policy if exists grc_insert on public.group_reflection_comments;
create policy grc_insert on public.group_reflection_comments for insert to authenticated
  with check (
    author_id = (select auth.uid())
    and public.is_full_member()
    and public.can_post_in_group(public.reflection_group(reflection_id), (select auth.uid()))
  );

drop policy if exists reactions_insert on public.community_reactions;
create policy reactions_insert on public.community_reactions for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and public.is_full_member()
    and public.can_post_in_group(public.entity_group(entity_type, entity_id), (select auth.uid()))
  );

-- ---- RPCs: request_join / redeem_invite --------------------------------
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
  if not public.is_full_member() then raise exception 'guest_forbidden'; end if;
  select * into g from public.groups where id = p_group_id and archived_at is null;
  if g.id is null then raise exception 'group_not_found' using errcode = 'P0002'; end if;
  if g.privacy <> 'private' then raise exception 'not_a_private_group'; end if;

  insert into public.group_members (group_id, user_id, role, status)
  values (p_group_id, uid, 'member', 'pending')
  on conflict (group_id, user_id) do nothing;
end;
$$;

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
  if not public.is_full_member() then raise exception 'guest_forbidden'; end if;

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
