-- v9.42: polubienia potraw — kto polubił danie

create table if not exists public.dish_likes (
  dish_id bigint not null references public.dishes (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (dish_id, user_id)
);

create index if not exists dish_likes_user_id_idx on public.dish_likes (user_id);

alter table public.dish_likes enable row level security;

-- widać wszystkie polubienia (do liczników)
drop policy if exists "dish_likes_select_all" on public.dish_likes;
create policy "dish_likes_select_all" on public.dish_likes
  for select to authenticated using (true);

-- polubienie tylko własne
drop policy if exists "dish_likes_insert_own" on public.dish_likes;
create policy "dish_likes_insert_own" on public.dish_likes
  for insert to authenticated with check (user_id = auth.uid());

-- odpolubienie tylko własne
drop policy if exists "dish_likes_delete_own" on public.dish_likes;
create policy "dish_likes_delete_own" on public.dish_likes
  for delete to authenticated using (user_id = auth.uid());
