-- v9: edycja życzeń do losowania, czat wspólny przed losowaniem, historia czatu przetrwa losowanie

-- wishes: edycja własnych pozycji do losowania (niezależnie od gotowości)
drop policy if exists "wishes_update_own" on public.wishes;
create policy "wishes_update_own" on public.wishes
  for update to authenticated
  using (
    user_id = auth.uid()
    and not exists (select 1 from public.assignments)
  );

-- wishes: usuwanie własnych pozycji do losowania (niezależnie od gotowości)
drop policy if exists "wishes_delete_own_before_lottery" on public.wishes;
create policy "wishes_delete_own_before_lottery" on public.wishes
  for delete to authenticated
  using (
    user_id = auth.uid()
    and not exists (select 1 from public.assignments)
  );

-- group_messages: otwarty dla wszystkich zalogowanych (także przed losowaniem)
drop policy if exists "group_messages_select_participants" on public.group_messages;
create policy "group_messages_select_all" on public.group_messages
  for select to authenticated using (true);

drop policy if exists "group_messages_insert_participant" on public.group_messages;
create policy "group_messages_insert_own" on public.group_messages
  for insert to authenticated
  with check (sender_id = auth.uid());

-- Losowanie: czat wspólny przetrwa (bez delete group_messages)
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
  insert into public.assignments (lottery_type, drawer_id, drawee_id)
  select 1, user_ids[x], user_ids[sigma[x]] from generate_series(1, n) as g(x)
  union all
  select 2, user_ids[x], user_ids[tau[x]] from generate_series(1, n) as g(x);
end;
$$;

revoke execute on function public.run_lottery() from public;
grant execute on function public.run_lottery() to authenticated;

-- Anulowanie losowania: czat wspólny przetrwa (bez delete group_messages)
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
  delete from public.thread_reads where true;
  update public.profiles set is_ready = false where is_ready = true;
end;
$$;

revoke execute on function public.cancel_lottery() from public;
grant execute on function public.cancel_lottery() to authenticated;
