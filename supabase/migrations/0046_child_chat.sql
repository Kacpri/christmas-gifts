-- v11.24: czat z dzieckiem (użytkownik <-> rodzice dziecka) + tryb rezerwacji
-- Rozmowa: user_id = strona inicjująca (np. rezerwujący), członkowie = user_id
-- + wszyscy rodzice dziecka. Anonimowość jest wyliczana po stronie aplikacji
-- (inicjujący bez nazwanej rezerwacji na tym dziecku = "Anonim" dla rodziców),
-- w bazie zostaje zawsze realny user_id.

-- 1) tryb rezerwacji: z nazwą (domyślnie) lub anonimowo
alter table public.child_wish_reservations
  add column if not exists is_anonymous boolean not null default false;

-- 2) imię rezerwującego: widzi rezerwujący oraz (dla rezerwacji z nazwą)
--    wszyscy; rezerwacja anonimowa ukrywa imię przed pozostałymi
create or replace function public.child_reservation_data()
returns table (
  child_wish_id bigint,
  state text,
  is_mine boolean,
  is_anonymous boolean,
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
    r.is_anonymous,
    case
      when r.user_id = auth.uid() or r.is_anonymous = false
      then p.full_name
      else null
    end as reserver_name
  from public.child_wish_reservations r
  join public.profiles p on p.id = r.user_id;
$$;

revoke execute on function public.child_reservation_data() from public;
grant execute on function public.child_reservation_data() to authenticated;

-- 3) rozmowy: jedna na (użytkownik, dziecko)
create table if not exists public.child_chat_conversations (
  id bigint generated always as identity primary key,
  child_id bigint not null references public.children (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (child_id, user_id)
);

create index if not exists child_chat_conversations_child_idx
  on public.child_chat_conversations (child_id);
create index if not exists child_chat_conversations_user_idx
  on public.child_chat_conversations (user_id);

alter table public.child_chat_conversations enable row level security;

-- widać rozmowy, w których się uczestniczy (inicjujący lub rodzic dziecka)
drop policy if exists "child_chat_conversations_select_member" on public.child_chat_conversations;
create policy "child_chat_conversations_select_member" on public.child_chat_conversations
  for select to authenticated
  using (
    user_id = auth.uid()
    or exists (
      select 1 from public.child_parents cp
      where cp.child_id = child_chat_conversations.child_id
        and cp.user_id = auth.uid()
    )
  );

-- rozmowę tworzy inicjujący; nie może to być rodzic tego dziecka
-- (czat z własnym dzieckiem nie ma sensu — druga strona to on sam)
drop policy if exists "child_chat_conversations_insert_opener" on public.child_chat_conversations;
create policy "child_chat_conversations_insert_opener" on public.child_chat_conversations
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and not exists (
      select 1 from public.child_parents cp
      where cp.child_id = child_chat_conversations.child_id
        and cp.user_id = auth.uid()
    )
  );

-- upsert przy ponownym otwarciu (wzór: anon_dm_conversations, 0040)
drop policy if exists "child_chat_conversations_update_opener" on public.child_chat_conversations;
create policy "child_chat_conversations_update_opener" on public.child_chat_conversations
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create table if not exists public.child_chat_messages (
  id bigint generated always as identity primary key,
  conversation_id bigint not null references public.child_chat_conversations (id) on delete cascade,
  sender_id uuid not null references public.profiles (id) on delete cascade,
  text text not null check (char_length(text) between 0 and 500),
  image_path text,
  image_width integer,
  image_height integer,
  created_at timestamptz not null default now(),
  edited_at timestamptz,
  deleted_at timestamptz
);

create index if not exists child_chat_messages_conversation_idx
  on public.child_chat_messages (conversation_id, created_at);

alter table public.child_chat_messages enable row level security;

-- widać wiadomości rozmów, w których się uczestniczy
drop policy if exists "child_chat_messages_select_member" on public.child_chat_messages;
create policy "child_chat_messages_select_member" on public.child_chat_messages
  for select to authenticated
  using (
    exists (
      select 1 from public.child_chat_conversations c
      where c.id = conversation_id
        and (
          c.user_id = auth.uid()
          or exists (
            select 1 from public.child_parents cp
            where cp.child_id = c.child_id and cp.user_id = auth.uid()
          )
        )
    )
  );

