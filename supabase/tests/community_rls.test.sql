-- Run with:  supabase test db
-- pgTAP assertions for the most security-critical Community RLS rules.
-- These run inside a transaction that is rolled back, as the superuser test role,
-- switching to `authenticated` + a fake JWT to impersonate each user.

begin;
select plan(8);

-- ---- fixtures (as superuser) ------------------------------------------------
insert into auth.users (id, email, raw_app_meta_data)
values
  ('00000000-0000-0000-0000-00000000000a', 'owner@test.dev',  '{"provider":"email"}'),
  ('00000000-0000-0000-0000-00000000000b', 'member@test.dev', '{"provider":"email"}'),
  ('00000000-0000-0000-0000-00000000000c', 'outsider@test.dev','{"provider":"email"}');
-- profiles are created by the on_auth_user_created trigger.
update public.profiles set display_name = 'Owner'    where id = '00000000-0000-0000-0000-00000000000a';
update public.profiles set display_name = 'Member'   where id = '00000000-0000-0000-0000-00000000000b';
update public.profiles set display_name = 'Outsider' where id = '00000000-0000-0000-0000-00000000000c';

insert into public.groups (id, slug, name, category, privacy, owner_id)
values ('10000000-0000-0000-0000-000000000001', 'private-circle', 'Private Circle', 'general', 'private',
        '00000000-0000-0000-0000-00000000000a');
-- owner membership row is added by the groups_owner_membership trigger.
insert into public.group_members (group_id, user_id, role, status)
values ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000b', 'member', 'active');

insert into public.group_messages (id, group_id, author_id, body)
values ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001',
        '00000000-0000-0000-0000-00000000000b', 'salaam');

insert into public.groups (id, slug, name, category, privacy, owner_id)
values ('10000000-0000-0000-0000-000000000002', 'secret-room', 'Secret Room', 'general', 'invite_only',
        '00000000-0000-0000-0000-00000000000a');

-- =====================================================================
-- As the OUTSIDER (not a member of anything)
-- =====================================================================
set local role authenticated;
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-00000000000c","role":"authenticated"}';

select is(
  (select count(*)::int from public.group_messages where group_id = '10000000-0000-0000-0000-000000000001'),
  0, 'outsider cannot read a private group''s messages');

select is(
  (select count(*)::int from public.groups where id = '10000000-0000-0000-0000-000000000002'),
  0, 'invite_only group is not discoverable by a non-member');

select is(
  (select count(*)::int from public.groups where id = '10000000-0000-0000-0000-000000000001'),
  1, 'private group IS discoverable (listed) by a non-member');

select throws_ok(
  $$ update public.group_messages set body = 'hacked'
     where id = '20000000-0000-0000-0000-000000000001' $$,
  NULL, 'outsider cannot edit someone else''s message');

select is(
  (select count(*)::int from public.group_invites where group_id = '10000000-0000-0000-0000-000000000001'),
  0, 'outsider cannot enumerate a group''s invites');

-- =====================================================================
-- As the MEMBER
-- =====================================================================
set local request.jwt.claims to '{"sub":"00000000-0000-0000-0000-00000000000b","role":"authenticated"}';

select is(
  (select count(*)::int from public.group_messages where group_id = '10000000-0000-0000-0000-000000000001'),
  1, 'active member can read the private group''s messages');

select is(
  (select count(*)::int from public.group_invites where group_id = '10000000-0000-0000-0000-000000000001'),
  0, 'a plain member still cannot see invites (admin only)');

select lives_ok(
  $$ insert into public.group_messages (group_id, author_id, body)
     values ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-00000000000b', 'another') $$,
  'active member can post a message');

select * from finish();
rollback;
