-- Świąteczne Losowanie — początkowa struktura bazy

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null,
  is_organizer boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.wishes (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  text text not null check (char_length(text) between 1 and 500),
  link text check (link is null or char_length(link) <= 2048),
  price numeric(10, 2) check (price is null or price >= 0),
  created_at timestamptz not null default now()
);

create table if not exists public.themes (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  theme text not null check (char_length(theme) between 1 and 300),
  updated_at timestamptz not null default now()
);

create table if not exists public.assignments (
  id bigint generated always as identity primary key,
  lottery_type smallint not null check (lottery_type in (1, 2)),
  drawer_id uuid not null references public.profiles (id) on delete cascade,
  drawee_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (lottery_type, drawer_id),
  unique (lottery_type, drawee_id)
);

create index if not exists wishes_user_id_idx on public.wishes (user_id);
create index if not exists assignments_drawer_idx on public.assignments (drawer_id);
create index if not exists assignments_drawee_idx on public.assignments (drawee_id);

-- Profil tworzy się automatycznie przy rejestracji; pierwszy użytkownik zostaje organizatorem
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, is_organizer)
  values (
    new.id,
    coalesce(
      nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
      nullif(trim(new.raw_user_meta_data ->> 'name'), ''),
      split_part(coalesce(new.email, ''), '@', 1)
    ),
    not exists (select 1 from public.profiles)
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.wishes enable row level security;
alter table public.themes enable row level security;
alter table public.assignments enable row level security;

-- profiles
create policy "profiles_select_all" on public.profiles
  for select to authenticated using (true);

create policy "profiles_update_own" on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (
    id = auth.uid()
    and is_organizer = (select p.is_organizer from public.profiles p where p.id = auth.uid())
  );

create policy "profiles_delete_by_organizer" on public.profiles
  for delete to authenticated
  using (
    id <> auth.uid()
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.is_organizer)
  );

-- wishes: widać własne oraz życzenia osoby wylosowanej w losowaniu 1
create policy "wishes_select_own_or_drawn" on public.wishes
  for select to authenticated
  using (
    user_id = auth.uid()
    or exists (
      select 1 from public.assignments a
      where a.lottery_type = 1
        and a.drawer_id = auth.uid()
        and a.drawee_id = wishes.user_id
    )
  );

create policy "wishes_insert_own" on public.wishes
  for insert to authenticated with check (user_id = auth.uid());

create policy "wishes_update_own" on public.wishes
  for update to authenticated using (user_id = auth.uid());

-- usuwanie tylko przed losowaniem
create policy "wishes_delete_own_before_lottery" on public.wishes
  for delete to authenticated
  using (user_id = auth.uid() and not exists (select 1 from public.assignments));

-- themes: widać własny oraz temat osoby wylosowanej w losowaniu 2
create policy "themes_select_own_or_drawn" on public.themes
  for select to authenticated
  using (
    user_id = auth.uid()
    or exists (
      select 1 from public.assignments a
      where a.lottery_type = 2
        and a.drawer_id = auth.uid()
        and a.drawee_id = themes.user_id
    )
  );

create policy "themes_insert_own" on public.themes
  for insert to authenticated with check (user_id = auth.uid());

-- temat zablokowany po losowaniu
create policy "themes_update_own_before_lottery" on public.themes
  for update to authenticated
  using (user_id = auth.uid() and not exists (select 1 from public.assignments));

-- assignments: każdy widzi tylko własne losy; zapis wyłącznie przez run_lottery()
create policy "assignments_select_own" on public.assignments
  for select to authenticated using (drawer_id = auth.uid());

-- Losowanie: dwa derangementi; w drugim nikt nie losuje osoby z pierwszego
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
  insert into public.assignments (lottery_type, drawer_id, drawee_id)
  select 1, user_ids[x], user_ids[sigma[x]] from generate_series(1, n) as g(x)
  union all
  select 2, user_ids[x], user_ids[tau[x]] from generate_series(1, n) as g(x);
end;
$$;

revoke execute on function public.run_lottery() from public;
grant execute on function public.run_lottery() to authenticated;

-- Anulowanie losowania: kasuje wyniki, odblokowuje życzenia i tematy
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
end;
$$;

revoke execute on function public.cancel_lottery() from public;
grant execute on function public.cancel_lottery() to authenticated;
