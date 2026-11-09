-- v11: potrawy — wspólna lista (kto, co, kategoria)

create table if not exists public.dishes (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 120),
  category text not null check (category in ('zupa','przystawka','glowne','dodatek','deser','napoj','inne')),
  created_at timestamptz not null default now()
);

create index if not exists dishes_user_id_idx on public.dishes (user_id);

alter table public.dishes enable row level security;

-- widać wszystkie potrawy (wspólna lista)
drop policy if exists "dishes_select_all" on public.dishes;
create policy "dishes_select_all" on public.dishes
  for select to authenticated using (true);

-- dodaje tylko własne
drop policy if exists "dishes_insert_own" on public.dishes;
create policy "dishes_insert_own" on public.dishes
  for insert to authenticated with check (user_id = auth.uid());

-- edytuje tylko własne
drop policy if exists "dishes_update_own" on public.dishes;
create policy "dishes_update_own" on public.dishes
  for update to authenticated using (user_id = auth.uid());

-- usuwa tylko własne
drop policy if exists "dishes_delete_own" on public.dishes;
create policy "dishes_delete_own" on public.dishes
  for delete to authenticated using (user_id = auth.uid());
