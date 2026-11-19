-- v11.0: panel dziecka — dzieci, rodzice (maks. 2), życzenia, rezerwacje prezentów
-- Dziecko nie bierze udziału w losowaniu; to osobna encja.

create table public.children (
  id bigint generated always as identity primary key,
  name text not null check (char_length(name) between 1 and 100),
  avatar_path text,
  avatar_updated_at timestamptz,
  created_by uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.child_parents (
  child_id bigint not null references public.children (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  is_creator boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (child_id, user_id)
);

create index if not exists child_parents_user_idx on public.child_parents (user_id);

create table public.child_wishes (
  id bigint generated always as identity primary key,
  child_id bigint not null references public.children (id) on delete cascade,
  text text not null check (char_length(text) between 1 and 500),
  link text check (link is null or char_length(link) <= 2048),
  price numeric(10, 2) check (price is null or price >= 0),
  pos int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists child_wishes_child_idx on public.child_wishes (child_id, pos);

-- jeden wiersz na prezent: unikalność child_wish_id = maks. jedna rezerwacja
create table public.child_wish_reservations (
  child_wish_id bigint primary key references public.child_wishes (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  state text not null default 'reserved' check (state in ('reserved', 'purchased')),
  reserved_at timestamptz not null default now(),
  purchased_at timestamptz
);

create index if not exists child_wish_reservations_user_idx
  on public.child_wish_reservations (user_id);

-- dziecko może mieć maksymalnie dwóch rodziców
create or replace function public.child_parents_max_two()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (select count(*) from public.child_parents where child_id = new.child_id) >= 2 then
    raise exception 'Dziecko może mieć maksymalnie dwóch rodziców.';
  end if;
  return new;
end;
$$;

drop trigger if exists child_parents_max_two on public.child_parents;
create trigger child_parents_max_two
  before insert on public.child_parents
  for each row execute function public.child_parents_max_two();

-- twórcy nie da się odłączyć (kaskada przy usunięciu konta jest dopuszczalna)
create or replace function public.protect_child_creator()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.is_creator
     and exists (select 1 from public.profiles where id = old.user_id) then
    raise exception 'Twórca dziecka nie może zostać odłączony.';
  end if;
  return old;
end;
$$;

drop trigger if exists protect_child_creator on public.child_parents;
create trigger protect_child_creator
  before delete on public.child_parents
  for each row execute function public.protect_child_creator();

-- odłączenie rodzica anuluje jego rezerwacje na tym dziecku
create or replace function public.cancel_reservations_on_parent_detach()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.child_wish_reservations
  where user_id = old.user_id
    and child_wish_id in (
      select id from public.child_wishes where child_id = old.child_id
    );
  return old;
end;
$$;

drop trigger if exists cancel_reservations_on_parent_detach on public.child_parents;
create trigger cancel_reservations_on_parent_detach
  after delete on public.child_parents
  for each row execute function public.cancel_reservations_on_parent_detach();

-- dziecko + rodzic-twórca w jednej transakcji
create or replace function public.create_child(p_name text)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  child_id bigint;
begin
  if char_length(p_name) not between 1 and 100 then
    raise exception 'Imię dziecka: 1–100 znaków.';
  end if;
  insert into public.children (name, created_by)
  values (p_name, auth.uid())
  returning id into child_id;
  insert into public.child_parents (child_id, user_id, is_creator)
  values (child_id, auth.uid(), true);
  return child_id;
end;
$$;

revoke execute on function public.create_child(text) from public;
grant execute on function public.create_child(text) to authenticated;

-- zmiana kolejności życzeń dziecka w jednym wywołaniu (wzór: reorder_wishes)
create or replace function public.reorder_child_wishes(p_ids bigint[])
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if array_length(p_ids, 1) is null then
    return;
  end if;

  if (select count(*) from public.child_wishes where id = any(p_ids))
       <> array_length(p_ids, 1) then
    raise exception 'Nieprawidłowa kolejność życzeń.';
  end if;

  if exists (
    select 1 from public.child_wishes w
    where w.id = any(p_ids)
      and not exists (
        select 1 from public.child_parents cp
        where cp.child_id = w.child_id and cp.user_id = auth.uid()
      )
  ) then
    raise exception 'Nieprawidłowa kolejność życzeń.';
  end if;

  update public.child_wishes w
  set pos = idx
  from generate_subscripts(p_ids, 1) as idx
  where w.id = p_ids[idx];
end;
$$;

revoke execute on function public.reorder_child_wishes(bigint[]) from public;
grant execute on function public.reorder_child_wishes(bigint[]) to authenticated;

alter table public.children enable row level security;
alter table public.child_parents enable row level security;
alter table public.child_wishes enable row level security;
alter table public.child_wish_reservations enable row level security;

-- children: wszyscy widzą; dodaje każdy (staje się twórcą);
-- edycja i usuwanie tylko rodziców; usuwanie tylko bez rezerwacji
drop policy if exists "children_select_all" on public.children;
create policy "children_select_all" on public.children
  for select to authenticated using (true);

drop policy if exists "children_insert_own" on public.children;
create policy "children_insert_own" on public.children
  for insert to authenticated with check (created_by = auth.uid());

drop policy if exists "children_update_parent" on public.children;
create policy "children_update_parent" on public.children
  for update to authenticated
  using (
    exists (
      select 1 from public.child_parents cp
      where cp.child_id = children.id and cp.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.child_parents cp
      where cp.child_id = children.id and cp.user_id = auth.uid()
    )
  );

drop policy if exists "children_delete_parent_no_reservations" on public.children;
create policy "children_delete_parent_no_reservations" on public.children
  for delete to authenticated
  using (
    exists (
      select 1 from public.child_parents cp
      where cp.child_id = children.id and cp.user_id = auth.uid()
    )
    and not exists (
      select 1 from public.child_wish_reservations r
      join public.child_wishes cw on cw.id = r.child_wish_id
      where cw.child_id = children.id
    )
  );

-- child_parents: wszyscy widzą; rodzica dodaje i odłącza każdy z rodziców
-- (twórca chroniony triggerem, limit 2 triggerem)
drop policy if exists "child_parents_select_all" on public.child_parents;
create policy "child_parents_select_all" on public.child_parents
  for select to authenticated using (true);

drop policy if exists "child_parents_insert_parent" on public.child_parents;
create policy "child_parents_insert_parent" on public.child_parents
  for insert to authenticated
  with check (
    user_id = auth.uid()
    or exists (
      select 1 from public.child_parents cp
      where cp.child_id = child_parents.child_id and cp.user_id = auth.uid()
    )
  );

drop policy if exists "child_parents_delete_parent" on public.child_parents;
create policy "child_parents_delete_parent" on public.child_parents
  for delete to authenticated
  using (
    user_id = auth.uid()
    or exists (
      select 1 from public.child_parents cp
      where cp.child_id = child_parents.child_id and cp.user_id = auth.uid()
    )
  );

-- child_wishes: wszyscy widzą; zarządzanie tylko rodzicami
drop policy if exists "child_wishes_select_all" on public.child_wishes;
create policy "child_wishes_select_all" on public.child_wishes
  for select to authenticated using (true);

drop policy if exists "child_wishes_insert_parent" on public.child_wishes;
create policy "child_wishes_insert_parent" on public.child_wishes
  for insert to authenticated
  with check (
    exists (
      select 1 from public.child_parents cp
      where cp.child_id = child_wishes.child_id and cp.user_id = auth.uid()
    )
  );

drop policy if exists "child_wishes_update_parent" on public.child_wishes;
create policy "child_wishes_update_parent" on public.child_wishes
  for update to authenticated
  using (
    exists (
      select 1 from public.child_parents cp
      where cp.child_id = child_wishes.child_id and cp.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.child_parents cp
      where cp.child_id = child_wishes.child_id and cp.user_id = auth.uid()
    )
  );

drop policy if exists "child_wishes_delete_parent" on public.child_wishes;
create policy "child_wishes_delete_parent" on public.child_wishes
  for delete to authenticated
  using (
    exists (
      select 1 from public.child_parents cp
      where cp.child_id = child_wishes.child_id and cp.user_id = auth.uid()
    )
  );

-- child_wish_reservations: rezerwuje każdy, anuluje i oznacza kupione
-- tylko rezerwujący; imię rezerwującego ukryte przed obcymi (view niżej)
drop policy if exists "child_wish_reservations_insert_own" on public.child_wish_reservations;
create policy "child_wish_reservations_insert_own" on public.child_wish_reservations
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists "child_wish_reservations_update_own" on public.child_wish_reservations;
create policy "child_wish_reservations_update_own" on public.child_wish_reservations
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists "child_wish_reservations_delete_own" on public.child_wish_reservations;
create policy "child_wish_reservations_delete_own" on public.child_wish_reservations
  for delete to authenticated using (user_id = auth.uid());

-- stan rezerwacji + imię rezerwującego (tylko dla rezerwującego i rodziców
-- dziecka; dla pozostałych null) — security definer, bo RLS na tabelach
-- ukrywa wiersze przed obcymi, a panel musi widzieć statusy wszystkich
create or replace function public.child_reservation_data()
returns table (
  child_wish_id bigint,
  state text,
  is_mine boolean,
  reserver_name text
)
language sql
security definer
set search_path = public
stable
as $$
  select
    r.child_wish_id,
    r.state,
    (r.user_id = auth.uid()) as is_mine,
    case
      when r.user_id = auth.uid()
        or exists (
          select 1
          from public.child_parents cp
          join public.child_wishes cw on cw.child_id = cp.child_id
          where cw.id = r.child_wish_id and cp.user_id = auth.uid()
        )
      then p.full_name
      else null
    end as reserver_name
  from public.child_wish_reservations r
  join public.profiles p on p.id = r.user_id;
$$;

revoke execute on function public.child_reservation_data() from public;
grant execute on function public.child_reservation_data() to authenticated;
