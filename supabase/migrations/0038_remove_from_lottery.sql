-- v11.20: usunięcie osoby po losowaniu bez psucia losowania
-- Osoba w losowaniu: jej drawee-e przechodzą do osób, które ją wylosowały
-- (z zachowaniem typu: lista→lista, temat→temat), wiersze osoby jako
-- kupującego są usuwane, profil zostaje (osoba staje się late joinerem).
-- Akceptowane skutki: samowylusowanie i dublet (ta sama osoba kupuje dwa
-- prezenty dla tej samej osoby).
-- Osoba spoza losowania: twardy delete profilu (poprzednie zachowanie).

create or replace function public.removal_plan(p_id uuid)
returns table (
  lottery_type smallint,
  drawee_id uuid,
  drawee_name text,
  new_drawer_id uuid,
  new_drawer_name text
)
language plpgsql
security definer
set search_path = public
stable
as $$
begin
  if not exists (
    select 1 from public.profiles where id = auth.uid() and is_organizer
  ) then
    raise exception 'Tylko organizator może usuwać uczestników.';
  end if;
  return query
    select x.lottery_type, x.drawee_id, px.full_name, a.drawer_id, pd.full_name
    from public.assignments x
    join public.assignments a
      on a.lottery_type = x.lottery_type and a.drawee_id = p_id
    join public.profiles px on px.id = x.drawee_id
    join public.profiles pd on pd.id = a.drawer_id
    where x.drawer_id = p_id
    order by x.lottery_type;
end;
$$;

revoke execute on function public.removal_plan(uuid) from public;
grant execute on function public.removal_plan(uuid) to authenticated;

create or replace function public.remove_participant(p_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.profiles where id = auth.uid() and is_organizer
  ) then
    raise exception 'Tylko organizator może usuwać uczestników.';
  end if;
  if p_id = auth.uid() then
    raise exception 'Nie możesz usunąć samego siebie.';
  end if;
  if not exists (select 1 from public.profiles where id = p_id) then
    raise exception 'Nie znaleziono osoby.';
  end if;

  if exists (
    select 1 from public.assignments where drawer_id = p_id or drawee_id = p_id
  ) then
    if (select count(*) from public.assignments where drawer_id = p_id) <> 2
       or (select count(*) from public.assignments where drawee_id = p_id) <> 2 then
      raise exception 'Nieprawidłowy stan losowania dla tej osoby.';
    end if;

    update public.assignments a
    set drawee_id = x.drawee_id
    from public.assignments x
    where x.drawer_id = p_id
      and a.lottery_type = x.lottery_type
      and a.drawee_id = p_id;

    delete from public.assignments where drawer_id = p_id;
  else
    delete from public.profiles where id = p_id;
  end if;
end;
$$;

revoke execute on function public.remove_participant(uuid) from public;
grant execute on function public.remove_participant(uuid) to authenticated;
