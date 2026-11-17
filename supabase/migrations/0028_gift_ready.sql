-- v9.117: status "prezent gotowy" — niezależny od is_ready (gotowość do losowania)

alter table public.profiles
  add column if not exists gift_ready boolean not null default false;

-- gift_ready można zmieniać w dowolnym momencie (jak awatar);
-- reszta kolumn pozostaje zablokowana
drop policy if exists "profiles_update_own_gift_ready" on public.profiles;
create policy "profiles_update_own_gift_ready" on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (
    id = auth.uid()
    and full_name = (select p.full_name from public.profiles p where p.id = auth.uid())
    and is_ready = (select p.is_ready from public.profiles p where p.id = auth.uid())
    and is_organizer = (select p.is_organizer from public.profiles p where p.id = auth.uid())
  );

-- participant_status() z gift_ready — create or replace nie zmienia typu
-- zwracanego, więc najpierw DROP FUNCTION
drop function if exists public.participant_status();

create function public.participant_status()
returns table (
  profile_id uuid,
  full_name text,
  is_ready boolean,
  in_lottery boolean,
  has_theme boolean,
  wish_count integer,
  gift_ready boolean
)
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  lottery_active boolean;
begin
  if not exists (
    select 1 from public.profiles where id = auth.uid() and is_organizer
  ) then
    raise exception 'Tylko organizator może przeglądać status uczestników.';
  end if;

  select exists (select 1 from public.assignments) into lottery_active;

  return query
    select
      p.id,
      p.full_name,
      p.is_ready,
      case when lottery_active then
        exists (
          select 1 from public.assignments a
          where a.drawer_id = p.id or a.drawee_id = p.id
        )
      else true end,
      exists (select 1 from public.themes t where t.user_id = p.id),
      (select count(*) from public.wishes w where w.user_id = p.id),
      p.gift_ready
    from public.profiles p
    order by p.full_name;
end;
$$;

revoke execute on function public.participant_status() from public;
grant execute on function public.participant_status() to authenticated;

-- Nowe losowanie i anulowanie resetują status prezentu
create or replace function public.run_lottery()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  user_ids uuid[];
  n integer;
  sigma integer[];
  tau integer[];
  attempts integer;
begin
  if not exists (
    select 1 from public.profiles where id = auth.uid() and is_organizer
  ) then
    raise exception 'Tylko organizator może uruchomić losowanie.';
  end if;

  select array_agg(id) into user_ids from public.profiles order by random();
  n := coalesce(array_length(user_ids, 1), 0);
  if n < 3 then
    raise exception 'Do losowania potrzebne są co najmniej 3 osoby (obecnie: %).', n;
  end if;

  if exists (select 1 from public.profiles where not is_ready) then
    raise exception 'Losowanie może wystartować, gdy wszyscy uczestnicy są gotowi.';
  end if;

  attempts := 0;
  loop
    select array_agg(x) into sigma
    from (
      select x, random() as r
      from generate_series(1, n) as g(x)
      order by r
    ) t;
    exit when not exists (
      select 1 from generate_series(1, n) as g(x) where sigma[x] = x
    );
    attempts := attempts + 1;
    if attempts > 10000 then
      raise exception 'Nie udało się wylosować pierwszej listy — spróbuj ponownie.';
    end if;
  end loop;

  attempts := 0;
  loop
    select array_agg(x) into tau
    from (
      select x, random() as r
      from generate_series(1, n) as g(x)
      order by r
    ) t;
    exit when not exists (
      select 1 from generate_series(1, n) as g(x)
      where tau[x] = x or tau[x] = sigma[x]
    );
    attempts := attempts + 1;
    if attempts > 10000 then
      raise exception 'Nie udało się wylosować drugiej listy — spróbuj ponownie.';
    end if;
  end loop;

  delete from public.assignments where true;
  delete from public.messages where true;
  delete from public.thread_reads where true;
  update public.profiles set gift_ready = false where gift_ready = true;
  insert into public.assignments (lottery_type, drawer_id, drawee_id)
  select 1, user_ids[x], user_ids[sigma[x]] from generate_series(1, n) as g(x)
  union all
  select 2, user_ids[x], user_ids[tau[x]] from generate_series(1, n) as g(x);
end;
$$;

revoke execute on function public.run_lottery() from public;
grant execute on function public.run_lottery() to authenticated;

create or replace function public.cancel_lottery()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.profiles where id = auth.uid() and is_organizer
  ) then
    raise exception 'Tylko organizator może anulować losowanie.';
  end if;

  delete from public.assignments where true;
  delete from public.messages where true;
  delete from public.group_messages where true;
  delete from public.thread_reads where true;
  update public.profiles set is_ready = false, gift_ready = false
  where is_ready = true or gift_ready = true;
end;
$$;

revoke execute on function public.cancel_lottery() from public;
grant execute on function public.cancel_lottery() to authenticated;
