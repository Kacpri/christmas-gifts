-- v11.19: anonimowy czat osobisty (jednostronna anonimowość)
-- Rozmowa: sender_id = strona anonimowa, recipient_id = strona widząca.
-- Odbiorca nigdy nie widzi tożsamości nadawcy anonimowego (aplikacja
-- mapuje go na stały pseudonim "Anonim"; dane serwera nie są
-- renderowane z sender_id po stronie odbiorcy).

create table if not exists public.anon_dm_conversations (
  id bigint generated always as identity primary key,
  sender_id uuid not null references public.profiles (id) on delete cascade,
  recipient_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (sender_id, recipient_id),
  check (sender_id <> recipient_id)
);

create index if not exists anon_dm_conversations_sender_idx
  on public.anon_dm_conversations (sender_id);
create index if not exists anon_dm_conversations_recipient_idx
  on public.anon_dm_conversations (recipient_id);

alter table public.anon_dm_conversations enable row level security;

-- widać rozmowy, w których się uczestniczy
drop policy if exists "anon_dm_conversations_select_member" on public.anon_dm_conversations;
create policy "anon_dm_conversations_select_member" on public.anon_dm_conversations
  for select to authenticated
  using (sender_id = auth.uid() or recipient_id = auth.uid());

-- rozmowę tworzy tylko strona anonimowa
drop policy if exists "anon_dm_conversations_insert_sender" on public.anon_dm_conversations;
create policy "anon_dm_conversations_insert_sender" on public.anon_dm_conversations
  for insert to authenticated
  with check (sender_id = auth.uid() and sender_id <> recipient_id);

create table if not exists public.anon_dm_messages (
  id bigint generated always as identity primary key,
  conversation_id bigint not null references public.anon_dm_conversations (id) on delete cascade,
  sender_id uuid not null references public.profiles (id) on delete cascade,
  text text not null check (char_length(text) between 1 and 500),
  created_at timestamptz not null default now(),
  edited_at timestamptz,
  deleted_at timestamptz
);

create index if not exists anon_dm_messages_conversation_idx
  on public.anon_dm_messages (conversation_id, created_at);

alter table public.anon_dm_messages enable row level security;

-- widać wiadomości rozmów, w których się uczestniczy
drop policy if exists "anon_dm_messages_select_member" on public.anon_dm_messages;
create policy "anon_dm_messages_select_member" on public.anon_dm_messages
  for select to authenticated
  using (
    exists (
      select 1 from public.anon_dm_conversations c
      where c.id = conversation_id
        and (c.sender_id = auth.uid() or c.recipient_id = auth.uid())
    )
  );

-- pisze uczestnik rozmowy (nadawca anonimowy i odbiorca, który odpowiada)
drop policy if exists "anon_dm_messages_insert_member" on public.anon_dm_messages;
create policy "anon_dm_messages_insert_member" on public.anon_dm_messages
  for insert to authenticated
  with check (
    sender_id = auth.uid()
    and exists (
      select 1 from public.anon_dm_conversations c
      where c.id = conversation_id
        and (c.sender_id = auth.uid() or c.recipient_id = auth.uid())
    )
  );

-- nadawca edytuje i (miękkie) usuwa własne, nieusunięte
drop policy if exists "anon_dm_messages_update_sender" on public.anon_dm_messages;
create policy "anon_dm_messages_update_sender" on public.anon_dm_messages
  for update to authenticated
  using (sender_id = auth.uid() and deleted_at is null)
  with check (sender_id = auth.uid());

create table if not exists public.anon_dm_reads (
  user_id uuid not null references public.profiles (id) on delete cascade,
  conversation_id bigint not null references public.anon_dm_conversations (id) on delete cascade,
  last_read_at timestamptz not null default now(),
  primary key (user_id, conversation_id)
);

alter table public.anon_dm_reads enable row level security;

drop policy if exists "anon_dm_reads_select_own" on public.anon_dm_reads;
create policy "anon_dm_reads_select_own" on public.anon_dm_reads
  for select to authenticated using (user_id = auth.uid());

drop policy if exists "anon_dm_reads_insert_own" on public.anon_dm_reads;
create policy "anon_dm_reads_insert_own" on public.anon_dm_reads
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists "anon_dm_reads_update_own" on public.anon_dm_reads;
create policy "anon_dm_reads_update_own" on public.anon_dm_reads
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create table if not exists public.anon_dm_message_reactions (
  message_id bigint not null references public.anon_dm_messages (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  emoji text not null check (char_length(emoji) between 1 and 8),
  primary key (message_id, user_id, emoji)
);

alter table public.anon_dm_message_reactions enable row level security;

drop policy if exists "anon_dm_reactions_select_member" on public.anon_dm_message_reactions;
create policy "anon_dm_reactions_select_member" on public.anon_dm_message_reactions
  for select to authenticated
  using (
    exists (
      select 1 from public.anon_dm_messages m
      join public.anon_dm_conversations c on c.id = m.conversation_id
      where m.id = message_id
        and (c.sender_id = auth.uid() or c.recipient_id = auth.uid())
    )
  );

drop policy if exists "anon_dm_reactions_insert_member" on public.anon_dm_message_reactions;
create policy "anon_dm_reactions_insert_member" on public.anon_dm_message_reactions
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.anon_dm_messages m
      join public.anon_dm_conversations c on c.id = m.conversation_id
      where m.id = message_id
        and (c.sender_id = auth.uid() or c.recipient_id = auth.uid())
    )
  );

drop policy if exists "anon_dm_reactions_delete_own" on public.anon_dm_message_reactions;
create policy "anon_dm_reactions_delete_own" on public.anon_dm_message_reactions
  for delete to authenticated using (user_id = auth.uid());

-- Realtime: wiadomości i reakcje pojawiają się na żywo
do $$
begin
  alter publication supabase_realtime add table public.anon_dm_messages;
exception
  when duplicate_object then null;
end
$$;

do $$
begin
  alter publication supabase_realtime add table public.anon_dm_message_reactions;
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
      select 1 from public.group_messages m
      where m.id = p_message_id
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
  elsif p_kind = 4 then
    if not exists (
      select 1 from public.anon_dm_messages m
      join public.anon_dm_conversations c on c.id = m.conversation_id
      where m.id = p_message_id
        and (c.sender_id = auth.uid() or c.recipient_id = auth.uid())
    ) then
      raise exception 'Nie masz dostępu do tej wiadomości.';
    end if;
    select exists (
      select 1 from public.anon_dm_message_reactions r
      where r.message_id = p_message_id
        and r.user_id = auth.uid()
        and r.emoji = p_emoji
    ) into existed;
    if existed then
      delete from public.anon_dm_message_reactions
      where message_id = p_message_id and user_id = auth.uid() and emoji = p_emoji;
    else
      insert into public.anon_dm_message_reactions (message_id, user_id, emoji)
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
