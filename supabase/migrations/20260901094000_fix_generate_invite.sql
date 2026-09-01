-- generate_invite() called gen_random_bytes() (pgcrypto). The function pins an
-- empty search_path and pgcrypto lives in the `extensions` schema on Supabase,
-- so the unqualified call failed with "function gen_random_bytes(integer) does
-- not exist" and no invite code was ever created.
--
-- Rebuild it on core functions only: md5(gen_random_uuid()) is available with an
-- empty search_path (both are in pg_catalog). Retry a few times on the (tiny)
-- chance of a unique-code collision.

create or replace function public.generate_invite(p_group_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_code text;
  attempt  integer := 0;
begin
  if not public.is_group_admin(p_group_id, (select auth.uid())) then
    raise exception 'forbidden';
  end if;

  loop
    attempt := attempt + 1;
    -- 8 lowercase hex chars, e.g. "a3f90c21"
    new_code := substr(md5(gen_random_uuid()::text || clock_timestamp()::text), 1, 8);
    begin
      insert into public.group_invites (group_id, code, created_by)
      values (p_group_id, new_code, (select auth.uid()));
      return new_code;
    exception when unique_violation then
      if attempt >= 5 then raise; end if;
    end;
  end loop;
end;
$$;
