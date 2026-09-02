-- ============================================================================
-- Real push notifications (FCM) for circle chat + DMs, with a per-conversation
-- mute — the "later phase" services/communityNotifications.ts already flagged.
-- ============================================================================

create table public.push_tokens (
  user_id    uuid not null references public.profiles (id) on delete cascade,
  token      text not null,
  platform   text not null default 'android',
  created_at timestamptz not null default now(),
  primary key (user_id, token)
);

create index push_tokens_user_idx on public.push_tokens (user_id);

alter table public.push_tokens enable row level security;

-- Owner-only. No read policy for the client — the Edge Function reads via
-- service_role, which bypasses RLS entirely, so nothing client-side ever needs
-- to see another user's tokens (or even its own list back).
create policy push_tokens_rw on public.push_tokens for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- --------------------------------------------------------------------------

-- Per-user, per-conversation notification mute. No row for a (user, scope) pair
-- means "not muted" (the default) — nothing needs to pre-populate one row per
-- circle per member, only the exceptions (someone who muted it) exist here.
create table public.notification_prefs (
  user_id    uuid not null references public.profiles (id) on delete cascade,
  scope_type text not null check (scope_type in ('group', 'dm')),
  scope_id   uuid not null, -- a groups.id or a dm_threads.id, depending on scope_type
  muted      boolean not null default true,
  updated_at timestamptz not null default now(),
  primary key (user_id, scope_type, scope_id)
);

alter table public.notification_prefs enable row level security;

-- Same shape as dm_thread_reads_rw (services/dmService.ts's read-marker table) —
-- owner-only read/write, one row per (user, scope).
create policy notification_prefs_rw on public.notification_prefs for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- --------------------------------------------------------------------------
-- Fire the push Edge Function on every new message, fire-and-forget (pg_net is
-- async — this does not block or slow down the insert). The shared secret is
-- read from Vault by name, never embedded in this file: see the separate,
-- git-ignored one-off that creates it via vault.create_secret.
-- --------------------------------------------------------------------------

create extension if not exists pg_net;
create extension if not exists supabase_vault;

create or replace function public.tg_notify_new_message()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_scope_id uuid;
  v_secret text;
  v_function_url text := 'https://vebyffcaanihqqbjvjja.supabase.co/functions/v1/push-on-new-message';
begin
  v_scope_id := case when TG_ARGV[0] = 'group' then new.group_id else new.thread_id end;

  select decrypted_secret into v_secret
  from vault.decrypted_secrets where name = 'push_shared_secret';

  if v_secret is not null then
    perform net.http_post(
      url := v_function_url,
      headers := jsonb_build_object('Content-Type', 'application/json', 'Authorization', 'Bearer ' || v_secret),
      body := jsonb_build_object(
        'type', TG_ARGV[0],
        'id', new.id,
        'scopeId', v_scope_id,
        'authorId', new.author_id,
        'body', new.body
      )
    );
  end if;

  return new;
end;
$$;

create trigger group_messages_notify after insert on public.group_messages
  for each row execute function public.tg_notify_new_message('group');

create trigger dm_messages_notify after insert on public.dm_messages
  for each row execute function public.tg_notify_new_message('dm');