-- pisze uczestnik rozmowy
drop policy if exists "child_chat_messages_insert_member" on public.child_chat_messages;
create policy "child_chat_messages_insert_member" on public.child_chat_messages
  for insert to authenticated
  with check (
    sender_id = auth.uid()
    and exists (
      select 1 from public.child_chat_conversations c
      where c.id = conversation_id
        and (
          c.user_id = auth.uid()
          or exists (
            select 1 from public.child_parents cp
            where cp.child_id = c.child_id and cp.user_id = auth.uid()
          )
        )
    )
  );

-- nadawca edytuje i (miękkie) usuwa własne, nieusunięte
drop policy if exists "child_chat_messages_update_sender" on public.child_chat_messages;
create policy "child_chat_messages_update_sender" on public.child_chat_messages
  for update to authenticated
  using (sender_id = auth.uid() and deleted_at is null)
  with check (sender_id = auth.uid());

create table if not exists public.child_chat_reads (
  user_id uuid not null references public.profiles (id) on delete cascade,
  conversation_id bigint not null references public.child_chat_conversations (id) on delete cascade,
  last_read_at timestamptz not null default now(),
  primary key (user_id, conversation_id)
);

alter table public.child_chat_reads enable row level security;

drop policy if exists "child_chat_reads_select_own" on public.child_chat_reads;
create policy "child_chat_reads_select_own" on public.child_chat_reads
  for select to authenticated using (user_id = auth.uid());

drop policy if exists "child_chat_reads_insert_own" on public.child_chat_reads;
create policy "child_chat_reads_insert_own" on public.child_chat_reads
  for insert to authenticated with check (user_id = auth.uid());

drop policy if exists "child_chat_reads_update_own" on public.child_chat_reads;
create policy "child_chat_reads_update_own" on public.child_chat_reads
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create table if not exists public.child_chat_message_reactions (
  message_id bigint not null references public.child_chat_messages (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  emoji text not null check (char_length(emoji) between 1 and 8),
  primary key (message_id, user_id, emoji)
);

alter table public.child_chat_message_reactions enable row level security;

drop policy if exists "child_chat_reactions_select_member" on public.child_chat_message_reactions;
create policy "child_chat_reactions_select_member" on public.child_chat_message_reactions
  for select to authenticated
  using (
    exists (
      select 1 from public.child_chat_messages m
      join public.child_chat_conversations c on c.id = m.conversation_id
      where m.id = message_id
        and (
          c.user_id = auth.uid()
          or exists (
            select 1 from public.child_parents cp
            where cp.child_id = c.child_id and cp.user_id = auth.uid()
          )
        )
    )
  );

drop policy if exists "child_chat_reactions_insert_member" on public.child_chat_message_reactions;
create policy "child_chat_reactions_insert_member" on public.child_chat_message_reactions
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.child_chat_messages m
      join public.child_chat_conversations c on c.id = m.conversation_id
      where m.id = message_id
        and (
          c.user_id = auth.uid()
          or exists (
            select 1 from public.child_parents cp
            where cp.child_id = c.child_id and cp.user_id = auth.uid()
          )
        )
    )
  );

drop policy if exists "child_chat_reactions_delete_own" on public.child_chat_message_reactions;
create policy "child_chat_reactions_delete_own" on public.child_chat_message_reactions
  for delete to authenticated using (user_id = auth.uid());

-- Realtime: wiadomości i reakcje pojawiają się na żywo
do $$
begin
  alter publication supabase_realtime add table public.child_chat_messages;
exception
  when duplicate_object then null;
end
$$;

do $$
begin
  alter publication supabase_realtime add table public.child_chat_message_reactions;
exception
  when duplicate_object then null;
end
$$;

-- Toggle reakcji w jednej transakcji; zwraca true, jeśli reakcja została dodana
-- (kind 5 = czat z dzieckiem)
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
  elsif p_kind = 5 then
    if not exists (
      select 1 from public.child_chat_messages m
      join public.child_chat_conversations c on c.id = m.conversation_id
      where m.id = p_message_id
        and (
          c.user_id = auth.uid()
          or exists (
            select 1 from public.child_parents cp
            where cp.child_id = c.child_id and cp.user_id = auth.uid()
          )
        )
    ) then
      raise exception 'Nie masz dostępu do tej wiadomości.';
    end if;
    select exists (
      select 1 from public.child_chat_message_reactions r
      where r.message_id = p_message_id
        and r.user_id = auth.uid()
        and r.emoji = p_emoji
    ) into existed;
    if existed then
      delete from public.child_chat_message_reactions
      where message_id = p_message_id and user_id = auth.uid() and emoji = p_emoji;
    else
      insert into public.child_chat_message_reactions (message_id, user_id, emoji)
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
