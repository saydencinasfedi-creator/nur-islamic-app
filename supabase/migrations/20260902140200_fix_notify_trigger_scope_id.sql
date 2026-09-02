-- Fix a real bug that broke every message send (group AND dm) as soon as the
-- previous migration's triggers went live: `case when ... then new.group_id else
-- new.thread_id end` fails at parse time whenever NEW's concrete row type is
-- missing either column — Postgres has to type-check *every* branch of a CASE
-- against NEW's actual row type before it can short-circuit on the value, it
-- doesn't defer column resolution the way a plain if/else would. A dm_messages
-- insert has no group_id column, a group_messages insert has no thread_id column,
-- so either trigger firing raised "record new has no field ..." and rolled back
-- the whole insert — confirmed via a real insert through the app, not a guess.
--
-- Fix: go through to_jsonb(new), which works for either row shape and returns
-- null for a key that isn't there instead of erroring.
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
  v_scope_id := (to_jsonb(new) ->> (case when TG_ARGV[0] = 'group' then 'group_id' else 'thread_id' end))::uuid;

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
exception when others then
  -- Never let a notification failure roll back the message itself — this is a
  -- best-effort side effect, not part of what "sending a message" means.
  raise warning '[tg_notify_new_message] failed: %', sqlerrm;
  return new;
end;
$$;
