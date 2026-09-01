-- ============================================================================
-- Nur — Community: global Salawat counter
--
-- One shared, ever-growing number plus a "today" bucket that rolls over at
-- local-server midnight. Written only through add_salawat() (SECURITY DEFINER);
-- streamed over Realtime so every open client sees taps live.
-- ============================================================================

create table public.global_salawat (
  id          boolean primary key default true check (id),   -- single-row table
  total_count bigint      not null default 0,
  today_count bigint      not null default 0,
  today_date  date        not null default current_date,
  updated_at  timestamptz not null default now()
);

insert into public.global_salawat (id) values (true)
  on conflict (id) do nothing;

alter table public.global_salawat enable row level security;

create policy salawat_read on public.global_salawat
  for select to authenticated using (true);
-- no insert/update/delete policy: the RPC below is the only writer.

create or replace function public.add_salawat(p_amount integer default 1)
returns public.global_salawat
language plpgsql
security definer
set search_path = ''
as $$
declare
  result public.global_salawat;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  if p_amount is null or p_amount < 1 then p_amount := 1; end if;
  if p_amount > 50 then p_amount := 50; end if;   -- clamp

  update public.global_salawat set
    total_count = total_count + p_amount,
    today_count = case when today_date = current_date
                       then today_count + p_amount
                       else p_amount end,
    today_date  = current_date,
    updated_at  = now()
  where id
  returning * into result;

  return result;
end;
$$;

revoke all on function public.add_salawat(integer) from public, anon;
grant execute on function public.add_salawat(integer) to authenticated;

alter publication supabase_realtime add table public.global_salawat;
