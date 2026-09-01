-- Prefer a display name passed at sign-up (options.data.display_name / full_name)
-- over the email local-part, so email+password signups arrive with their real name.

create or replace function public.tg_handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, is_anonymous)
  values (
    new.id,
    coalesce(
      nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''),
      nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
      nullif(split_part(new.email, '@', 1), ''),
      'Guest'
    ),
    coalesce((new.raw_app_meta_data ->> 'provider') = 'anonymous', false)
  )
  on conflict (id) do nothing;
  return new;
end;
$$;
