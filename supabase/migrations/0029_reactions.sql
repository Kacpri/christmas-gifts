-- v9.118: reakcje emoji na wiadomościach (wątki losowania, czat wspólny, DM)
-- Tabela na każdy typ wiadomości (osobne FK i kaskadowe usuwanie)

create table if not exists public.message_reactions (
  message_id bigint not null references public.messages(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  emoji text not null check (char_length(emoji) between 1 and 8),
  primary key (message_id, user_id, emoji)
);

create table if not exists public.group_message_reactions (
  message_id bigint not null references public.group_messages(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  emoji text not null check (char_length(emoji) between 1 and 8),
  primary key (message_id, user_id, emoji)
);

create table if not exists public.dm_message_reactions (
  message_id bigint not null references public.dm_messages(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  emoji text not null check (char_length(emoji) between 1 and 8),
  primary key (message_id, user_id, emoji)
);

alter table public.message_reactions enable row level security;
alter table public.group_message_reactions enable row level security;
alter table public.dm_message_reactions enable row level security;

-- Wątki losowania: widać reakcje na wiadomościach wątków, w których się uczestniczy
drop policy if exists "message_reactions_select_member" on public.message_reactions;
create policy "message_reactions_select_member" on public.message_reactions
  for select to authenticated
  using (
    exists (
      select 1 from public.messages m
      where m.id = message_reactions.message_id
        and (m.drawer_id = auth.uid() or m.drawee_id = auth.uid())
    )
  );

drop policy if exists "message_reactions_insert_member" on public.message_reactions;
create policy "message_reactions_insert_member" on public.message_reactions
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.messages m
      where m.id = message_reactions.message_id
        and (m.drawer_id = auth.uid() or m.drawee_id = auth.uid())
    )
  );

drop policy if exists "message_reactions_delete_own" on public.message_reactions;
create policy "message_reactions_delete_own" on public.message_reactions
  for delete to authenticated
  using (user_id = auth.uid());

-- Czat wspólny: widać reakcje, jeśli jest się uczestnikiem losowania
drop policy if exists "group_message_reactions_select_participant" on public.group_message_reactions;
create policy "group_message_reactions_select_participant" on public.group_message_reactions
  for select to authenticated
  using (
    exists (
      select 1 from public.assignments a
      where a.drawer_id = auth.uid() or a.drawee_id = auth.uid()
    )
  );

drop policy if exists "group_message_reactions_insert_participant" on public.group_message_reactions;
create policy "group_message_reactions_insert_participant" on public.group_message_reactions
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.assignments a
      where a.drawer_id = auth.uid() or a.drawee_id = auth.uid()
    )
  );

drop policy if exists "group_message_reactions_delete_own" on public.group_message_reactions;
create policy "group_message_reactions_delete_own" on public.group_message_reactions
  for delete to authenticated
  using (user_id = auth.uid());

-- DM: widać reakcje na wiadomościach, w których się uczestniczy
drop policy if exists "dm_message_reactions_select_member" on public.dm_message_reactions;
create policy "dm_message_reactions_select_member" on public.dm_message_reactions
  for select to authenticated
  using (
    exists (
      select 1 from public.dm_messages m
      where m.id = dm_message_reactions.message_id
        and (m.sender_id = auth.uid() or m.recipient_id = auth.uid())
    )
  );

drop policy if exists "dm_message_reactions_insert_member" on public.dm_message_reactions;
create policy "dm_message_reactions_insert_member" on public.dm_message_reactions
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.dm_messages m
      where m.id = dm_message_reactions.message_id
        and (m.sender_id = auth.uid() or m.recipient_id = auth.uid())
    )
  );

drop policy if exists "dm_message_reactions_delete_own" on public.dm_message_reactions;
create policy "dm_message_reactions_delete_own" on public.dm_message_reactions
  for delete to authenticated
  using (user_id = auth.uid());

-- Realtime: reakcje pojawiają się na żywo
do $$
begin
  alter publication supabase_realtime add table public.message_reactions;
exception
  when duplicate_object then null;
end
$$;

do $$
begin
  alter publication supabase_realtime add table public.group_message_reactions;
exception
  when duplicate_object then null;
end
$$;

do $$
begin
  alter publication supabase_realtime add table public.dm_message_reactions;
exception
  when duplicate_object then null;
end
$$;

-- Toggle reakcji w jednej transakcji; zwraca true, jeśli reakcja została dodana
create or replace function public.toggle_message_reaction(
  p_kind smallint,
  p_message_id bigint,
  p_emoji text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  existed boolean;
begin
  if char_length(p_emoji) not between 1 and 8 then
    raise exception 'Nieprawidłowa reakcja.';
  end if;

  if p_kind = 1 then
    if not exists (
      select 1 from public.messages m
      where m.id = p_message_id
        and (m.drawer_id = auth.uid() or m.drawee_id = auth.uid())
    ) then
      raise exception 'Nie masz dostępu do tej wiadomości.';
    end if;
    select exists (
      select 1 from public.message_reactions r
      where r.message_id = p_message_id
        and r.user_id = auth.uid()
        and r.emoji = p_emoji
    ) into existed;
    if existed then
      delete from public.message_reactions
      where message_id = p_message_id and user_id = auth.uid() and emoji = p_emoji;
    else
      insert into public.message_reactions (message_id, user_id, emoji)
      values (p_message_id, auth.uid(), p_emoji);
    end if;
  elsif p_kind = 2 then
    if not exists (
      select 1 from public.assignments a
      where a.drawer_id = auth.uid() or a.drawee_id = auth.uid()
    ) then
      raise exception 'Nie masz dostępu do tej wiadomości.';
    end if;
    select exists (
      select 1 from public.group_message_reactions r
      where r.message_id = p_message_id
        and r.user_id = auth.uid()
        and r.emoji = p_emoji
    ) into existed;
    if existed then
      delete from public.group_message_reactions
      where message_id = p_message_id and user_id = auth.uid() and emoji = p_emoji;
    else
      insert into public.group_message_reactions (message_id, user_id, emoji)
      values (p_message_id, auth.uid(), p_emoji);
    end if;
  elsif p_kind = 3 then
    if not exists (
      select 1 from public.dm_messages m
      where m.id = p_message_id
        and (m.sender_id = auth.uid() or m.recipient_id = auth.uid())
    ) then
      raise exception 'Nie masz dostępu do tej wiadomości.';
    end if;
    select exists (
      select 1 from public.dm_message_reactions r
      where r.message_id = p_message_id
        and r.user_id = auth.uid()
        and r.emoji = p_emoji
    ) into existed;
    if existed then
      delete from public.dm_message_reactions
      where message_id = p_message_id and user_id = auth.uid() and emoji = p_emoji;
    else
      insert into public.dm_message_reactions (message_id, user_id, emoji)
      values (p_message_id, auth.uid(), p_emoji);
    end if;
  else
    raise exception 'Nieznany typ wiadomości.';
  end if;

  return not existed;
end;
$$;

revoke execute on function public.toggle_message_reaction(smallint, bigint, text) from public;
grant execute on function public.toggle_message_reaction(smallint, bigint, text) to authenticated;
